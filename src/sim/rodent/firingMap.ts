import { meanVector } from './spatial/angles'

/**
 * A firing map (spec §6.4): spikes divided by time spent, in 2.5 cm bins
 * over the room's floor, lightly smoothed, filled in only where the rat has
 * been. **The bins are indexed by the rat's true position**, which is the
 * experimenter's camera, while the spikes come from cells that fire from
 * the estimate. That is why a map recorded in the dark smears.
 */

export const BIN = 0.025
/** A bin counts as visited once the rat has spent this long in it, seconds. */
export const MIN_OCCUPANCY = 0.1

export class FiringMaps {
  readonly n: number
  readonly nx: number
  readonly ny: number
  readonly halfX: number
  readonly halfY: number
  readonly occupancy: Float32Array
  readonly spikes = new Map<string, Float32Array>()
  /** Head-direction cells: time per heading bin, and spikes per cell per bin. */
  readonly hdBins = 24
  readonly hdTime: Float32Array
  readonly hdSpikes = new Map<string, Float32Array>()
  seconds = 0

  constructor(width: number, length: number) {
    this.halfX = width / 2
    this.halfY = length / 2
    this.nx = Math.ceil(width / BIN)
    this.ny = Math.ceil(length / BIN)
    this.n = this.nx * this.ny
    this.occupancy = new Float32Array(this.n)
    this.hdTime = new Float32Array(this.hdBins)
  }

  binOf(x: number, y: number): number {
    const i = Math.min(this.nx - 1, Math.max(0, Math.floor((x + this.halfX) / BIN)))
    const j = Math.min(this.ny - 1, Math.max(0, Math.floor((y + this.halfY) / BIN)))
    return j * this.nx + i
  }

  hdBinOf(heading: number): number {
    const a = ((heading % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)
    return Math.min(this.hdBins - 1, Math.floor((a / (2 * Math.PI)) * this.hdBins))
  }

  /** One step: the rat's true position and heading, and which cells spiked. */
  record(dt: number, x: number, y: number, heading: number, spiked: { key: string; hd?: boolean }[]): void {
    this.seconds += dt
    const b = this.binOf(x, y)
    this.occupancy[b] += dt
    const hb = this.hdBinOf(heading)
    this.hdTime[hb] += dt
    for (const s of spiked) {
      if (s.hd) {
        let arr = this.hdSpikes.get(s.key)
        if (!arr) this.hdSpikes.set(s.key, (arr = new Float32Array(this.hdBins)))
        arr[hb]++
      } else {
        let arr = this.spikes.get(s.key)
        if (!arr) this.spikes.set(s.key, (arr = new Float32Array(this.n)))
        arr[b]++
      }
    }
  }

  /** Share of the floor's bins the rat has visited. */
  coverage(insideBin?: (x: number, y: number) => boolean): number {
    let visited = 0
    let total = 0
    for (let j = 0; j < this.ny; j++) {
      for (let i = 0; i < this.nx; i++) {
        const x = -this.halfX + (i + 0.5) * BIN
        const y = -this.halfY + (j + 0.5) * BIN
        if (insideBin && !insideBin(x, y)) continue
        total++
        if (this.occupancy[j * this.nx + i] >= MIN_OCCUPANCY) visited++
      }
    }
    return total ? visited / total : 0
  }

  private cache = new Map<string, { at: number; map: Float32Array }>()

  /** Spikes per second in each bin, lightly smoothed; NaN where the rat has not been. Cached until the record grows. */
  rateMap(key: string): Float32Array {
    const hit = this.cache.get(key)
    if (hit && hit.at === this.seconds) return hit.map
    const map = this.computeRateMap(key)
    this.cache.set(key, { at: this.seconds, map })
    return map
  }

  private computeRateMap(key: string): Float32Array {
    const spikes = this.spikes.get(key) ?? new Float32Array(this.n)
    const sm = smooth(spikes, this.nx, this.ny)
    const oc = smooth(this.occupancy, this.nx, this.ny)
    const out = new Float32Array(this.n)
    for (let b = 0; b < this.n; b++) out[b] = this.occupancy[b] >= MIN_OCCUPANCY || oc[b] >= MIN_OCCUPANCY ? sm[b] / Math.max(oc[b], 1e-6) : NaN
    return out
  }

  /** The center of mass of a cell's firing, in meters relative to the room's center, or null for a silent cell. */
  centroid(key: string): { x: number; y: number; peak: number } | null {
    const r = this.rateMap(key)
    let sx = 0
    let sy = 0
    let total = 0
    let peak = 0
    for (let j = 0; j < this.ny; j++) {
      for (let i = 0; i < this.nx; i++) {
        const v = r[j * this.nx + i]
        if (!(v > 0)) continue
        const x = -this.halfX + (i + 0.5) * BIN
        const y = -this.halfY + (j + 0.5) * BIN
        sx += v * x
        sy += v * y
        total += v
        peak = Math.max(peak, v)
      }
    }
    if (total <= 0) return null
    return { x: sx / total, y: sy / total, peak }
  }

  /** A head-direction cell's rate by heading bin, and from it its preferred direction and tuning index. */
  hdTuning(key: string): { rates: number[]; preferred: number; index: number } {
    const spikes = this.hdSpikes.get(key) ?? new Float32Array(this.hdBins)
    const rates: number[] = []
    const angles: number[] = []
    for (let b = 0; b < this.hdBins; b++) {
      rates.push(this.hdTime[b] > 0 ? spikes[b] / this.hdTime[b] : 0)
      angles.push(((b + 0.5) * 2 * Math.PI) / this.hdBins)
    }
    const mv = meanVector(angles, rates)
    return { rates, preferred: mv.angle, index: mv.length }
  }
}

/** A 3×3 box blur, weights 1-2-1, over a grid. */
export function smooth(src: Float32Array, nx: number, ny: number): Float32Array {
  const out = new Float32Array(src.length)
  const w = [1, 2, 1]
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      let s = 0
      let ws = 0
      for (let dj = -1; dj <= 1; dj++) {
        const jj = j + dj
        if (jj < 0 || jj >= ny) continue
        for (let di = -1; di <= 1; di++) {
          const ii = i + di
          if (ii < 0 || ii >= nx) continue
          const k = w[dj + 1] * w[di + 1]
          s += k * src[jj * nx + ii]
          ws += k
        }
      }
      out[j * nx + i] = ws ? (s / ws) * 1 : 0
    }
  }
  return out
}

/**
 * Grid spacing from a rate map: the distance to the first ring of peaks in
 * its spatial autocorrelation, averaged over the six nearest peaks. Used by
 * the tests that measure the groups' spacings and how a shortened box
 * changes them.
 */
export function gridSpacing(rate: Float32Array, nx: number, ny: number): number | null {
  const valid = (v: number) => Number.isFinite(v)
  const vals: number[] = []
  for (const v of rate) if (valid(v)) vals.push(v)
  if (vals.length < 100) return null
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length
  const maxLag = Math.floor(Math.min(nx, ny) * 0.6)
  const ac = new Float32Array((2 * maxLag + 1) * (2 * maxLag + 1))
  const W = 2 * maxLag + 1
  for (let dy = -maxLag; dy <= maxLag; dy++) {
    for (let dx = -maxLag; dx <= maxLag; dx++) {
      let s = 0
      let n = 0
      let va = 0
      let vb = 0
      for (let j = 0; j < ny; j++) {
        const jj = j + dy
        if (jj < 0 || jj >= ny) continue
        for (let i = 0; i < nx; i++) {
          const ii = i + dx
          if (ii < 0 || ii >= nx) continue
          const a = rate[j * nx + i]
          const b = rate[jj * nx + ii]
          if (!valid(a) || !valid(b)) continue
          s += (a - mean) * (b - mean)
          va += (a - mean) * (a - mean)
          vb += (b - mean) * (b - mean)
          n++
        }
      }
      ac[(dy + maxLag) * W + (dx + maxLag)] = n > 20 && va > 0 && vb > 0 ? s / Math.sqrt(va * vb) : 0
    }
  }
  // Peaks: local maxima of the autocorrelation away from the center, above 0.1.
  const peaks: { d: number; v: number }[] = []
  for (let dy = -maxLag + 1; dy < maxLag; dy++) {
    for (let dx = -maxLag + 1; dx < maxLag; dx++) {
      const d = Math.sqrt(dx * dx + dy * dy)
      if (d < 3) continue
      const v = ac[(dy + maxLag) * W + (dx + maxLag)]
      if (v < 0.1) continue
      let isMax = true
      for (let a = -1; a <= 1 && isMax; a++) for (let b = -1; b <= 1; b++) if ((a || b) && ac[(dy + a + maxLag) * W + (dx + b + maxLag)] > v) { isMax = false; break }
      if (isMax) peaks.push({ d, v })
    }
  }
  if (peaks.length < 3) return null
  peaks.sort((a, b) => a.d - b.d)
  const nearest = peaks.slice(0, Math.min(6, peaks.length))
  return (nearest.reduce((a, p) => a + p.d, 0) / nearest.length) * BIN
}

/**
 * How much a rate map recorded in a box shortened along x is a compressed
 * copy of one recorded in the full box: the compression factor in
 * [floor, 1] at which the full map, squeezed along x, best correlates with
 * the short one over the short box's bins. 1 means the firing stayed at its
 * metric positions (anchored to the running sum); the box's own ratio means
 * it moved with the walls.
 */
export function bestCompression(full: Float32Array, nxFull: number, short: Float32Array, nxShort: number, ny: number, floor: number): { factor: number; r: number } {
  let best = { factor: 1, r: -2 }
  for (let f = floor; f <= 1.0001; f += 0.01) {
    const xs: number[] = []
    const ys: number[] = []
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nxShort; i++) {
        const v = short[j * nxShort + i]
        if (!Number.isFinite(v)) continue
        // Position in the short box relative to its center, in bins; the same place in the full box is at x/f.
        const xShort = i + 0.5 - nxShort / 2
        const xFull = xShort / f + nxFull / 2 - 0.5
        const ii = Math.round(xFull)
        if (ii < 0 || ii >= nxFull) continue
        const u = full[j * nxFull + ii]
        if (!Number.isFinite(u)) continue
        xs.push(u)
        ys.push(v)
      }
    }
    if (xs.length < 50) continue
    const r = correlation(xs, ys)
    if (r > best.r) best = { factor: f, r }
  }
  return best
}

function correlation(a: number[], b: number[]): number {
  const n = a.length
  const ma = a.reduce((x, y) => x + y, 0) / n
  const mb = b.reduce((x, y) => x + y, 0) / n
  let sab = 0
  let saa = 0
  let sbb = 0
  for (let i = 0; i < n; i++) {
    sab += (a[i] - ma) * (b[i] - mb)
    saa += (a[i] - ma) ** 2
    sbb += (b[i] - mb) ** 2
  }
  return saa > 0 && sbb > 0 ? sab / Math.sqrt(saa * sbb) : 0
}
