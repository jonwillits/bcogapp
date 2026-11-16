import { VOCABULARY } from './grammar'

/**
 * Part 4, Step 2's count model (spec §8.3), of the kind of Lund and
 * Burgess (1996, p. 204): a window of `windowSize` words moves along the
 * corpus one word at a time, and for every word inside the window before
 * the current word, the pair's count goes up by the window size minus the
 * distance plus one, so that a word next to the current word adds the
 * most and a word at the window's edge adds one. With "count words before
 * and after separately" on, a word's counts of the words before it (its
 * row) and of the words after it (its column) are two lists, joined into
 * one embedding of length 2V, as the original concatenated a word's row
 * and column; off, the two are added into one list of length V.
 *
 * The corpus is counted as one stream of tokens, end marks included, so
 * that a window can span a sentence's end, as the original's did.
 */
export interface CountModel {
  windowSize: number
  separate: boolean
  vocab: string[]
  /** before[i][j]: how much word j occurred before word i within the window; after[i][j]: after. */
  before: Float64Array[]
  after: Float64Array[]
}

export function makeCountModel(windowSize: number, separate: boolean, vocab: string[] = VOCABULARY): CountModel {
  const V = vocab.length
  return { windowSize, separate, vocab, before: Array.from({ length: V }, () => new Float64Array(V)), after: Array.from({ length: V }, () => new Float64Array(V)) }
}

/** Count a stretch of the stream; `onStep` reports progress for the screen's filling table. Returns the model. */
export function countStream(m: CountModel, tokens: readonly number[], from = 0, to = tokens.length): CountModel {
  const w = m.windowSize
  for (let i = Math.max(from, 0); i < Math.min(to, tokens.length); i++) {
    const cur = tokens[i]
    for (let d = 1; d <= w && i - d >= 0; d++) {
      const prev = tokens[i - d]
      const weight = w - d + 1
      m.before[cur][prev] += weight
      m.after[prev][cur] += weight
    }
  }
  return m
}

/** A word's embedding: its list of counts. */
export function embedding(m: CountModel, word: number): Float64Array {
  const V = m.vocab.length
  if (m.separate) {
    const e = new Float64Array(2 * V)
    e.set(m.before[word], 0)
    e.set(m.after[word], V)
    return e
  }
  const e = new Float64Array(V)
  for (let j = 0; j < V; j++) e[j] = m.before[word][j] + m.after[word][j]
  return e
}

export function cosine(a: Float64Array, b: Float64Array): number {
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0
}

/** The k nearest neighbors of a word by cosine similarity of embeddings, among `among` (default every word but itself). */
export function nearest(m: CountModel, word: number, k = 5, among?: number[]): { word: number; similarity: number }[] {
  const e = embedding(m, word)
  const cands = (among ?? m.vocab.map((_, i) => i)).filter((i) => i !== word)
  return cands
    .map((i) => ({ word: i, similarity: cosine(e, embedding(m, i)) }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, k)
}

/** What one sentence adds to the count table: the pairs and their weights, for Step 3's Order screen. */
export function contribution(windowSize: number, separate: boolean, tokens: readonly number[], vocab: string[] = VOCABULARY): CountModel {
  return countStream(makeCountModel(windowSize, separate, vocab), tokens)
}

/** Two count tables are identical: for the Order screen's claim. */
export function sameCounts(a: CountModel, b: CountModel): boolean {
  const V = a.vocab.length
  for (let i = 0; i < V; i++) for (let j = 0; j < V; j++) if (embedding(a, i)[j] !== embedding(b, i)[j] || (a.separate && embedding(a, i)[V + j] !== embedding(b, i)[V + j])) return false
  return true
}

// -------------------------------------------------------------- projections

/** The first two principal components of a set of vectors, by power iteration on the centered data; returns each vector's two coordinates. */
export function principalPlane(vectors: Float64Array[], iterations = 200): [number, number][] {
  const n = vectors.length
  if (n === 0) return []
  const d = vectors[0].length
  const mean = new Float64Array(d)
  for (const v of vectors) for (let i = 0; i < d; i++) mean[i] += v[i] / n
  const X = vectors.map((v) => v.map((x, i) => x - mean[i]))
  // Scale each vector to unit length so that frequent words do not dominate the plane: the directions of difference, not the sizes.
  const rows = X.map((v) => {
    let s = 0
    for (const x of v) s += x * x
    const k = s ? 1 / Math.sqrt(s) : 0
    return v.map((x) => x * k)
  })
  const comps: Float64Array[] = []
  for (let c = 0; c < 2; c++) {
    let w = new Float64Array(d).map((_, i) => Math.sin(i + 1 + c))
    for (let it = 0; it < iterations; it++) {
      const next = new Float64Array(d)
      for (const r of rows) {
        let proj = 0
        for (let i = 0; i < d; i++) proj += r[i] * w[i]
        for (let i = 0; i < d; i++) next[i] += proj * r[i]
      }
      for (const p of comps) {
        let dot = 0
        for (let i = 0; i < d; i++) dot += next[i] * p[i]
        for (let i = 0; i < d; i++) next[i] -= dot * p[i]
      }
      let norm = 0
      for (const x of next) norm += x * x
      norm = Math.sqrt(norm) || 1
      w = next.map((x) => x / norm)
    }
    comps.push(w)
  }
  return rows.map((r) => {
    const out: [number, number] = [0, 0]
    for (let c = 0; c < 2; c++) for (let i = 0; i < d; i++) out[c] += r[i] * comps[c][i]
    return out
  })
}

export interface Cluster {
  members: number[]
  height: number
  children?: [Cluster, Cluster]
}

/** Agglomerative clustering by average linkage on cosine distance (1 − similarity): the two most similar clusters join first. */
export function clusterTree(vectors: Float64Array[]): Cluster {
  let clusters: Cluster[] = vectors.map((_, i) => ({ members: [i], height: 0 }))
  const dist = (a: Cluster, b: Cluster) => {
    let s = 0
    for (const i of a.members) for (const j of b.members) s += 1 - cosine(vectors[i], vectors[j])
    return s / (a.members.length * b.members.length)
  }
  while (clusters.length > 1) {
    let bi = 0
    let bj = 1
    let best = Infinity
    for (let i = 0; i < clusters.length; i++)
      for (let j = i + 1; j < clusters.length; j++) {
        const d = dist(clusters[i], clusters[j])
        if (d < best) {
          best = d
          bi = i
          bj = j
        }
      }
    const merged: Cluster = { members: [...clusters[bi].members, ...clusters[bj].members], height: best, children: [clusters[bi], clusters[bj]] }
    clusters = clusters.filter((_, k) => k !== bi && k !== bj)
    clusters.push(merged)
  }
  return clusters[0]
}
