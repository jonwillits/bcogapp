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
  {
    id: 'm03-neuron',
    name: 'Lab 3 — The Neuron',
    route: '#/m03-neuron',
    scene: 'src/scenes/m03_neuron',
    handout: 'neurons_and_neural_communication/neuron_lab/neuron_lab.md',
    report: 'neurons_and_neural_communication/neuron_lab/neuron_lab_report.docx',

    retired: [
      { term: /\bthe pit\b/gi, why: 'it is called the arena, as in Lab 2' },
      {
        term: /watch all four vehicles/gi,
        why: 'each cell loads with its own world, one at a time - "load each of the four in turn"',
      },
      {
        term: /whether behaviou?r alone lets you sort them/gi,
        why: 'the four are distinguishable by style but not diagnosable by it - ask whether behaviour tells you what is wrong',
      },
    ],

    controls: [
      'Signal type', 'Sensor-to-actuator distance', 'World speed (how fast the lights move)',
      'How many lights', 'Reset', 'New seed', 'Reaction time', 'Signal path length',
      'Lights collected', 'Energy per light',
      'Where the inputs come from', 'Mirror this wiring to the other cell', 'Time window for the output',
      'Sodium-potassium pump power (Na⁺/K⁺)', 'Sodium channels blocked',
      'How fast sodium channels reset', 'Current injected into the neuron', 'Restore healthy membrane',
      'Show the equations', 'Brain Energy Calculator', 'Things to try', 'Myelin on the axon',
      'Step one spike', 'Real time', 'Ten times slower than life', 'Fifty times slower than life', 'Simulation speed',
      'Reveal faults', 'Lesions', 'Load a vehicle', 'Neuron Information', 'World Information',
    ],

    claims: [
      { says: 'N1-N4 all collect fewer lights than the healthy vehicle; N1 and N2 almost none', test: 'every sick cell collects less than the healthy one' },
      { says: 'N1 has nothing wrong with its cell and yields only to a slower world', test: 'yields to a slow world' },
      { says: "N2's fault shows on the Neurons tab's printed strengths", test: 'printed strengths give it away' },
      { says: 'N3 is nearly normal at rest and fails under sustained demand', test: 'only fails under sustained maximum input' },
      { says: 'N4 has the lowest energy per light collected of the four', test: 'lowest energy per light collected' },
      { says: 'Q6: the arithmetic prints 25, 10, 0 and the measured rate differs', test: 'give 25, 10' },
      { says: 'Q7: the curve is flat on the left and levels off on the right, and neither end is a parameter', test: 'no named parameter sets the floor' },
      { says: 'Q10: pump off - rest rises, spikes shrink below half, ATP reads zero', test: 'pump off, rest rises' },
      { says: 'Q10: a silent cell with its pump on still spends ATP', test: 'cell silent, the ATP counter is non-zero' },
      { says: 'Q12: instant reset raises the ceiling (off the sliders, on the curve) and lets spikes travel backwards', test: 'raises the ceiling and permits backward propagation' },
      { says: 'Q12: with instant reset the curve no longer levels off within the plotted range', test: 'upper flat region is absent' },
      { says: 'Q2/Q3: a diffusing chemical takes about ten seconds across 100 µm, and a thousandfold distance costs a millionfold time', test: 'quadruples per doubling' },
      { says: 'Q4: a graded signal is gone by a centimetre', test: 'gone by a centimetre' },
      { says: 'Q20: 10 spikes/s is far over budget; 20 W affords under 1.5 spikes/s', test: 'lands between 0.3 and 1.5' },
      { says: 'Q25: predicted and measured agree in the middle and part company at the top', test: 'agree through the middle and part company' },
      { says: 'no anatomy on the Neurons tab; the output function is never named', test: 'contains no anatomy' },
      { says: 'Q1: the chemical vehicle does fine in the slow world and fails in the fast one', test: null },
      { says: 'the four sick cells are not sortable by watching', test: null },
    ],

    crib: 'crib: what the five cells should look like',
  },
]
