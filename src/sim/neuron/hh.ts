/**
 * The Hodgkin–Huxley membrane, as they wrote it down in 1952, plus the two
 * things the classic model leaves out and this lab cannot do without: the ion
 * concentrations the reversal potentials are made of, and the pump that keeps
 * them there.
 *
 * Everything in this file is per unit area of membrane, in the units Hodgkin
 * and Huxley used: millivolts, milliseconds, mS/cm², µA/cm², µF/cm². Voltages
 * are absolute (rest near −65 mV), not shifted to zero as in the 1952 paper.
 *
 * **What is deliberately not here.** There is no parameter called threshold —
 * the cell fires when the sodium loop runs away, and where that happens is
 * something to measure, not to type. There is no refractory timer — the pause
 * after a spike is sodium inactivation (`h`) recovering slowly, and the
 * "recovery" control below scales *that*. Both are acceptance tests in
 * `cell.test.ts`.
 */

/** Rate functions of the 1952 model in absolute millivolts. */
export function alphaM(v: number): number {
  const x = v + 40
  return Math.abs(x) < 1e-6 ? 1 : (0.1 * x) / (1 - Math.exp(-x / 10))
}
export function betaM(v: number): number {
  return 4 * Math.exp(-(v + 65) / 18)
}
export function alphaH(v: number): number {
  return 0.07 * Math.exp(-(v + 65) / 20)
}
export function betaH(v: number): number {
  return 1 / (1 + Math.exp(-(v + 35) / 10))
}
export function alphaN(v: number): number {
  const x = v + 55
  return Math.abs(x) < 1e-6 ? 0.1 : (0.01 * x) / (1 - Math.exp(-x / 10))
}
export function betaN(v: number): number {
  return 0.125 * Math.exp(-(v + 65) / 80)
}

/**
 * RT/F at the temperature Hodgkin and Huxley worked at, 6.3 °C, in millivolts.
 * The Nernst equation is E = (RT/F) · ln(outside / inside) for a monovalent
 * cation, so this one number turns a concentration ratio into a voltage.
 */
export const RT_OVER_F_MV = 24.08

/** Extracellular concentrations, held fixed: seawater around a squid axon. */
export const NA_OUT_MM = 440
export const K_OUT_MM = 20

/** The reversal potentials the 1952 fit implies, used to seed the inside. */
export const E_NA_REST_MV = 50
export const E_K_REST_MV = -77

/** Intracellular concentrations that give exactly the classic reversals. */
export const NA_IN_REST_MM = NA_OUT_MM / Math.exp(E_NA_REST_MV / RT_OVER_F_MV)
export const K_IN_REST_MM = K_OUT_MM * Math.exp(-E_K_REST_MV / RT_OVER_F_MV)

export function nernst(outside: number, inside: number): number {
  return RT_OVER_F_MV * Math.log(outside / inside)
}

/**
 * Charge carried by one micro-amp-second, in elementary charges, so a current
 * density integrated over an area and a time becomes a count of ions — and a
 * pump current becomes a count of ATP molecules spent.
 */
export const CHARGES_PER_UA_MS = 1e-6 * 1e-3 / 1.602176634e-19

/**
 * Lookup tables for the gating kinetics at one fixed step, so the inner loop
 * pays two array reads per gate instead of four exponentials.
 *
 * Each gate x relaxes toward x∞(V) with time constant τ(V); over a fixed step
 * the exact solution is x ← x∞ + (x − x∞)·exp(−dt/τ). That update is the
 * *exponential Euler* scheme, and it is unconditionally stable, which is what
 * lets the step be a quarter of a millisecond-ish rather than far smaller.
 *
 * `phi` is the Q10 temperature factor on all rates (1 = 6.3 °C, the 1952
 * fit). `hRecovery` speeds up the h kinetics — how fast sodium channels
 * *leave* inactivation — and only at voltages below about −45 mV, where a
 * cell that has just fired is on its way back to rest. Confining it there is
 * what makes the control mean what its label says. Three other versions were
 * measured and rejected: scaling α_h everywhere shifts the steady-state
 * inactivation curve so that channels never shut during a spike and the cell
 * sits in a depolarised plateau (rate zero at every drive with a uniform
 * ×20); scaling α_h alone below −45 mV raises h∞ at rest and makes the cell
 * fire at inputs the healthy one ignores, so the *lower* flat region moved
 * as well as the upper one; and scaling both rates everywhere makes channels
 * inactivate faster on the upstroke and abolishes the spike.
 */
export class GateTables {
  static readonly V_MIN = -150
  static readonly V_MAX = 100
  static readonly STEP_MV = 0.05
  readonly n: number
  readonly mInf: Float64Array
  readonly mDecay: Float64Array
  readonly hInf: Float64Array
  readonly hDecay: Float64Array
  readonly nInf: Float64Array
  readonly nDecay: Float64Array
  readonly dt: number
  readonly phi: number

  constructor(dt: number, phi: number, hRecovery: number) {
    this.dt = dt
    this.phi = phi
    this.n = Math.round((GateTables.V_MAX - GateTables.V_MIN) / GateTables.STEP_MV) + 1
    this.mInf = new Float64Array(this.n)
    this.mDecay = new Float64Array(this.n)
    this.hInf = new Float64Array(this.n)
    this.hDecay = new Float64Array(this.n)
    this.nInf = new Float64Array(this.n)
    this.nDecay = new Float64Array(this.n)
    for (let i = 0; i < this.n; i++) {
      const v = GateTables.V_MIN + i * GateTables.STEP_MV
      const am = alphaM(v) * phi
      const bm = betaM(v) * phi
      this.mInf[i] = am / (am + bm)
      this.mDecay[i] = Math.exp(-dt * (am + bm))
      const an = alphaN(v) * phi
      const bn = betaN(v) * phi
      this.nInf[i] = an / (an + bn)
      this.nDecay[i] = Math.exp(-dt * (an + bn))
    }
    this.setHRecovery(hRecovery)
  }

  /** Rebuild only the h tables; the m and n kinetics are untouched. */
  setHRecovery(hRecovery: number): void {
    for (let i = 0; i < this.n; i++) {
      const v = GateTables.V_MIN + i * GateTables.STEP_MV
      const boost = 1 + (hRecovery - 1) * recoveryRegion(v)
      const ah = alphaH(v) * this.phi * boost
      const bh = betaH(v) * this.phi
      this.hInf[i] = ah / (ah + bh)
      this.hDecay[i] = Math.exp(-this.dt * (ah + bh))
    }
  }

  /** Table index for a voltage, clamped to the table's range. */
  index(v: number): number {
    let i = Math.round((v - GateTables.V_MIN) / GateTables.STEP_MV)
    if (i < 0) i = 0
    else if (i >= this.n) i = this.n - 1
    return i
  }
}

/**
 * 1 below about −45 mV, 0 above: where a cell that has just fired is on its
 * way back to rest, and where the boost to α_h applies.
 *
 * Measured before settling here. A boost confined to the after-spike
 * undershoot (below −70 mV) leaves h∞ at rest untouched, which is tidier, but
 * it barely moves the ceiling (242 → 250 spikes/s at ×50) and never lets a
 * spike reflect, because in this model the pause after a spike is held as
 * much by the potassium gate as by sodium inactivation. Centred at −45 mV the
 * same boost also raises h∞ between rest and threshold — more sodium channels
 * available sooner — and that is what doubles the ceiling (242 → 484) and
 * sends spikes back up the axon. The price is a cell somewhat more excitable
 * near rest, which the tests record. Centred higher still (−42 mV) the boost
 * reaches the upstroke and the cell stalls in a plateau.
 */
export function recoveryRegion(v: number): number {
  return 1 / (1 + Math.exp((v + RECOVERY_CENTRE_MV) / 2.5))
}
export const RECOVERY_CENTRE_MV = 45

/**
 * Sodium–potassium pump turnover as a function of the sodium inside the cell.
 *
 * A Hill function in intracellular sodium, cubed because three sodium ions bind
 * per cycle. `kmNa` is the sodium level at which the pump runs at half its
 * maximum. Returned as the *net charge* the pump moves out per unit time and
 * area (µA/cm²): three sodium out and two potassium in is one positive charge
 * out per cycle, so this number is also the cycle rate in charge units, and
 * one cycle is one ATP.
 */
export function pumpRate(
  naIn: number,
  pumpPower: number,
  jMax: number,
  kmNa: number,
): number {
  const a = naIn * naIn * naIn
  const k = kmNa * kmNa * kmNa
  return (pumpPower * jMax * a) / (a + k)
}
