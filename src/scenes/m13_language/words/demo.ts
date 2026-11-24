/**
 * Step 3's six-trial demonstration (Jon, 2026-11-23): a short fixed
 * sequence made for clarity, not drawn from the student's trials, on which
 * the two models are stepped through one trial at a time. Two words and
 * three objects; the first word names object A, the second names object C.
 * Every pick that the models make "at random" is scripted here, so that the
 * sequence shows each rule at work: guess and check with no pick stored
 * (trials 1 and 2), a stored pick that is gone (trial 3), a stored pick
 * that is present (trials 4 to 6); tallying picking at random on equal
 * counts (trials 1 and 2) and then by the higher count, among them trial 3,
 * where its count for object A survives the wrong pick on trial 1 while
 * guess and check has forgotten A. Nothing here is a parameter of the
 * models: α is 1 and β is large, so that every step is determinate.
 */
export type DemoObject = 'A' | 'B' | 'C'
export const DEMO_OBJECTS: DemoObject[] = ['A', 'B', 'C']
/** Which shipped object file stands for each letter (the first set's first three). */
export const DEMO_OBJECT_IDS: Record<DemoObject, string> = { A: 'object01', B: 'object02', C: 'object03' }
export const DEMO_WORDS = ['word 1', 'word 2'] as const
/** word index → the object it names. */
export const DEMO_PAIRING: DemoObject[] = ['A', 'C']

export interface DemoTrial {
  word: 0 | 1
  screen: [DemoObject, DemoObject]
  /** Guess and check: what it had stored for the word before the trial, what it picked, and the rule it used. */
  gc: { stored: DemoObject | null; pick: DemoObject; rule: 'nothing stored: picks at random' | 'stored pick is gone: picks at random' | 'stored pick is present: picks it' }
  /** Tallying: its counts for the word with every object before the trial, what it picked, and the rule it used. */
  tally: { pick: DemoObject; rule: 'equal counts: picks at random' | 'picks the higher count' }
}

export const DEMO_TRIALS: DemoTrial[] = [
  { word: 0, screen: ['A', 'B'], gc: { stored: null, pick: 'B', rule: 'nothing stored: picks at random' }, tally: { pick: 'B', rule: 'equal counts: picks at random' } },
  { word: 1, screen: ['C', 'B'], gc: { stored: null, pick: 'C', rule: 'nothing stored: picks at random' }, tally: { pick: 'B', rule: 'equal counts: picks at random' } },
  { word: 0, screen: ['A', 'C'], gc: { stored: 'B', pick: 'A', rule: 'stored pick is gone: picks at random' }, tally: { pick: 'A', rule: 'picks the higher count' } },
  { word: 1, screen: ['C', 'A'], gc: { stored: 'C', pick: 'C', rule: 'stored pick is present: picks it' }, tally: { pick: 'C', rule: 'picks the higher count' } },
  { word: 0, screen: ['A', 'B'], gc: { stored: 'A', pick: 'A', rule: 'stored pick is present: picks it' }, tally: { pick: 'A', rule: 'picks the higher count' } },
  { word: 1, screen: ['C', 'B'], gc: { stored: 'C', pick: 'C', rule: 'stored pick is present: picks it' }, tally: { pick: 'C', rule: 'picks the higher count' } },
]

export interface DemoState {
  /** Guess and check's stored pick for each word, after the trials so far. */
  stored: (DemoObject | null)[]
  /** Tallying's count for each word with each object, after the trials so far. */
  counts: Record<DemoObject, number>[]
}

/** The two models' memories after the first `n` trials (0 for the start). */
export function demoState(n: number): DemoState {
  const stored: (DemoObject | null)[] = [null, null]
  const counts: Record<DemoObject, number>[] = [{ A: 0, B: 0, C: 0 }, { A: 0, B: 0, C: 0 }]
  for (const t of DEMO_TRIALS.slice(0, n)) {
    stored[t.word] = t.gc.pick
    for (const o of t.screen) counts[t.word][o]++
  }
  return { stored, counts }
}

export const isDemoRight = (t: DemoTrial, pick: DemoObject): boolean => DEMO_PAIRING[t.word] === pick

/** A check that the scripted trials follow the rules they name, run by the suite. */
export function demoConsistent(): string[] {
  const errors: string[] = []
  DEMO_TRIALS.forEach((t, i) => {
    const before = demoState(i)
    const stored = before.stored[t.word]
    if (stored !== t.gc.stored) errors.push(`trial ${i + 1}: guess and check had ${stored} stored, not ${t.gc.stored}`)
    const expectRule = stored === null ? 'nothing stored: picks at random' : t.screen.includes(stored) ? 'stored pick is present: picks it' : 'stored pick is gone: picks at random'
    if (t.gc.rule !== expectRule) errors.push(`trial ${i + 1}: guess and check's rule should be "${expectRule}"`)
    if (expectRule === 'stored pick is present: picks it' && t.gc.pick !== stored) errors.push(`trial ${i + 1}: guess and check should pick its stored ${stored}`)
    if (!t.screen.includes(t.gc.pick)) errors.push(`trial ${i + 1}: guess and check picked an object not on the screen`)
    const c = before.counts[t.word]
    const [x, y] = t.screen
    const tallyRule = c[x] === c[y] ? 'equal counts: picks at random' : 'picks the higher count'
    if (t.tally.rule !== tallyRule) errors.push(`trial ${i + 1}: tallying's rule should be "${tallyRule}"`)
    if (tallyRule === 'picks the higher count' && t.tally.pick !== (c[x] > c[y] ? x : y)) errors.push(`trial ${i + 1}: tallying should pick the higher count`)
    if (!t.screen.includes(t.tally.pick)) errors.push(`trial ${i + 1}: tallying picked an object not on the screen`)
  })
  return errors
}
