# Module 9 as built — notes for the session that writes the handout

Written 2026-10-18 by the session that built `m09-rat`, from the code on branch `m09-rat` and from measurements, for whoever writes `intro_to_bcs/spatial_cognition/way_home_lab/way_home_lab.md` after Jon's walk-through (`course_creation/labs/09_spatial_cognition/LAB_9_WALKTHROUGH.md`, beside the spec). Nothing is merged or pushed. The spec is `m09_rat_SCENE_SPEC.md` beside the walk-through, and the chapter is `intro_to_bcs/spatial_cognition/spatial_cognition_reading.md`, a draft under Jon's proofread on the day of the build.

**Every number here was measured, not predicted.** Unless a line says otherwise: six seeds (1000 to 1005), headless, the session as it loads; "of 20" means seeds 1000 to 1019. The probe that produced them is `src/sim/rodent/crib.probe.ts`, and `npm run closeout m09-rat` prints them; `timing.probe.ts` produced §6 and `scripts/m09-fps.mjs` the frame rates. A handout that quotes a number should quote one from §4 and say "about": the scene opens on a random seed, and a student's numbers fall inside these ranges, not on their means.

**The handout may assert what the close-out's claim list says and nothing it cannot find there.** Forty-nine claims about what the scene makes true (`scripts/labs.config.mjs`, entry `m09-rat`); forty-seven name the test that goes red if it stops being true. Two have none: the frame rate on a real screen (measured by the script, reported in §4.9) and legibility on the dark theme, which only a person can see.

**The lab's rule, on every tested surface: commit, then reveal.** No true nest position or error before *Commit my trials*; no hidden rat's strategy before *Commit my diagnoses*; no result before *Commit my prediction*; no answer in the closer before its commit. All four are tested on rendered markup (`reveal.test.tsx`).

---

## 1. Every control, as it shipped

The header panel, titled **Lab 9: The Way Home**, is on every tab: five tabs (**World** Part 0, **Home** Part 1, **Rats** Part 2, **Cells** Part 3, **Patches** Closer), the rats line, the **Run seed** with **New seed**, the **View** choice (**Eye view** / **Follow view**), and two boxes, **Narrower view** and **Low detail**. The layout is the shared full-bleed canvas with floating panels: the header and the part's controls on the left, the part's results on the right, and under the canvas on the moving tabs a drive pad (four arrow buttons for touch screens) with the line *Arrow keys or WASD drive the animal*. **Every part, and each step of Parts 1 and 3, opens with its description in a panel centered over the view** (`OrientingPanel`: the step's title, *What will happen*, three or four paragraphs, the content lines, and *About n minutes. Press Begin on the left.*); the side panel keeps the time and **Begin**, and in Part 3 the prediction and **Commit my prediction**, with the panel staying up until the prediction is committed (Jon's walk, 2026-10-20: the explanation belongs in the middle of the screen, the buttons at the side). Parts 0 and 2 and the closer show theirs until **Begin** at the top of their side panel; their controls stay where they were. **Any step can be opened**: the orienting screen has **Go back to Step n−1** and **Go to Step n+1** beside **Begin**, and a finished step has **Redo Step n** beside **Go on to Step n+1** (Jon, 2026-10-20: students may jump around and redo; the handout cautions against jumping ahead). Redo drops a Part 1 block's reveal and reopens its orienting screen; in Part 3 it reopens the step so its change is made again on the commit, bringing a rat left in the second room back first. A new seed starts every part again. Switching tabs keeps every part's state. **Two conventions from Jon's walk (2026-10-20) hold on every panel:** a button's or a key's name in running text is in quotes (*press “Here is my nest”, or the “Enter” key*), and a block of fixed lines that carries numbers is a block of rows, the label padded to one width and the value right-aligned so the decimals line up (Part 1's reveal, Part 2's result lines, Part 3's recording panel and result lines, the closer's night). Lines that are sentences stay sentences.

**The keys.** Up arrow or W forward; left and right arrows, or A and D, turn; down arrow or S a slow step back. Constant speed while held; no acceleration. Ignored while an input, select, button or link has focus. They work on World, Home and Cells. **Enter presses Here is my nest** on the Home tab (Jon's walk, 2026-10-20); the key line under the view says so. On Rats, `CameraRig`'s own keys (WASD pan, arrows rotate) work as in every earlier scene. On Patches the forager drives itself.

**The view.** Eye view: first person at the animal's eye height (7 cm in the range, 4.5 cm in the box), 75° field of view (55° with the box ticked). Follow view: behind the animal (0.9 m in the range, 0.32 m in the box) and above it (0.42 m and 0.16 m), looking at a point just ahead of its head, eased so that a turn does not snap; in the box the camera is kept inside the walls. The rat's body is drawn in follow view and not in eye view. **Narrower view** sets the eye view's field to 55°; follow view is always 55° (Jon's walk, 2026-10-19: the narrower field looked better behind the rat and made no difference in eye view). **Low detail** halves the ground clutter and the draw distance and caps the canvas at one device pixel; it changes nothing the sim does. The view changes nothing the sim does either (`homing.test.ts`: the same seed and keys give the same trial record in either view).

### World tab (Part 0)

No controls beyond the header. The range in moonlight with the nest in view, free driving, nothing scored. The panel says what the keys do, what the two views are, the comfort settings, the lab's commit-then-reveal rule, and what the four parts are.

### Home tab (Part 1)

| Name on screen | What it does | Where |
|---|---|---|
| **Step 1** … **Step 5** (chips) | the five blocks, opened in order; a finished block can be reopened to its reveal | left |
| **Begin** | on each block's *What will happen* screen | left |
| **Here is my nest** | ends the return; enabled on the return and not during the startle; the Enter key presses it | left |
| **Restart trial** | starts the trial again on a fresh trip of the same beetle count (`replanTrip`, drawn from the seed, the trial and the attempt, so a restarted trial is not a practiced one); the record counts restarts and the reveal prints the count as a row; Steps 1, 2, 3 and 5, not during the startle (Jon's walk, 2026-10-20: for a student who is interrupted) | left |
| **Commit my trials** | after the block's last trial; opens the reveal | left |
| **Go on to Step n** | after the reveal | left |

While a trial runs, a status box sits over the view and on the panel, three lines on the way out and four on the return: *Trial n of N* · *Beetles taken k of m* (or *Set down somewhere else* in Step 4) · the phase, *Walk to the beetle* / *Find the nest* in the accent color / *Startled* / *Trial over* · and on the return *then press “Here is my nest”*. (Jon's walk, 2026-10-19 and 2026-10-20: the phase and the button's name on one line overflowed the box; the light line and the blank line were noise once Part 1 had no dark; the change of goal wanted a color as well as the words. The box is the one place a line is added rather than kept blank, at a change of phase, not of a live value.) The right panel reads *The overhead view, the errors and the navigators appear here after Commit my trials.* until the commit.

**The reveal** (right panel): one legend line naming every mark, then per trial an overhead inset (the outward path in amber with a numbered amber dot at each beetle, the return dashed in blue, the nest a green dot, the endpoint a blue ring, the navigators' endpoints red squares, the near landmarks as rings, moved where they were moved, none on the bare range); fixed rows with the label padded to one width and the number right-aligned so the decimals line up (*Outward path*, in Step 2 *Return in moonlight* or *in the dark*, *Error from the nest* with *(time ran out)* when the two-minute cap ended it, *Time in eye view*, *Time in follow view*, *Restarts*, and in Step 5 *Landmarks moved* and *Score on the line*; Jon's walk, 2026-10-20); in Step 5 the 0-to-1 line with the student's dot and the navigators' grey dots; and four lines of navigators, `label  error  from you`. Below the trials: in Step 2 the plot *Error against the length of the outward path*; in every scored block the four navigators' one-line descriptions and the line that they are programs given the same trips. Practice is not scored and shows no navigators.

### Rats tab (Part 2)

| Name on screen | Range | Default |
|---|---|---|
| **Rat**: H, R1 … R6 | seven chips | H |
| **Apparatus**: The plus maze · The water maze · The radiating paths | | plus maze |
| **Training trials** (plus maze) | 4 · 16 · 64 | 4 |
| **Platform** (water maze) | hidden · visible, with a flag | hidden |
| **The lamp** (radiating paths) | in place · switched off · moved across the room | in place |
| **Room** | rich room · plain enclosure | rich |
| **Rotate the room’s cues 90° between training and test** (box) | | off |
| **Remove the cues just before the choice** (box) | | off |
| **Darkness** | none · from the start · after setting off | none |
| **Run the test** · **Skip ahead to the result** | | |
| *Tests run* · *Trials in a run* (fixed lines) | | 0 · 8 |
| **Diagnosis**: a select per hidden rat | — choose — · beacon · route · snapshot · map (survey knowledge: a cognitive map) · damage to the hippocampus · damage to the striatum | — |
| **Commit my diagnoses** | disabled until every hidden rat has one | |
| **Reveal** (per hidden rat, right panel) | after the commit; reads *Revealed* once pressed | |

Right panel: **This test**: *Rat*, then the apparatus's result lines (plus maze: probe trials, ended at the east arm (the place), ended at the west arm (the same turn), ended elsewhere; water maze: test trials, found within 60 s, mean time, the probe's share in the platform's quarter and the rotated quarter, then one line per trial; radiating paths: trials, most taken, path 6, paths 4 and 5, and a bar chart of twelve paths with path 6 in amber). **The rats**: H's line in full; each hidden rat *hidden until the commit*, then **Reveal**, then its strategy, its line, and *You said: …*.

### Cells tab (Part 3)

| Name on screen | What it does |
|---|---|
| **Step 1** … **Step 5** (chips) | the five steps, opened in order |
| **Begin** | on each step's *What will happen* |
| the prediction chips and **Commit my prediction** | Steps 2 to 5; the change happens on the commit |
| **Let it explore by itself** (toggle) | the seeded foraging path |
| **Skip ahead 2 minutes** · **Skip ahead 10 minutes** | paid five simulated seconds a slice |
| **Skip ahead 1 day (30 simulated minutes)** | Step 5 only |
| **Pin these maps** · **Clear the maps** | the pinned set appears at the foot of the right panel |
| **Browse other place cells** · **Browse other grid cells** | the next six place cells; the next pair in each grid group |
| **Lights on** | Step 2: ends the dark |
| **Move the card** | Step 3: 90° whichever way keeps it in view; *Turn to face the card first* otherwise |
| **Back to the first room** | Step 4 |
| **Go on** · **Go on to Step n** | |

The predictions: Step 2 *In the dark, what happens to the place fields?* (stay as sharp · smear and drift · disappear · move to new places and stay); Step 3 *When the card is turned 90° while the rat is out of the box, what do the head-direction cells do?* (each keeps its direction · every direction turns 90°, all together · they scatter · they stop firing); Step 4 *In the new room, what do the place cells do?* (same places · some new places, others silent · all silent · everywhere); Step 5 *With the turn signal gone and the card in view, what do the head-direction cells do over a day?* (keep their tuning, held by the card · keep firing, but not for any one heading · stop firing · turn with the card as before).

Right panel, **The recording**, redrawn at most twice a second: ten fixed lines (*Room: the first box, lit* · *Simulated time* · *Gap between the estimate and the true position … cm* · *The bump against the true heading …°* · *Drift of the bump since lights out …°* while dark · *The white card holds the heading* / *does not hold the heading yet* · *It took control after n.n min in this room* / *Time in this room* · *Directional tuning of the shown cells (0 to 1)* · *Card moves seen by the rat in this room: n* · *Turn pathway: intact / removed*); **The rings** as two circles of 64 bars with the decoded bump marked and its heading printed, with the two-rings line and the not-a-circle line; **Head-direction cells**: eight polar plots labeled by preferred direction (0°, 45°, …); **Firing maps: place cells**: six heat squares with the peak rate under each, and the place-cells line; **Grid cells**: six, two per group, labeled with the group's spacing, and the two grid lines; **Border cells**: four (east, north, west, south wall); **Overhead**: the box's outline, the true path in amber, the estimate dashed in blue, the rat and its estimate as dots; **Pinned maps**: each pinned set with four polar plots, four place maps and one grid map per group.

Left panel, beside the step: *Your prediction: …* once committed; **What the step shows**, three fixed lines (Step 2: the lights and the gap; Step 3: the eight cells' turns since the card was turned, their mean, and whether the card holds the heading; Step 4: the map in use of those stored, place cells silent in this room, and the card's control; Step 5: the pathway, the lower ring's bump strength, the directional tuning); and the three Part 3 content lines (models, the estimate, the map rule). Step 5 also prints the assumption line (§5 below).

### Patches tab (the closer)

| Name on screen | Range | Default |
|---|---|---|
| **Predict first**: the rich habitat · the poor habitat, then **Commit my prediction** | | |
| **Habitat**: rich habitat · poor habitat | | rich |
| **Leave a patch when beetles turn up there more slowly than one every … s** (slider) | 2 · 3 · 4 · 6 · 8 · 10 · 12 · 15 · 20 · 25 | 8 |
| **Run a night** · **Skip ahead to the end of the night** · **Try every setting** | | |

Four fixed lines: *Night: h.hh h of 4* · *Beetles found* · *Patches visited* · *Beetles per minute*. Right panel: the habitat's line, the plot *beetles per minute* against the setting with the habitat's average rate as a dashed mark (*average rate: one every 4.4 s*), two fixed lines (the best setting; the predicted setting), the table of both habitats' best and predicted settings, and after the commit *Your prediction* and the answer.

---

## 2. The spatial system, as it shipped

Headless in `src/sim/rodent/spatial/`. The body (`body.ts`) is the only file that holds the true pose, and nothing under `spatial/` imports it (`structure.test.ts`). What the system receives each step is `Senses`: the turn signal, the step signal, the landmarks in view as bearings and distances, a wall contact, the room's center as seen (bearing and distance, with noise, in the light), and the room as perceived (shape, wall and floor colors, the card, and the room's axis as seen). Every noise draw and every spike comes from the session's seeded stream.

**The two rings** (`ring.ts`). `N = 64` units each, Lab 4's rate units with the sigmoid at width 0.2 and threshold 1.0. The lower ring's recurrent weights are a bell of width 25° with amplitude 0.18 about each unit minus a uniform inhibition of 0.114, baseline 0.65; the turn signal enters as the ring's own rates multiplied by the turn rate through an asymmetric weight, the derivative of the bell times `TURN_GAIN = 0.05` (Zhang's 1996 mechanism), calibrated so a turn moves the bump by the same angle within 2% from 30°/s to 180°/s (at 360°/s it keeps up at 44%; the body never turns faster than 120°/s). Time constant 50 ms, step 20 ms, noise 0.04 on every unit's net input. **The background drive** the turn pathway carries is 1.0; a settled bump dies below a drive of about 0.68 (measured; `CRITICAL_DRIVE`); the lesion leaves 0.45, and 0.45 plus the nudge's ceiling is well below the critical value, so the card cannot make up the difference. The upper ring: one fixed weight of 3.0 from the lower counterpart, threshold 0.8, width 0.25, no connections among its own units.

**Landmark input.** Twelve view units per landmark the system knows of (the white card, the black card), each a bell of width 18° about one egocentric direction. The bearing the rings read is the landmark's direction *as seen from the room's center*, which the system computes from two things it senses, the vector to the landmark and the vector to the center: a card on the wall of a 1 m box swings by tens of degrees as the rat crosses the floor, and no heading could be learned from its raw bearing (measured: control 0.26 at 10 min and a 44° wobble in the light; with the center-based bearing, 0.78 and 4°). View strength is 1 within half a meter and fades to 0.3 by two meters, times the landmark's stability (below). The view weights onto the upper ring start at zero, saturate at 0.08, and learn by Lab 5's Coincidence rule **with weakening on** — Φ = y − 2·ȳ with ȳ the unit's 20-second average — at η = 0.002 per second of coactivity, written only by `learnWeights`. Without weakening the mapping smears over every heading the ring drifted through and the card's pull goes broad and feeble (measured, `tune.probe.ts`).

**The nudge.** The landmark input each upper unit receives, times 0.3, clamped to ±0.03, added to the lower counterpart's net input. At its ceiling it pulls a standing bump at under 10° a second (measured 4 to 5°/s; the body turns at 120°/s), returns a bump displaced by 45° within 40 s, and cannot form or hold a bump without the pathway's drive (`ring.test.ts`). It is the one path from a landmark to the lower ring (`structure.test.ts`).

**Stability** (`stability.ts`). While a landmark is in view its raw bearing should change only as the head turns; a change of more than 15° in one step, net of the turn signal, is a jump, and each jump halves the landmark's stability. Stability scales the landmark's input to the rings and its weight in the position estimate (a landmark below 0.5 gives no position fix). A landmark moved out of view is not caught. See §5 for why this exists.

**The estimate** (`estimate.ts`). Position in the ring's frame; each step adds the step signal along the upper ring's decoded heading; a variance grows by 0.004 m² per meter run. Corrections: a stable landmark's fix is averaged in by the Kalman share, with the fix's standard deviation 3 cm plus 12 cm per meter of distance, divided by stability; a landmark closer than 15 cm replaces the estimate outright; the room's center as seen in the light is a fix with a 6 cm standard deviation; a wall contact resets the coordinate across the wall touched, and only that coordinate (the variance halves). **The map frame**: a map stores the room's axis as seen on entry, in ring coordinates, because the ring does not know north; fields, grids, border cells and wall resets are computed in that frame, and a contact in a room with corners is a contact with the nearest of its four walls whatever the heading estimate's drift has done to the perceived direction.

**The cells** (`maps.ts`, `system.ts`). Thirty place cells, each active in a room with probability 0.65, a Gaussian field of 10 cm standard deviation at a seeded place, blending the running sum and the wall-anchored coordinate with equal weight (0.5), peak 20 Hz. Three grid groups with spacings 30, 42 and 58.8 cm (ratio 1.4), six cells each, a seeded orientation per group and a seeded offset per cell, the standard three-cosine lattice rectified and squared, anchored to the walls at 0.15, 0.5 and 0.85, peak 15 Hz. Four border cells, one per wall, firing within 8 cm of it, peak 20 Hz. Eight head-direction cells shown: upper-ring units 0, 8, …, 56 (every 45°), peak 40 Hz. Spikes are Poisson at rate × peak × dt.

**Maps for rooms.** Room distance = |roundness difference| + |width difference| + |length difference| + 1 if the wall colors differ + 0.5 if the floors differ + 1 if the cards differ. The current map is kept unless another stored room fits better by 0.1 (`HYSTERESIS`); a room farther than 0.55 (`NEW_ROOM`) from every stored one gets a new map. With the six boxes from a square to a circle the switch falls between the third and fourth (`recording.test.ts`). A new map's fields, grid orientations and offsets come from the map store's own forked stream, so returning to a room restores its map exactly.

**The door that is shut.** `ratesAt(x, y)`, cell activity for a position the rat is not at, throws unless the system was built with `offline: true`; this scene never passes it and never calls it (`structure.test.ts`). That is how Module 10's replay and imagining stay out.

**The index of directional tuning** is the mean-vector length of a cell's firing rate by heading in 24 bins, averaged over the eight shown cells: 0.73 to 0.74 for a filled map in the light; 0.03 to 0.06 after the lesion.

---

## 3. Every world, as it shipped

**The range** (`range.ts`, drawn by `RangeView.tsx`). The forager is kept within 30 m of the nest at the origin. Near landmarks: the fallen log at (4.5, 2.5), 3 m long; the large rock at (−3.5, 4); the split rock at (3, −4.5); the stump at (−4, −3). The tall tree at (0, 45), 14 m high, a direction from anywhere in moonlight. The stream bank along x = −27. Moonlight: near landmarks seen within 10 m, the tree from anywhere, fog density 0.13 (0.17 with Low detail). Dark: nothing but the ground within about 2 m, fog density 0.9 (1.0), a dim light at the animal with a 2.6 m reach. A beetle is taken within 0.6 m; the nest reached within 0.8 m. Pace 1.5 m/s, 0.5 m/s stepping back, 120°/s turning; body radius 10 cm. **The landmarks stop the body** (`pushOut` in `range.ts`; Jon's walk, 2026-10-19: the rat walked through the rocks): each has a footprint, a disk of 0.6 × size for a rock, 0.35 m for the stump, 0.6 m for the tree's trunk, and a 3 m segment of radius 0.26 m along the log; the body is pushed out of a footprint where the landmark stands now, moved or not, on the World tab and in every Part 1 trial. The navigators and the closer's forager are not stopped (they are programs, and the closer's forager moves on a line between patches). The ground is a leaf-litter texture repeated sixty times over a 90 m plane, with 2,600 instanced leaves and 700 pebbles (half with Low detail).

**Part 1's trials** (`homing.ts`). Practice: two trials of one leg. **Step 2, Home across bare ground** (Jon's walk, 2026-10-19 and 2026-10-20; it was *Home in the dark*, six trials with dark returns, at the first build): the range bare, no landmarks, no tree, no stream bank, no nest to see; moonlight throughout; **eight trials, three of two beetles, three of three and two of four, in an order set by the seed**, legs 4.5 to 7.5 m with 45° to 135° between them, **and every beetle at least half the path walked so far from the nest** (`HOME_SHARE`, Step 2 only; a leg is redrawn until it is), so a trip never doubles back to the start and the distance home grows with the path. The reasons: the dark took away the ground moving past as well as the landmarks, and on a screen the ground moving past is the whole self-motion signal, so the dark returns measured blindness more than path integration (Jon's six errors in the first build: 3.5 to 20.4 m); the chapter's path integrator is the ant on featureless ground in daylight; a day later Jon dropped the two dark trials that had briefly closed the block as a second variable the block does not need. Three trials at each end of the path range are what a trend needs, and the shuffled order keeps practice and fatigue from running with path length (Jon's first run got worse trial by trial). Measured before the home-share rule, over twenty seeds, the last beetle stood 6.5 to 12 m from the nest after two legs but 2 to 18 m after four. The overhead draws no landmarks on the bare range, and **the error plot's dots are colored by beetle count** with a legend. **Every beetle, and the straight walk to it from the last, keeps 1 m beyond every near landmark's footprint** (`BEETLE_CLEARANCE`; a leg is redrawn up to forty times; Jon's walk, 2026-10-19: beetles spawned behind the rocks), which changes every seed's beetles from the first build; §4.2 was re-measured after it. Moonlight: four trials of three legs. Picture: set down 3, 20, 3, 20 m from the nest at a seeded bearing, facing a seeded way; the still picture is the view from the nest facing north in moonlight. Moved: four trials of two or three legs of 3 to 3.6 m, the tree hidden, the near landmarks rotated about the last beetle by ±15° (two trials) or ±60° (two) in a seeded order after a two-second startle. A return ends on *Here is my nest* or after 120 s. The record keeps every step's time, pose, command, light and phase, every beetle's time, the outward length, and the seconds in each view.

**The navigators** (`homing.ts`). Turn noise 0.12 rad/s white per step, turn gain 1.01, step noise 6% of speed, variance 0.02 m² per meter run, a landmark fix's standard deviation 0.4 m, and *Following one*'s conflict distance 3.5 m. Each walks home at the range pace by its own sensed heading until its estimate says it is within 0.4 m of the nest; *Landmarks only* goes straight to where the landmarks put the nest when a near landmark is in view at the last beetle and stops where it is otherwise.

**The laboratory** (`lab.ts`). The plus maze: four arms 0.6 m long and 12 cm wide, food in the east arm, training from the south, the probe from the north; from the south the food was a right turn, so the same turn from the north is the west arm. The water maze: a pool of radius 0.8 m, the platform of radius 7 cm at (0.35, 0.35), starts at north, east, south, west in turn (north first), swimming at 0.3 m/s, a 60 s cap, a 30 s probe from the north with the platform removed. The radiating paths: a table of radius 0.25 m, the start path 0.8 m from the south, the roundabout route north 0.5, west 0.3, north 0.5, east 0.8 to the food box, twelve paths of 1.3 m fanning from 142.5° to −22.5° at 15°, path 6 (67.5°) nearest the food box, paths 4 and 5 beside the blocked alley (90°), the lamp 0.15 m east and 0.25 m north of the food box, or moved to (−1.2, 0.9). Rooms: the rich room's rack of cages 2.2 m east, a window north, a door west, a poster south; the plain enclosure has nothing.

**The recording boxes** (`rooms.ts`). Box A: 1 m square, gray walls, dark floor, the white card on the north wall. Box B: round, 1.1 m across, blue walls, pale floor, the black card on the east. For the tests only: Box A stretched to 1.5 × 1 m, shortened to 0.75 × 1 m, and six boxes from the square to a circle. Pace 0.5 m/s, 0.2 back, 120°/s; body radius 4 cm; the card seen within ±100° of the head.

**The patch world** (`patch.ts`). Rich habitat: a fresh patch yields 0.5 beetles a second, falling with a 20 s time constant, patches 12 m apart (8 s of travel). Poor: 0.2 a second, 20 s, 30 m (20 s). A night is 4 hours at 0.1 s steps. The rule leaves when the gap since the last beetle exceeds the setting. The habitat's average rate (the largest value of beetles gained per second of patch time plus travel) is one every 4.4 s in the rich habitat and one every 15.7 s in the poor; the predicted settings are 4 and 15.

---

## 4. Every number a student will read off the screen

### 4.1 Part 3, the card and the heading (six seeds unless marked)

- **The card takes control** (the printed line) after **7.5 to 7.9 min** in the first box (mean 7.7), never within the first minute; in the round box after 8.2 to 8.7 min (mean 8.5).
- **In the light**, once the card has control, the bump's offset from the true heading wanders by 4 to 5° (standard deviation over a minute). The offset itself is arbitrary and can be anything; it is the drift that matters.
- **After 5 min in the dark** the bump stands 3 to 105° from where it stood (mean 42°). The reading says it drifts within minutes; one seed in six barely moved in five.
- **The card turned 90° out of sight** (four seeds, two minutes to settle, two to record): the eight cells' preferred directions turn by 88 to 92° (mean 90), all together.
- **Moves in sight before the card loses control** (four seeds): 5, 4, 5, 3.
- **The lesion** (four seeds): tuning index 0.73 to 0.74 before; 0.03 to 0.06 thirty simulated minutes after; 0.03 to 0.05 after a further hour with the card in view. The cells keep firing: the upper ring's mean rate stays near 0.15 of peak.
- **Let it explore by itself** covers 94 to 98% of the floor's bins in 10 min.
- **The gap between the estimate and the true position**: 6 to 15 cm lit (mean 9); 5 to 31 cm averaged over two dark minutes (mean 20).
- **The round box**: 8 to 16 of 30 place cells silent (mean 11); the rest in new places.
- **Stretched by half** (one seed): the fields' x moves by a factor of 1.34, that is about 0.68 of the stretch (spec target 0.4 to 0.6; see §5).
- **Square to circle**: the map switches once, between the third and fourth of six boxes (by test; not a step in the scene).
- **Grid spacings** 30, 42, 58.8 cm; shortening the box by a quarter compresses the largest group's map more than the smallest's (by test).

### 4.2 Part 1, the navigators (twenty seeds, a scripted forager that walks straight to each beetle and straight home)

| Block | Outward path | Running sum only | Landmarks only | Averaging | Following one |
|---|---|---|---|---|---|
| bare ground, 2 beetles | 9 to 13 m | 0.3 to 1.9 (mean 0.7) | 5.8 to 12.4 (9.4): stops at the last beetle | 0.1 to 2.1 (0.7) | 0.2 to 1.7 (0.7) |
| bare ground, 3 beetles | 14 to 20 m | 0.0 to 3.2 (1.1) | 8.7 to 18.3 (12.6) | 0.1 to 2.4 (1.0) | 0.2 to 2.5 (0.9) |
| bare ground, 4 beetles | 17 to 25 m | 0.2 to 3.6 (1.1) | 10.8 to 20.9 (15.4) | 0.4 to 3.1 (1.3) | 0.2 to 3.7 (1.1) |
| moonlight, 3 legs | | 0.1 to 2.5 (0.9) | 0.1 to 16.0 (1.2) | 0.1 to 1.0 (0.5) | 0.1 to 1.0 (0.5) |

Errors in meters from the nest. On the bare range the running sum's mean error grows with the path only a little (0.7 to 1.1 to 1.1 m), too little to show in eight trials; averaging and following one have nothing to average with and end where the running sum does. *Landmarks only* now ends farther off with more beetles, since the last beetle is at least half the path from the nest. Re-measured 2026-10-20 for the eight-trial block; the moonlight and moved rows are unchanged, since the home-share rule is Step 2's only. In moonlight *Landmarks only* ends at the nest when a near landmark is in view at the last beetle and otherwise stops where it is (one trial in twenty ended 16 m off). Re-measured 2026-10-19 after the beetle clearance redrew every trip; the first build's ranges were within a meter of these.

**The moved landmarks** (score on the 0-to-1 line, medians over twenty seeds): Running sum only 0.08 on the small move and 0.05 on the large; Landmarks only 0.96 and 0.86; Averaging 0.65 and 0.61; **Following one 0.69 and 0.97**. The 15° move puts the two nests about 2 m apart, the 60° move about 7 m; the threshold is 3.5 m.

**The picture block**: set down 3, 20, 3, 20 m from the nest. The running-sum navigators stay where they were set down; Landmarks only goes to the nest when a near landmark is within 10 m.

The student's own errors are the data, and the build has no number for a person at a screen.

### 4.3 Part 2, the table (majority over twenty seeds; the count is the majority's)

| Test | H | R1 | R2 | R3 | R4 | R5 | R6 |
|---|---|---|---|---|---|---|---|
| plus, rich, 4 | east 20 | east 20 | west 20 | east 20 | east 20 | west 20 | east 20 |
| plus, rich, 64 | **west** 20 | east 20 | west 20 | east 20 | east 20 | west 20 | east 20 |
| plus, plain | west 20 | none 18 | west 20 | none 18 | none 18 | west 20 | none 18 |
| water, visible | finds 20 | finds 20 | fails from new starts 18 | finds 19 | finds 19 | finds 20 | finds 20 |
| water, hidden | learns 20 | fails 18 | fails 15 | learns 20 | learns 20 | fails 15 | learns 20 |
| water, cues removed | most times 20 | fails 20 | fails 12 | **fails** 17 | most times 20 | fails 12 | most times 20 |
| water, rotated | rotated quarter 20 | fails 17 | fails 20 | rotated quarter 20 | rotated quarter 20 | fails 20 | rotated quarter 20 |
| water, dark after start | most times 20 | fails 20 | fails 12 | fails 17 | most times 20 | fails 12 | most times 20 |
| paths, lamp on | path 6 20 | **path 6** 20 | paths 4 and 5 20 | path 6 20 | path 6 20 | path 6 20 | path 6 20 |
| paths, lamp off | path 6 20 | none 19 | paths 4 and 5 20 | none 19 | path 6 20 | paths 4 and 5 20 | path 6 20 |
| paths, lamp moved | path 6 20 | **path 1** 20 | paths 4 and 5 20 | none 19 | path 6 20 | path 1 20 | path 6 20 |

*none* is *no consistent arm* or *no preferred path*. In the water maze, *finds it* and *most times* mean swimming to the platform within 20 s on at least 60% (75% for *finds it*) of the test trials, which a direct swim from the rim does in about 5 s and a random search seldom does; *learns it* means the later trials are quick. With a change (rotation, removal, darkness) a run is 8 training trials and then 8 test trials, and the lines report the test trials.

### 4.4 The closer (twenty seeds)

| Habitat | Average rate | Predicted setting | Best setting, median (range) |
|---|---|---|---|
| rich | one every 4.4 s | 4 s | 6 s (6 to 8) |
| poor | one every 15.7 s | 15 s | 12 s (10 to 15) |

The rich habitat's best setting is sooner, and both lie within one step of the prediction; see §5 for the one-step offsets.

### 4.5 Timing of the scene itself

One sim step of Part 3 is 47 µs headless; a frame's six steps 0.3 ms; a skip slice of five simulated seconds about 12 ms; *Skip ahead 2 minutes* about 0.3 s in all, 10 minutes about 1 s, the compressed day about 3 s. The sixteen rate maps cost 0.6 ms together (cached until the record grows). A whole four-leg homing trial, scripted, is 0.6 ms and its four navigators 0.7 ms. A test in Part 2 is under 0.5 ms. A four-hour night is 3 ms; *Try every setting* 9 ms. Nothing on a click path approaches 300 ms.

### 4.6 Wall-clock minutes per part, the build session's count (nobody has timed a student)

| Part | What it asks | Minutes |
|---|---|---|
| 0 | the tour, both views | 3 |
| 1 | 2 + 6 + 4 + 4 + 4 trials of about 40 s each, five reveals to read | 25 |
| 2 | one test per row of the table, eleven runs with *Skip ahead to the result*, the diagnoses | 22 |
| 3 | five steps, a minute of driving and a skip each, the predictions | 25 |
| closer | two habitats, *Try every setting* twice, the prediction | 8 |

**About 83 minutes with reading and writing**, against the 80-minute target. The cheapest cut is Part 1's picture block (5 min).

### 4.7 Frames per second (`scripts/m09-fps.mjs`, headed Chromium on the development Mac, driving forward and turning)

75 in every case: the range in eye view, in follow view, and in eye view with Low detail; the box in both views; with and without Chrome's 4× CPU throttle. That is the display's refresh rate; the drawing is light enough that the CPU throttle does not reach it. On an idle machine no main-thread block during *Skip ahead 2 minutes* reached 50 ms, throttled or not; the skip takes about 0.3 s unthrottled and 1 s throttled. Measured while the test suite ran, the frame rate fell to 10 and a block reached 79 ms, so the script is only meaningful with nothing else running. A Chromebook's GPU is the number still to be seen. (Headless Chromium's software renderer gave 4 to 7 and means nothing.)

### 4.8 What is tested, and what only a person can see

98 tests for the scene and its sim (672 in the suite). Not verifiable headless: the look of the range at night and of the box in the dark, the rat's idle motion, whether either view makes anyone queasy, the heat maps' legibility on the dark theme, and the frame rate on a Chromebook.

---

## 5. Every result the scene produces that the reading does not report, and where the build departed from the spec

1. **The seen card loses control through a stability estimate, not through weight spreading alone** (spec §6.2 says the spread of the view weights does it). Measured: in any regime where the card takes control in about 8 minutes, turns every cell by 90° when turned out of sight, and keeps the lit offset within a few degrees, the pull is fast enough that a seen move is followed within 20 to 40 s and the weights are relearned, not spread; the card followed eight moves of eight. In the regime where spreading did cost control (five moves), the pull was so slow that the out-of-sight turn moved the cells only 45 to 65° in two minutes and the lit offset wandered 20 to 40°. The system therefore also tracks each landmark's stability from bearing jumps the turn signal does not match (the reading's own principle: a landmark is worth using only if it stays where it is), halving the landmark's weight at each seen move; control goes after 3 to 5 moves. A landmark moved out of view is not caught, which is why the out-of-sight turn carries every cell. The handout should say the loss of control is this model's rule, and that the reading reports the outcome only.
2. **The rings read a landmark's direction as seen from the room's center.** Not in the spec. A card on the wall of a 1 m box swings by tens of degrees as the rat crosses the floor; from its raw bearing no heading could be learned (control 0.26 at 10 min, a 44° wobble in the light). The system computes the center-based direction from two things it senses, the vector to the card and the vector to the room's center, both egocentric. The handout can say that distant landmarks are the ones that give a heading, and that a card on a near wall is treated as if seen from the middle of the room.
3. **Weakening is on** in the Coincidence rule (spec §6.2 names Coincidence; weakening is Lab 5's setting of it). Without it the mapping from view units to upper-ring units smears over every heading the ring drifts through, the card's pull goes broad, and control never settles.
4. **The one assumption the reading does not state** (spec §6.2 asked for it to be recorded): the turn pathway carries a steady background drive that is part of what holds the lower ring's bump; removing the pathway removes the drive with the turn information, and the ring is then too weakly driven to hold a bump against its own noise. Measured: a bump persists down to a drive of about 0.68 of the intact value and dies below it; the lesion leaves 0.45, and the nudge's ceiling cannot make up the difference. The line beside Step 5 says this is the model's assumption.
5. **The map frame.** The ring does not know north, so each map stores the room's axis as seen when the map was made and computes everything in that frame (spec §6.5 does not say how a map's coordinates relate to the ring's). A wall contact in a room with corners resets the coordinate across the nearest of the four walls.
6. **The compressed day**: *Skip ahead 1 day* runs 30 simulated minutes, labeled as such; the tuning is gone within that and stays gone over the following hour (measured).
7. **Stretch the box**: fields move by about 0.68 of the stretch, not 0.4 to 0.6, with the blend at equal weight; the walls as seen in the light also re-place the estimate. Recorded, not retuned, and not a step in the scene.
8. **The closer's best setting** lies one step after the average-rate mark in the rich habitat and one step before it in the poor, because the rule reads the rate off the gap since the last beetle, a noisy estimate: at a high rate a long gap arrives by chance before the rate has fallen, at a low rate the reverse. Within one step either way.
9. **The reading's radiating-paths result is hard to repeat** (§9.1.6); the programmed rats' clean preferences (20 of 20) are a property of the programs, and the handout should say so, as the spec asks.
10. **The water-maze criteria** for *finds it*, *learns it* and *most times* are the build's (20 s, 60% and 75%); the reading gives none.
11. **Beacons pull by their salience**: a cage rack 0.25, the one lamp in a dark room 1.0, a flag on the platform 1.0. That is what makes the beacon rat look exactly like the map rat with the lamp in place and follow the lamp when it is moved, and what lets the turns beat the rack for R5 in the plus maze while the lamp beats the turns on the radiating paths.
12. **Dark drift** is 3 to 105° after five minutes across six seeds; a seed can sit still for five minutes.
13. **Cut, in the spec's order**: the reorientation step (§7.8) and the home-base step (§10.2). Square to circle and stretch the box are measured by tests and not offered as steps. R6 was built. Both views are kept everywhere.
14. **Step 2 runs on the bare range** (Jon's walk, 2026-10-19 and 2026-10-20; spec §7.2 says *in the dark*): see §3. Its orienting panel says what path integration is and what to do: *Keep track of your own turns and distances as you go: that is all there will be.* **For people at a screen** the scene produces no number: the student's errors in the dark, what they do with the picture of home when set down far, and the self-motion a screen gives (the ground moving past and the keys pressed) are the handout's questions, as spec §7.7 says. The screen line and the comfort line are on Part 1's orienting screen.

## 6. What the handout should not say

Not *cue card* (it is the white card or the black card). Not *head-direction ring* (two rings, lower and upper). Not that a card the rat has seen move loses control *because the weights spread* (it is the stability rule, §5.1). Not *replay*, *preplay* or *imagine* (Module 10's). Not that grid cells build the place cells here (the place line says the reverse). Not that the navigators are models of the student. Not a frame rate for a Chromebook. And no number from §4 without "about".

## 7. State at hand-off, 2026-10-18

Branch `m09-rat`, seven commits off `main`, working tree clean after the last commit, nothing pushed, nothing merged. 672 tests pass (one Lab 8 speed test at 75 ms fails when the machine is busy, as it did when the close-out ran beside the frame-rate script, and passes alone); the build is clean; `npm run closeout m09-rat` prints the 49 claims and the crib. Jon has not walked the scene. The walk-through is written. The handout waits on the walk.

**If a change moves a number.** §4 is quoted by the walk-through and will be quoted by the handout. Re-run the crib (`PROBE=1 PROBE_DIR=src/sim/rodent npx vitest run --disable-console-intercept -t "crib:"`, about ten minutes), correct §4 and the walk-through, and any band in `recording.test.ts`, `homing.test.ts`, `rats.test.ts` or `patch.test.ts` that the change crosses. `tune.probe.ts` is the record of how the ring's constants were chosen.

**Practical notes.** The dev URL has no `/bcogapp/` base. A dev server from this clone was already on 5173 during the build. The in-app browser throttles the frame loop and cannot judge motion or frame rate; `scripts/m09-fps.mjs` opens a headed Chromium for that. Editing a `.tsx` in the scene forces a full reload in dev, which resets every part.
