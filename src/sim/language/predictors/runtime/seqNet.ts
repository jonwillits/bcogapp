/**
 * The lab's own runtime for Part 4's networks trained offline (spec §2,
 * §8.5): Lab 8's choice of a runtime of our own rather than a library,
 * for the same reason (`M08_AS_BUILT_NOTES.md` §2): every intermediate
 * value Part 4 draws has to be readable, here the attention weights of
 * every layer and every attention computation, the hidden state at every
 * position, and the input embeddings. The weights are read-only arrays
 * decoded once at load; nothing here writes one (`frozen.test.ts`).
 *
 * The transformer is the one `training/m13/train_predictors.py` trains:
 * token and position embeddings added, then for each layer a pre-layer-
 * norm causal self-attention with nHeads computations and a residual add,
 * then a pre-layer-norm feed-forward layer (width dFF, the tanh-approximate
 * GELU) with a residual add; a final layer norm; an untied output layer;
 * a softmax over the vocabulary. The simple recurrent network is Elman's:
 * a one-hot token in, a hidden layer of tanh units with its own previous
 * activity fed back, a softmax out, the hidden state zero at a sentence's
 * start. `agreement.test.ts` holds both to PyTorch's numbers within 1e-4.
 */

export interface TensorDesc {
  dtype: 'f32'
  offset: number
  shape: number[]
}

export interface SnapshotDesc {
  updates: number
  weightsFile: string
  heldOutAccuracy: number
  agreementByDepth: Record<string, number>
  loss: number | null
}

export interface SeqDesc {
  name: string
  kind: 'transformer' | 'srn'
  vocab: string[]
  pad: number
  dModel: number
  nLayers: number
  nHeads: number
  maxLen: number
  dFF: number
  hidden: number
  tensors: Record<string, TensorDesc>
  snapshots: SnapshotDesc[]
  params: number
}

export interface SeqModel {
  desc: SeqDesc
  updates: number
  weights: Map<string, Float32Array>
}

export function loadSeqModel(desc: SeqDesc, updates: number, bin: ArrayBuffer): SeqModel {
  const weights = new Map<string, Float32Array>()
  const view = new DataView(bin)
  for (const [name, t] of Object.entries(desc.tensors)) {
    const n = t.shape.reduce((a, b) => a * b, 1)
    const out = new Float32Array(n)
    for (let i = 0; i < n; i++) out[i] = view.getFloat32(t.offset + 4 * i, true)
    weights.set(name, out)
  }
  return { desc, updates, weights }
}

const W = (m: SeqModel, name: string): Float32Array => {
  const w = m.weights.get(name)
  if (!w) throw new Error(`no tensor ${name}`)
  return w
}

/** y = x W^T + b for a PyTorch Linear with weight [out, in]. */
function linear(x: Float64Array, w: Float32Array, b: Float32Array | null, outDim: number, inDim: number): Float64Array {
  const y = new Float64Array(outDim)
  for (let o = 0; o < outDim; o++) {
    let s = b ? b[o] : 0
    const row = o * inDim
    for (let i = 0; i < inDim; i++) s += w[row + i] * x[i]
    y[o] = s
  }
  return y
}

function layerNorm(x: Float64Array, g: Float32Array, b: Float32Array, eps = 1e-5): Float64Array {
  const n = x.length
  let mean = 0
  for (let i = 0; i < n; i++) mean += x[i]
  mean /= n
  let v = 0
  for (let i = 0; i < n; i++) v += (x[i] - mean) ** 2
  v /= n
  const k = 1 / Math.sqrt(v + eps)
  const y = new Float64Array(n)
  for (let i = 0; i < n; i++) y[i] = (x[i] - mean) * k * g[i] + b[i]
  return y
}

/** The tanh-approximate GELU, as PyTorch's F.gelu(approximate='tanh'). */
export function gelu(x: number): number {
  return 0.5 * x * (1 + Math.tanh(Math.sqrt(2 / Math.PI) * (x + 0.044715 * x * x * x)))
}

export function softmax(x: ArrayLike<number>, temperature = 1): Float64Array {
  const n = x.length
  let max = -Infinity
  for (let i = 0; i < n; i++) if (x[i] / temperature > max) max = x[i] / temperature
  const out = new Float64Array(n)
  let sum = 0
  for (let i = 0; i < n; i++) {
    out[i] = Math.exp(x[i] / temperature - max)
    sum += out[i]
  }
  for (let i = 0; i < n; i++) out[i] /= sum
  return out
}

export interface TransformerOutput {
  /** For each position, the logits over the vocabulary (the padding index dropped). */
  logits: Float64Array[]
  /** For each position, the probability of each token as the next one. */
  probs: Float64Array[]
  /** attention[layer][head][query position][key position]; zero where the key is later than the query. */
  attention: number[][][][]
  /** The hidden state after each layer at each position: hidden[layer][position], layer 0 being the embeddings with positions added. */
  hidden: Float64Array[][]
  /** The input embedding of each token in the vocabulary, for Step 5's plane. */
  embeddings: () => Float64Array[]
}

export function transformerForward(m: SeqModel, tokens: readonly number[]): TransformerOutput {
  const { dModel: d, nLayers, nHeads, dFF, vocab } = m.desc
  const V = vocab.length
  const T = tokens.length
  if (T > m.desc.maxLen) throw new Error(`prompt longer than ${m.desc.maxLen} tokens`)
  const tok = W(m, 'tok.weight')
  const pos = W(m, 'pos.weight')
  let h: Float64Array[] = tokens.map((t, i) => {
    const x = new Float64Array(d)
    for (let k = 0; k < d; k++) x[k] = tok[t * d + k] + pos[i * d + k]
    return x
  })
  const hidden: Float64Array[][] = [h.map((x) => Float64Array.from(x))]
  const attention: number[][][][] = []
  const hd = d / nHeads
  const scale = 1 / Math.sqrt(hd)
  for (let L = 0; L < nLayers; L++) {
    const p = `layers.${L}.`
    const a = h.map((x) => layerNorm(x, W(m, p + 'ln1.weight'), W(m, p + 'ln1.bias')))
    const qkv = a.map((x) => linear(x, W(m, p + 'qkv.weight'), W(m, p + 'qkv.bias'), 3 * d, d))
    const layerAttn: number[][][] = []
    const ctx: Float64Array[] = h.map(() => new Float64Array(d))
    for (let head = 0; head < nHeads; head++) {
      const rows: number[][] = []
      for (let i = 0; i < T; i++) {
        const scores = new Float64Array(i + 1)
        for (let j = 0; j <= i; j++) {
          let s = 0
          for (let k = 0; k < hd; k++) s += qkv[i][head * hd + k] * qkv[j][d + head * hd + k]
          scores[j] = s * scale
        }
        const w = softmax(scores)
        const row = new Array(T).fill(0)
        for (let j = 0; j <= i; j++) {
          row[j] = w[j]
          for (let k = 0; k < hd; k++) ctx[i][head * hd + k] += w[j] * qkv[j][2 * d + head * hd + k]
        }
        rows.push(row)
      }
      layerAttn.push(rows)
    }
    attention.push(layerAttn)
    h = h.map((x, i) => {
      const o = linear(ctx[i], W(m, p + 'o.weight'), W(m, p + 'o.bias'), d, d)
      const y = new Float64Array(d)
      for (let k = 0; k < d; k++) y[k] = x[k] + o[k]
      return y
    })
    h = h.map((x) => {
      const mm = layerNorm(x, W(m, p + 'ln2.weight'), W(m, p + 'ln2.bias'))
      const f = linear(mm, W(m, p + 'fc.weight'), W(m, p + 'fc.bias'), dFF, d)
      for (let k = 0; k < dFF; k++) f[k] = gelu(f[k])
      const pr = linear(f, W(m, p + 'proj.weight'), W(m, p + 'proj.bias'), d, dFF)
      const y = new Float64Array(d)
      for (let k = 0; k < d; k++) y[k] = x[k] + pr[k]
      return y
    })
    hidden.push(h.map((x) => Float64Array.from(x)))
  }
  const outW = W(m, 'out.weight')
  const outB = W(m, 'out.bias')
  const outDim = m.desc.tensors['out.weight'].shape[0]
  const logits = h.map((x) => linear(layerNorm(x, W(m, 'lnf.weight'), W(m, 'lnf.bias')), outW, outB, outDim, d).slice(0, V))
  const probs = logits.map((l) => softmax(l))
  const embeddings = () => vocab.map((_, t) => Float64Array.from(tok.subarray(t * d, t * d + d)))
  return { logits, probs, attention, hidden, embeddings }
}

export interface SrnOutput {
  logits: Float64Array[]
  probs: Float64Array[]
  /** The hidden state at each position. */
  hidden: Float64Array[]
}

export function srnForward(m: SeqModel, tokens: readonly number[]): SrnOutput {
  const { hidden: H, vocab } = m.desc
  const V = vocab.length
  const inDim = m.desc.tensors['w_ih.weight'].shape[1]
  const wih = W(m, 'w_ih.weight')
  const bih = W(m, 'w_ih.bias')
  const whh = W(m, 'w_hh.weight')
  const outW = W(m, 'out.weight')
  const outB = W(m, 'out.bias')
  const outDim = m.desc.tensors['out.weight'].shape[0]
  let h = new Float64Array(H)
  const hidden: Float64Array[] = []
  const logits: Float64Array[] = []
  for (const t of tokens) {
    const next = new Float64Array(H)
    for (let j = 0; j < H; j++) {
      // A one-hot input: x W_ih^T picks column t of W_ih.
      let s = bih[j] + wih[j * inDim + t]
      for (let k = 0; k < H; k++) s += whh[j * H + k] * h[k]
      next[j] = Math.tanh(s)
    }
    h = next
    hidden.push(Float64Array.from(h))
    logits.push(linear(h, outW, outB, outDim, H).slice(0, V))
  }
  return { logits, probs: logits.map((l) => softmax(l)), hidden }
}

/** A stable hash of every weight, for the frozen test. */
export function weightsHash(m: SeqModel): string {
  let h = 2166136261
  for (const [, w] of m.weights) {
    const u = new Uint8Array(w.buffer, w.byteOffset, w.byteLength)
    for (let i = 0; i < u.length; i++) {
      h ^= u[i]
      h = Math.imul(h, 16777619) >>> 0
    }
  }
  return h.toString(16)
}
