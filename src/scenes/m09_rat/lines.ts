/**
 * The lines on screen that are content, not decoration (Module 9 spec
 * §11). Each is short, each has a string test in `naming.test.ts`, and
 * each sits on the panel the spec names.
 */

/** 1. Every tab. */
export const RATS_LINE =
  'Rats stand in for the early mammals of the reading. Most of what is known about these cells comes from rats.'

/** 2. Part 3. */
export const MODELS_LINE = 'These cells are a model computed by this program, not recordings from a rat.'

/** 3. Part 3. */
export const ESTIMATE_LINE =
  'These cells respond to where the rat’s own estimate puts it, which can differ from where it is.'

/** 4. Part 3, beside the grid cells. */
export const GRID_LINE =
  'Computing grid cells from the running sum is the leading hypothesis, not an established finding.'

/** 5. Part 3, beside the place cells. */
export const PLACE_LINE = 'Here, place cells are computed from the estimate directly, not built from grid cells.'

/** 6. Part 3, beside the rings. */
export const RINGS_LINE =
  'In the rat, these cells are not laid out in a circle. Each ring arranges them by the direction each prefers.'

/** 7. Part 1’s orienting screen. */
export const SCREEN_LINE =
  'A screen gives no sense of balance and no feeling of the body moving. Here, how far and which way you have gone comes only from the ground moving past and the keys you pressed.'

/** 8. Part 2. */
export const PROGRAMMED_LINE = 'Each hidden rat follows one programmed strategy. Real rats use several at once.'

/** 9. Part 3. */
export const MAP_RULE_LINE =
  'The program chooses a room’s map by a rule that compares rooms. It is not a model of the hippocampus’s own circuits.'

/** 10. The closer. */
export const LEAVING_LINE = 'The rule says when leaving pays best, not how an animal comes to leave.'

/** 11. The closer, if the home base is built. */
export const HOME_BASE_LINE = 'This is one proposal for why rats explore from a home base.'

/** 12. Part 1’s reveal. */
export const NAVIGATORS_LINE =
  'These navigators are programs given the same trips. Ending in the same place does not show the same procedure.'

/** 13. Part 3, beside the grid cells. */
export const THREE_GROUPS_LINE =
  'This model has three groups of grid cells. The most thoroughly recorded rats have four or five.'

/** 14. Part 1’s orienting screen. */
export const COMFORT_LINE = 'Anyone who feels unwell can switch to the follow view or tick the Narrower view box.'

/** 15. Part 3, beside the rings. */
export const TWO_RINGS_LINE =
  'The lower ring stands for the start of the chain, low in the brain, where the heading is kept from turns. The upper ring stands for the cells recorded further up, where a landmark can correct it.'

/** The commit-then-reveal rule, on the World tab. */
export const COMMIT_RULE_LINE =
  'Nothing a test would tell you is shown until you commit: not where the nest truly was, not what a hidden rat relies on, not what a change did to the cells.'

/** The one assumption the reading does not state, beside the lesion step. */
export const LESION_ASSUMPTION_LINE =
  'The reading reports that the cells kept firing but not for any one heading. That the lower ring then holds no bump, because the turn pathway also carried a steady drive, is this model’s assumption.'
