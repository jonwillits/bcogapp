# Module 3 — where the build departed from the spec

Written for Jon to carry into the Box copies of `m03_neuron_SCENE_SPEC.md` and `neuron_lab.md`. Nothing in Box was edited from this repo.

Every number here was measured, not chosen. Where a spec figure turned out to be unreachable or wrong, the section says which measurement showed it and what replaced it. The spec's §3.5, §7 and §10 were written from the reading rather than from a running model, and this is the list of what a running model said back.

Three things did not change and are worth saying first. **Threshold and the refractory period are emergent**: nothing is called threshold, nothing times a pause, and both are tested. **Concentrations and the pump are real**: intracellular sodium and potassium are state, the reversal potentials are recomputed from them every step, the pump is 3:2 and electrogenic, and the ATP counter is its cycles. **The energy calculator does not compute from the patch**: it uses Lennie's figure and says so on its face.

---

## 1. The cell: what the 1952 model needed to be a lab

**Temperature.** The 1952 kinetics at 6.3 °C give a spike two milliseconds wide and a ceiling near 80 spikes/s, and under steady current the cell is a cliff — nothing, then fifty spikes a second (it is a class II cell). The shipped cell runs the rates at a Q10 factor of **2** (about 13 °C): spike about a millisecond, ceiling 238 spikes/s, threshold −52.9 mV. The equations are still Hodgkin and Huxley's; the temperature factor is theirs too.

**The synapse, and why Q6 set it.** Inputs arrive as Poisson events, and that noise is the only thing that turns the cliff into the smooth rise the reading's figure shows. Three choices were forced:

- **Connection strength is an event count, not an event size.** A strength of 2 delivers two unit charges per input spike; −3 delivers three negative ones. With strength as event *size*, three big inhibitory events a second could not cancel twenty small excitatory ones however the averages compared, and the reading's example came out 29 → 23 → 18 instead of 25 → 10 → 0.
- **The synapse is slow: 50 ms.** A 20–30 ms synapse gives a curve within 10% of the arithmetic from 40 to 150 — and inhibition that does not subtract (the example read 26 → 22 → 14). At 100 ms inhibition subtracts perfectly and the low end becomes a cliff again. Fifty is the compromise.
- **Excitatory charge is booked as sodium in, inhibitory as potassium out.** Without that the drive was charge from nowhere and the cell expelled it as potassium: a cell driven at 60 events/s lost a third of its potassium in a minute for no physical reason, and the healthy cell could not sustain the rates the lab asks of it. (The Membrane tab says the inhibitory channel here passes potassium, and that the chapter's GABA receptor passes chloride instead; the model tracks only sodium and potassium.)

**What the reading's example now reads.** Baseline 5, strengths +2 and −3, inputs (10, 0), (10, 5), (10, 15): the arithmetic prints **25, 10, −20 → 0**, as the spec requires. The output rate measured from the membrane reads about **12, 5 and 2** (several seeds). The cell's onset is steeper than a line, so a small total is worth fewer spikes than the arithmetic says; the measured curve is within 10% of the line from 60 to 150 and within 20% from 60 to 200. This is Q6's question, not a defect — but the handout's Q6 might tell students to expect the measured number to be *smaller* at these low totals, so the surprise lands where the reading puts it (a real cell does more than add) rather than as a suspicion that the panel is broken.

**Concentration rate.** The concentrations change at the true rate for a 4 µm fibre times **1.5**, and the Membrane tab says so. At 1× the pump-off cell's spikes were still 54% of their height at the minute mark; at 2× or more the pump's own current, clearing sodium, hyperpolarised a *driven* cell and halved its rate within fifteen seconds of a slider move, so what a student read off the panel depended on how quickly they read it. At 1.5× the pump-off cell is well under half by the minute and silent soon after, and a driven cell drifts over about twenty seconds. That drift is real (post-activity hyperpolarisation) and is left visible.

**The pump.** Hill in intracellular sodium, exponent 3, with ten times its resting rate in reserve. The 1952 leak is split into sodium and potassium parts so that −65 mV, E_Na = 50 and E_K = −77 are an exact fixed point of voltage *and* concentration with the pump running.

## 2. "Instant" recovery — what removes the ceiling and what does not

The spec asks that setting inactivation recovery to instant remove the firing-rate ceiling and permit backward propagation. Four implementations were measured:

| what was scaled | ceiling (238 healthy) | reflection | verdict |
|---|---|---|---|
| α_h everywhere, ×20 | 0 | — | the cell stalls in a depolarised plateau: channels never shut |
| α_h and β_h together, below −45 mV | 0 | — | channels inactivate faster on the upstroke; no spike |
| α_h only, in the after-spike undershoot (below −70 mV) | 250–264 | none | tidy — h∞ at rest untouched — but the pause after a spike is held by the potassium gate as much as by sodium |
| **α_h only, below −45 mV, ×45** | **484** | **yes (7 return crossings)** | shipped |

The shipped version also raises h∞ between rest and threshold, so the "instant" cell is a little more excitable near rest — it fires at small totals the healthy cell ignores. The floor of the input–output curve (totals below zero) is unchanged. **The handout's Q12 is safe**: the ceiling doubles and moves off the plotted range, and spikes come back up the axon. Worth one clause in the answer key: the lower end of the curve rises a little too, because more sodium channels are available sooner, and that is the same mechanism seen from the other side.

## 3. The input–output curve and the overlay

Spec §10: predicted and measured within 10% over the middle two-thirds, more than 25% apart in the top sixth.

Measured (1952 cell, Q10 = 2, Poisson drive, plot axis −50 to 260): within 10% over totals of **60–150**, within 20% over **60–200**, a steep convex onset below 60 (the "sharp at onset" divergence the spec expects), and **20–25% below the line over the top sixth**. The tests hold to those bands. A tighter middle was reachable only with a synapse fast enough that inhibition stopped subtracting (§1), which costs Q6.

The base curve on the Unit tab is the arithmetic clipped at the measured floor and the measured ceiling. With the overlay on, the dashed line is the arithmetic floored at zero and nothing else — the reading's own function — against the measured sweep. The ceiling is the cell's under any steady drive (a swept injected current), which is 238 for the healthy cell and 198 with potassium conductance raised to 45.

## 4. The axon

- **Conduction velocity: 0.80 m/s** unmyelinated (4 µm fibre, 100 Ω·cm, 6 mm in 40 patches). The spec's ≈1 m/s. **Myelin: 10.0 m/s**, 12.5× — the spec's ≈50 m/s would need a bigger fibre; the test asks for tenfold. To get there the wrapped patches carry 1/200 of bare capacitance (a thick sheath, 100 lamellae) and the node patches 1/50, because a 150 µm patch is a hundred times longer than a real node.
- **ATP per spike falls 7×** with myelin (test asks for 3×).
- **The soma is not loaded by the axon** — coupling is one way. This keeps the soma's spikes identical whatever the axon does and is a second-order simplification of a thin process leaving a large body.
- **The simulated axon is a fixed 6 mm**, whatever the body-size control says. At 100 µm a real axon is isopotential and nothing travels; the Membrane tab needs something to travel for Q11 and Q12. The vehicle's wheel reads the far end of the 6 mm stretch; for bodies longer than that the remaining distance is an analytic delay at the measured velocity, and the World tab's travel time is distance over that velocity throughout.
- **Velocity as the World tab reports it is measured by the instrument on the full axon** whenever the cell's parameters change, not read live from the running cell, whose reading gets noisy at high rates.

**The resolution-invariance test could not be kept as written, and the reduced-resolution path is gone.** A coarse axon drops spikes: ten patches lose a fifth of them at 40 events/s, twenty lose a third at 200, and only the full forty carry every spike at every rate the cell produces. The vehicle's behaviour depends on what reaches the far end, so the coarse axon would have changed it. A 0.05 ms step made the full axon affordable (about 65 ms of compute per simulated second per cell — two cells at real time is a seventh of one core), so the scene runs it always. `neuronWorld.test.ts` records the measurement. Path-level invariance is unmeasurable anyway: two runs differing by a millisecond of far-end timing diverge chaotically within ten seconds, and a 5% criterion on a count of a few lights a minute is below the Poisson noise floor of any deploy-gating test.

## 5. The world, the catch rule, and Part 1

**A vehicle needs two cells, and each has its own wiring.** One neuron has one output and cannot steer. The vehicle carries two cells — left cell to left wheel from same-side and opposite-side sensors, right cell its mirror — and each has its own baseline and two strengths: six numbers, as Lab 1's matrix had a number per connection. The first build locked the two to one set of numbers for the sake of "one cell, three tabs"; Jon's judgement (2026-09-06) was that identical weights locked together is an artificial-network habit and unintuitive for a biological organism, and that Lab 2 had just shown students four independent weights. So the Unit tab's sliders set the selected cell, a button gives the other cell the same wiring, and the five diagnostic cells carry their fault in both cells. The membrane lesions still act on both cells at once, like a drug reaching both; a one-sided lesion would be a Things-to-try extra. The handout could say this in Part 0, and Q13's "change the second connection" now changes it in one cell unless the student copies it across — which turns the vehicle rather than reversing it, and is worth a sentence.

**The catch rule.** "Lights collected" needed a definition, and three were measured:

1. None: a vehicle that never moved collected almost as many lights as a healthy one — 3.3 against 3.8 a minute — because three lights drifting round a walled arena run into anything parked on the floor every twenty seconds.
2. Driving at the light at contact: fixed that, but a healthy cell in N1's world of too-fast lights still scored 2.9 against 3.6, because a light passing through a vehicle that happened to be facing it counted.
3. Dwell on the light for 0.4 s: cut that to nothing, and halved the healthy vehicle's own score, because a charging 2b passes straight through.

**Shipped: you catch what you can keep up with** — driving into the light, and moving at least 90% as fast as the light is moving. A healthy vehicle keeps its head-on catches; N1 gets none, which is exactly N1's story. The World tab says so in one line.

**Signal types, measured (fast world 2 u/s, slow 0.5 u/s, three lights, four seeds, three minutes):**

| | lights/min |
|---|---|
| spikes, 100 µm, fast world | 3.1 |
| spikes, 100 µm, slow world | 1.6 |
| diffusing chemical, 100 µm, slow world | 1.3 |
| diffusing chemical, 100 µm, fast world | 0.2 |
| graded electrical, 1 m, fast world | 0.0 |

So Q1/Q2's contrast holds: a chemical vehicle does about as well as a spiking one in the slow world and about nothing in the fast one. Note the healthy vehicle is *worse* in the slow world than the fast one: it idles at 0.4 u/s when nothing is in sensor range and slow lights rarely come to it. Q1's table will show that, and it is worth a sentence so nobody reads it as a bug.

**The chemical vehicle does not turn.** With a ten-second delay it steers toward where a light was, which is nowhere in particular; it cruises at about 1.5 u/s on its lingering drive. "Slow to clear" is modelled (the arriving signal lingers about as long as it took to come); "cannot be aimed" is stated on the panel, not modelled — each side's chemical still reaches only its own wheel.

**Reaction time** = sensing (the sensor's own 20 ms response) + travel (the signal physics) + integration (spikes: the 50 ms synapse plus the wheel's 50 ms averaging; chemical: the clearance time plus the averaging). At the default body the spiking vehicle reads about 120 ms.

**World speed is a slider, not two detents.** The two detents are there as buttons (slow 0.5, fast 2.0), but N1's world has to be visibly *faster than the vehicle* and the World tab prints the light speed beside the vehicle's top speed (3.2 u/s), because that comparison is N1's diagnosis and it has to be readable from the World tab and nowhere else.

## 6. The five cells

Each is the healthy scenario with one parameter changed, written out in `src/sim/neuron/cells.ts`. Healthy: contralateral excitatory (Lab 1's 2b) at strength 2, baseline 5, fast world, three lights.

| | the one change | spec said | shipped |
|---|---|---|---|
| N0 | opposite-side strength −2 | strong negative | as spec |
| N1 | lights at 5 u/s | faster than the vehicle's top speed (3.2) | as spec |
| N2 | opposite-side strength 0.25 | near zero | as spec |
| N3 | pump power | about a quarter | **0.2** — at 0.3 it collected 1.75 a minute; 0.2 is the lowest that still leaves the resting spike within 80% of healthy |
| N4 | baseline | fires rarely | **−10** (from 5); −6, −15 and −20 all measured within noise of each other |

**N4's premise is half wrong in this model, and the half that is wrong is worth knowing.** The spec has N4 "use a small fraction of the ATP". In a Hodgkin–Huxley membrane with the 1952 leak, the *resting* pump work dominates: at rest the pump clears about 10 µA/cm² of sodium leak continuously, and a spike adds about 0.4 µC/cm², so a cell firing at 10 spikes/s spends only about a third more than a silent one, and a cell that fires rarely saves perhaps a tenth. (The reading's budget — resting potential an eighth of signalling at a few spikes a second — is for a cortical neuron with a far tighter membrane than a squid axon's.) So N4 cannot win on ATP *spent*; it wins on ATP *per light* only against cells that collect nearly nothing, and the test is written that way: N4's cost per light is finite and at most half of N1's, N2's and N3's, which are infinite or near it. Q19 and Q21 still work — "a cell that fires rarely is not a broken cell" is true and visible — but the handout's line that N4 "uses a small fraction of the ATP" should become "spends a little less ATP and gets its lights cheaper than the others", and the panel's *ATP spent* readout will show the resting cost plainly, which is the reading's own point.

**Measured, four seeds of three minutes, default world, after the 45-second warm-up** (`world.probe.ts`):

| | lights/min | how it moves |
|---|---|---|
| healthy | 3.1 | roams, swings toward lights, stopped half the time |
| N0 | 0.0 | parked nine-tenths of the time; turns away when a light comes |
| N1 | 0.0 | moves like the healthy vehicle; the lights outrun it |
| N2 | 0.1 | creeps; stopped four-fifths of the time |
| N3 | 1.7 | crawls, stopped two-thirds of the time; E_Na at 30 mV under its own load |
| N4 | 2.2 | sits still three-quarters of the time, then lunges |

**The symptom-identity test is not met as written, and the reason is in the world rather than the cells.** N1 and N2 collect nothing; N3 collects about half the healthy rate; N4 about seven-tenths. Three worlds were tried to bring N3 and N4 down — a 12- and a 14-unit arena, four lights, a healthy baseline of 10 so the healthy vehicle cruises — and in every one a sit-and-wait N4 did as well as or *better* than the roaming healthy vehicle, because in a walled arena with drifting lights something drifts within reach every twenty seconds or so, and a lunge from rest is as good a catch as a chase. N3's fault needs sustained load, and a vehicle that chases in bursts recovers between them; only a pump at a tenth of normal brought it near zero, and that cell is visibly sick at rest. Neither is a tuning problem: the first is what an efficient idle strategy looks like, and the second is what "fails only under load" means.

The test asserts what holds: N1 and N2 at most a fifth of healthy, N3 at most three-quarters, N4 below healthy. **N1 in a slow world** is asserted on the *gain* from slowing the world (N1 gains about 2.2 a minute; nobody else gains anything). **N4 on energy per light** is asserted as a ranking — N4's cost per light is finite and the lowest of the four — rather than the spec's factor of two, because the measured margin over N3 is only about 1.2×, and the reason is worth putting in the answer key: **a broken pump is cheap.** N3 spends a fifth less ATP per minute than any healthy cell because its pump does a fifth of the work, so its cost per light is nearly N4's despite collecting fewer. Against N1 and N2, which collect nothing, N4's margin is infinite. These three count-based tests take half an hour and live in `neuronWorld.slow.test.ts`, run by `npm run test:slow` rather than by every `npm run test`; the last full run (2026-09-05) passed the first two, and the N4 assertion was restated on that run's numbers (N3 1.10 × 10¹² per light, N4 0.94 × 10¹²).

**What a student will see, honestly.** With the catch rule, N0 (parks near lights), N1 (chases at full speed and misses) and N2 (creeps) collect essentially nothing. The four fail *alike* on the number the spec measures; they do not move alike, and the memory of Module 2 says to say so. A viewer can tell N1 apart from N2 by *style* in a few seconds — one charges, one crawls. What they cannot tell is which level the fault is at: a crawler could be a weak connection or a weak pump, and a charger that misses could be a bad cell or a bad world. That is the ambiguity Q15–Q17 need, and it is the one the scene provides. The handout's Q15 could be reworded from "whether behaviour alone lets you sort them" to "whether behaviour alone tells you *what is wrong* with each".

**Q15's "watch all four vehicles" is one at a time.** Each cell loads with its own world (N1's lights are faster), so the Diagnosis tab loads one vehicle at a time and the handout should say "load each in turn".

**N3's fault appears after driving.** Each diagnostic cell is run for 45 simulated seconds before the student sees it, so N3 is already under load. Reset replays from that point.

## 7. The energy calculator

As spec §7: Lennie's 2.4 × 10⁹ ATP per spike, 86 × 10⁹ neurons, 50 kJ/mol for ATP, the budget shares exposed (signalling 75%, action potentials 50% of that). 10 spikes/s → **457 W**; 20 W affords **0.44 spikes/s**. Both inside §10's bands.

**One premise of §7 turned out wrong, and the panel wording follows the measurement.** The spec says a single simulated compartment costs orders of magnitude less than a whole neuron. The shipped cell — one 10 µm soma plus 6 mm of 4 µm axon, about 7.6 × 10⁻⁴ cm² of membrane — costs **about 1.2 × 10⁹ ATP per spike**, the same order as Lennie's figure, because that much thin axon is a realistic amount of membrane. The reason the calculator must not use it is different from the one the spec gives, and the panel says the true one: the simulated number covers the pump work of one spike in that much membrane and none of the synapses, transmitter, vesicles or housekeeping a whole cortical neuron pays for. Multiplying it by 86 billion would still give nonsense, for that reason.

## 8. Things in the UI the spec did not ask for

- **"Where the inputs come from"** on the Unit tab: the vehicle's sensors (live) or the sliders. Q6 needs the sliders; the vehicle needs the sensors; both cannot drive x₁ and x₂ at once. Moving x₁ or x₂ switches to the sliders, and the vehicle then drives on the cells' output regardless of what it sees.
- **The third input is gone.** The spec's §2.2 asks for three inputs with a rate slider each, to match the reading's `y = b₀ + b₁x₁ + b₂x₂ + b₃x₃`. The vehicle has two sensors and nothing else to wire, so x₃ was a slider connected to nothing, explaining nothing and asked about nowhere; Jon's call (2026-09-06) was to take it out. The panel prints `y = b₀ + b₁x₁ + b₂x₂`. Q26's "fourth input" is a thought question and needs no slider.
- **Both cells in one picture.** The Unit and Membrane tabs draw Lab 1's wiring — two sensors, straight and crossed lines, two actuators — with a cell where each line was, so each cell's x₁ is visibly the same-side sensor and its x₂ the other side's. Clicking a cell selects which one the instruments below show; a line says the vehicle carries two copies on one set of settings. (Jon's request, 2026-09-06; the spec's "one cell" wording assumed a single cell could drive a vehicle, and it cannot steer.)
- **The World readouts are grouped** — reaction time as a stacked bar, the signal, the lights as value tiles, and light speed against the vehicle's top speed as two bars — and the body-size slider carries a one-line hint that it changes the travel time and not the vehicle (Jon's feedback, 2026-09-06).
- **"Step one spike"** runs the world until the body fires and the spike has passed.
- **The Membrane tab's slow motion runs the vehicle too** — one clock. The panel says which time scale is on screen on every tab.
- **The trace window** has four settings (20–400 ms).

---

# What the handout needs

Ordered by how much it matters.

1. **Q6.** Tell students the measured rate will be *lower* than the arithmetic at these totals (about half), and that the third case reads a few spikes rather than zero — then ask why. Otherwise the first thing a careful student concludes is that the panel is broken.
2. **Part 3, Step 1.** "Watch all four vehicles" → "load each of the four in turn". And "whether behaviour alone lets you sort them" → "whether behaviour alone tells you what is wrong with each": they *are* distinguishable by style; they are not diagnosable by it.
3. **Part 1, Q1's table.** A sentence that the healthy spiking vehicle collects fewer lights in the slow world than the fast one, and why (slow lights do not come to an idling vehicle).
4. **The Membrane tab's slow motion needs saying before a student meets it, or it reads as a freeze.** The tab opens ten times slower than life (a badge over the arena says so, with *real time*, *10× slow* and *50× slow* buttons), and the vehicle is on the same clock, so it all but stops. Wording to add, in Part 0 where the Membrane tab is introduced and again at Part 2 Step 3:

   > *The Membrane tab runs the whole scene in slow motion — ten times slower than life by default, fifty times if you ask — because an action potential lasts about a millisecond and you are meant to watch one happen. The vehicle in the arena is on the same clock, so it will have all but stopped. It has not frozen. A badge over the arena says what speed you are at; press* real time *there, or on the panel, whenever you want the vehicle to drive again.*

   And at Q10: "a simulated minute" is right; add "press *real time* first, or a simulated minute takes ten real ones".
5. **Q12.** One clause: the low end of the curve rises a little too (§2).
6. **Part 0.** One line that the vehicle has two cells, each with its own wiring, drawn together on the Unit and Membrane tabs in Lab 1's wiring picture; clicking one selects which the sliders and instruments belong to, and a button copies one cell's wiring to the other. **Q13** should say whether to flip b₂ in one cell (the vehicle turns) or in both (it reverses its approach), since the two give different behaviour.
7. **Q13.** The Membrane tab's inhibitory synapse passes potassium out, not chloride in, and says the chapter's version alongside. The Q13 answer ("what changed is the receptor, and the ion its channel passes") is unaffected; an answer key should accept either ion.
8. **Q19 / Part 4.** N4 does not use "a small fraction of the ATP" (§6 above): the resting cost dominates, which is the reading's own point. Reword to "spends a little less, and gets its lights cheaper than the other three" — and note for the answer key that N3 comes close on that figure *because* its pump is broken, which is a good trap for Q19's "why is a rarely firing cell not a broken one".
9. **Part 0.** The handout links to `neuron_lab_report.docx`, which does not exist yet; `npm run closeout m03-neuron` fails on it and will keep failing until it does. The close-out's question-set check needs it to compare the report against the handout's Q1–Q28.
10. **"Pit".** The app says *arena*, as it has since Lab 2; the Lab 3 handout says *pit* three times (Part 0 twice, Q15). The close-out flags them.

# What the spec needs

- §3.1: Q10 factor 2; threshold −52.9 mV; the shipped "instant recovery" and the three rejected versions (§2 above).
- §3.2: rundown at 1.5× a 4 µm fibre; the pump's headroom; the leak split.
- §3.4: 0.80 m/s and 10 m/s; the fixed 6 mm axon; one-way soma coupling; myelin's capacitances.
- §3.5: the measured table in §5 above.
- §4: no reduced-resolution path, and why.
- §6 / §9: the tuned values and the "alike on the number, not in style" statement.
- §7: the corrected premise about the patch's cost.
- §10: the bands the tests actually hold (each test's comment carries its own).
