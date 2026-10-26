/**
 * The bounding box of every shipped room model, in the model's own units,
 * read straight from each GLB's JSON chunk (the POSITION accessors' min
 * and max, carried through each node's transform), so the scene can scale a
 * model to a target height without loading it first. No DOM, no loader.
 *
 *   node training/m10/room/measure.mjs      → training/m10/room/sizes.json
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const ROOM = join(ROOT, 'public', 'm10', 'room')

function glbJson(path) {
  const b = readFileSync(path)
  if (b.readUInt32LE(0) !== 0x46546c67) throw new Error(`${path}: not a GLB`)
  const len = b.readUInt32LE(12)
  return JSON.parse(b.subarray(20, 20 + len).toString('utf8'))
}

/** 4×4 column-major multiply, as glTF stores matrices. */
const mul = (a, b) => {
  const o = new Array(16).fill(0)
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]
  return o
}
const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
function nodeMatrix(n) {
  if (n.matrix) return n.matrix
  const t = n.translation ?? [0, 0, 0]
  const q = n.rotation ?? [0, 0, 0, 1]
  const s = n.scale ?? [1, 1, 1]
  const [x, y, z, w] = q
  const R = [
    1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w), 0,
    2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w), 0,
    2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y), 0,
    0, 0, 0, 1,
  ]
  const S = [s[0], 0, 0, 0, 0, s[1], 0, 0, 0, 0, s[2], 0, 0, 0, 0, 1]
  const T = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, t[0], t[1], t[2], 1]
  return mul(T, mul(R, S))
}
const apply = (m, [x, y, z]) => [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]]

function bounds(j) {
  const lo = [Infinity, Infinity, Infinity]
  const hi = [-Infinity, -Infinity, -Infinity]
  const visit = (ni, parent) => {
    const n = j.nodes[ni]
    const m = mul(parent, nodeMatrix(n))
    if (n.mesh !== undefined) {
      for (const p of j.meshes[n.mesh].primitives) {
        const a = j.accessors[p.attributes.POSITION]
        if (!a.min || !a.max) continue
        // Every corner of the accessor's box, transformed.
        for (const cx of [a.min[0], a.max[0]]) for (const cy of [a.min[1], a.max[1]]) for (const cz of [a.min[2], a.max[2]]) {
          const v = apply(m, [cx, cy, cz])
          for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], v[k]); hi[k] = Math.max(hi[k], v[k]) }
        }
      }
    }
    for (const c of n.children ?? []) visit(c, m)
  }
  const scene = j.scenes[j.scene ?? 0]
  for (const ni of scene.nodes) visit(ni, I)
  return { min: lo, max: hi, width: hi[0] - lo[0], height: hi[1] - lo[1], depth: hi[2] - lo[2] }
}

const out = {}
const walk = (dir) => {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) walk(p)
    else if (e.endsWith('.glb')) out[relative(ROOM, p)] = bounds(glbJson(p))
  }
}
walk(ROOM)
const r = (v) => Math.round(v * 1000) / 1000
for (const [f, b] of Object.entries(out)) console.log(`${f.padEnd(44)} w ${r(b.width).toFixed(3)}  h ${r(b.height).toFixed(3)}  d ${r(b.depth).toFixed(3)}  (y from ${r(b.min[1])} to ${r(b.max[1])})`)
writeFileSync(join(dirname(fileURLToPath(import.meta.url)), 'sizes.json'), JSON.stringify(out, null, 1) + '\n')
