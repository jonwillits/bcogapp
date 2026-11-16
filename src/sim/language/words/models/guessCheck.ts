import type { Rng } from '../../../random'
import type { Trial } from '../design'

/**
 * Guess and check (spec §7.3; Trueswell et al., 2013; Medina et al., 2011,
 * both pending in the library, so no rule beyond the spec's is used). On a
 * word's first occurrence it picks an object on the screen at random. On
 * each later occurrence it recalls its last pick for that word with
 * probability α. If it recalls the pick and that object is present, it
 * picks it again. Otherwise it picks an object on the screen at random.
 * It stores one object per word and nothing else: no count, no history
 * (structural test in `structure.test.ts`). Its one parameter is α.
 */
export interface GuessCheck {
  alpha: number
  /** The one stored object per word, or -1 for none. */
  lastPick: number[]
}

export function makeGuessCheck(alpha: number, nWords: number): GuessCheck {
  return { alpha, lastPick: Array(nWords).fill(-1) }
}

export function guessCheckChoose(m: GuessCheck, t: Trial, rng: Rng): number {
  const last = m.lastPick[t.word]
  let pick: number
  if (last >= 0 && rng.next() < m.alpha && t.objects.includes(last)) pick = last
  else pick = t.objects[rng.int(t.objects.length)]
  m.lastPick[t.word] = pick
  return pick
}
