/**
 * The adjusted ratio of clustering of Roenker, Thompson and Brown (1971),
 * for Part 2 (spec §6.3):
 *
 *   ARC = (R − E(R)) / (maxR − E(R))
 *
 * R is the observed number of adjacent pairs in the output that share a
 * category, E(R) = Σ nₖ² / N − 1 is the number expected by chance, and
 * maxR = N − k is the most possible, where N is the number of words
 * recalled, nₖ the number recalled from category k, and k the number of
 * categories represented. 1 is perfect clustering and 0 the level expected
 * by chance. Only correctly recalled words count: a word with no category
 * is dropped before the count, and a word recalled twice counts once.
 */

export interface ArcPieces {
  /** The scored output, in order, with each word's category. */
  output: { word: string; category: string }[]
  N: number
  k: number
  /** nₖ per category, in order of first appearance. */
  counts: { category: string; n: number }[]
  R: number
  E: number
  maxR: number
  arc: number | null
}

export function arc(outputOrder: string[], categoryOf: (w: string) => string | null): ArcPieces {
  const seen = new Set<string>()
  const output: { word: string; category: string }[] = []
  for (const w of outputOrder) {
    const category = categoryOf(w)
    if (category === null || seen.has(w)) continue
    seen.add(w)
    output.push({ word: w, category })
  }
  const N = output.length
  const counts: { category: string; n: number }[] = []
  for (const o of output) {
    const c = counts.find((x) => x.category === o.category)
    if (c) c.n++
    else counts.push({ category: o.category, n: 1 })
  }
  const k = counts.length
  let R = 0
  for (let i = 1; i < N; i++) if (output[i].category === output[i - 1].category) R++
  const E = N > 0 ? counts.reduce((s, c) => s + c.n * c.n, 0) / N - 1 : 0
  const maxR = N - k
  const denominator = maxR - E
  return { output, N, k, counts, R, E, maxR, arc: Math.abs(denominator) < 1e-9 ? null : (R - E) / denominator }
}
