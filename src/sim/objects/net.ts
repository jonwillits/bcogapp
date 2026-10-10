/**
 * A small runtime for the lab's shipped networks, written here rather than
 * taken from a library, for three reasons recorded in the as-built notes:
 * the drawing network's every intermediate map has to be readable for the
 * layer strip and the tolerance plots; the photo networks are
 * MobileNetV3-small, whose few kinds of layer fit in a few hundred lines;
 * and a library's WebAssembly runtime would be the largest file in the lab.
 *
 * A model is a list of operations over named tensors (see
 * `training/m08/export_model.py`). Running it fills a map from tensor name
 * to tensor, which is what the scene reads. **Nothing here writes a
 * weight**: the weights are read-only typed arrays decoded once at load, and
 * `frozen.test.ts` hashes them before and after a scripted session.
 */

export interface Tensor {
  c: number
  h: number
  w: number
  /** Channels-last: index (y * w + x) * c + channel. One pixel's channels are contiguous, which is what the 1 × 1 and depthwise convolutions want. */
  data: Float32Array
}

export interface ConvOp { op: 'conv'; in: string; out: string; w: string; b: string; k: number; stride: number; pad: number; groups: number }
export interface UnaryOp { op: 'relu' | 'hardswish' | 'hardsigmoid' | 'maxpool2' | 'gap' | 'softmax'; in: string; out: string }
export interface SeOp { op: 'se'; in: string; out: string; w1: string; b1: string; w2: string; b2: string }
export interface AddOp { op: 'add'; in: string; other: string; out: string }
export interface LinearOp { op: 'linear'; in: string; out: string; w: string; b: string }
export type Op = ConvOp | UnaryOp | SeOp | AddOp | LinearOp

export interface TensorDesc { dtype: 'f32' | 'f16'; offset: number; shape: number[] }

export interface ModelDesc {
  name: string
  kind: 'drawing' | 'photo'
  input: { channels: number; size: number; mean: number; std: number }
  labels: string[]
  layers?: { id: string; pooled: string; title: string; channels: number }[]
  outputs: { logits: string; probs: string; penultimate: string }
  ops: Op[]
  tensors: Record<string, TensorDesc>
  weightsFile: string
}

export interface Model {
  desc: ModelDesc
  weights: Map<string, Float32Array>
  /** Convolution weights re-laid out for the channels-last loops, made once at load. Derived from `weights`, never written after. */
  convWeights: Map<string, Float32Array>
}

/** IEEE half to single, bit by bit. */
export function f16ToF32(h: number): number {
  const s = (h & 0x8000) ? -1 : 1
  const e = (h >> 10) & 0x1f
  const f = h & 0x3ff
  if (e === 0) return s * Math.pow(2, -14) * (f / 1024)
  if (e === 31) return f ? NaN : s * Infinity
  return s * Math.pow(2, e - 15) * (1 + f / 1024)
}

/** Decode the weights file against the description. The returned arrays are the only copy; they are never written. */
export function loadModel(desc: ModelDesc, bin: ArrayBuffer): Model {
  const weights = new Map<string, Float32Array>()
  const view = new DataView(bin)
  for (const [name, t] of Object.entries(desc.tensors)) {
    const n = t.shape.reduce((a, b) => a * b, 1)
    const out = new Float32Array(n)
    if (t.dtype === 'f32') {
      for (let i = 0; i < n; i++) out[i] = view.getFloat32(t.offset + 4 * i, true)
    } else {
      for (let i = 0; i < n; i++) out[i] = f16ToF32(view.getUint16(t.offset + 2 * i, true))
    }
    weights.set(name, out)
  }
  // PyTorch stores a convolution's weights as [out][in/groups][k][k]. A
  // 1 × 1 convolution keeps that: each output's weights over the inputs are
  // contiguous, as is each pixel's channels, so an output is one dot product.
  // A depthwise convolution is re-laid tap-major, [tap][channel], so that the
  // loop over channels reads contiguous weights. The general case is
  // [group][tap][cinG][coutG].
  const convWeights = new Map<string, Float32Array>()
  for (const op of desc.ops) {
    if (op.op !== 'conv') continue
    const W = weights.get(op.w)!
    const cout = desc.tensors[op.w].shape[0]
    const cinG = desc.tensors[op.w].shape[1]
    const k = op.k
    const coutG = cout / op.groups
    if (k === 1 && op.groups === 1) { convWeights.set(op.w, W); continue }
    const re = new Float32Array(W.length)
    if (cinG === 1 && coutG === 1) {
      for (let c = 0; c < cout; c++) for (let t = 0; t < k * k; t++) re[t * cout + c] = W[c * k * k + t]
    } else {
      for (let o = 0; o < cout; o++) {
        const g = Math.floor(o / coutG)
        const og = o - g * coutG
        for (let i = 0; i < cinG; i++) for (let t = 0; t < k * k; t++) {
          re[((g * k * k + t) * cinG + i) * coutG + og] = W[(o * cinG + i) * k * k + t]
        }
      }
    }
    convWeights.set(op.w, re)
  }
  return { desc, weights, convWeights }
}

function tensor(c: number, h: number, w: number): Tensor {
  return { c, h, w, data: new Float32Array(c * h * w) }
}

/** The same tensor as PyTorch lays it out, [c][h][w], for tests against Python and for drawing one channel. */
export function chw(t: Tensor): Float32Array {
  const out = new Float32Array(t.data.length)
  const hw = t.h * t.w
  for (let p = 0; p < hw; p++) for (let c = 0; c < t.c; c++) out[c * hw + p] = t.data[p * t.c + c]
  return out
}

/** One channel of a tensor as a row-major image. */
export function channel(t: Tensor, c: number): Float32Array {
  const out = new Float32Array(t.h * t.w)
  for (let p = 0; p < out.length; p++) out[p] = t.data[p * t.c + c]
  return out
}

/**
 * Convolution, grouped, with zero padding, channels-last. Three paths: 1 × 1
 * (a dot product per pixel), depthwise (one channel in, one out, per
 * group), and the general case, which the drawing network's 3 × 3 layers
 * and the photo networks' first layer use.
 */
function conv(x: Tensor, Wr: Float32Array, B: Float32Array, k: number, stride: number, pad: number, groups: number): Tensor {
  const cin = x.c
  const cout = B.length
  const oh = Math.floor((x.h + 2 * pad - k) / stride) + 1
  const ow = Math.floor((x.w + 2 * pad - k) / stride) + 1
  const y = tensor(cout, oh, ow)
  const yd = y.data
  const xd = x.data
  const cinG = cin / groups
  const coutG = cout / groups
  const H = x.h, Wd = x.w
  if (k === 1 && groups === 1 && stride === 1 && pad === 0) {
    // Wr is [cout][cin]: each output at each pixel is one dot product of two contiguous rows.
    const hw = H * Wd
    for (let p = 0; p < hw; p++) {
      const yo = p * cout
      const xo = p * cin
      let o = 0
      // Four outputs at a time share each load of the pixel's channels.
      for (; o + 3 < cout; o += 4) {
        const w0 = o * cin, w1 = w0 + cin, w2 = w1 + cin, w3 = w2 + cin
        let s0 = 0, s1 = 0, s2 = 0, s3 = 0
        for (let i = 0; i < cin; i++) {
          const xv = xd[xo + i]
          s0 += xv * Wr[w0 + i]
          s1 += xv * Wr[w1 + i]
          s2 += xv * Wr[w2 + i]
          s3 += xv * Wr[w3 + i]
        }
        yd[yo + o] = B[o] + s0
        yd[yo + o + 1] = B[o + 1] + s1
        yd[yo + o + 2] = B[o + 2] + s2
        yd[yo + o + 3] = B[o + 3] + s3
      }
      for (; o < cout; o++) {
        const wo = o * cin
        let s0 = 0
        for (let i = 0; i < cin; i++) s0 += xd[xo + i] * Wr[wo + i]
        yd[yo + o] = B[o] + s0
      }
    }
    return y
  }
  if (cinG === 1 && coutG === 1) {
    // Depthwise: Wr is [tap][channel].
    const C = cout
    for (let r = 0; r < oh; r++) {
      const r0 = r * stride - pad
      for (let cc = 0; cc < ow; cc++) {
        const c0 = cc * stride - pad
        const yo = (r * ow + cc) * C
        for (let ch = 0; ch < C; ch++) yd[yo + ch] = B[ch]
        for (let u = 0; u < k; u++) {
          const rr = r0 + u
          if (rr < 0 || rr >= H) continue
          for (let v = 0; v < k; v++) {
            const ccv = c0 + v
            if (ccv < 0 || ccv >= Wd) continue
            const xo = (rr * Wd + ccv) * C
            const wo = (u * k + v) * C
            for (let ch = 0; ch < C; ch++) yd[yo + ch] += Wr[wo + ch] * xd[xo + ch]
          }
        }
      }
    }
    return y
  }
  // General grouped convolution: Wr is [group][tap][cinG][coutG].
  const kk = k * k
  for (let r = 0; r < oh; r++) {
    const r0 = r * stride - pad
    for (let cc = 0; cc < ow; cc++) {
      const c0 = cc * stride - pad
      const yo = (r * ow + cc) * cout
      for (let o = 0; o < cout; o++) yd[yo + o] = B[o]
      for (let u = 0; u < k; u++) {
        const rr = r0 + u
        if (rr < 0 || rr >= H) continue
        for (let v = 0; v < k; v++) {
          const ccv = c0 + v
          if (ccv < 0 || ccv >= Wd) continue
          const xo = (rr * Wd + ccv) * cin
          const t = u * k + v
          for (let g = 0; g < groups; g++) {
            const yg = yo + g * coutG
            for (let i = 0; i < cinG; i++) {
              const xv = xd[xo + g * cinG + i]
              if (xv === 0) continue
              const wo = ((g * kk + t) * cinG + i) * coutG
              for (let og = 0; og < coutG; og++) yd[yg + og] += xv * Wr[wo + og]
            }
          }
        }
      }
    }
  }
  return y
}

export const relu = (v: number) => (v > 0 ? v : 0)
export const hardsigmoid = (v: number) => (v <= -3 ? 0 : v >= 3 ? 1 : v / 6 + 0.5)
export const hardswish = (v: number) => v * hardsigmoid(v)

/** The three activations, each written out in its own loop so nothing is called per element. */
function unary(x: Tensor, which: 'relu' | 'hardswish' | 'hardsigmoid'): Tensor {
  const y = tensor(x.c, x.h, x.w)
  const xd = x.data, yd = y.data, n = xd.length
  if (which === 'relu') for (let i = 0; i < n; i++) { const v = xd[i]; yd[i] = v > 0 ? v : 0 }
  else if (which === 'hardswish') for (let i = 0; i < n; i++) { const v = xd[i]; yd[i] = v <= -3 ? 0 : v >= 3 ? v : v * (v / 6 + 0.5) }
  else for (let i = 0; i < n; i++) { const v = xd[i]; yd[i] = v <= -3 ? 0 : v >= 3 ? 1 : v / 6 + 0.5 }
  return y
}

function maxpool2(x: Tensor): Tensor {
  const oh = Math.floor(x.h / 2), ow = Math.floor(x.w / 2)
  const C = x.c
  const y = tensor(C, oh, ow)
  for (let r = 0; r < oh; r++) for (let cc = 0; cc < ow; cc++) {
    const a = (2 * r * x.w + 2 * cc) * C
    const b = a + C
    const c2 = a + x.w * C
    const d = c2 + C
    const yo = (r * ow + cc) * C
    for (let ch = 0; ch < C; ch++) {
      const m1 = Math.max(x.data[a + ch], x.data[b + ch])
      const m2 = Math.max(x.data[c2 + ch], x.data[d + ch])
      y.data[yo + ch] = Math.max(m1, m2)
    }
  }
  return y
}

function gap(x: Tensor): Tensor {
  const y = tensor(x.c, 1, 1)
  const hw = x.h * x.w
  const C = x.c
  for (let p = 0; p < hw; p++) for (let c = 0; c < C; c++) y.data[c] += x.data[p * C + c]
  for (let c = 0; c < C; c++) y.data[c] /= hw
  return y
}

/** A linear layer over a vector. For the drawing network the vector is a 4 × 4 × 96 map flattened as PyTorch flattens it, [c][h][w], so it is converted first. */
function linear(x: Tensor, W: Float32Array, B: Float32Array): Tensor {
  const v = x.h * x.w === 1 ? x.data : chw(x)
  const n = v.length
  const out = B.length
  const y = tensor(out, 1, 1)
  for (let o = 0; o < out; o++) {
    let s = B[o]
    const wo = o * n
    for (let i = 0; i < n; i++) s += W[wo + i] * v[i]
    y.data[o] = s
  }
  return y
}

function softmax(x: Tensor): Tensor {
  const y = tensor(x.c, 1, 1)
  let m = -Infinity
  for (const v of x.data) if (v > m) m = v
  let s = 0
  for (let i = 0; i < x.data.length; i++) { y.data[i] = Math.exp(x.data[i] - m); s += y.data[i] }
  for (let i = 0; i < y.data.length; i++) y.data[i] /= s
  return y
}

/** Squeeze and excitation: pool each channel, two small linear layers, and scale the channels by the result. */
function se(x: Tensor, W1: Float32Array, B1: Float32Array, W2: Float32Array, B2: Float32Array): Tensor {
  const pooled = gap(x)
  const h = linear(pooled, W1, B1)
  for (let i = 0; i < h.data.length; i++) h.data[i] = relu(h.data[i])
  const s = linear(h, W2, B2)
  const scale = new Float32Array(x.c)
  for (let c = 0; c < x.c; c++) scale[c] = hardsigmoid(s.data[c])
  const y = tensor(x.c, x.h, x.w)
  const C = x.c
  for (let p = 0; p < x.h * x.w; p++) for (let c = 0; c < C; c++) y.data[p * C + c] = x.data[p * C + c] * scale[c]
  return y
}

function add(a: Tensor, b: Tensor): Tensor {
  const y = tensor(a.c, a.h, a.w)
  for (let i = 0; i < a.data.length; i++) y.data[i] = a.data[i] + b.data[i]
  return y
}

/**
 * Run the model on one image (row-major, size × size, values in [0, 1]).
 * Returns every named tensor, so a caller can read any layer. `only`
 * stops early once that tensor exists, for callers that need less.
 */
export function run(model: Model, image: Float32Array, only?: string, profile?: Map<string, number>): Map<string, Tensor> {
  const { desc, weights } = model
  const size = desc.input.size
  if (image.length !== size * size) throw new Error(`expected ${size}×${size} input, got ${image.length} values`)
  const x = tensor(1, size, size)
  const { mean, std } = desc.input
  for (let i = 0; i < image.length; i++) x.data[i] = (image[i] - mean) / std
  const t = new Map<string, Tensor>()
  t.set('input', x)
  const W = (n: string) => {
    const w = weights.get(n)
    if (!w) throw new Error(`missing weight ${n}`)
    return w
  }
  const CW = (n: string) => model.convWeights.get(n)!
  const T = (n: string) => {
    const v = t.get(n)
    if (!v) throw new Error(`missing tensor ${n}`)
    return v
  }
  for (const op of desc.ops) {
    let y: Tensor
    const t0 = profile ? performance.now() : 0
    switch (op.op) {
      case 'conv': y = conv(T(op.in), CW(op.w), W(op.b), op.k, op.stride, op.pad, op.groups); break
      case 'relu': y = unary(T(op.in), 'relu'); break
      case 'hardswish': y = unary(T(op.in), 'hardswish'); break
      case 'hardsigmoid': y = unary(T(op.in), 'hardsigmoid'); break
      case 'maxpool2': y = maxpool2(T(op.in)); break
      case 'gap': y = gap(T(op.in)); break
      case 'softmax': y = softmax(T(op.in)); break
      case 'se': y = se(T(op.in), W(op.w1), W(op.b1), W(op.w2), W(op.b2)); break
      case 'add': y = add(T(op.in), T(op.other)); break
      case 'linear': y = linear(T(op.in), W(op.w), W(op.b)); break
    }
    t.set(op.out, y)
    if (profile) {
      const key = op.op === 'conv' ? (op.k === 1 && op.groups === 1 ? 'conv1x1' : op.groups > 1 ? `depthwise${op.k}` : `conv${op.k}`) : op.op
      profile.set(key, (profile.get(key) ?? 0) + performance.now() - t0)
    }
    if (only && op.out === only) break
  }
  return t
}

export interface Labelled {
  /** Index of the top label. */
  top: number
  probs: Float32Array
}

/** The probabilities and the top label for one image. */
export function classify(model: Model, image: Float32Array): Labelled {
  const t = run(model, image, model.desc.outputs.probs)
  const probs = t.get(model.desc.outputs.probs)!.data
  let top = 0
  for (let i = 1; i < probs.length; i++) if (probs[i] > probs[top]) top = i
  return { top, probs }
}

/** The penultimate layer's activity for one image: the readout's input in Part 3. */
export function penultimate(model: Model, image: Float32Array): Float32Array {
  return run(model, image, model.desc.outputs.penultimate).get(model.desc.outputs.penultimate)!.data
}

/** The k most likely labels, as (index, probability), most likely first. */
export function topK(probs: Float32Array, k: number): { label: number; p: number }[] {
  const idx = Array.from(probs, (_, i) => i)
  idx.sort((a, b) => probs[b] - probs[a])
  return idx.slice(0, k).map((label) => ({ label, p: probs[label] }))
}

/** Pearson correlation between two activity patterns: how closely one layer's activity for one image matches its activity for another. */
export function match(a: Float32Array, b: Float32Array): number {
  let ma = 0, mb = 0
  for (let i = 0; i < a.length; i++) { ma += a[i]; mb += b[i] }
  ma /= a.length; mb /= b.length
  let sab = 0, saa = 0, sbb = 0
  for (let i = 0; i < a.length; i++) {
    const da = a[i] - ma, db = b[i] - mb
    sab += da * db; saa += da * da; sbb += db * db
  }
  const d = Math.sqrt(saa * sbb)
  return d > 0 ? sab / d : 0
}

/** A stable hash of every weight, for the test that nothing a student does changes a shipped model. */
export function weightsHash(model: Model): string {
  let h1 = 0x811c9dc5 | 0
  const names = [...model.weights.keys()].sort()
  for (const n of names) {
    const w = model.weights.get(n)!
    const u = new Uint32Array(w.buffer, w.byteOffset, w.length)
    for (let i = 0; i < u.length; i++) {
      h1 = Math.imul(h1 ^ (u[i] & 0xffff), 16777619)
      h1 = Math.imul(h1 ^ (u[i] >>> 16), 16777619)
    }
  }
  return (h1 >>> 0).toString(16).padStart(8, '0')
}
