/**
 * The two places the Module 5 scene says, on its own face, where it is not
 * being literal. Both are content rather than disclaimers — the handout asks
 * a question about the first — and `naming.test.ts` asserts both are on screen.
 */

/** On the Credit section and on the corridor's World panel. §5.1.11 puts tier four with the vertebrates. */
export const TIER_FOUR_LINE =
  'Real nematodes do not bridge delays of this kind: that capacity arrives with the vertebrates. The rule is being run here anyway, in an animal that does not have it, to show what the rule requires.'

/** On the Chemistry tab, beside the broadcast signal. §5.3.7 says exactly this, and the scene is no more confident than the chapter. */
export const DOPAMINE_EVIDENCE_LINE =
  'The recordings that established this were made in vertebrates, and largely in primates. How far down the tree the arrangement extends is a separate question.'

export const SIGNAL_COLORS = {
  phi: '#ffd166',
  dopamine: '#ff6fae',
  value: '#5ee6d6',
  verdict: '#4f9cff',
} as const
