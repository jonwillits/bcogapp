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
 *   strings   sim directories whose string literals reach the screen, on top
 *             of the scene's own components
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
      { term: /\bbody size\b/gi, why: 'the control is Sensor-to-actuator distance' },
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
  {
    id: 'm04-bilaterian',
    name: 'Lab 4 — The Bilaterian',
    route: '#/m04-bilaterian',
    scene: 'src/scenes/m04_bilaterian',
    /** Sim files whose strings reach the screen: scenario titles, modulator names, function labels. */
    strings: ['src/sim/bilaterian'],
    handout: 'neural_circuits_affect_and_valence/bilaterian_lab/bilaterian_lab.md',
    report: 'neural_circuits_affect_and_valence/bilaterian_lab/bilaterian_lab_report.docx',

    retired: [
      { term: /\bFive animals\b/g, why: 'the scenario is "The diagnosis dish"' },
      { term: /flip the pill/gi, why: 'the diagram calls it the routing switch' },
      { term: /\btrain(ing|ed)?\b|\bepochs?\b|learning rate/gi, why: 'nothing learns in this lab, and none of that vocabulary is in the scene' },
      { term: /dopamine|serotonin|norepinephrine|endorphin/gi, why: 'no molecule is named on screen; matching them is Q20', unless: ['Q20'] },
    ],

    controls: [
      'Scenario', 'Cue concentration', 'Source to place on a click', 'Reset', 'New seed',
      'Cues reached per minute', 'Harm', 'Crossings of the strip', 'Reversals per minute', 'Time in reverse',
      'Energy per cue reached', 'routing switch', 'forward group', 'reverse group', 'interneuron',
      'activation function', 'threshold function', 'sigmoid function', 'Restore the wiring this scenario started with',
      'Wiring — fixed until you change it', 'The arithmetic', 'The target function', 'The decision boundary', 'Steering',
      'Rows satisfied', 'pursuit', 'satiety and tone', 'arousal and vigilance', 'relief', 'Persistence',
      'Scorecard', 'Reveal faults', 'When you have committed', 'The diagnosis dish', 'The labeled line',
      'Food beyond copper', 'The world changes', 'handful of interneurons', 'connection strength', 'actuator bias',
    ],

    claims: [
      { says: 'Q1: the animal reaches food about twice a minute by comparing now against a moment ago', test: 'routed forward the animal reaches food; routed to reverse it reaches none' },
      { says: 'Q1: reversal probability rises when the comparison comes out badly and not otherwise', test: 'reversal probability rises when the comparison comes out badly' },
      { says: 'Q1: starting 180° from the source, the animal still arrives', test: 'starting 180° from the source, it still arrives in every seed' },
      { says: 'Q2: routed to reverse, it never touches the food', test: 'routed forward the animal reaches food; routed to reverse it reaches none' },
      { says: 'Q4: crossings depend on how food is weighed against copper, not on either alone', test: 'crossings depend on how food is weighed against copper' },
      { says: 'Q6: as shipped the AND animal feeds in warm water and is harmed; 1, 1, 2 feeds only in cool water', test: 'AND: as shipped the animal feeds in warm water' },
      { says: 'Q6: two strengths of 1 with a threshold of 2 fire only on (1,1)', test: 'two strengths of 1 with a threshold of 2 fire only on (1,1)' },
      { says: 'Q8: going from AND to OR by one number shifts the line and does not rotate it', test: 'shifts the line and does not rotate it' },
      { says: 'Q9: baseline and threshold slide the same line', test: 'shifts the line and does not rotate it' },
      { says: 'Q10: wired for OR the animal spends less time in danger than wired for AND', test: 'OR: one number turns AND into OR' },
      { says: 'Q11: AND NOT needs a negative weight, and with it the animal is never eaten', test: 'AND NOT: needs a negative weight' },
      { says: 'Q12: no setting of one unit satisfies XOR', test: 'no student-reachable setting of one unit satisfies XOR' },
      { says: 'Q13: moving any modulator leaves every number on the Circuit tab unchanged', test: 'moving any modulator to either extreme leaves every stored weight bit-identical' },
      { says: 'Q14: W1, W3 and W4 all reach cues well below the healthy animal', test: 'W1 to W4 all reach cues well below the healthy animal' },
      { says: 'Q14: W2 reverses far more often than any other animal', test: 'W2 reverses far more often than any other animal' },
      { says: 'Q14: W1 and W3 cannot be told apart at the shipped concentration', test: 'W1 and W3 are the same animal at the shipped concentration' },
      { says: 'Q16: at high concentration W3 recovers and W1 does not', test: 'at maximum concentration W3 recovers and W1 does not' },
      { says: 'Q17: W4 has nothing wrong with its wiring; only satiety differs', test: 'every weight, switch and threshold equals the healthy default' },
      { says: 'Q18: W4 goes into the bogs where the others will not', test: 'W4 goes where the others will not' },
      { says: 'the worked example W0 flees its food and reaches none', test: 'W0 flees its food and reaches none' },
      { says: 'Q21: harm rises and the animal does not recover within five minutes', test: 'harm counter rises and the animal does not recover' },
      { says: 'Q22: flipping the switch fixes it in one move', test: 'flipping the switch fixes it in one move' },
      { says: 'Q19: a meal kicks two levels up and they decay back over a couple of minutes', test: null },
      { says: 'Q20: the healthy animal sits nearest contentment on the plane', test: null },
    ],

    crib: 'crib: what the six animals should look like',
  },
  {
    id: 'm05-learning',
    name: 'Lab 5 — Learning',
    route: '#/m05-learning',
    scene: 'src/scenes/m05_learning',
    /** Sim files whose strings reach the screen: scenario titles, blurbs, the four settings' names. */
    strings: ['src/sim/bilaterian/learning', 'src/sim/bilaterian', 'src/scenes/m04_bilaterian'],
    handout: 'learning_and_plasticity/learning_lab/learning_lab.md',
    report: 'learning_and_plasticity/learning_lab/learning_lab_report.docx',
    /**
     * The handout was written FROM the built scene (decided 2026-09-20; live
     * 2026-09-21 after Jon's walk-through), so the claims below are still
     * phrased as what the SCENE makes true — the statements about what a
     * student will see that a passing test guarantees — and the handout
     * asserts nothing it could not find here.
     */

    retired: [
      { term: /\bfish\b/gi, why: 'the animal is Lab 4’s bilaterian; the fish is Module 7’s' },
      { term: /serotonin|norepinephrine|endorphin/gi, why: 'only dopamine is named on screen, on the broadcast signal' },
      { term: /\bepisod|\breplay|\bretriev/gi, why: 'nothing in the scene keeps a record of an occasion; Module 10 owns records', unless: ['q28', 'q29'] },
      { term: /basal gangli|cerebell|striat/gi, why: 'Module 5 stops at the synapse and the cell; Module 6 owns the anatomy' },
      { term: /Hebb’s rule setting|delta rule setting/gi, why: 'the selector’s settings are Coincidence, Prediction, Teacher and Verdict' },
    ],

    controls: [
      'Scenario', 'Let the weights change', 'Salt, then food', 'Blocking', 'Four signals, one problem', 'The corridor', 'Extinction',
      'What the world does', 'Go to phase', 'Interval between the touch and the food',
      'A second cue, almond odor, at every site', 'Almond odor marks the food (off: salt does)',
      'Wait', 'Move to the second dish', 'Deliver one outcome', 'Response to salt alone, here and now',
      'Sites touched', 'Touched and found nothing', 'Harm', 'Reset', 'New seed', 'Skip ahead 1 min', 'Skip ahead 3 min',
      'The weight trace', 'at the start', 'run started',
      'Learning on', 'Coincidence', 'Prediction', 'Teacher', 'Verdict', 'learning rate η', 'eligibility trace window',
      'discount γ, per second of delay', 'Weakening (long-term depression)', 'Competition',
      'The arithmetic', 'One occasion, by hand', 'One algorithm, written down twice', 'The signal trace', 'Credit',
      'surprise at the food', 'dopamine — the broadcast signal', 'Dopamine',
      'pursuit', 'satiety and tone', 'arousal and vigilance', 'relief',
    ],

    claims: [
      { says: 'Part 1: with the rule on, the food-odor weight moves by more than 20% and the animal is harmed anyway, in every minute of five, at every learning rate', test: 'the weight moves by more than 20%% and the animal is harmed anyway' },
      { says: 'Part 1: it is harmed as much as the animal whose weights nobody can change', test: 'is harmed as much as the animal whose weights nobody can change' },
      { says: 'Part 1: salt starts ignored and ends driving the verdict by itself', test: 'salt starts ignored and ends driving the verdict by itself' },
      { says: 'Part 1: the panel’s by-hand occasion gives 1600 at η = 1 and 16 at η = 0.01', test: 'reproduces the chapter’s arithmetic: 1600 at η = 1, 16 at η = 0.01' },
      { says: 'Part 1: one occasion at the high rate moves a weight as far as a hundred at the low rate', test: 'one occasion at the high rate moves a weight as far as a hundred at the low rate' },
      { says: 'Part 1: a second cue that co-occurs as reliably gains exactly as much', test: 'a second cue that co-occurs as reliably gains exactly as much' },
      { says: 'Part 1: past the 1.5 s the cues linger, a pairing moves the weight by less than a tenth as far', test: 'past the coincidence window, a pairing moves the weight by less than a tenth as far' },
      { says: 'Part 1: with weakening off, no weight ever goes down, in any scenario', test: 'no stored weight ever decreases — every scenario, twenty seeds' },
      { says: 'Part 1: both bounds off, the weights sit at the ceiling inside a minute and the verdict fires over most of the dish', test: 'inside a minute the weights sit at the ceiling' },
      { says: 'Part 1: with either bound on, they do not', test: 'with weakening on, they do not' },
      { says: 'Part 2: under Prediction the added cue ends below 20% of the first', test: 'under prediction, the added cue ends below 20% of the first' },
      { says: 'Part 2: under Coincidence the added cue ends within 30% of the first', test: 'under coincidence, the added cue ends within 30% of the first' },
      { says: 'Part 2: tested alone, almond odor is sought out under Coincidence and not under Prediction', test: 'almond odor is sought out under coincidence and not under prediction' },
      { says: 'Part 2: the selector changes Φ and nothing else', test: 'the same Φ gives the same Δb under every setting' },
      { says: 'Part 2: the Prediction setting holds its prediction through the arrival', test: 'not regenerated while the arrival is being resolved' },
      { says: 'Part 2: Coincidence cannot tell the cue that marks food from the one that marks nothing, and unlearns neither', test: 'coincidence cannot tell the cue that marks food' },
      { says: 'Part 2: Prediction learns which cue food follows, and follows the flip', test: 'prediction learns which cue food follows, and follows the flip' },
      { says: 'Part 2: a Teacher stops as soon as the verdict is right, near 0.7', test: 'a teacher gets there precisely' },
      { says: 'Part 2: one broadcast number is enough to follow the flip, and is the least exact of the three that can', test: 'it is the least exact of the three that can follow the flip' },
      { says: 'Part 3: value appears at the approach first, then the turn, then the marker', test: 'value seeps backward' },
      { says: 'Part 3: by the last trials the marker carries more than the surprise left at the food', test: 'the first point in the chain carries more than the food does' },
      { says: 'Part 3: with the trace window at zero the marker never gains', test: 'with the trace window at zero, the first action in the chain never gains weight' },
      { says: 'Part 3: a wider window carries value back sooner', test: 'a wider window carries the news further back sooner' },
      { says: 'Part 3: the passing vibration gains almost nothing at any window', test: 'what passes through and leads nowhere gains almost nothing' },
      { says: 'Part 3: the scene says real nematodes do not bridge this delay, on the Credit section and the corridor’s panel', test: 'the tier-four statement is on the Credit section' },
      { says: 'Closer: after extinction the salt weight sits far above where it started', test: 'the stored weight ends far above where it started' },
      { says: 'Closer: Wait brings the response back and moves no weight', test: 'spontaneous recovery: wait, with no training of any kind' },
      { says: 'Closer: Move brings it back, and moving back takes it away again', test: 'renewal: move to the second dish' },
      { says: 'Closer: one unpaired meal brings it back', test: 'reinstatement: one unpaired delivery' },
      { says: 'Closer: every return is partial, and two together return more than one', test: 'none of the returns reaches the level before extinction' },
      { says: 'Chemistry: dopamine is named on the broadcast signal, with the note that the recordings were in vertebrates and largely primates', test: 'dopamine is named, on the broadcast signal' },
      { says: 'Chemistry: moving any of the four modulators leaves every weight alone', test: 'moving any of the four functional modulators leaves every stored weight bit-identical' },
      { says: 'Throughout: same seed and same settings reproduce a run exactly', test: 'same seed and same settings reproduce a run exactly, in every scenario' },
      { says: 'Throughout: with learning off this is Lab 4, to the last bit', test: 'reproduces bit-for-bit: every scenario and every animal' },
      { says: 'Throughout: Skip ahead is the same run as watching it, and the traces record through it', test: 'a skip paid down a slice per frame is the same run as one paid at once' },
      { says: 'the weight trace shows a run-started mark and at-the-start values', test: null },
    ],

    crib: 'crib: what the weight trace and the signal trace should do',
  },
  {
    id: 'm06-brain',
    name: 'Lab 6 — One Plan, Many Brains',
    route: '#/m06-brain',
    scene: 'src/scenes/m06_brain',
    /** The data layer whose strings reach the screen: structure lines, task and tool text, the tree's cards and reveal lines. */
    strings: ['src/sim/brain'],
    handout: 'vertebrate_neural_architecture/brain_lab/brain_lab.md',
    report: 'vertebrate_neural_architecture/brain_lab/brain_lab_report.docx',
    /**
     * Built 2026-09-27 with no handout; the handout was written the same
     * evening from docs/M06_AS_BUILT_NOTES.md after Jon's walk-through, so
     * the claims below are phrased as what the SCENE makes true — what the
     * handout may assert — and the handout asserts nothing it cannot find here.
     */

    retired: [
      { term: /flythrough|fly-through/gi, why: 'the flythrough was never built; the model is taken apart and experimented on' },
      { term: /\blesion\b/gi, why: 'the tool is called Remove; the line under it names lesions as the method', unless: ['lesions, and neuropsychology'] },
      { term: /fear cent(er|re)/gi, why: 'the scene never prints it; the handout names it only as the misconception', unless: ['news story', 'phrase', 'misconception'] },
      { term: /\b(frontal|parietal|temporal|occipital) lobe|visual cortex|homunculus|prefrontal/gi, why: 'no cortical region is named in Module 6; later modules own them' },
      { term: /\bmouse\b/gi, why: 'the comparison brain on screen is “mammal”, one parameter set; the chapter’s mouse is the handout’s to cite', unless: ['the reading'] },
      { term: /log scale/gi, why: 'the true-scale view uses a magnifier, not a log scale' },
    ],

    controls: [
      'Specimens', 'Plan', 'Tree', 'Bench',
      'Commit my matches', 'True scale', 'Credits', 'Enlarge', 'See the original', 'Show the cutouts again', 'Play again with a new order',
      'from the side', 'from above', 'zoom', 'size not recorded',
      'The lamprey tour', 'Lamprey beside mammal', 'Proportions', 'The bird pallium', 'Show all seven', 'Show lamprey and mammal only',
      'Reveal the answer', 'Start over',
      'Orient', 'Tone and shock', 'Cue and food', 'Lever', 'Timed blink', 'Open field',
      'Train', 'Test', 'Run', 'Clear training', 'Record', 'Remove', 'Stimulate', 'Silence a pathway during training',
      'the neocortex', 'the dopamine clusters', 'the amygdala', 'the hindbrain', 'Restore',
      'the dopamine clusters (raise dopamine)', 'the periaqueductal gray', 'one point on the tectum', 'Point on the tectum',
      'nothing silenced', 'climbing fibers', 'dopamine fibers',
      'reported', 'follows from the chapter', 'no result reported', 'not scorable',
      'Doya’s table', 'unsupervised', 'prediction', 'supervised', 'reinforcement',
    ],

    claims: [
      { says: 'Plan: the six regions and their proportions are the chapter figure’s, number for number and color for color', test: 'the seven rows match the pasted source, number for number' },
      { says: 'Plan: the lamprey has no cerebellum and every other species set has one', test: 'the lamprey has no cerebellum, and every other vertebrate set has one' },
      { says: 'Plan: the lamprey’s pallium has three layers, the mammal’s six, and the bird’s is clustered', test: 'the lamprey’s pallium has three layers, the mammal’s six, and the bird’s is clustered' },
      { says: 'Plan: the hippocampus and the thalamus are named, not spent', test: 'the hippocampus and the thalamus are named, not spent' },
      { says: 'Plan: the pallium is labeled pallium in the lamprey and pallium (neocortex) in the mammal', test: 'uses the chapter’s naming convention' },
      { says: 'Specimens: thirteen photographs, each with a credit, a licence, a source URL and a crop box', test: 'lists at least eight specimens, each with a credit, a licence, a source URL and a crop box' },
      { says: 'Specimens: before Commit my matches, no species name, correctness or credit is rendered against any image', test: 'attaches no species name, scientific name or credit to any image' },
      { says: 'Specimens: before the reveal every image is a grayscale cutout identified only by a number', test: 'shows every image as a grayscale cutout on the neutral stage' },
      { says: 'Specimens: the same run seed gives the same order', test: 'the run seed fixes the order' },
      { says: 'Specimens: after the reveal each match is marked, named, shown as the full-color original, and linked to its source', test: 'marks each match right or wrong, names it, shows the original and links to its source' },
      { says: 'Specimens: true size comes from each original’s own scale bar and is the same at every zoom', test: 'drawn size in centimeters is the same at every zoom' },
      { says: 'Specimens: the span runs from about three centimeters to about twenty', test: 'the span runs from a few centimeters to about twenty' },
      { says: 'Specimens: the Credits view lists every credit, licence and source; the photographs are excluded from the GPL', test: 'the NOTICE exists, names every file, and excludes them from the GPL' },
      { says: 'Tree: the topology is §7.1’s and the answer key is §7.2’s card for card', test: 'the answer key matches §7.2 card for card' },
      { says: 'Tree: the large-brain card cannot be placed once; the key has three separate origins', test: 'the large-brain card’s key has three separate origins' },
      { says: 'Tree: no card is accepted on the outgroup branch', test: 'no vertebrate card is accepted on the outgroup branch' },
      { says: 'Tree: no answer-key information is rendered before Reveal the answer', test: 'before the reveal, no key branch, no mark and no reveal line is rendered' },
      { says: 'Tree: a pallium placed with the mammals is marked wrong at the reveal; the amygdala at the root is neither right nor wrong', test: 'placing is free until every card has a placement, then the reveal marks each one' },
      { says: 'Bench: the recording map is §8.5’s row for row, and a grey cell is never zero', test: 'matches §8.5 row for row' },
      { says: 'Bench: the amygdala records high in the threat task and the food task alike', test: 'the amygdala is active in the threat task and the food task alike' },
      { says: 'Bench: the dopamine cells shift from the food to the cue across training, as a primate result', test: 'show Module 5’s shift, as a primate result' },
      { says: 'Bench: removing the dopamine clusters slows every movement, and the learned tasks cannot be scored cleanly', test: 'removing the dopamine clusters lowers movement in every task' },
      { says: 'Bench: silencing the dopamine fibers during Lever training, then testing, leaves movement normal and pressing at the untrained level', test: 'silencing the dopamine fibers during Lever training, then testing, leaves movement normal and pressing at the untrained level' },
      { says: 'Bench: silencing the climbing fibers during Timed-blink training leaves the timed blink absent and the reflex blink unchanged', test: 'silencing climbing fibers during Timed-blink training leaves the timed blink absent and the reflex blink unchanged' },
      { says: 'Bench: silencing the other route leaves each task learned normally', test: 'silencing climbing fibers during Lever training leaves the lever learned normally' },
      { says: 'Bench: removing the amygdala leaves both Tone-and-shock and Cue-and-food unlearned', test: 'removing the amygdala leaves both Tone-and-shock and Cue-and-food unlearned at test' },
      { says: 'Bench: removing the neocortex leaves walking, grooming and exploring, and every other task grey', test: 'removing the neocortex leaves walking, grooming and exploring in the open field, and every other task grey' },
      { says: 'Bench: stimulating the periaqueductal gray gives the whole defensive pattern, in a rat', test: 'stimulating the periaqueductal gray gives the whole defensive pattern, in a rat' },
      { says: 'Bench: stimulating neighboring points on the tectum turns the animal toward neighboring places, monotonically', test: 'stimulating neighboring points turns the animal toward neighboring places, monotonically' },
      { says: 'Bench: the hindbrain cannot be removed, and the refusal names breathing and heart rate', test: 'the hindbrain cannot be removed, and the refusal is shown' },
      { says: 'Bench: every non-grey result carries a claim id that exists in the outline', test: 'every id exists in the live outline when it is reachable' },
      { says: 'Bench: no cell for the hippocampus is non-grey', test: 'no bench cell for the hippocampus is non-grey' },
      { says: 'Bench: the same seed reproduces every bench number', test: 'the same seed reproduces every bench number' },
      { says: 'Throughout: no cortical region, no fear center, no brain part called a module, no agentic verb', test: 'never says fear center, and never calls a brain part a module' },
      { says: 'Throughout: the three honesty lines are on screen', test: 'states the three honesty lines' },
      { says: 'Shell: the Lab button says the handout is not posted yet, not an error', test: 'the Lab pane message for the missing handout is honest and not an error' },
    ],

    /** No motion anywhere in this scene: there is no crib. What only a person can confirm is in LAB_6_WALKTHROUGH.md. */
    crib: null,
  },
  {
    id: 'm07-fish',
    name: 'Lab 7 — The Smell of an Eel',
    route: '#/m07-fish',
    scene: 'src/scenes/m07_fish',
    /** Sim files whose strings reach the screen: scenario titles and blurbs, the kinds of thing, the hidden layer's settings, the built-in receptors, the four fish, the stakes. */
    strings: ['src/sim/fish', 'src/sim/bilaterian', 'src/scenes/m07_fish'],
    handout: 'pattern_recognition/fish_lab/fish_lab.md',
    report: 'pattern_recognition/fish_lab/fish_lab_report.docx',
    /**
     * Built 2026-10-04 with no handout; the handout was written 2026-10-05,
     * after Jon's walk-through, from docs/M07_AS_BUILT_NOTES.md. The claims
     * below are what the SCENE makes true, and the handout asserts nothing it
     * cannot find here.
     */

    retired: [
      { term: /\bepochs?\b/gi, why: 'the scene counts encounters, and encounters per individual in a pool' },
      { term: /\bloss\b/gi, why: 'the learning curve plots percent wrong' },
      { term: /playground|tensorflow/gi, why: 'the Playground lab is retired; this is the fish scene' },
      { term: /spiral/gi, why: 'the spiral was replaced by the downstream scenario' },
      { term: /olfactory bulb|epitheli/gi, why: 'no receptor biology or named sensory structure; Module 8 owns the senses' },
      { term: /\bCompetition\b/g, why: 'the fourth hidden-layer setting was cut (spec §11); ask about competitive learning from the reading', unless: ['reading', '§7.2.7'] },
      { term: /\bMorph\b/g, why: 'the Morph animation was cut (spec §11)' },
      { term: /hidden layers\b/gi, why: 'there is one hidden layer; no control adds another', unless: ['Labs 4 and 5'] },
    ],

    controls: [
      'World', 'Network', 'Learning', 'Decision', 'Fish',
      'Scenario', 'One line will do', 'Jumpy or blind?', 'Ripe or rotting', 'Built in, wired at random, or learned', 'The eels it has smelled', 'Downstream', 'A new predator',
      'What the world does', 'What is in the stream', 'Scorecard', 'Encounters', 'Harm taken', 'Meals', 'Percent of verdicts right', 'Encounters per individual, on average',
      'Where the encounters come from', 'How many individuals live here', 'How much smells vary', 'Run seed', 'Reset', 'New seed',
      'Go to phase', 'An eel comes back', 'Eels and suckers stay around', 'Go downstream', 'Go back upstream', 'Learn from every distance',
      'Proportion of A (a built-in receptor)', 'Proportion only (receptors A and B disconnected)',
      'Skip ahead 100 encounters', 'Skip ahead 1,000 encounters',
      'Number of hidden units', 'activation function', 'threshold function (a hard step)', 'sigmoid function (an S-shaped curve)',
      'Both together', 'Distance from the ideal strength', 'Proportion of A', 'The output unit', 'baseline b₀', 'threshold θ',
      'Restore the wiring this scenario started with',
      'The feature space', 'Show the test set', 'Show each kind’s average (its prototype)', 'The diagram', 'The hidden-activity space', 'The learning curve',
      'Learning on', 'learning rate η', 'Who sets the hidden weights?', 'By hand', 'Pass the error back', 'Fixed at random',
      'Number of hidden units, fixed at random', 'Sparse: about one unit in ten active at once', 'Start from new random weights', 'The arithmetic',
      'criterion', 'arousal and vigilance', 'satiety and tone', 'effective criterion', 'How often an eel is upstream',
      'What each outcome is worth', 'The fish’s stakes', 'The reading’s example', 'Score this criterion', 'Energy per 100 encounters',
      'The evidence', 'The scorecard', 'Energy against criterion', 'hit rate', 'false-alarm rate', 'percent correct',
      'Hit', 'Miss', 'False alarm', 'Correct rejection',
      'Healthy', 'F1', 'F2', 'F3', 'F4', 'Reveal', 'This fish’s stream',
    ],

    claims: [
      { says: 'Engine: the hidden layer exists in this scene only; no Lab 4 or Lab 5 circuit has an output unit', test: 'no Lab 4 circuit has an output unit' },
      { says: 'Engine: Labs 4 and 5 still cannot satisfy XOR', test: 'no student-reachable setting of one unit satisfies XOR' },
      { says: 'Engine: Lab 4 runs bit-for-bit as it shipped', test: 'reproduces bit-for-bit: every scenario and every animal' },
      { says: 'Engine: only setWiring and the learning rule write a stored weight, hidden weights and built-in receptor weights included', test: 'the fish reaches a weight only through those two writes' },
      { says: 'Learning: passing the error back is the same rule: every change is η · x · Φ, through thirdFactor', test: 'structurally: every change is weightChange(η, x, Φ), every Φ comes from thirdFactor' },
      { says: 'Learning: the change matches a finite-difference estimate of the error’s gradient to within 1%', test: 'the numerical gradient check' },
      { says: 'Learning: with the threshold function, Pass the error back moves no hidden weight in 1,000 encounters, and the output’s weights still move', test: 'the threshold function blocks it' },
      { says: 'Learning: under Fixed at random the hidden weights never change', test: 'fixed at random is fixed' },
      { says: 'Learning: under By hand the rule leaves the hidden layer where it was put', test: 'by hand: the rule leaves the hidden layer where the student put it' },
      { says: 'Learning: with Sparse on, about one random unit in ten is active for a smell', test: 'sparse: about one random unit in ten is active' },
      { says: 'Learning: the prediction is made when the smell arrives and held until the outcome does', test: 'p is generated when the smell arrives and is not recomputed when the outcome does' },
      { says: 'Learning: the output’s Φ is a − p, the outcome minus the held prediction', test: 'the target is the outcome: Φ at the output is a − p' },
      { says: 'Learning: the outcome arrives on every encounter, whatever the verdict, so the fish learns from what it fled', test: 'the fish learns from an encounter it fled, and from one it stayed for' },
      { says: 'Learning: there is one hidden layer and no control adds a second', test: 'there is one hidden layer and no place for a second' },
      { says: 'World: every two-way problem is half one outcome and half the other', test: 'every two-way problem is half one outcome and half the other at the default base rate' },
      { says: 'World: a fish that never eats is right half the time on the island, not four times in five', test: 'the island is the case to watch' },
      { says: 'World: a pool is a fixed set of individuals, each with its own smell', test: 'a pool holds a fixed number of individuals, each with its own smell' },
      { says: 'World: far smells read about three tenths of near ones', test: 'far things are diluted' },
      { says: 'World: the fish never encounters the test set', test: 'the test sets are the experimenter’s' },
      { says: 'World: the fish keeps no list of occasions; its state is a fixed number of numbers', test: 'the fish’s state is the same size after ten encounters and after five thousand' },
      { says: 'Part 1 and throughout: Reset restores the weights and keeps every setting', test: 'restores the weights to where the run started, keeps every setting' },
      { says: 'Part 2: moving the criterion or either modulator changes no weight, no baseline and no evidence value', test: 'moving the criterion, or either modulator, changes no weight, no baseline and no evidence value' },
      { says: 'Part 2: hits and false alarms rise and fall together as the criterion moves', test: 'the hit rate and the false-alarm rate move in the same direction' },
      { says: 'Part 2: learning does not undo a criterion', test: 'two fish that differ only in criterion and chemistry learn bit-identical weights' },
      { says: 'Part 2: d′ in this world is near 2', test: 'Part 2’s world gives a d′ near 2' },
      { says: 'Part 2: d′ from the two rates stays within ±0.15 across the middle half of the evidence', test: 'it stays within ±0.15 across the middle half of the evidence' },
      { says: 'Part 2: the By hand box gives d′ of 1.99 and 2.05 for the reading’s two face-memory testers', test: 'the face-memory example' },
      { says: 'Part 2: scaling the weights leaves d′ unchanged; only their direction changes it', test: 'weight direction, not size' },
      { says: 'Part 2: under the fish’s stakes the best criterion is liberal', test: 'under the fish’s stakes with eels at 50%, the energy-maximizing criterion is liberal' },
      { says: 'Part 2: under the reading’s example it is conservative', test: 'under the reading’s example, it is conservative' },
      { says: 'Part 2: each of F1 to F4 differs from the healthy fish in exactly one named property', test: 'each differs from the healthy fish in exactly one named property' },
      { says: 'Part 2: F1 and F2 have the healthy fish’s d′, and F3’s is at most 60% of it', test: 'F1 and F2 have the healthy fish’s d′; F3’s is at most 60% of it' },
      { says: 'Part 2: F2 and F3 are within 5 points of percent correct and far apart in false alarms', test: 'F2 and F3 are the ambiguous pair' },
      { says: 'Part 2: F4 earns more than the healthy fish in its own stream', test: 'F4 is not broken' },
      { says: 'Part 3: one unit stays under 80% on the fruit at every learning rate', test: 'one unit fails: test accuracy stays below 80% after 5,000 encounters' },
      { says: 'Part 3: the two prototype crosses lie within 0.05 of each other', test: 'the two prototype crosses lie within 0.05 of each other' },
      { says: 'Part 3: the chapter’s OR, NOT-AND, AND network can be set on the sliders and gets all four corners right', test: 'the chapter’s hand-built network' },
      { says: 'Part 3: four hidden units reach 95% in at least 18 of 20 seeds within 2,000 encounters', test: 'four hidden units, passing the error back' },
      { says: 'Part 3: one hidden unit never does; two sometimes stick', test: 'one hidden unit never does; two sometimes stick' },
      { says: 'Part 3: with two hidden units, two corners that share an outcome land together in hidden space — the ripe pair or the other pair', test: 'two corners that share an outcome land together in hidden space' },
      { says: 'Part 3: Both together solves the fruit with no hidden units', test: 'Both together on, no hidden units: one unit solves it' },
      { says: 'Part 4: Distance from the ideal strength solves the island; Both together does not', test: 'Distance from the ideal strength, no hidden units: at least 95%. Both together instead: under 80%' },
      { says: 'Part 4: and Distance from the ideal strength does nothing for the fruit', test: 'a built-in receptor is a bet on one problem' },
      { says: 'Part 4: fixed at random, accuracy rises with the size of the layer, and sparse does at least as well', test: 'fixed at random: accuracy rises with the size of the layer' },
      { says: 'Part 4: passing the error back, two hidden units cannot do the island and six do in most seeds', test: 'two hidden units cannot; six reach 95% in most seeds' },
      { says: 'Part 5: six individuals and eight hidden units leave training well ahead of the test set after 5,000 encounters', test: 'training accuracy runs well ahead of the test set' },
      { says: 'Part 5: fewer hidden units change little, because the overfitting comes from the smallness of the pool', test: 'fewer hidden units change little' },
      { says: 'Part 5: a larger pool shrinks the gap and a stream closes it', test: 'a larger pool shrinks the gap, and a stream closes it' },
      { says: 'Part 5: trained near only, the fish misses far eels and does not flee far suckers', test: 'trained near only: near test at least 90%; far eels are missed' },
      { says: 'Part 5: learning from every distance fixes it', test: 'learn from every distance: far test at least 85%' },
      { says: 'Part 5: Proportion of A beside A and B does not: the fish still leans on raw strength', test: 'the fish still leans on raw strength' },
      { says: 'Part 5: Proportion only does, without the fish ever having been downstream', test: 'Proportion only, trained near only: far test at least 85%' },
      { says: 'Closer: after phase 2 alone the eel-and-sucker test has collapsed', test: 'eel-and-sucker has collapsed to 60% or less' },
      { says: 'Closer: then an eel comes back and the fish stays', test: 'then an eel comes back, and the fish stays' },
      { says: 'Closer: with eels and suckers staying around, both test sets stay high', test: 'with eels and suckers staying around, both test sets stay high' },
      { says: 'Closer: trained on all four from the start, the same network learns them all', test: 'trained on all four at once from the start learns them all' },
      { says: 'Screen: the nine content lines are each on their panel', test: '9. the target: the outcome a moment later' },
      { says: 'Screen: no loss, no epoch, no receptor biology, no named cortical area, no agentic verb about the network', test: 'no string attributes knowing, noticing or deciding to the network' },
      { says: 'Throughout: same seed and same settings reproduce a run exactly', test: 'same seed and same settings reproduce a run exactly, in every scenario' },
      { says: 'Throughout: the animation has its own stream and cannot perturb a run', test: 'the animation has its own stream' },
      { says: 'Throughout: Skip ahead is the same run as watching it', test: 'skipping ahead is the same run as watching it' },
      { says: 'Shell: the Lab button says the handout is not posted yet, not an error', test: 'the Lab pane message for the missing Lab 7 handout is honest and not an error' },
      { says: 'the fish turns to face each new smell, darts to cover, and is shown struck or fed', test: null },
    ],

    crib: 'crib: what the panels should read',
  },
  {
    id: 'm08-objects',
    name: 'Lab 8 — Does It Fail Where We Fail?',
    route: '#/m08-objects',
    scene: 'src/scenes/m08_objects',
    /** Sim files whose strings reach the screen: eraser names, noise names, condition names, model titles. */
    strings: ['src/sim/objects'],
    handout: 'perception_and_action/object_lab/object_lab.md',
    report: 'perception_and_action/object_lab/object_lab_report.docx',

    retired: [
      { term: /\bloss\b|\bepochs?\b/gi, why: 'neither word is on screen: percent correct, and images' },
      { term: /\binvariant\b|achieves? invariance/gi, why: 'invariance names the problem; what is achieved is tolerance' },
      { term: /the network (sees|knows|thinks|understands|notices|decides|recogni[sz]es)/gi, why: 'a network labels, classifies, outputs and responds; recognize is for people' },
      { term: /salt[- ]and[- ]pepper|uniform noise/gi, why: 'on screen they are noise A and noise B', unless: ['noise A', 'noise B'] },
      { term: /ONNX|TensorFlow|WebAssembly/gi, why: 'no runtime is named on screen; the networks run in the browser' },
    ],

    controls: [
      'Draw', 'Parts', 'Views', 'Noise', 'Closer', 'New seed', 'Undo', 'Clear', 'Draw this:',
      'Center and scale the drawing first', 'Turn it upside down', 'Mirror it', 'Squash it flat', 'Squeeze it thin', 'Restore the drawing',
      'Version B: trained on shifted, turned and resized copies', 'Show it', 'Previous', 'Next', 'Commit my answers',
      'Mid-line', 'At the joints', 'share of ink removed', 'Commit my answer', 'Commit my answers for the ten pairs',
      'one shoe among shoes', 'one shoe among other things', 'Start the test', 'same shoe', 'not the same shoe',
      'Learning on', 'learning rate η', 'Skip ahead 50 steps', 'Start from new random weights', 'Label my drawing', 'By hand',
    ],

    claims: [
      { says: 'the drawing network names at least 85% of held-out drawings (92.6%)', test: 'names the right category for most of the fixed inputs' },
      { says: 'the browser’s drawing network gives Python’s top label on 50 fixed inputs, probabilities within 0.01', test: 'gives the same top label on every one of the fixed inputs' },
      { says: 'every layer of the drawing network agrees with Python', test: 'every layer’s activity agrees with Python to 1e-4' },
      { says: 'each photo network gives Python’s top label on 50 shipped photographs, probabilities within 0.01', test: 'gives the same top label on every fixed input, and probabilities within 0.01' },
      { says: 'the readout’s input, the penultimate layer, agrees with Python', test: 'the penultimate layer agrees to 1e-2 on every unit' },
      { says: 'the TypeScript rasterizer agrees with Python pixel for pixel', test: 'the rasterizer agrees with Python pixel for pixel' },
      { says: 'the two erasers agree with Python and remove the same ink to within 2%', test: 'the two erasers remove the same total length to within 2%' },
      { says: 'the browser’s noise has the statistics the networks were trained on', test: 'changes a share p of the pixels, half of them to white' },
      { says: 'nothing a student does changes a shipped model', test: 'every shipped model hashes the same before and after a scripted session' },
      { says: 'the readout is Lab 7’s unit, learning through thirdFactor and learnWeights only', test: 'readout.ts learns through thirdFactor, weightChange and learnWeights' },
      { says: 'the readout reaches 95% on its training images within 500 steps', test: 'reaches 95% on its training images within 500 steps' },
      { says: 'the three view conditions are matched for distance from the nearest learned view', test: 'the sorted distances are identical across conditions' },
      { says: 'every view the scene asks for was rendered and shipped', test: 'learned views, wobble frames, test views and the full curve' },
      { says: 'no network answer is rendered before Commit my answers, in Parts 2, 3 and 4', test: 'before: a Commit button, no revealed trial' },
      { says: 'after the commit, every trial is revealed with the truth, the answer and the network’s label', test: 'after: every trial revealed' },
      { says: 'the seed fixes the trials', test: 'the seed fixes the trials' },
      { says: 'every test’s viewing mode is decided (Parts 2 and 3 free, Part 4 glimpse) and no developer control is rendered', test: 'every mode is decided and no control is rendered' },
      { says: 'Part 4’s noise adapts: one step harder after a right answer, one step easier after a wrong one, within its range', test: 'moves one step harder on a right answer' },
      { says: 'Part 3 is one run of 48 trials, both sets mixed, half target in every condition', test: 'is 48 trials, 24 per set' },
      { says: 'Parts 2, 3 and 4 each open on an introduction with Begin, and Part 3’s warns that the run takes about five minutes', test: 'opens on an introduction' },
      { says: 'each of the spec’s eleven lines is on its panel', test: 'the eleven lines that are content' },
      { says: 'no loss, no epoch, no cortical area, no agentic verb about a network', test: 'no agentic verb about a network' },
      { says: 'every shipped image is credited in a NOTICE and excluded from the GPL', test: 'every shipped file is in the NOTICE and in the manifest' },
      { says: 'no shipped photograph carries a person, face or body-part label', test: 'no shipped photograph carries a person, face or body-part label' },
      { says: 'nothing leaves the page: no POST, no camera, no file input, no storage', test: 'no camera, no microphone, no file input, no storage' },
      { says: 'each part downloads under about 15 MB and the lab under about 40 MB', test: 'each part under about 15 MB and the lab under about 40 MB' },
      { says: 'one drawing inference is under 75 ms here (300 ms at a 4× throttle)', test: 'one inference is fast enough for a live label after each stroke' },
      { says: 'one photo inference is under 75 ms here (300 ms at a 4× throttle)', test: 'one photo inference is under 75 ms here' },
      { says: 'selection changes a control’s color and never its size', test: 'no button style keys font weight, padding, font size or border width on state' },
      { says: 'the spec’s measured targets, with the two that fail recorded as findings', test: 'the spec’s targets, measured' },
      { says: 'a glimpse lasts about 200 ms in a real browser (measured by scripts/m08-timing.mjs, reported in the walk-through)', test: null },
      { says: 'feature maps, gray renders and grayscale photographs are legible on the dark theme', test: null },
    ],

    crib: 'crib: readout',
  },
  {
    id: 'm09-rat',
    name: 'Lab 9 — The Way Home',
    route: '#/m09-rat',
    scene: 'src/scenes/m09_rat',
    /** Sim files whose strings reach the screen: the navigators' names and lines, the rats' labels and reveal lines, the strategies, the habitats, the result lines. */
    strings: ['src/sim/rodent'],
    handout: 'spatial_cognition/way_home_lab/way_home_lab.md',
    handoutPending: true,
    /**
     * Built 2026-10-18 with no handout; the handout is written after Jon's
     * walk-through, from docs/M09_AS_BUILT_NOTES.md. The claims below are
     * what the SCENE makes true, and the handout asserts nothing it cannot
     * find here.
     */

    retired: [
      { term: /\bmental rotation\b|imagine the (room|view)|from the other side/gi, why: 'last year’s Part 3 is not carried forward; imagining a view is Module 10’s' },
      { term: /\breplay\b|\bpreplay\b/gi, why: 'no control runs the map without moving; Module 10 owns replay' },
      { term: /head[- ]?direction ring\b/gi, why: 'the scene names two rings: the lower ring and the upper ring' },
      { term: /\bcue card\b/gi, why: 'on screen it is the white card or the black card' },
      { term: /Reorientation|rotational (twin|error)/gi, why: 'the reorientation step (spec §7.8) was cut; ask about §9.2.6 from the reading', unless: ['reading', '§9.2.6'] },
      { term: /Trips out from a home base|home base/gi, why: 'the home-base step (spec §10.2) was cut', unless: ['reading', '§9.2.9'] },
      { term: /Square to circle|stretch the box/gi, why: 'the morph and stretch boxes are measured by tests, not offered as steps in the scene', unless: ['reading', '§9.3.5', '§9.3.2'] },
    ],

    controls: [
      'World', 'Home', 'Rats', 'Cells', 'Patches', 'New seed', 'Eye view', 'Follow view', 'Narrower view', 'Low detail',
      'Begin', 'Here is my nest', 'Commit my trials', 'Go on', 'Step 1', 'Step 2', 'Step 3', 'Step 4', 'Step 5',
      'Running sum only', 'Landmarks only', 'Averaging', 'Following one',
      'The plus maze', 'The water maze', 'The radiating paths', 'rich room', 'plain enclosure', 'Training trials', 'Platform', 'hidden', 'visible, with a flag',
      'The lamp', 'in place', 'switched off', 'moved across the room', 'Rotate the room’s cues 90° between training and test', 'Remove the cues just before the choice', 'Darkness', 'from the start', 'after setting off',
      'Run the test', 'Skip ahead to the result', 'Tests run', 'Commit my diagnoses', 'Reveal', 'beacon', 'route', 'snapshot', 'map (survey knowledge: a cognitive map)', 'damage to the hippocampus', 'damage to the striatum',
      'Commit my prediction', 'Let it explore by itself', 'Skip ahead 2 minutes', 'Skip ahead 10 minutes', 'Skip ahead 1 day (30 simulated minutes)', 'Pin these maps', 'Clear the maps', 'Browse other place cells', 'Browse other grid cells', 'Move the card', 'Lights on', 'Back to the first room',
      'lower ring', 'upper ring', 'Head-direction cells', 'Grid cells', 'Border cells', 'Overhead', 'Pinned maps',
      'rich habitat', 'poor habitat', 'Leave a patch when beetles turn up there more slowly than one every', 'Run a night', 'Skip ahead to the end of the night', 'Try every setting', 'Beetles per minute',
    ],

    claims: [
      { says: 'Rings: the lower ring settles into one bump from any start, and with no turn and no noise it holds its place', test: 'settles into a single bump from any starting state' },
      { says: 'Rings: the upper ring’s bump sits where the lower ring’s does, within one unit', test: 'upper ring’s bump sits where the lower ring’s does' },
      { says: 'Rings: a turn moves the bump by the same angle, slow or fast, within 5%', test: 'a turn moves the bump by the same angle, within 5%' },
      { says: 'Rings: in the dark the bump’s error grows over minutes', test: 'in the dark, with noise, the bump’s error grows over simulated minutes' },
      { says: 'Rings: the background drive holds the bump; the critical drive lies below the intact one and above the lesioned one plus the nudge', test: 'the background drive is what holds the bump' },
      { says: 'Rings: without the turn pathway the lower ring holds no bump and its units keep firing', test: 'holds no stable bump: its activity wanders and breaks up' },
      { says: 'Rings: the nudge cannot make a bump, and it is clamped', test: 'the nudge cannot make a bump' },
      { says: 'Rings: with the pathway intact the nudge returns a bump displaced by 45° to the card’s alignment', test: 'returns a bump displaced by 45° in the light' },
      { says: 'Rings: the nudge pulls slower than any turn', test: 'pulls slower than any turn' },
      { says: 'Part 3: Let it explore by itself covers at least 90% of the floor in 10 minutes', test: 'covers at least 90% of the box’s floor bins within 10 simulated minutes' },
      { says: 'Part 3: a card takes control only after several minutes: none at 1, control by 10', test: 'controls the bump only after several simulated minutes' },
      { says: 'Part 3: in the light the bump’s offset holds; in the dark it wanders within minutes; the card pulls it back', test: 'offset from the true heading holds still' },
      { says: 'Part 3: the card turned 90° out of sight turns every head-direction cell by 90°, within 10°', test: 'every head-direction cell’s preferred direction turns by the same angle, within 10°' },
      { says: 'Part 3: a card the rat has seen move loses control within a few moves', test: 'a card the rat has seen move loses control' },
      { says: 'Part 3: without the turn pathway tuning is lost within a simulated day, stays lost with the card in view, and the cells keep firing', test: 'tuning is lost within a simulated day and stays lost with the card in view' },
      { says: 'Part 3: the estimate’s error in the dark grows with distance, and a touched wall resets the coordinate across it', test: 'its error in the dark grows with distance traveled, and wall contact reduces the error across that wall' },
      { says: 'Part 3: injecting an error into the estimate moves every place field by that error', test: 'injecting an error into the estimate moves every place field by that error' },
      { says: 'Part 3: a new room reassigns every place field; returning restores the first room’s map exactly', test: 'a new room reassigns every place field; returning restores the first room’s map exactly' },
      { says: 'Part 3: square to circle switches once, between the third and fourth of six steps (measured by test; not a step in the scene)', test: 'square to circle: the map switches once' },
      { says: 'Part 3: grid spacings are in the ratio 1.4, and shortening the box compresses the largest group more than the smallest', test: 'grid spacing ratios between groups are 1.4 within 0.05' },
      { says: 'Part 3: stretching the box by half stretches place fields by about half as much (measured by test; not a step in the scene)', test: 'stretching the box by half stretches place fields by 0.4 to 0.6 of that' },
      { says: 'Structure: nothing under the spatial system imports the true pose', test: 'nothing under spatial/ imports the body' },
      { says: 'Structure: landmark input reaches the lower ring only through the bounded nudge', test: 'landmark input reaches the lower ring only through the bounded nudge' },
      { says: 'Structure: no running the map without moving — ratesAt throws, and the scene never opens it', test: 'ratesAt throws unless the system was built offline' },
      { says: 'Structure: one learner — only the view weights onto the upper ring change, through thirdFactor on Coincidence and learnWeights', test: 'the only numbers that change by learning are the view weights onto the upper ring' },
      { says: 'Structure: only setWiring and learnWeights write a stored weight, the rat included', test: 'the rat reaches a weight only through learnWeights' },
      { says: 'Determinism: the same seed reproduces every number; no Math.random in the rodent directory', test: 'the same seed reproduces every number of a session' },
      { says: 'Part 1: the four navigators reproduce their endpoints from the record and the seed', test: 'the four navigators reproduce their endpoints from the trial record and the seed' },
      { says: 'Part 1: every trial records its time in each view, and the trip record is complete', test: 'every trial records the time spent in each view' },
      { says: 'Part 1: switching views changes no number in the sim', test: 'switching views changes no number in the sim' },
      { says: 'Part 1: Running sum only’s error grows with path length over 100 trips', test: 'the mean error over long trips exceeds the mean over short ones' },
      { says: 'Part 1: Following one averages below the conflict threshold and follows the landmarks above it; Averaging lands between', test: 'Following one averages below the conflict threshold' },
      { says: 'Part 1: in the dark Landmarks only stops where it is', test: 'in the dark, Landmarks only stops where it is' },
      { says: 'Part 1: nothing about the nest is in the markup before Commit my trials, and no overhead inset', test: 'before: a Commit button; no overhead inset, no nest, no endpoint, no error, no navigator' },
      { says: 'Part 1: after the commit, an overhead inset per trial with the nest, the endpoint, the error and the four navigators', test: 'after: the overhead inset for every trial' },
      { says: 'Part 2: every cell of spec §8.3’s table is the majority outcome over 20 seeds', test: 'Plus maze, rich room, 4 training trials, probe from north' },
      { says: 'Part 2: with the lamp in place R1 looks exactly like R4, and removing the cues just before the choice separates R3 from R4', test: 'the two cells that are the point' },
      { says: 'Part 2: R6 stays with place after 64 trials and fails the plain enclosure', test: 'R6, if built' },
      { says: 'Part 2: no hidden rat’s strategy is in the markup before Commit my diagnoses', test: 'before: the result lines, the hidden rats marked hidden' },
      { says: 'Part 3: no result before Commit my prediction', test: 'a step that changes something asks first' },
      { says: 'Closer: the best leaving setting is sooner in the rich habitat, within one step of the habitat’s average rate', test: 'over 20 seeds the best setting is sooner in the rich habitat' },
      { says: 'Closer: the answer only after Commit my prediction', test: 'before: no answer line; after: the prediction and the answer' },
      { says: 'Screen: the fifteen content lines are each on their panel', test: '15. the two rings, beside the rings' },
      { says: 'Screen: no agentic verb about cells, rings, the program, a navigator or a programmed rat; carry not used for information; no British spellings', test: 'no agentic verb about cells, the rings, the program' },
      { says: 'Screen: selection changes a control’s color and never its size', test: 'no button style keys font weight, padding, font size or border width on state' },
      { says: 'Screen: nothing leaves the page', test: 'no fetch, no POST, no XMLHttpRequest' },
      { says: 'Shell: the Lab button says the handout is not posted yet, not an error', test: 'the Lab pane message for the missing Lab 9 handout is honest and not an error' },
      { says: 'Cameras: at least 30 frames per second in the eye view in the range under a 4× CPU throttle (measured by scripts/m09-fps.mjs, reported in the walk-through)', test: null },
      { says: 'Look: the night scene, the heat maps and the rings are legible on the dark theme', test: null },
    ],

    crib: 'crib: what the panels should read',
  },
]
