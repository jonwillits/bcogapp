/**
 * The two contour erasers, shared line for line with
 * `training/m08/erasers.py`, which carries the full account. Both remove the
 * same share of a drawing's total stroke length; they differ in where the
 * gaps are centered: *mid-line* at the middles of the runs between joints,
 * so each part stays recoverable; *at the joints* on corners, on stroke
 * ends near another stroke, and on crossings, so the joints between parts
 * are hidden. Joints are found on the vectors before rasterizing.
 */
import type { Drawing, Stroke } from './raster'

export const CORNER_DEG = 60.0
export const CORNER_WINDOW = 12.0
export const NEAR = 10.0
export const MIN_SEG = 2.0

export type EraserKind = 'mid' | 'joints'
export type JointKind = 'corner' | 'end' | 'crossing'
/** A joint: which stroke, how far along it, and what kind it is. */
export type Joint = [number, number, JointKind]

export const ERASER_LABEL: Record<EraserKind, string> = { mid: 'Mid-line', joints: 'At the joints' }

function distPointSeg(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay
  const l2 = dx * dx + dy * dy
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2))
  const qx = ax + t * dx, qy = ay + t * dy
  return Math.sqrt(((px - qx) * (px - qx)) + ((py - qy) * (py - qy)))
}

/** Every stroke resampled to points `step` apart along its length, plus its last point. */
export function resample(strokes: Drawing, step = 2.0): Drawing {
  const out: Drawing = []
  for (const s of strokes) {
    const xs = s[0], ys = s[1]
    if (xs.length === 1) { out.push([[xs[0]], [ys[0]]]); continue }
    const nx = [xs[0]], ny = [ys[0]]
    let carry = 0
    for (let k = 0; k < xs.length - 1; k++) {
      const ax = xs[k], ay = ys[k], bx = xs[k + 1], by = ys[k + 1]
      const seg = Math.sqrt(((bx - ax) * (bx - ax)) + ((by - ay) * (by - ay)))
      let pos = step - carry
      while (pos <= seg) {
        const t = pos / seg
        nx.push(ax + t * (bx - ax)); ny.push(ay + t * (by - ay))
        pos += step
      }
      carry = seg - (pos - step)
    }
    if (nx[nx.length - 1] !== xs[xs.length - 1] || ny[ny.length - 1] !== ys[ys.length - 1]) { nx.push(xs[xs.length - 1]); ny.push(ys[ys.length - 1]) }
    out.push([nx, ny])
  }
  return out
}

export function arcPositions(stroke: Stroke): number[] {
  const [xs, ys] = stroke
  const pos = [0]
  for (let k = 0; k < xs.length - 1; k++) pos.push(pos[pos.length - 1] + Math.sqrt(((xs[k + 1] - xs[k]) * (xs[k + 1] - xs[k])) + ((ys[k + 1] - ys[k]) * (ys[k + 1] - ys[k]))))
  return pos
}

function segmentsCross(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number): [number, number] | null {
  const r0 = bx - ax, r1 = by - ay
  const s0 = dx - cx, s1 = dy - cy
  const den = r0 * s1 - r1 * s0
  if (Math.abs(den) < 1e-9) return null
  const t = ((cx - ax) * s1 - (cy - ay) * s0) / den
  const u = ((cx - ax) * r1 - (cy - ay) * r0) / den
  if (t > 1e-6 && t < 1 - 1e-6 && u > 1e-6 && u < 1 - 1e-6) return [t, u]
  return null
}

/** Joints on resampled strokes, sorted, with close ones on one stroke merged. */
export function findJoints(strokes: Drawing): Joint[] {
  const joints: Joint[] = []
  const arcs = strokes.map(arcPositions)
  strokes.forEach((s, si) => {
    const [xs, ys] = s
    const arc = arcs[si]
    const n = xs.length
    for (let k = 1; k < n - 1; k++) {
      const a = arc[k]
      let i0 = k
      while (i0 > 0 && a - arc[i0] < CORNER_WINDOW) i0--
      let i1 = k
      while (i1 < n - 1 && arc[i1] - a < CORNER_WINDOW) i1++
      if (i0 === k || i1 === k) continue
      const v0x = xs[k] - xs[i0], v0y = ys[k] - ys[i0]
      const v1x = xs[i1] - xs[k], v1y = ys[i1] - ys[k]
      const l0 = Math.sqrt((v0x * v0x) + (v0y * v0y)), l1 = Math.sqrt((v1x * v1x) + (v1y * v1y))
      if (l0 === 0 || l1 === 0) continue
      const cosang = Math.max(-1, Math.min(1, (v0x * v1x + v0y * v1y) / (l0 * l1)))
      if ((Math.acos(cosang) * 180) / Math.PI > CORNER_DEG) joints.push([si, a, 'corner'])
    }
    for (const end of [0, n - 1]) {
      const px = xs[end], py = ys[end]
      let near = false
      for (let sj = 0; sj < strokes.length && !near; sj++) {
        if (sj === si) continue
        const [ox, oy] = strokes[sj]
        for (let k = 0; k < Math.max(ox.length - 1, 1); k++) {
          const k2 = Math.min(k + 1, ox.length - 1)
          if (distPointSeg(px, py, ox[k], oy[k], ox[k2], oy[k2]) <= NEAR) { near = true; break }
        }
      }
      if (near) joints.push([si, arc[end], 'end'])
    }
  })
  strokes.forEach((s, si) => {
    const [xs, ys] = s
    for (let sj = si; sj < strokes.length; sj++) {
      const [ox, oy] = strokes[sj]
      for (let k = 0; k < xs.length - 1; k++) {
        for (let m = 0; m < ox.length - 1; m++) {
          if (sj === si && Math.abs(k - m) <= 1) continue
          const hit = segmentsCross(xs[k], ys[k], xs[k + 1], ys[k + 1], ox[m], oy[m], ox[m + 1], oy[m + 1])
          if (hit) {
            joints.push([si, arcs[si][k] + hit[0] * (arcs[si][k + 1] - arcs[si][k]), 'crossing'])
            joints.push([sj, arcs[sj][m] + hit[1] * (arcs[sj][m + 1] - arcs[sj][m]), 'crossing'])
          }
        }
      }
    }
  })
  joints.sort((a, b) => a[0] - b[0] || a[1] - b[1] || (a[2] < b[2] ? -1 : a[2] > b[2] ? 1 : 0))
  const merged: Joint[] = []
  for (const j of joints) {
    const last = merged[merged.length - 1]
    if (last && last[0] === j[0] && j[1] - last[1] < CORNER_WINDOW / 2) continue
    merged.push(j)
  }
  return merged
}

/** Where the gaps go: on the joints, or at the middles of the runs between them. */
export function gapCenters(strokes: Drawing, joints: Joint[], kind: EraserKind): [number, number][] {
  const centers: [number, number][] = []
  strokes.forEach((s, si) => {
    const L = arcPositions(s)[s[0].length - 1]
    const js = joints.filter((j) => j[0] === si).map((j) => j[1]).sort((a, b) => a - b)
    if (kind === 'joints') for (const p of js) centers.push([si, p])
    else {
      const b = [0, ...js, L]
      for (let i = 0; i < b.length - 1; i++) if (b[i + 1] - b[i] > MIN_SEG) centers.push([si, (b[i] + b[i + 1]) / 2])
    }
  })
  return centers
}

function intervals(centers: [number, number][], half: number, n: number): [number, number][][] {
  const per: [number, number][][] = Array.from({ length: n }, () => [])
  for (const [si, c] of centers) per[si].push([c - half, c + half])
  return per.map((iv) => {
    iv.sort((a, b) => a[0] - b[0])
    const merged: [number, number][] = []
    for (const [a, b] of iv) {
      const last = merged[merged.length - 1]
      if (last && a <= last[1]) last[1] = Math.max(last[1], b)
      else merged.push([a, b])
    }
    return merged
  })
}

function removedLength(rs: Drawing, centers: [number, number][], half: number): number {
  const iv = intervals(centers, half, rs.length)
  let removed = 0
  rs.forEach((s, si) => {
    const L = arcPositions(s)[s[0].length - 1]
    for (const [a, b] of iv[si]) removed += Math.max(0, Math.min(b, L) - Math.max(a, 0))
  })
  return removed
}

function pointAt(xs: number[], ys: number[], arc: number[], p: number): [number, number] {
  for (let k = 0; k < arc.length - 1; k++) {
    if (arc[k] <= p && p <= arc[k + 1]) {
      const seg = arc[k + 1] - arc[k]
      const t = seg === 0 ? 0 : (p - arc[k]) / seg
      return [xs[k] + t * (xs[k + 1] - xs[k]), ys[k] + t * (ys[k + 1] - ys[k])]
    }
  }
  return [xs[xs.length - 1], ys[ys.length - 1]]
}

function slice(xs: number[], ys: number[], arc: number[], a: number, b: number): Stroke {
  const [px, py] = pointAt(xs, ys, arc, a)
  const nx = [px], ny = [py]
  for (let k = 0; k < arc.length; k++) if (a < arc[k] && arc[k] < b) { nx.push(xs[k]); ny.push(ys[k]) }
  const [qx, qy] = pointAt(xs, ys, arc, b)
  nx.push(qx); ny.push(qy)
  return [nx, ny]
}

function apply(rs: Drawing, centers: [number, number][], half: number): Drawing {
  const iv = intervals(centers, half, rs.length)
  const out: Drawing = []
  rs.forEach((s, si) => {
    const [xs, ys] = s
    const arc = arcPositions(s)
    const L = arc[arc.length - 1]
    const keep: [number, number][] = []
    let pos = 0
    for (const [a, b] of iv[si]) {
      if (a > pos) keep.push([pos, a])
      pos = Math.max(pos, b)
    }
    if (pos < L) keep.push([pos, L])
    for (const [a, b] of keep) if (b - a >= MIN_SEG) out.push(slice(xs, ys, arc, a, b))
  })
  return out
}

export interface Erased {
  strokes: Drawing
  /** The share of the total stroke length actually removed. */
  removed: number
  /** Half the width of each gap, in the 256 space. */
  half: number
  /** Whether the joints eraser had no joint to work with and fell back to mid-line gaps. */
  fellBack: boolean
}

/** Remove `share` of the total stroke length in gaps centered as `kind` says. */
export function erase(strokes: Drawing, share: number, kind: EraserKind, joints?: Joint[]): Erased {
  const rs = resample(strokes)
  const js = joints ?? findJoints(rs)
  let centers = gapCenters(rs, js, kind)
  let fellBack = false
  if (kind === 'joints' && centers.length === 0) { centers = gapCenters(rs, js, 'mid'); fellBack = true }
  const total = rs.reduce((acc, s) => acc + arcPositions(s)[s[0].length - 1], 0)
  const target = share * total
  let lo = 0, hi = total
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2
    if (removedLength(rs, centers, mid) < target) lo = mid
    else hi = mid
  }
  const half = (lo + hi) / 2
  return { strokes: apply(rs, centers, half), removed: total > 0 ? removedLength(rs, centers, half) / total : 0, half, fellBack }
}

/** Move the strokes at `part` by (dx, dy): the moved-part manipulation. */
export function movePart(strokes: Drawing, part: number[], dx: number, dy: number): Drawing {
  return strokes.map((s, i) => (part.includes(i) ? [s[0].map((x) => x + dx), s[1].map((y) => y + dy)] : s))
}
