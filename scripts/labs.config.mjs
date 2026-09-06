/**
 * Every lab that has student-facing documents, and what must stay true of it.
 *
 * Adding a lab means adding an entry here. Nothing else in `check-docs.mjs` or
 * `closeout.mjs` knows about any particular module.
 *
 * The four per-lab fields are the four ways a lab has gone wrong:
 *
 *   retired   words the design has abandoned, which strand themselves in the
 *             documents and are read by students for months
 *   controls  names the documents use for things in the app, which drift the
 *             moment a control is renamed
 *   claims    promises about what a student will *see*, which no word-checker
 *             can verify and which therefore need a test each
 *   crib      the probe that prints what a person should look for, since
 *             nothing headless can see motion
 */

export const COURSE =
  process.env.INTRO_TO_BCS ??
  '/Users/jon/Library/CloudStorage/Box-Box/teaching/bcog_web/courses/introduction_to_brain_and_cognitive_science_1/current_version/intro_to_bcs'

/**
 * House style, checked in every lab. Keep this short: a rule here applies to
 * documents nobody is currently thinking about.
 */
export const BANNED_EVERYWHERE = [
  {
    term: /\bcolour\b|\bbehaviour\b|\bfavour[a-z]*\b|\bcentre\b|\banalyse[a-z]*\b/gi,
    why: 'US spelling in student-facing text',
  },
]

export const LABS = [
  {
    id: 'm02-evolution',
    name: 'Lab 2 — Evolving Vehicles',
    route: '#/m02-evolution',
    scene: 'src/scenes/m02_evolution',
    handout: 'comparative_approaches/evolution_lab/evolution_lab.md',
    report: 'comparative_approaches/evolution_lab/evolution_lab_report.docx',

    /**
     * Each entry may carry `unless` phrases: the places the term is used
     * *correctly*, which is usually to tell students it no longer applies.
     */
    retired: [
      {
        term: /\bgenerations?\b/gi,
        why: 'the engine has no generations - use a duration or a birth count',
        unless: ['there are no generations'],
      },
      {
        term: /\b(average|mean) energy\b/gi,
        why: 'no energy readout exists; the panel shows births per minute',
      },
      { term: /Reset \(same seed\)/gi, why: 'the button is "Reset simulation"' },
      { term: /\bpopulation size\b/gi, why: 'the control is "How many the arena holds"' },
      { term: /\bthe pit\b/gi, why: 'it is called the arena' },
      {
        term: /body colou?r (you recorded|of most)/gi,
        why: 'the neutral trait is the mark; body colour is computed from the wiring',
      },
      {
        term: /light (dims|runs out|is used up)/gi,
        why: 'food patches drift and never deplete',
      },
    ],

    controls: [
      'Reset simulation', 'New seed', 'Founders', 'Mutation rate', 'Inheritance',
      'Selection', 'Light regime', 'How many the arena holds', 'Size of the arena',
      'Size of a food patch', 'How many food patches', 'How fast the patches drift',
      'Sensor noise', 'Reveal wiring', 'Reveal tree', 'Creature Options',
      'World Options', 'Run Options', 'View Options', 'Population W', 'Population Z',
      'Born since the start', 'Creatures alive', 'Births per minute, early on',
      'Births per minute, now', 'Food', 'Poison', 'Neutral',
    ],

    /**
     * `test` is a distinctive fragment of the test name that would go red if
     * the claim stopped being true. `null` means nobody has measured it, and
     * the close-out prints it as an unbacked promise rather than assuming.
     */
    claims: [
      { says: 'W, X and Y all reach the light and stay; Z does not', test: 'reach the light and stay near it' },
      { says: 'W and X cannot be told apart by watching', test: 'sisters are indistinguishable' },
      { says: 'Y differs by driving backwards and by nothing else', test: 'nothing a student is not told about' },
      { says: 'a designed perturbation separates Y from W and X', test: 'perturbations separate Y' },
      { says: 'the default world does not already give the mechanism away', test: 'not already given away' },
      { says: 'each population fails in the other world (Q18)', test: 'fails in the other' },
      { says: 'the saved lineages are genuine engine output', test: 'reproduces exactly from its recipe' },
      { says: 'Part 1: a population visibly adapts', test: null },
    ],

    crib: 'crib: what each population should look like',
  },
]
