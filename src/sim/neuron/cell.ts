import type { Rng } from '../random'
import {
  GateTables,
  CHARGES_PER_UA_MS,
  K_IN_REST_MM,
  K_OUT_MM,
  NA_IN_REST_MM,
  NA_OUT_MM,
  E_K_REST_MV,
  E_NA_REST_MV,
  alphaH,
  alphaM,
  alphaN,
  betaH,
  betaM,
  betaN,
  nernst,
  pumpRate,
} from './hh'

/**
 * One neuron: a Hodgkin–Huxley soma, an axon made of Hodgkin–Huxley patches
 * joined end to end, three rate-coded inputs plus a baseline arriving at the
 * soma, and — in every patch — the sodium and potassium concentrations and
 * the pump that classic Hodgkin–Huxley does without.
 *
 * This object is the whole of the scene's neuron. The World, Unit and Membrane
 * tabs are three readouts of it and nothing else simulates a cell; the tests in
 * `cell.test.ts` are the acceptance tests of `m03_neuron_SCENE_SPEC.md` §10.
 */

export interface CellParams {
  /** Peak sodium conductance, mS/cm² (120 in the 1952 fit). */
  gNa: number
  /** Peak potassium conductance, mS/cm² (36). */
  gK: number
  /**
   * The 1952 leak (0.3 mS/cm², non-specific) split into a sodium part and a
   * potassium part, so that the ions crossing at rest can be counted and
   * pumped back. Together they sum to the classic 0.3; the split is chosen so
   * that with the pump at its resting rate the classic −65 mV rest is an exact
   * steady state of both voltage *and* concentration — see `restingBalance`.
   */
  gLNa: number
  gLK: number
  /** Membrane capacitance, µF/cm². */
  cm: number
  /** Fraction of voltage-gated sodium channels blocked, 0–1. A lesion control. */
  naBlock: number
  /** Pump power, 0–1 of normal. A lesion control. */
  pumpPower: number
  /**
   * Multiplier on the rate at which sodium channels recover from inactivation
   * (α_h). 1 is the 1952 value; large values are the "instant" end of the
   * recovery control. This is the only thing the refractory period is made of.
   */
  hRecovery: number
  /** Steady current injected into the soma, µA/cm². A lesion control. */
  iInject: number
  /** Q10 factor on all gating rates; 1 is the 6.3 °C of the 1952 fit. */
  temperatureFactor: number
  /**
   * Pump maximum, µA/cm² of net charge, and the intracellular sodium at which
   * it runs at half that. Derived from the resting balance so that the healthy
   * cell's pump has `PUMP_HEADROOM` times its resting rate in reserve.
   */
  pumpJMax: number
  pumpKmNa: number
  /**
   * How fast a current changes a concentration: mM per ms per µA/cm². A real
   * cell of this size would be `CONCENTRATION_RATE_TRUE`; the shipped value
   * is that times `RUNDOWN_SPEEDUP`, so that gradient rundown after a pump
   * block is watchable in a simulated minute instead of many. The panel says
   * so — a model that quietly lies about a time constant would make Q28
   * ridiculous.
   */
  concentrationRate: number
  /**
   * Charge one input spike of unit weight delivers to the soma, µC/cm², and
   * the time constant over which it arrives. Together with the weights and
   * rates these set the mean drive: a total of T unit-events per second is a
   * mean current of `synapseQ × T` µA/cm².
   */
  synapseQ: number
  synapseTau: number
  /**
   * How many presynaptic events one input spike stands for. An input "at 10
   * spikes per second" is a line, not a fibre: it delivers `fanIn × 10` events
   * a second, each carrying `synapseQ / fanIn` of charge. The mean drive is
   * the same whatever the fan-in; what changes is how lumpy it is, and that
   * is what decides whether inhibition subtracts (integration) or merely
   * skips the odd excitatory event (relay).
   */
  synapseFanIn: number
  /** Things-to-try extra: myelin on the axon. Built last; see the spec §2.3. */
  myelin: boolean
}

export interface AxonGeometry {
  /** Number of patches the axon is cut into. */
  compartments: number
  /** Length of the simulated stretch of axon, mm. */
  lengthMm: number
  /** Fibre diameter, µm. Conduction velocity grows with its square root. */
  diameterUm: number
  /** Axoplasm resistivity, Ω·cm. */
  riOhmCm: number
  /** Soma radius, µm — only its membrane area matters here. */
  somaRadiusUm: number
  /** Myelin: a bare node every this many patches; the rest are wrapped. */
  nodeEvery: number
  /** Myelin: capacitance of a wrapped patch relative to bare membrane. */
  myelinCmScale: number
  /**
   * Myelin: capacitance of a node patch relative to bare membrane. A real node
   * is a micron or two of bare membrane with a very high channel density; a
   * patch here is 150 µm long, so a node patch keeps a full patch's worth of
   * channels but only a fraction of its capacitance — a short node with dense
   * channels, smeared over the patch.
   */
  nodeCmScale: number
  /** Myelin: channel and leak density of a wrapped patch relative to bare. */
  myelinGScale: number
}

/** Rate-coded input: three inputs and a baseline, per the reading's §3.2.8. */
export interface UnitInput {
  /** Baseline b₀, spikes per second (may be negative). */
  b0: number
  /** Connection strengths b₁, b₂, b₃ — the reading's weights. */
  b: [number, number, number]
  /** Input rates x₁, x₂, x₃, spikes per second. */
  x: [number, number, number]
}

/**
 * The classic resting balance. At −65 mV the 1952 conductances pass a small
 * inward sodium current and a larger outward potassium current, and the leak
 * makes up the difference. Splitting the leak into sodium and potassium parts
 * and adding an electrogenic pump gives three unknowns — gLNa, gLK and the
 * pump rate J — and three conditions: sodium in balances 3J out, potassium out
 * balances 2J in, and the two leak parts sum to the classic 0.3. Solving them
 * makes −65 mV, and the concentrations behind E_Na = 50 and E_K = −77, a true
 * fixed point of the whole system.
 */
export function restingBalance(
  gNa = 120,
  gK = 36,
  gLTotal = 0.3,
  vRest = -65,
): { gLNa: number; gLK: number; jRest: number } {
  const mInf = alphaM(vRest) / (alphaM(vRest) + betaM(vRest))
  const hInf = alphaH(vRest) / (alphaH(vRest) + betaH(vRest))
  const nInf = alphaN(vRest) / (alphaN(vRest) + betaN(vRest))
  const dNa = vRest - E_NA_REST_MV // negative: inward driving force
  const dK = vRest - E_K_REST_MV // positive: outward
  const iNa = gNa * mInf ** 3 * hInf * dNa
  const iK = gK * nInf ** 4 * dK
  // iNa + gLNa·dNa = −3J ;  iK + gLK·dK = 2J ;  gLNa + gLK = gLTotal
  // ⇒ with gLNa = gLTotal − gLK:
  //   J = −(iNa + (gLTotal − gLK)·dNa) / 3 = (iK + gLK·dK) / 2
  //   ⇒ −2·iNa − 2·gLTotal·dNa + 2·gLK·dNa = 3·iK + 3·gLK·dK
  //   ⇒ gLK·(2·dNa − 3·dK) = 3·iK + 2·iNa + 2·gLTotal·dNa
  const gLK = (3 * iK + 2 * iNa + 2 * gLTotal * dNa) / (2 * dNa - 3 * dK)
  const gLNa = gLTotal - gLK
  const jRest = (iK + gLK * dK) / 2
  return { gLNa, gLK, jRest }
}

/** Pump reserve: its maximum is this many times its resting rate. */
export const PUMP_HEADROOM = 10

/**
 * mM per ms per µA/cm² for a cylinder 4 µm across — the axon's own geometry.
 * (1 µA/cm² is 1e-6/F mol per second per cm², and a 4 µm fibre has 10⁴ cm⁻¹
 * of surface per volume.)
 */
export const CONCENTRATION_RATE_TRUE = (1e-6 / 96485) * 1e4 * 1e3 /* mol→mM, s→ms */
/**
 * How much faster than a 4 µm fibre the gradients are allowed to run down.
 *
 * Settled at 1 — the true rate for the axon — after measuring the alternative.
 * At 2 or more the pump-off collapse Q10 asks for is dramatic within a minute,
 * but the same constant governs how fast the cell settles under a sustained
 * load, and at 2 the pump's own current had hyperpolarised a driven cell and
 * halved its rate within fifteen seconds of a slider move — so what a student
 * read off the panel depended on how quickly they read it. At 1 the pump-off
 * cell still loses half its spike height inside a simulated minute, and a
 * driven cell drifts over half a minute rather than a few seconds. The panel
 * still says which cell this rate belongs to: a cell body would be several
 * times slower.
 */
export const RUNDOWN_SPEEDUP = 1

const BALANCE = restingBalance()

export const HEALTHY_CELL: CellParams = {
  gNa: 120,
  gK: 36,
  gLNa: BALANCE.gLNa,
  gLK: BALANCE.gLK,
  cm: 1,
  naBlock: 0,
  pumpPower: 1,
  hRecovery: 1,
  iInject: 0,
  temperatureFactor: 2,
  pumpJMax: BALANCE.jRest * PUMP_HEADROOM,
  pumpKmNa: NA_IN_REST_MM * Math.cbrt(PUMP_HEADROOM - 1),
  concentrationRate: CONCENTRATION_RATE_TRUE * RUNDOWN_SPEEDUP,
  synapseQ: 0.17,
  synapseTau: 50,
  synapseFanIn: 1,
  myelin: false,
}

export const DEFAULT_AXON: AxonGeometry = {
  compartments: 40,
  lengthMm: 6,
  diameterUm: 4,
  riOhmCm: 100,
  somaRadiusUm: 10,
  nodeEvery: 8,
  myelinCmScale: 0.005,
  nodeCmScale: 0.02,
  myelinGScale: 0.01,
}

/** Fewer patches for the same axon, used while the Membrane tab is hidden. */
export const REDUCED_COMPARTMENTS = 10

/** The fixed integration step, ms. */
export const DT_MS = 0.025

/** Upward crossing of this voltage counts as a spike. */
export const SPIKE_CROSSING_MV = -20

/** Seconds of spike history kept, for rates and the raster. */
const HISTORY_MS = 5000
/** The voltage trace is sampled this often. */
export const TRACE_SAMPLE_MS = 0.1
const TRACE_LEN = 4000 // 400 ms

/** Window after a spike over which its sodium entry is charged to it. */
const SPIKE_NA_WINDOW_MS = 6

export interface CellReadout {
  time: number
  vSoma: number
  vFar: number
  m: number
  h: number
  n: number
  naIn: number
  kIn: number
  eNa: number
  eK: number
  iNa: number
  iK: number
  iPump: number
  iSyn: number
  atpPerSecond: number
  atpPerSpike: number
  conductionVelocity: number | null
}

export class NeuronCell {
  params: CellParams
  axon: AxonGeometry
  time = 0
  /** Soma spike times, ms, oldest first; trimmed to `HISTORY_MS`. */
  spikes: number[] = []
  /** Far-end spike times, ms. */
  farSpikes: number[] = []
  /** Peak voltage and amplitude (peak − preceding trough) of each soma spike. */
  spikeAmplitudes: number[] = []
  /** Cumulative ATP molecules spent by every pump in the cell. */
  atpTotal = 0
  /** Last measured conduction velocity, m/s; null until a spike has run. */
  conductionVelocity: number | null = null
  /** Rolling soma and far-end voltage, sampled every `TRACE_SAMPLE_MS`. */
  traceV: Float32Array
  traceFar: Float32Array
  traceHead = 0
  traceCount = 0
  input: UnitInput = { b0: 0, b: [0, 0, 0], x: [0, 0, 0] }

  // Per-compartment state: index 0 is the soma, 1..N the axon.
  v!: Float64Array
  m!: Float64Array
  h!: Float64Array
  n!: Float64Array
  naIn!: Float64Array
  kIn!: Float64Array
  private area!: Float64Array
  private cmScale!: Float64Array
  private gScale!: Float64Array
  private gAx = 0
  private count = 0
  // Working arrays for the tridiagonal solve and current bookkeeping.
  private lower!: Float64Array
  private diag!: Float64Array
  private upper!: Float64Array
  private rhs!: Float64Array
  private iNa!: Float64Array
  private iK!: Float64Array
  private jPump!: Float64Array
  private peak!: Float64Array
  private trough!: Float64Array
  private above!: Uint8Array
  private naInflux!: Float64Array // cumulative sodium charges entered, per patch
  private spikeStart!: Float64Array
  private spikeNa0!: Float64Array
  private preRate!: Float64Array
  private naPerSpike!: Float64Array
  private lastSpike!: Float64Array
  private lastRateMark!: Float64Array
  private lastRateNa!: Float64Array
  private tables: GateTables
  /**
   * Synaptic current at the soma, µA/cm², kept as two pools because they are
   * two ions. Excitatory events let sodium in (`synE` ≥ 0) and inhibitory
   * events let potassium out (`synI` ≤ 0), and both are booked against the
   * concentrations so that the pump has to clear what the inputs let through.
   * Without this the drive is charge from nowhere, and the cell expels it as
   * potassium — measured: a cell driven at 60 events/s lost a third of its
   * potassium in a minute for no physical reason.
   */
  private synE = 0
  private synI = 0
  private lastIPump = 0
  private lastINa = 0
  private lastIK = 0
  private traceAcc = 0
  private velA = 0
  private velB = 0
  private velTA = -1
  private rng: Rng

  constructor(rng: Rng, params: Partial<CellParams> = {}, axon: Partial<AxonGeometry> = {}) {
    this.rng = rng
    this.params = { ...HEALTHY_CELL, ...params }
    this.axon = { ...DEFAULT_AXON, ...axon }
    this.tables = new GateTables(
      DT_MS,
      this.params.temperatureFactor,
      this.params.hRecovery,
    )
    this.traceV = new Float32Array(TRACE_LEN)
    this.traceFar = new Float32Array(TRACE_LEN)
    this.allocate(this.axon.compartments)
    this.resetState()
  }

  /** Number of axon patches currently simulated. */
  get compartments(): number {
    return this.count - 1
  }

  private allocate(n: number): void {
    const total = n + 1
    this.count = total
    this.v = new Float64Array(total)
    this.m = new Float64Array(total)
    this.h = new Float64Array(total)
    this.n = new Float64Array(total)
    this.naIn = new Float64Array(total)
    this.kIn = new Float64Array(total)
    this.area = new Float64Array(total)
    this.cmScale = new Float64Array(total)
    this.gScale = new Float64Array(total)
    this.lower = new Float64Array(total)
    this.diag = new Float64Array(total)
    this.upper = new Float64Array(total)
    this.rhs = new Float64Array(total)
    this.iNa = new Float64Array(total)
    this.iK = new Float64Array(total)
    this.jPump = new Float64Array(total)
    this.peak = new Float64Array(total)
    this.trough = new Float64Array(total)
    this.above = new Uint8Array(total)
    this.naInflux = new Float64Array(total)
    this.spikeStart = new Float64Array(total).fill(-1)
    this.spikeNa0 = new Float64Array(total)
    this.preRate = new Float64Array(total)
    this.naPerSpike = new Float64Array(total)
    this.lastSpike = new Float64Array(total).fill(-Infinity)
    this.lastRateMark = new Float64Array(total)
    this.lastRateNa = new Float64Array(total)
    this.geometry()
  }

  /** Areas, axial coupling and the myelin pattern for the current patch count. */
  private geometry(): void {
    const a = this.axon
    const n = this.count - 1
    const lenCm = a.lengthMm / 10 / n
    const dCm = a.diameterUm * 1e-4
    // Axial conductance between neighbouring patches, per unit membrane area
    // of a patch: g = d / (4·Ri·L²). Shorter patches couple more tightly.
    this.gAx = (dCm / (4 * a.riOhmCm * lenCm * lenCm)) * 1e3 // S/cm² → mS/cm²
    const somaR = a.somaRadiusUm * 1e-4
    this.area[0] = 4 * Math.PI * somaR * somaR
    this.cmScale[0] = 1
    this.gScale[0] = 1
    const patchArea = Math.PI * dCm * lenCm
    for (let i = 1; i <= n; i++) {
      this.area[i] = patchArea
      const wrapped = this.params.myelin && (i - 1) % a.nodeEvery !== 0
      const node = this.params.myelin && !wrapped
      this.cmScale[i] = wrapped ? a.myelinCmScale : node ? a.nodeCmScale : 1
      this.gScale[i] = wrapped ? a.myelinGScale : 1
    }
    this.velA = 1 + Math.round(n * 0.25)
    this.velB = 1 + Math.round(n * 0.75)
    this.velTA = -1
  }

  /** Put every patch at the classic rest, with the concentrations behind it. */
  resetState(): void {
    const vRest = -65
    const t = this.tables
    const idx = t.index(vRest)
    for (let i = 0; i < this.count; i++) {
      this.v[i] = vRest
      this.m[i] = t.mInf[idx]
      this.h[i] = t.hInf[idx]
      this.n[i] = t.nInf[idx]
      this.naIn[i] = NA_IN_REST_MM
      this.kIn[i] = K_IN_REST_MM
      this.peak[i] = vRest
      this.trough[i] = vRest
      this.above[i] = 0
    }
    this.synE = 0
    this.synI = 0
    this.spikes = []
    this.farSpikes = []
    this.spikeAmplitudes = []
    this.time = 0
    this.atpTotal = 0
    this.conductionVelocity = null
    this.traceHead = 0
    this.traceCount = 0
    this.traceAcc = 0
    this.velTA = -1
    this.naInflux.fill(0)
    this.spikeStart.fill(-1)
    this.naPerSpike.fill(0)
    this.lastSpike.fill(-Infinity)
    this.lastRateMark.fill(0)
    this.lastRateNa.fill(0)
  }

  /** Change parameters mid-run. Concentrations and gates carry on as they are. */
  setParams(patch: Partial<CellParams>): void {
    const before = this.params
    this.params = { ...before, ...patch }
    if (
      patch.hRecovery !== undefined &&
      patch.hRecovery !== before.hRecovery
    ) {
      this.tables.setHRecovery(this.params.hRecovery)
    }
    if (
      patch.temperatureFactor !== undefined &&
      patch.temperatureFactor !== before.temperatureFactor
    ) {
      this.tables = new GateTables(DT_MS, this.params.temperatureFactor, this.params.hRecovery)
    }
    if (patch.myelin !== undefined && patch.myelin !== before.myelin) {
      this.geometry()
    }
  }

  /**
   * Re-cut the axon into a different number of patches, carrying the profile
   * across by interpolation so nothing on screen jumps. Used to run the axon
   * coarsely while the Membrane tab is hidden — and `cell.test.ts` checks that
   * doing so leaves the vehicle's behaviour alone.
   */
  setCompartments(n: number): void {
    if (n === this.count - 1) return
    const old = {
      count: this.count,
      v: this.v, m: this.m, h: this.h, n: this.n, naIn: this.naIn, kIn: this.kIn,
    }
    this.allocate(n)
    const sample = (arr: Float64Array, i: number) => {
      // Position of new axon patch i (1..n) along the old axon (1..oldN).
      const oldN = old.count - 1
      const pos = 1 + ((i - 1) * (oldN - 1)) / Math.max(1, n - 1)
      const lo = Math.floor(pos)
      const hi = Math.min(oldN, lo + 1)
      const f = pos - lo
      return arr[lo] * (1 - f) + arr[hi] * f
    }
    this.v[0] = old.v[0]; this.m[0] = old.m[0]; this.h[0] = old.h[0]; this.n[0] = old.n[0]
    this.naIn[0] = old.naIn[0]; this.kIn[0] = old.kIn[0]
    for (let i = 1; i <= n; i++) {
      this.v[i] = sample(old.v, i)
      this.m[i] = sample(old.m, i)
      this.h[i] = sample(old.h, i)
      this.n[i] = sample(old.n, i)
      this.naIn[i] = sample(old.naIn, i)
      this.kIn[i] = sample(old.kIn, i)
      this.peak[i] = this.v[i]
      this.trough[i] = this.v[i]
      this.above[i] = this.v[i] > SPIKE_CROSSING_MV ? 1 : 0
    }
  }

  /** The three weights and rates the soma is being driven by. */
  setInput(input: UnitInput): void {
    this.input = input
  }

  /** The reading's arithmetic: b₀ + Σ bᵢxᵢ, before any floor or ceiling. */
  linearTotal(): number {
    const { b0, b, x } = this.input
    return b0 + b[0] * x[0] + b[1] * x[1] + b[2] * x[2]
  }

  /** Soma spikes in the last `windowMs`. */
  spikesInWindow(windowMs: number): number {
    const from = this.time - windowMs
    let k = 0
    for (let i = this.spikes.length - 1; i >= 0 && this.spikes[i] >= from; i--) k++
    return k
  }

  /** Output rate in spikes per second, measured over the last second. */
  outputRate(windowMs = 1000): number {
    return (this.spikesInWindow(windowMs) * 1000) / windowMs
  }

  /** Pump turnover across the whole cell right now, ATP molecules per second. */
  atpPerSecond(): number {
    let sum = 0
    for (let i = 0; i < this.count; i++) sum += this.jPump[i] * this.area[i]
    return sum * CHARGES_PER_UA_MS * 1e3
  }

  /**
   * ATP one spike commits the pump to: the sodium that spike let in across
   * every patch that fired with it, divided by the three sodium the pump
   * carries out per ATP. Measured per patch from the last spike that reached
   * it; a patch the spike no longer reaches (a blocked axon) contributes
   * nothing, because it let nothing in.
   */
  atpPerSpike(): number {
    const recent = this.lastSpike[0] - 50
    let na = 0
    for (let i = 0; i < this.count; i++) {
      if (this.lastSpike[i] >= recent) na += this.naPerSpike[i]
    }
    return na / 3
  }

  /** A single-spike stimulus: a brief current pulse into the soma. */
  private pulseUntil = -1
  private pulseAmp = 0
  pulse(amplitude: number, durationMs: number): void {
    this.pulseAmp = amplitude
    this.pulseUntil = this.time + durationMs
  }

  /** Voltage profile along the axon, soma first. */
  profile(): Float64Array {
    return this.v
  }

  /** Whether axon patch i (1-based) is wrapped in myelin. */
  isWrapped(i: number): boolean {
    return this.params.myelin && (i - 1) % this.axon.nodeEvery !== 0
  }

  readout(): CellReadout {
    return {
      time: this.time,
      vSoma: this.v[0],
      vFar: this.v[this.count - 1],
      m: this.m[0],
      h: this.h[0],
      n: this.n[0],
      naIn: this.naIn[0],
      kIn: this.kIn[0],
      eNa: nernst(NA_OUT_MM, this.naIn[0]),
      eK: nernst(K_OUT_MM, this.kIn[0]),
      iNa: this.lastINa,
      iK: this.lastIK,
      iPump: this.lastIPump,
      iSyn: this.synE + this.synI,
      atpPerSecond: this.atpPerSecond(),
      atpPerSpike: this.atpPerSpike(),
      conductionVelocity: this.conductionVelocity,
    }
  }

  /** Advance by `ms` of simulated time in fixed steps. */
  advance(ms: number): void {
    const steps = Math.max(1, Math.round(ms / DT_MS))
    for (let s = 0; s < steps; s++) this.step()
  }

  private step(): void {
    const p = this.params
    const t = this.tables
    const dt = DT_MS
    const N = this.count
    const naOut = NA_OUT_MM
    const kOut = K_OUT_MM

    // Synaptic events. Each input is a Poisson train at its rate, and a
    // connection's strength is how many unit events each input spike sets
    // off: a strength of 2 delivers two unit charges per input spike, a
    // strength of −3 three negative ones. So the arithmetic on the Unit panel
    // — rate × strength — is literally the event rate arriving at the soma,
    // and a strong sparse input and a weak dense one with the same product
    // drive the cell alike. (Measured the other way, with strength as event
    // *size*, the reading's example came out 29 → 23 → 18 instead of 25 → 10
    // → 0: three big inhibitory events a second cannot cancel twenty small
    // excitatory ones, however the averages compare.) Drawn from the run's
    // one stream.
    const { b0, b, x } = this.input
    const fan = p.synapseFanIn
    const rates = [Math.abs(b0), x[0] * Math.abs(b[0]), x[1] * Math.abs(b[1]), x[2] * Math.abs(b[2])]
    const signs = [Math.sign(b0), Math.sign(b[0]), Math.sign(b[1]), Math.sign(b[2])]
    // Q is µC/cm², τ is ms, and the current unit is µA/cm² = µC/(cm²·s).
    const kick = (p.synapseQ * 1000) / (p.synapseTau * fan)
    for (let i = 0; i < 4; i++) {
      const r = rates[i] * fan
      if (r <= 0) continue
      if (this.rng.next() < (r * dt) / 1000) {
        if (signs[i] > 0) this.synE += kick
        else this.synI -= kick
      }
    }
    const synDecay = Math.exp(-dt / p.synapseTau)
    this.synE *= synDecay
    this.synI *= synDecay

    let iExt = this.synE + this.synI + p.iInject
    if (this.time < this.pulseUntil) iExt += this.pulseAmp

    // Build the implicit system. Voltage is solved backward-Euler with the
    // conductances frozen over the step; the axon patches form a tridiagonal
    // chain, and the soma drives the first patch without being loaded by it.
    const gNaOpen = p.gNa * (1 - p.naBlock)
    for (let i = 0; i < N; i++) {
      const vi = this.v[i]
      const gs = this.gScale[i]
      const mm = this.m[i]
      const gNaEff = gs * (gNaOpen * mm * mm * mm * this.h[i] + p.gLNa)
      const nn = this.n[i]
      const nn2 = nn * nn
      const gKEff = gs * (p.gK * nn2 * nn2 + p.gLK)
      const eNa = nernst(naOut, this.naIn[i])
      const eK = nernst(kOut, this.kIn[i])
      // Pumps sit in the membrane like channels do, so a wrapped patch has
      // proportionally fewer of them.
      const j = gs * pumpRate(this.naIn[i], p.pumpPower, p.pumpJMax, p.pumpKmNa)
      this.jPump[i] = j
      const c = p.cm * this.cmScale[i]
      const cdt = c / dt
      let g = gNaEff + gKEff
      let src = gNaEff * eNa + gKEff * eK - j
      if (i === 0) {
        src += iExt
      } else {
        // Axial coupling: to the previous patch (or the soma, explicitly) and
        // to the next one.
        const ga = this.gAx
        if (i === 1) {
          src += ga * this.v[0]
          g += ga
        } else {
          this.lower[i] = -ga
          g += ga
        }
        if (i < N - 1) {
          this.upper[i] = -ga
          g += ga
        }
      }
      this.diag[i] = cdt + g
      this.rhs[i] = cdt * vi + src
      // Stash the frozen conductances for the current bookkeeping below.
      this.iNa[i] = gNaEff
      this.iK[i] = gKEff
    }

    // Soma: a single implicit equation.
    const vSomaNew = this.rhs[0] / this.diag[0]
    // Axon: Thomas algorithm over patches 1..N-1.
    if (N > 1) {
      for (let i = 2; i < N; i++) {
        const w = this.lower[i] / this.diag[i - 1]
        this.diag[i] -= w * this.upper[i - 1]
        this.rhs[i] -= w * this.rhs[i - 1]
      }
      this.v[N - 1] = this.rhs[N - 1] / this.diag[N - 1]
      for (let i = N - 2; i >= 1; i--) {
        this.v[i] = (this.rhs[i] - this.upper[i] * this.v[i + 1]) / this.diag[i]
      }
    }
    this.v[0] = vSomaNew

    // Gates by exponential Euler, currents and concentrations from the new
    // voltage, pump turnover into the ATP ledger, and spike detection.
    const rate = p.concentrationRate
    for (let i = 0; i < N; i++) {
      const vi = this.v[i]
      const k = t.index(vi)
      this.m[i] = t.mInf[k] + (this.m[i] - t.mInf[k]) * t.mDecay[k]
      this.h[i] = t.hInf[k] + (this.h[i] - t.hInf[k]) * t.hDecay[k]
      this.n[i] = t.nInf[k] + (this.n[i] - t.nInf[k]) * t.nDecay[k]

      const eNa = nernst(naOut, this.naIn[i])
      const eK = nernst(kOut, this.kIn[i])
      const iNa = this.iNa[i] * (vi - eNa) // positive = outward
      const iK = this.iK[i] * (vi - eK)
      const j = this.jPump[i]
      // The inputs' ions arrive at the soma: excitatory charge is sodium
      // coming in, inhibitory charge is potassium going out.
      const naSyn = i === 0 ? this.synE : 0
      const kSyn = i === 0 ? this.synI : 0
      this.iNa[i] = iNa
      this.iK[i] = iK
      this.naIn[i] = Math.max(1, this.naIn[i] + rate * (-iNa + naSyn - 3 * j) * dt)
      this.kIn[i] = Math.max(1, this.kIn[i] + rate * (-iK + kSyn + 2 * j) * dt)

      const areaDt = this.area[i] * dt * CHARGES_PER_UA_MS
      this.atpTotal += j * areaDt
      const naIn = -iNa + naSyn
      if (naIn > 0) this.naInflux[i] += naIn * areaDt

      // Spike bookkeeping per patch.
      if (this.above[i]) {
        if (vi > this.peak[i]) this.peak[i] = vi
        if (vi < SPIKE_CROSSING_MV) this.above[i] = 0
      } else {
        if (vi < this.trough[i]) this.trough[i] = vi
        if (vi >= SPIKE_CROSSING_MV) {
          this.above[i] = 1
          this.onSpike(i)
        }
      }
      // Sodium-per-spike: close the window when it is up or a new spike starts.
      if (this.spikeStart[i] >= 0) {
        const elapsed = this.time - this.spikeStart[i]
        if (elapsed >= SPIKE_NA_WINDOW_MS) this.closeSpikeWindow(i, elapsed)
      }
      // Track the pre-spike sodium influx rate over a rolling 2 ms.
      if (this.time - this.lastRateMark[i] >= 2) {
        this.preRate[i] =
          (this.naInflux[i] - this.lastRateNa[i]) / (this.time - this.lastRateMark[i])
        this.lastRateMark[i] = this.time
        this.lastRateNa[i] = this.naInflux[i]
      }
    }
    this.lastINa = this.iNa[0]
    this.lastIK = this.iK[0]
    this.lastIPump = this.jPump[0]

    this.time += dt

    // Voltage trace.
    this.traceAcc += dt
    if (this.traceAcc >= TRACE_SAMPLE_MS - 1e-9) {
      this.traceAcc = 0
      this.traceV[this.traceHead] = this.v[0]
      this.traceFar[this.traceHead] = this.v[N - 1]
      this.traceHead = (this.traceHead + 1) % TRACE_LEN
      if (this.traceCount < TRACE_LEN) this.traceCount++
    }

    // Trim spike history.
    const cutoff = this.time - HISTORY_MS
    if (this.spikes.length && this.spikes[0] < cutoff) {
      let k = 0
      while (k < this.spikes.length && this.spikes[k] < cutoff) k++
      this.spikes.splice(0, k)
      this.spikeAmplitudes.splice(0, k)
    }
    if (this.farSpikes.length && this.farSpikes[0] < cutoff) {
      let k = 0
      while (k < this.farSpikes.length && this.farSpikes[k] < cutoff) k++
      this.farSpikes.splice(0, k)
    }
  }

  private onSpike(i: number): void {
    const now = this.time
    if (this.spikeStart[i] >= 0) {
      this.closeSpikeWindow(i, now - this.spikeStart[i])
    }
    this.spikeStart[i] = now
    this.spikeNa0[i] = this.naInflux[i]
    this.lastSpike[i] = now
    if (i === 0) {
      // Amplitude of the *previous* spike is only known once it has peaked;
      // record this spike's trough now and its peak when the next one starts
      // or the window closes. Simplest honest version: report the peak seen
      // so far for the last spike at close time — see closeSpikeWindow.
      this.spikes.push(now)
      this.spikeAmplitudes.push(0)
      this.peak[0] = this.v[0]
    } else if (i === this.count - 1) {
      this.farSpikes.push(now)
    }
    if (i === this.velA) this.velTA = now
    if (i === this.velB && this.velTA >= 0 && now - this.velTA < 100 && now > this.velTA) {
      const distMm = ((this.velB - this.velA) * this.axon.lengthMm) / (this.count - 1)
      this.conductionVelocity = distMm / (now - this.velTA) // mm/ms = m/s
      this.velTA = -1
    }
  }

  private closeSpikeWindow(i: number, elapsed: number): void {
    const gained = this.naInflux[i] - this.spikeNa0[i]
    const baseline = this.preRate[i] * elapsed
    this.naPerSpike[i] = Math.max(0, gained - baseline)
    this.spikeStart[i] = -1
    if (i === 0 && this.spikeAmplitudes.length) {
      this.spikeAmplitudes[this.spikeAmplitudes.length - 1] = this.peak[0] - this.trough[0]
      this.trough[0] = this.v[0]
    }
  }
}
