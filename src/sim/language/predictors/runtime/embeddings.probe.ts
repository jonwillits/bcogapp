import { describe, it } from 'vitest'
import { mkdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { loadShipped } from './loadModels.node'
import { gelu, softmax, srnForward, type SeqModel } from './seqNet'
import { principalPlane, embedding, makeCountModel, countStream } from '../counts'
import { corpus, SETTINGS, VOCABULARY, nounOf, verbOf } from '../grammar'
import { makeRng } from '../../../random'

/**
 * Jon's review page for Step 5's planes (2026-11-20): every way of giving
 * each noun and verb a vector from the shipped models, each shown as the
 * lab's plane (the two directions of greatest difference, after centring
 * and scaling each vector to unit length, as `principalPlane` does) with
 * sorting scores in the plane and in the full space. The page is written
 * outside the repo, beside the sounds review:
 *   PROBE=1 PROBE_DIR=src/sim/language/predictors/runtime npx vitest run --disable-console-intercept -t "embedding review page"
 *   then http://localhost:8013/embeddings/  (python3 -m http.server 8013 from ~/Documents/Projects/bcogapp_data/m13/review)
 */
const OUT = join(homedir(), 'Documents', 'Projects', 'bcogapp_data', 'm13', 'review', 'embeddings')

const WORDS = VOCABULARY.filter((t) => nounOf(t) || verbOf(t))
const KIND = WORDS.map((w) => (nounOf(w) ? 'noun' : 'verb'))
const NUMBER = WORDS.map((w) => (nounOf(w) ?? verbOf(w))!.number)
const CATEGORY = WORDS.map((w) => nounOf(w)?.spec.category ?? verbOf(w)!.spec.cls)

type Variant = { group: string; name: string; vectors: Float64Array[]; trained: boolean }

// ---- the transformer, with every intermediate state kept ----
const Wt = (m: SeqModel, name: string) => m.weights.get(name)!
function linear(x: Float64Array, w: Float32Array, b: Float32Array | null, outDim: number, inDim: number): Float64Array {
  const y = new Float64Array(outDim)
  for (let o = 0; o < outDim; o++) {
    let s = b ? b[o] : 0
    for (let i = 0; i < inDim; i++) s += w[o * inDim + i] * x[i]
    y[o] = s
  }
  return y
}
function layerNorm(x: Float64Array, g: Float32Array, b: Float32Array, eps = 1e-5): Float64Array {
  let mean = 0
  for (const v of x) mean += v / x.length
  let variance = 0
  for (const v of x) variance += (v - mean) ** 2 / x.length
  const k = 1 / Math.sqrt(variance + eps)
  return x.map((v, i) => (v - mean) * k * g[i] + b[i])
}
/** STAGES[s][position]: the state at each position after each stage of the network. */
const STAGES = ['E+P: the embedding with its position added', 'after layer 1 attention', 'after layer 1 feed-forward', 'after layer 2 attention', 'after layer 2 feed-forward', 'after the final layer norm (what the output layer reads)']
function stages(m: SeqModel, tokens: readonly number[]): Float64Array[][] {
  const { dModel: d, nLayers, nHeads, dFF } = m.desc
  const T = tokens.length
  const tok = Wt(m, 'tok.weight'), pos = Wt(m, 'pos.weight')
  let h = tokens.map((t, i) => { const x = new Float64Array(d); for (let k = 0; k < d; k++) x[k] = tok[t * d + k] + pos[i * d + k]; return x })
  const out: Float64Array[][] = [h.map((x) => Float64Array.from(x))]
  const hd = d / nHeads, scale = 1 / Math.sqrt(hd)
  for (let L = 0; L < nLayers; L++) {
    const p = `layers.${L}.`
    const a = h.map((x) => layerNorm(x, Wt(m, p + 'ln1.weight'), Wt(m, p + 'ln1.bias')))
    const qkv = a.map((x) => linear(x, Wt(m, p + 'qkv.weight'), Wt(m, p + 'qkv.bias'), 3 * d, d))
    const ctx = h.map(() => new Float64Array(d))
    for (let head = 0; head < nHeads; head++) for (let i = 0; i < T; i++) {
      const scores = new Float64Array(i + 1)
      for (let j = 0; j <= i; j++) { let s = 0; for (let k = 0; k < hd; k++) s += qkv[i][head * hd + k] * qkv[j][d + head * hd + k]; scores[j] = s * scale }
      const w = softmax(scores)
      for (let j = 0; j <= i; j++) for (let k = 0; k < hd; k++) ctx[i][head * hd + k] += w[j] * qkv[j][2 * d + head * hd + k]
    }
    h = h.map((x, i) => { const o = linear(ctx[i], Wt(m, p + 'o.weight'), Wt(m, p + 'o.bias'), d, d); return x.map((v, k) => v + o[k]) })
    out.push(h.map((x) => Float64Array.from(x)))
    h = h.map((x) => {
      const f = linear(layerNorm(x, Wt(m, p + 'ln2.weight'), Wt(m, p + 'ln2.bias')), Wt(m, p + 'fc.weight'), Wt(m, p + 'fc.bias'), dFF, d)
      for (let k = 0; k < dFF; k++) f[k] = gelu(f[k])
      const pr = linear(f, Wt(m, p + 'proj.weight'), Wt(m, p + 'proj.bias'), d, dFF)
      return x.map((v, k) => v + pr[k])
    })
    out.push(h.map((x) => Float64Array.from(x)))
  }
  out.push(h.map((x) => layerNorm(x, Wt(m, 'lnf.weight'), Wt(m, 'lnf.bias'))))
  return out
}

// ---- contexts: how a word's vector is taken from the states of a sentence ----
const CONTEXTS = [
  { key: 'alone', name: 'the word alone, one-word prompt' },
  { key: 'own', name: 'its own position, averaged over the corpus' },
  { key: 'upto', name: 'all positions up to the word, concatenated (padded to 32), averaged over the corpus' },
  { key: 'whole', name: 'the whole sentence, concatenated (padded to 32), averaged over the corpus' },
] as const
const MAXLEN = 32
function concatPositions(states: Float64Array[], upTo: number, width: number): Float64Array {
  const v = new Float64Array(MAXLEN * width)
  for (let i = 0; i <= upTo && i < states.length; i++) v.set(states[i], i * width)
  return v
}
/** For each stage, for each context, the vector of each word. `run` gives each sentence's states per stage. */
function contextual(sentences: number[][], nStages: number, width: number, run: (tokens: number[]) => Float64Array[][]): Float64Array[][][] {
  const sums: Float64Array[][][] = CONTEXTS.map((c) => Array.from({ length: nStages }, () => WORDS.map(() => new Float64Array(c.key === 'alone' ? width : c.key === 'own' ? width : MAXLEN * width))))
  const counts = WORDS.map(() => 0)
  WORDS.forEach((w, wi) => {
    const st = run([VOCABULARY.indexOf(w)])
    for (let s = 0; s < nStages; s++) sums[0][s][wi].set(st[s][0])
  })
  for (const sent of sentences) {
    const st = run(sent)
    sent.forEach((t, i) => {
      const wi = WORDS.indexOf(VOCABULARY[t])
      if (wi < 0) return
      counts[wi]++
      for (let s = 0; s < nStages; s++) {
        const own = st[s][i]
        for (let k = 0; k < width; k++) sums[1][s][wi][k] += own[k]
        const up = concatPositions(st[s], i, width), whole = concatPositions(st[s], sent.length - 1, width)
        for (let k = 0; k < up.length; k++) { sums[2][s][wi][k] += up[k]; sums[3][s][wi][k] += whole[k] }
      }
    })
  }
  for (let c = 1; c < CONTEXTS.length; c++) for (let s = 0; s < nStages; s++) WORDS.forEach((_, wi) => { const v = sums[c][s][wi]; for (let k = 0; k < v.length; k++) v[k] /= counts[wi] || 1 })
  return sums
}

// ---- scores ----
const dist = (a: ArrayLike<number>, b: ArrayLike<number>) => { let s = 0; for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2; return Math.sqrt(s) }
function prep(vecs: Float64Array[]): Float64Array[] {
  const d = vecs[0].length, n = vecs.length, mean = new Float64Array(d)
  for (const v of vecs) for (let i = 0; i < d; i++) mean[i] += v[i] / n
  return vecs.map((v) => { const c = v.map((x, i) => x - mean[i]); let s = 0; for (const x of c) s += x * x; const k = s ? 1 / Math.sqrt(s) : 0; return c.map((x) => x * k) })
}
function nnSame(vecs: ArrayLike<number>[], label: string[]): number {
  let same = 0
  for (let i = 0; i < vecs.length; i++) {
    let best = -1, bd = Infinity
    for (let j = 0; j < vecs.length; j++) if (j !== i) { const d = dist(vecs[i], vecs[j]); if (d < bd) { bd = d; best = j } }
    if (label[best] === label[i]) same++
  }
  return same / vecs.length
}
function separation(vecs: ArrayLike<number>[], label: string[]): number {
  const d = vecs[0].length, cents: Record<string, Float64Array> = {}, n: Record<string, number> = {}
  for (let i = 0; i < vecs.length; i++) { const l = label[i]; cents[l] ??= new Float64Array(d); n[l] = (n[l] ?? 0) + 1; for (let k = 0; k < d; k++) cents[l][k] += vecs[i][k] }
  for (const l in cents) for (let k = 0; k < d; k++) cents[l][k] /= n[l]
  let within = 0
  for (let i = 0; i < vecs.length; i++) within += dist(vecs[i], cents[label[i]])
  const ls = Object.keys(cents)
  return within ? dist(cents[ls[0]], cents[ls[1]]) / (within / vecs.length) : 0
}
function silhouette(vecs: ArrayLike<number>[], label: string[]): number {
  let total = 0
  for (let i = 0; i < vecs.length; i++) {
    let a = 0, na = 0, b = 0, nb = 0
    for (let j = 0; j < vecs.length; j++) if (j !== i) { const d = dist(vecs[i], vecs[j]); if (label[j] === label[i]) { a += d; na++ } else { b += d; nb++ } }
    a /= na || 1; b /= nb || 1
    total += (b - a) / Math.max(a, b, 1e-12)
  }
  return total / vecs.length
}
function varianceInPlane(rows: Float64Array[], plane: [number, number][]): number {
  let total = 0; for (const r of rows) for (const x of r) total += x * x
  let inPlane = 0; for (const p of plane) inPlane += p[0] ** 2 + p[1] ** 2
  return total ? inPlane / total : 0
}
type Scored = Variant & { dims: number; plane: [number, number][]; scores: Record<string, number> }
function score(v: Variant): Scored {
  const rows = prep(v.vectors)
  const plane = principalPlane(v.vectors)
  const pts = plane.map((p) => Float64Array.from(p))
  const s = (vecs: ArrayLike<number>[], pre: string) => ({ [pre + 'kindNN']: nnSame(vecs, KIND), [pre + 'numberNN']: nnSame(vecs, NUMBER), [pre + 'categoryNN']: nnSame(vecs, CATEGORY), [pre + 'kindSep']: separation(vecs, KIND), [pre + 'kindSil']: silhouette(vecs, KIND) })
  return { ...v, dims: v.vectors[0].length, plane, scores: { ...s(pts, 'plane.'), ...s(rows, 'full.'), variance: varianceInPlane(rows, plane) } }
}

// ---- the page ----
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')
function scatter(plane: [number, number][], w = 300, h = 250): string {
  const xs = plane.map((p) => p[0]), ys = plane.map((p) => p[1])
  const span = (a: number[]) => { const lo = Math.min(...a), hi = Math.max(...a); const pad = (hi - lo || 1) * 0.1; return [lo - pad, hi + pad] }
  const [x0, x1] = span(xs), [y0, y1] = span(ys)
  const X = (x: number) => 8 + ((x - x0) / (x1 - x0)) * (w - 16), Y = (y: number) => h - 8 - ((y - y0) / (y1 - y0)) * (h - 16)
  const pts = WORDS.map((word, i) => {
    const noun = KIND[i] === 'noun', pl = NUMBER[i] === 'pl', color = noun ? '#2a6fdb' : '#e07a1f'
    return `<circle cx="${X(xs[i]).toFixed(1)}" cy="${Y(ys[i]).toFixed(1)}" r="3.2" fill="${pl ? 'white' : color}" stroke="${color}" stroke-width="1.4"/><text x="${(X(xs[i]) + 4.5).toFixed(1)}" y="${(Y(ys[i]) - 3).toFixed(1)}" font-size="8.5" fill="${color}">${esc(word)}</text>`
  }).join('')
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" style="background:#fafafa;border:1px solid #ddd"><line x1="${X(0).toFixed(1)}" y1="0" x2="${X(0).toFixed(1)}" y2="${h}" stroke="#e5e5e5"/><line x1="0" y1="${Y(0).toFixed(1)}" x2="${w}" y2="${Y(0).toFixed(1)}" stroke="#e5e5e5"/>${pts}</svg>`
}
const pct = (x: number) => (100 * x).toFixed(0) + '%'
const COLS: [string, string, (s: Record<string, number>) => string][] = [
  ['plane.kindNN', 'plane: noun/verb NN', (s) => pct(s['plane.kindNN'])], ['plane.numberNN', 'plane: number NN', (s) => pct(s['plane.numberNN'])], ['plane.categoryNN', 'plane: category NN', (s) => pct(s['plane.categoryNN'])], ['plane.kindSep', 'plane: noun/verb separation', (s) => s['plane.kindSep'].toFixed(2)], ['plane.kindSil', 'plane: noun/verb silhouette', (s) => s['plane.kindSil'].toFixed(2)],
  ['full.kindNN', 'full: noun/verb NN', (s) => pct(s['full.kindNN'])], ['full.numberNN', 'full: number NN', (s) => pct(s['full.numberNN'])], ['full.categoryNN', 'full: category NN', (s) => pct(s['full.categoryNN'])], ['full.kindSep', 'full: noun/verb separation', (s) => s['full.kindSep'].toFixed(2)], ['full.kindSil', 'full: noun/verb silhouette', (s) => s['full.kindSil'].toFixed(2)],
  ['variance', 'share of variation in the plane', (s) => pct(s.variance)],
]
function page(rows: Scored[]): string {
  const table = `<table id="scores"><thead><tr><th data-k="group">model</th><th data-k="name">the vector for each word</th><th data-k="trained">trained</th><th data-k="dims">dims</th>${COLS.map(([k, label]) => `<th data-k="${k}">${label}</th>`).join('')}</tr></thead><tbody>${rows.map((r, i) => `<tr data-i="${i}"><td>${esc(r.group)}</td><td><a href="#plane-${i}">${esc(r.name)}</a></td><td>${r.trained ? 'yes' : 'no'}</td><td data-v="${r.dims}">${r.dims}</td>${COLS.map(([k, , f]) => `<td data-v="${r.scores[k]}">${f(r.scores)}</td>`).join('')}</tr>`).join('')}</tbody></table>`
  const planes = rows.filter((r) => r.trained).map((r) => `<figure id="plane-${rows.indexOf(r)}"><figcaption><b>${esc(r.group)}</b><br>${esc(r.name)}<br><span class="m">${r.dims} numbers · plane: noun/verb NN ${pct(r.scores['plane.kindNN'])}, number NN ${pct(r.scores['plane.numberNN'])}, separation ${r.scores['plane.kindSep'].toFixed(2)} · full: noun/verb NN ${pct(r.scores['full.kindNN'])}, number NN ${pct(r.scores['full.numberNN'])} · ${pct(r.scores.variance)} of the variation in the plane</span></figcaption>${scatter(r.plane)}</figure>`).join('')
  return `<!doctype html><meta charset="utf-8"><title>Step 5 planes: every way to give a word a vector</title>
<style>body{font:14px/1.45 -apple-system,Helvetica,Arial,sans-serif;margin:24px;max-width:1400px;color:#222}h1{font-size:20px}h2{font-size:16px;margin-top:32px}p{max-width:900px}table{border-collapse:collapse;font-size:12px;margin:12px 0}th,td{border:1px solid #ddd;padding:3px 6px;text-align:right;white-space:nowrap}th{background:#f2f2f2;cursor:pointer;position:sticky;top:0}td:nth-child(1),td:nth-child(2),th:nth-child(1),th:nth-child(2){text-align:left}td:nth-child(2){white-space:normal;max-width:360px}tr:hover td{background:#f7f7ff}.grid{display:flex;flex-wrap:wrap;gap:14px}figure{margin:0;width:300px}figcaption{font-size:11px;min-height:96px;margin-bottom:4px}.m{color:#666}a{color:#2a6fdb;text-decoration:none}code{background:#f2f2f2;padding:0 3px}</style>
<h1>Step 5 planes: every way to give a noun or verb a vector</h1>
<p>The 50 nouns and verbs of Part 4's vocabulary, each given a vector in one of the ways below, then drawn as the lab's plane: each vector centred and scaled to unit length, then projected onto the two directions of greatest difference (a principal-component plane; with these distances it is the same picture classical MDS gives). Nouns blue, verbs orange; singular filled, plural hollow. Models are the shipped snapshot after 20,000 updates; the table also has the untrained snapshot (0 updates) for every variant, as a baseline. Scores: <b>NN</b> is the share of words whose nearest neighbour has the same label (noun/verb; singular/plural; Elman's category: human, large animal, small animal, breakable, food, other, and for verbs transitive, optional, intransitive). Chance is about 52% for noun/verb, 50% for number, and 15% for category. <b>Separation</b> is the distance between the noun and verb centroids over the mean distance of a word to its own centroid. <b>Silhouette</b> is the usual one, for noun/verb, from −1 to 1. Each score is given in the plane (the picture) and in the full space (all the numbers). The last column is how much of the variation among the vectors the plane's two directions capture. Click a column header to sort.</p>
<h2>How the transformer is laid out</h2>
<p>Two layers, each an attention sublayer followed by a feed-forward sublayer, both added to the residual stream after a layer norm: in your notation E–A–H–A–H, then a final layer norm and the output layer (its own 53 × 32 matrix, not tied to the embeddings). The same weights apply at every position; what differs by position is the state, a vector of 32 numbers per position per stage, and the position embedding added at the start. So a word's vector from a hidden stage needs a context, and the page uses four: the word alone as a one-word prompt; the state at the word's own position in each corpus sentence it appears in, averaged over those occurrences; the states at every position up to and including the word, laid end to end and padded to the 32-position window (1,024 numbers), averaged; and the whole sentence's states laid end to end, averaged. The recurrent network has the same four contexts, with its 64-unit hidden layer.</p>
<h2>Scores</h2>${table}
<h2>Planes, trained snapshot</h2><div class="grid">${planes}</div>
<script>
document.querySelectorAll('#scores th').forEach((th,ci)=>th.addEventListener('click',()=>{const tb=document.querySelector('#scores tbody');const rows=[...tb.rows];const num=rows.every(r=>r.cells[ci].dataset.v!==undefined);const dir=th.dataset.dir==='desc'?'asc':'desc';th.dataset.dir=dir;rows.sort((a,b)=>{const x=num?+a.cells[ci].dataset.v:a.cells[ci].textContent,y=num?+b.cells[ci].dataset.v:b.cells[ci].textContent;return (x<y?-1:x>y?1:0)*(dir==='desc'?-1:1)});rows.forEach(r=>tb.appendChild(r))}))
</script>`
}

describe('embedding review page', () => {
  it('writes it', () => {
    const sentences = corpus(makeRng(SETTINGS.corpusSeed), SETTINGS.corpusSentences).map((s) => s.map((t) => VOCABULARY.indexOf(t)))
    const tokens = sentences.flat()
    const variants: Variant[] = []
    for (const [windowSize, separate, name] of [[4, true, 'window 4, the lists before and after (the lab’s)'], [4, false, 'window 4, before and after summed'], [1, true, 'window 1, before and after'], [8, true, 'window 8, before and after']] as const) {
      const m = countStream(makeCountModel(windowSize, separate), tokens)
      variants.push({ group: 'count model', name, trained: true, vectors: WORDS.map((w) => embedding(m, VOCABULARY.indexOf(w))) })
    }
    for (const trained of [true, false]) {
      const updates = trained ? undefined : 0
      const tr = loadShipped('transformer', updates), srn = loadShipped('srn', updates)
      const d = tr.desc.dModel, H = srn.desc.hidden
      const row = (w: Float32Array, width: number, t: number) => Float64Array.from(w.subarray(t * width, t * width + width))
      const tokW = Wt(tr, 'tok.weight'), outW = Wt(tr, 'out.weight')
      variants.push({ group: 'transformer weights', name: 'input embedding (tok.weight row)', trained, vectors: WORDS.map((w) => row(tokW, d, VOCABULARY.indexOf(w))) })
      variants.push({ group: 'transformer weights', name: 'output weights (out.weight row)', trained, vectors: WORDS.map((w) => row(outW, d, VOCABULARY.indexOf(w))) })
      variants.push({ group: 'transformer weights', name: 'input embedding and output weights, concatenated', trained, vectors: WORDS.map((w) => { const v = new Float64Array(2 * d); v.set(row(tokW, d, VOCABULARY.indexOf(w)), 0); v.set(row(outW, d, VOCABULARY.indexOf(w)), d); return v }) })
      variants.push({ group: 'transformer weights', name: 'layer 1 query, key and value of the word alone (what attention reads from it)', trained, vectors: WORDS.map((w) => { const st = stages(tr, [VOCABULARY.indexOf(w)])[0][0]; return linear(layerNorm(st, Wt(tr, 'layers.0.ln1.weight'), Wt(tr, 'layers.0.ln1.bias')), Wt(tr, 'layers.0.qkv.weight'), Wt(tr, 'layers.0.qkv.bias'), 3 * d, d) }) })
      const trStates = contextual(sentences, STAGES.length, d, (t) => stages(tr, t))
      CONTEXTS.forEach((c, ci) => STAGES.forEach((stage, si) => variants.push({ group: 'transformer states', name: `${stage}; ${c.name}`, trained, vectors: trStates[ci][si] })))
      const wih = Wt(srn, 'w_ih.weight'), inDim = srn.desc.tensors['w_ih.weight'].shape[1], srnOut = Wt(srn, 'out.weight')
      variants.push({ group: 'recurrent network weights', name: 'input weights (the token’s column of w_ih; Step 5’s)', trained, vectors: WORDS.map((w) => { const t = VOCABULARY.indexOf(w); const v = new Float64Array(H); for (let j = 0; j < H; j++) v[j] = wih[j * inDim + t]; return v }) })
      variants.push({ group: 'recurrent network weights', name: 'output weights (out.weight row)', trained, vectors: WORDS.map((w) => row(srnOut, H, VOCABULARY.indexOf(w))) })
      const srnStates = contextual(sentences, 1, H, (t) => [srnForward(srn, t).hidden])
      CONTEXTS.forEach((c, ci) => variants.push({ group: 'recurrent network states', name: `hidden layer; ${c.name}`, trained, vectors: srnStates[ci][0] }))
    }
    const rows = variants.map(score)
    mkdirSync(OUT, { recursive: true })
    writeFileSync(join(OUT, 'index.html'), page(rows))
    console.log(`wrote ${join(OUT, 'index.html')}: ${rows.length} variants`)
    for (const r of rows.filter((r) => r.trained)) console.log(`${r.group} | ${r.name} | ${r.dims} | plane kind ${pct(r.scores['plane.kindNN'])} number ${pct(r.scores['plane.numberNN'])} | full kind ${pct(r.scores['full.kindNN'])} number ${pct(r.scores['full.numberNN'])} | var ${pct(r.scores.variance)}`)
  })
})
