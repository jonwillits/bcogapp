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
     * Built 2026-09-27 with no handout: the handout is written from
     * docs/M06_AS_BUILT_NOTES.md after Jon's walk-through, so the claims
     * below are what the SCENE makes true — what the handout may assert.
     */
    handoutPending: true,

    retired: [
      { term: /flythrough|fly-through/gi, why: 'the flythrough was never built; the model is taken apart and experimented on' },
      { term: /\blesion\b/gi, why: 'the tool is called Remove; the line under it names lesions as the method', unless: ['lesions, and neuropsychology'] },
      { term: /fear cent(er|re)/gi, why: 'the scene never prints it; the handout names it only as the misconception' },
      { term: /\b(frontal|parietal|temporal|occipital) lobe|visual cortex|homunculus|prefrontal/gi, why: 'no cortical region is named in Module 6; later modules own them' },
      { term: /\bmouse\b/gi, why: 'the comparison brain on screen is “mammal”, one parameter set; the chapter’s mouse is the handout’s to cite' },
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
]
