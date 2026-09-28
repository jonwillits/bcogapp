# Module 6 as built — notes for the session that writes the handout

Written 2026-09-27 by the session that built `m06-brain`, from the shipped code, for whoever writes `intro_to_bcs/vertebrate_neural_architecture/brain_lab/brain_lab.md`. Built on the branch `m06-brain`. **Jon walked it 2026-09-27 with one note** (a selected chip went bold and reflowed its row; now a rule with a test), and **the handout was written the same evening from these notes**: `brain_lab.md`, 26 questions, with `build_report.py` generating the report. Unmerged and unpushed at the time of writing. The one file this session wrote into Box is the walk-through, `course_creation/labs/06_vertebrate_neural_architecture/LAB_6_WALKTHROUGH.md`, at Jon's standing request.

**The handout may assert what the close-out's claim list says and nothing it cannot find there.** Thirty-six claims about what a student will see each name the test that goes red if it stops being true (`scripts/labs.config.mjs`, entry `m06-brain`; `npm run closeout m06-brain` prints them). There is no crib probe: nothing in this scene moves, so what only a person can confirm is the look, and the walk-through lists it.

**Every result on the Bench is one of three kinds, and the handout has to use the labels as printed.** *reported* (green, solid), *follows from §…* (blue, dashed outline, printing the claim ids), *no result reported* (grey). A grey cell is the honest shape of what the chapter reports. It is not an inactive structure, and the handout should ask about the patchiness rather than apologize for it.

---

## 1. Every control and view, as it shipped

Four tabs in the header panel, titled **Lab 6: One Plan, Many Brains**: **Specimens** (Part 1), **Plan** (Part 1), **Tree** (Part 1), **Bench** (Part 2). Under the tabs, the *About this scene* line (the three honesty points) and the **Run seed**, which fixes the specimen order and the bench's numbers. Each tab keeps its own state while it is showing and starts fresh when the student comes back to it; the bench object and the seed live above the tabs and persist. The **Lab** button in the top bar opens the pane; while the handout does not exist it reads *Lab instructions not published yet* with the line *The Lab 6 handout has not been posted yet. When it is, it will appear here without a reload of the app. Until then the scene itself is open to explore.* There is no report link yet (no `reportUrl` in the registry entry; add it with the `.docx`).

### Specimens tab

Left panel **Specimens**: an instruction note, **Progress** (*n of 13 named*), the button **Commit my matches** (disabled until every image has a name; the note under it says so), and after the commit: *n of 13 right*, then under **After the reveal** the buttons **True scale** (toggles; reads *True scale: on*), **Credits** (toggles; reads *Credits: showing*), **Show the cutouts again** / **Show the originals**, and **Play again with a new order** (new seed, guesses cleared, back to the un-revealed state). The standing note: *Write down the strategy you used before you commit. The reflection asks for it.*

Stage, before the commit, titled **Which brain is which?**: a grid of numbered cards, **#1** to **#13**, in an order fixed by the run seed. Each card has a view switch (**from the side** / **from above**; the kiwi has *from above* only), the grayscale cutout on a neutral grey stage at one display size, a select reading **— choose a name —** with the thirteen common names in alphabetical order (*African elephant, bottlenose dolphin, California sea lion, chimpanzee, common marmoset, Florida manatee, gray kangaroo, human, kiwi, pig, platypus, rat, sheep*), and **Enlarge**. A name may be chosen for more than one card; nothing stops a duplicate, and nothing is marked until the commit.

Stage, after the commit: each card shows **✓ name** in green or **✗ name — you said …** in red, the **full-color original composite** (title, Latin name, scale bar, catalog number and collection credit included, exactly as the CMBC published it; for the kiwi, the whole four-bird figure), and a **See the original** link to the source page. **Show the cutouts again** swaps the originals back for the cutouts.

Stage, with **True scale** on, titled **The specimens at their true relative sizes**: a **zoom** slider (3 to 20 px per cm, default 8), a **5 cm** reference bar that scales with it, every specimen drawn at its true width from its own scale bar with its name and *n.n cm across* under it, and the line *Sizes come from each original's own scale bar. Click a small one to magnify it ×4.* Clicking a specimen opens a magnifier box under the row: the specimen at four times the zoom, its name, a **1 cm at ×4** bar, and its size. The only interpretation on screen: **Size and folding evolved more than once. §6.3.5.** A specimen without a scale bar would be drawn as a dashed grey box reading *size not recorded* (none of the thirteen is; the test covers the case).

Right panel **Enlarged**: the card the student pressed Enlarge on, at 300 px tall, with the view switch; after the commit it also prints the name, the scientific name, the credit and a **See the original** link. With **Credits** on, the panel is titled **Credits** and lists every specimen alphabetically with its common and scientific name, credit line, licence and **See the original** link, under the line that the photographs are excluded from the app's GPL licence.

### Plan tab

Left panel **Plan**: **View** with four choices, **The lamprey tour**, **Lamprey beside mammal**, **Proportions**, **The bird pallium**; **Structures**, fifteen chips (*spinal cord, hindbrain, reticular formation, norepinephrine cluster, cerebellum, tectum, periaqueductal gray, dopamine clusters, serotonin clusters, hypothalamus, thalamus, basal ganglia, amygdala, pallium, hippocampus*; in the mammal the tectum chip reads *tectum (superior colliculus)* and the pallium chip *pallium (neocortex)*); and in bold §6.1.8-C25: *Each description is a first approximation. Every structure does more than one thing, and most of what an animal does involves several of them at once.*

Stage, **The lamprey tour**: the lamprey model, every structure clickable on the model and by its label, the cerebellum drawn as a dashed empty outline over the front of the hindbrain, the amygdala as a dashed outline. Hovering the norepinephrine cluster tints nearly the whole brain and prints *fibers reach nearly the whole brain*. Every model prints *front of the brain at the left · schematic* under it.

Stage, **Lamprey beside mammal**: two models side by side, captioned *lamprey* and *mammal*, the same structures clickable in both, and under them in bold: **What changed between the two brains? Write your answer down before you go on; the scene does not give one.**

Stage, **Proportions**: the chapter figure's bars redrawn from the same constants (lamprey and mammal rows), each segment outlined, the *no cerebellum of the jawed kind* note on the lamprey row, the six-region legend and the figure's own line *the parts are the same; the proportions are not*. Above it the schematic line: *Proportions are schematic, drawn to show that the parts are the same and the proportions are not. They are not measurements.* The button **Show all seven** adds shark, bony fish, frog, lizard and bird (it then reads **Show lamprey and mammal only**). The same what-changed question sits under the bars.

Stage, **The bird pallium**: two schematic cross-sections, *bird: clusters* and *mammal: six layers (neocortex)*, surface at the top, and the line *Whether particular parts of a bird's pallium correspond to particular parts of a mammal's neocortex has been argued for decades.* §6.3.5-C13, C14.

Right panel **Structure**: the clicked structure's name as printed in that species, *in the lamprey* or *in the mammal*, its one line with its claim ids, and where it applies the named-not-spent line in italics (thalamus: *What it does to the signals it passes is a question for later modules.* hippocampus: *What it does is the subject of Modules 9 and 10.*). Clicking the lamprey's cerebellum outline gives: *No cerebellum in the form jawed vertebrates have. It arose with, or shortly before, the jawed fishes. Whether a small region here counts as a simple cerebellum is debated.* (§6.1.8-C19, C20, C28). The lamprey's amygdala adds *Whether a lamprey has an amygdala-like region is not settled.* (§6.3.3-C14). Under it, **The pallium's layers**: *lamprey: three layers · mammal: six layers: the neocortex · bird: organized in clusters rather than in layers*, and the first-approximation line again.

### Tree tab

Left panel **Tree**: the rule in bold (§6.1.8-C2), *A part two species both have was most likely present in their common ancestor. A part only one has most likely arose after the split.*; **Cards — pick one, then click branches**, nine numbered cards, each showing *not placed* or *n placed*: **1** A tectum that maps space and orients the animal · **2** Basal ganglia with two opposed pathways · **3** A pallium · **4** A cerebellum · **5** A six-layered pallium (neocortex) · **6** Basal ganglia output nucleus divided in two · **7** A corpus callosum · **8** An amygdala-like region · **9** A large brain for its body size. Then **Reveal the answer** (disabled until every card has at least one placement; the note says so) and, after the reveal, **Start over**.

Stage, **Where did each part arise?**: the cladogram, root at the left, thirteen tips at the right reading *an invertebrate (outgroup), lamprey, a shark, a bony fish, a frog, a lizard, a bird, platypus, kangaroo, dolphin, rat, chimpanzee, human*. Hovering a branch highlights it, names it (*jawed vertebrates: shark and everything after*, and so on) and prints below the tree which tips it covers. Clicking a branch places the selected card there as a numbered blue chip above the branch; clicking again removes it. The outgroup's branch is dashed and refuses every card with the line *The invertebrate is the outgroup. Every card is a vertebrate trait, so none can go on its branch.* A card may be placed on several branches.

After the reveal: each placed chip turns green (match), red with a strike (miss) or amber (not settled), and the key is drawn as white rings under the branches, dashed where the chapter leaves it open (card 8 at the root). Right panel **The answer**: for each card, *the key:* branch names, each placement marked ✓ / ✗ / ?, *missing from your placements:* where the key has a branch the student did not use, for card 9 *You used n separate origins; the key uses 3*, and the reveal line where a card has one. Before the reveal the right panel is **Your placements**.

### Bench tab

Left panel **The bench**: **Task** — six chips **Orient**, **Tone and shock**, **Cue and food**, **Lever**, **Timed blink**, **Open field**; the task's *what happens* and *Measured:* lines; **Train** and **Test** for a learned task (**Run** for Orient and Open field), **Clear training**, and a status word (*untrained*, *trained*, *trained with the climbing fibers silenced*). **Record** with its method line and the button **Record during ‹task›**. **Remove** with its method line and four chips **the neocortex**, **the dopamine clusters**, **the amygdala**, **the hindbrain**, plus **Restore ‹structure›** once one is removed, the refusal in red when the hindbrain is tried, and the menu line *This bench reports only experiments the chapter describes, or results that follow directly from what it states.* **Stimulate** with three chips **the dopamine clusters (raise dopamine)**, **the periaqueductal gray**, **one point on the tectum**, the **Point on the tectum** slider (0 to 1) for the last, and the **Stimulate** button. **Silence a pathway during training** with chips **nothing silenced**, **climbing fibers to the cerebellum**, **dopamine fibers to the striatum**, and the note *Set this, then press Train. The route is restored before Test.* **What the bench reads out**: *behavior, activity, pain response*, and in bold **Nothing on this bench measures what the animal feels.**

Stage, **Part 2 — An address is not an account**: the mammal model (removed structures hatched red and dimmed, a stimulated one ringed in amber, the tectum ring at the slider's point) beside a schematic silhouette that reports *movement: slow, hard to start* or *turned n° left/right*. Under it the result card for the last Test or Stimulate, then **The last few runs — ‹task›** (the last six train and test entries with what the bench was under), and the line *The numbers are schematic: a trained animal against an untrained one, with a little variation from run to run. They are not measurements from any experiment.*

Right panel **Recordings and notes**: after **Record**, a table of the thirteen structures with a three-cell activity meter (*low, moderate, high*) and claim ids, or *no result reported* in grey; the scale line; the reverse-inference line in bold (§6.2.1-C5); for Cue and food and Lever, a pink box *dopamine clusters across training. Early: at the food, not at the cue. Late: at the cue, not at the food. Module 5 §5.3.7; a primate recording result.* Below it **Doya's table — fill it in yourself**: four rows (*unsupervised, prediction, supervised, reinforcement*) with a select (*—, climbing fibers, dopamine fibers, none*); not checked.

---

## 2. The specimen set as it shipped

Thirteen. Twelve CMBC composites and the kiwi panel, all copied byte-identical from the sourcing folder into `public/m06/specimens/`; the derived cutouts in `derived/` have opaque hashed names. Crop boxes are in original pixels after tightening to the specimen; **the tightened boxes and the bar lengths are in `manifest.json`**, written by `scripts/m06-specimens.py`. Views: *side* and *above* for every mammal; *above* only for the kiwi. Sizes below are the *side* view's width (the kiwi's is *above*).

| Name in the list | File | Scale bar (measured) | Width across | Tree tip |
|---|---|---|---|---|
| platypus | Platypus73466clr.jpg | 1 cm = 70 px | 3.2 cm | platypus |
| gray kangaroo | Graykangaroo621276clr.jpg | 1 cm = 35 px | 7.8 cm | kangaroo |
| rat | labrat63-463lgclr.jpg | 1 cm = 91 px | 3.3 cm | rat |
| common marmoset | Marmoset6clr.jpg | 1 cm = 47 px | 3.8 cm | — |
| chimpanzee | chimp6sect6.jpg | 1 cm = 17 px | 10.9 cm | chimpanzee |
| human | human8sect6.jpg | 5 cm = 71 px | 15.4 cm | human |
| bottlenose dolphin | dolphinpanel6.jpg | 1 cm = 15 px | 15.1 cm | dolphin |
| Florida manatee | manatee8sect6.jpg | 1 cm = 18 px | 11.4 cm | — |
| California sea lion | Casealionpanel6.jpg | 1 cm = 12 px | 16.0 cm | — |
| African elephant | elephantall6clr.jpg | 5 cm = 49 px | 21.7 cm | — |
| pig | Pig6clr.jpg | 1 cm = 26 px | 9.6 cm | — |
| sheep | Sheep6clr.jpg | 1 cm = 33 px | 9.1 cm | — |
| kiwi | Visual_processing_areas_of_the_brains_of_four_species_of_birds.png | 0.5 cm = 38 px | 3.2 cm | a bird |

**A caution for the handout on the sea lion.** Its bar is twelve pixels for a centimeter in a 504-pixel composite, and the size that follows (16 cm across) is larger than the dolphin's and above reference values for the species. The measurement is faithful to the image, which is what the spec asks for, and I did not correct it; the handout should not ask a question whose answer turns on the sea lion's size. The dolphin at 15.1 cm and the human at 15.4 cm are close enough that "the dolphin's brain is larger than a human's" should be phrased with care: on these two composites they are about the same width, and the dolphin's *above* view is wider (15.5 cm) than the human's (15.3 cm).

Credits: every CMBC file carries *From the University of Wisconsin and Michigan State Comparative Mammalian Brain Collections and the National Museum of Health and Medicine (brainmuseum.org), supported by the National Science Foundation and the National Institutes of Health.* The kiwi carries the paper (Martin GR, Wilson K-J, Wild JM, Parsons S, Kubke MF, Corfield J, 2007, PLoS ONE 2(2): e198, from the article page; the Commons page names no author), the licence CC BY 2.5, and the changes made. `public/m06/specimens/NOTICE` lists all of it and excludes the files from the GPL; `NOTICE.md` at the root points at it, and the README says so.

Not shipped, from the sourcing folder: the two lamprey PDFs, the shark engraving, the generated bird image. A test asserts that no file in the shipped folder matches any of them.

---

## 3. The bench as it shipped

The intact baselines, all *follows from the chapter*. Numbers are the schematic mean with a seeded jitter (standard deviation in brackets), clamped to their range; the handout should say "about".

| Task | Untrained | Trained | Result text | Claims |
|---|---|---|---|---|
| Orient | *turns toward the flash* 92% (4) of flashes | — | The eyes and head turn toward the flash. | §6.1.8-C8, §6.3.2-C4 |
| Tone and shock | *freezing to the tone* 8% (4) of the tone | 70% (8) | Untrained: little freezing to the tone. / The trained animal freezes to the tone. | §6.3.13-C3, C6 |
| Cue and food | *approach after the light* 12% (5) of trials | 85% (6) | Untrained: the light is not followed by approach. / After the light, the trained animal approaches the food site. | §6.3.13-C6 |
| Lever | *presses per minute* 2 (1) | 20 (3) | Untrained: an occasional press. / The trained animal presses the lever. | §6.2.5-C2, C3 |
| Timed blink | *eye already closed when the puff arrives* 4% (3); *reflex blink to the puff itself* 100% | 85% (6); 100% | Untrained: the eye closes only when the puff lands. / The eye is already closed when the puff arrives. | §6.2.4-C2, C3, C8 |
| Open field | walking yes · grooming yes · exploring yes | — | The animal walks, grooms and explores. | §6.2.8-C22 |

The manipulation rows. Every combination not listed is grey and prints *No result reported.* followed by one sentence saying what the chapter does and does not report about that structure.

| Manipulation | Task | Kind | Result text a student reads | Readouts | Found in | Claims |
|---|---|---|---|---|---|---|
| Remove the neocortex | Open field | reported | Walking, grooming and exploring all continue. | walking / grooming / exploring: *continues* | Cat, with the basal ganglia intact. | §6.2.8-C22 |
| Remove the neocortex | any other | not reported | No result reported. The chapter describes the animal without a neocortex in the open field only. | — | — | — |
| Remove the dopamine clusters | Lever | reported | Every movement is slow and hard to start. Lever presses fall, whatever the training. | *movement: slow*; presses per minute 3 (1) trained, 1 (1) untrained | A lamprey whose dopamine is depleted; Parkinson's disease in humans. | §6.2.9-C11 |
| Remove the dopamine clusters | Orient, Open field | reported | Every movement is slow and hard to start. | *turn toward the flash: slow to start*; walking / grooming / exploring: *little* | same | §6.2.9-C11 |
| Remove the dopamine clusters | Tone and shock, Cue and food, Timed blink | reported | Every movement is slow and hard to start. The learned response cannot be scored cleanly, because the animal barely moves. | the task's readout printed as *not scorable* | same | §6.2.9-C11 |
| Stimulate the dopamine clusters (raise dopamine) | Open field selected | reported | Unwanted movements break through. | — | — | §6.2.9-C12 |
| Stimulate the dopamine clusters | any other task selected | not reported | No result reported. The chapter reports what raised dopamine does in the open field, and nothing about it during this task. | — | — | — |
| Silence dopamine fibers during Lever training, then Test | Lever | follows | The animal moves normally at test, and presses no more than an untrained animal. | *movement: normal*; presses per minute 2 (1) | note: This is what the three-systems mapping predicts. The chapter's evidence for the mapping is reward-related activity where the pallium meets the striatum (§6.2.6-C9). | §6.2.5-C8, C9, C14; §6.2.6-C13 |
| Silence dopamine fibers during Timed-blink training | Timed blink | follows | The blink is learned normally. | 85% (6); reflex 100% | — | #t-learning-structures, §6.2.6-C12, C13 |
| Silence climbing fibers during Timed-blink training | Timed blink | reported | The learned, timed blink never develops. The reflex blink to the puff itself is unaffected. | eye already closed 4% (3); reflex 100% | Rabbit. Note: the learned blink is the reported result (§6.2.4-C12); the reflex follows from §6.2.4-C4. | §6.2.4-C12, C4 |
| Silence climbing fibers during Lever training | Lever | follows | The lever is learned normally. | presses per minute 20 (3) | — | #t-learning-structures, §6.2.6-C13 |
| Silence either route during Tone-and-shock or Cue-and-food training | those | not reported | No result reported. The chapter states where the … fibers deliver their signal, and says nothing about this task. | — | — | — |
| Remove the amygdala | Tone and shock (trained) | reported | Freezing to the tone is not learned: the trained animal freezes no more than an untrained one. | freezing 8% (4) | Rat. | §6.3.13-C6, C7 |
| Remove the amygdala | Cue and food (trained) | reported | Approach to the light is not learned: the trained animal approaches no more than an untrained one. | approach 12% (5) | Rat. | §6.3.13-C6, C7 |
| Remove the amygdala | either, untrained | reported | Untrained. Train, then test: freezing to the tone (approach to the light) will not be learned. | the untrained readout | Rat. | same |
| Remove the amygdala | Orient, Lever, Timed blink, Open field | not reported | No result reported. The chapter reports the amygdala's part in learning about threats and about rewards, and nothing about this task. | — | — | — |
| Stimulate the periaqueductal gray | any | reported | The whole defensive pattern appears: freezing or fleeing, with reduced response to pain. Not a fragment of it. | — | Rat. | §6.3.2-C16, C17 |
| Stimulate one point on the tectum, point p | any | follows | The eyes and head turn n° to the left/right (straight ahead at 0.5). A neighboring point on the tectum turns them toward a neighboring place: the tectum is a topographic map. | direction = −60° + 120·p, so 0 → 60° left, 1 → 60° right; the silhouette's head turns | The superior colliculus in mammals (§6.3.2-C9). | §6.2.8-C3, C4; §6.3.2-C4 |
| Remove the hindbrain | — | refused (follows) | Refused. The animal would not survive: the hindbrain runs breathing and heart rate. | nothing changes | — | §6.1.8-C6, §6.3.1-C6 |

The recording map is the spec's §8.5 table exactly, every non-grey cell labeled *follows from* with its claims, plus the notes printed under it: hindbrain and reticular formation *Breathing, heart rate and wakefulness run throughout.* (§6.3.1-C6, C8) · norepinephrine cluster *The arousal dial.* (§6.3.1-C10, C11) · cerebellum *Active during movement, and during perception.* (§6.2.1-C1, §6.2.4-C10, C12) · dopamine clusters, the shift box in the two food tasks (§6.2.5-C8, C4; cross-reference Module 5 §5.3.7, a primate recording result) · hypothalamus *A food-restricted animal is driven toward food.* (§6.1.8-C12, §6.3.3-C4) · hippocampus *Named, not spent. Modules 9 and 10 take it up.* · serotonin clusters *No task-specific claim in the chapter.* The amygdala is high in Tone and shock and in Cue and food, low in Orient, grey elsewhere; the striatum is high in both food tasks and moderate in everything else. Both are what the handout's "the table will look confident, and then it cracks" step needs.

The separating experiment is the pair *Remove the dopamine clusters → Lever* (slow everywhere, presses fall, learned tasks not scorable) against *Silence dopamine fibers during Lever training → Test* (movement normal, presses at the untrained level). The handout builds its question on both halves; both are tested.

---

## 4. Timing, in wall-clock minutes, as walked by the build session

There is no simulation to wait for, so the risk is that a tab goes faster than the proposal's budget, not slower. Times are for a student who reads the panel text once and does each activity once; the writing the handout adds is on top.

| Tab | Proposal | Measured walk | Where it goes faster |
|---|---|---|---|
| Specimens | about 12 of Part 1's 32 | 9 to 11: about 6 to name thirteen images with Enlarge and view switching, 1 to commit and read the marks, 2 to 3 for True scale and the magnifier | The naming is the whole of it. Without a written-strategy question before the commit, students will commit inside four minutes. |
| Plan | about 10 | 6 to 8: 3 for the tour if every structure is clicked, 2 for beside and proportions, 1 for the bird pallium | The tour is fifteen clicks and fifteen short lines. The what-changed question is the only thing that slows it. |
| Tree | about 10 | 6 to 8: 4 to place nine cards, 2 to read the reveal | Placing a card is one click. Students who do not read the branch names will finish in three minutes; the reveal is where the time should go. |
| Bench | about 30 | 14 to 18: 3 for Record on six tasks, 2 for Train and Test on the four learned tasks, 8 to 10 for the twelve manipulation rows, 2 for Doya's table | The manipulation rows are each two or three clicks. The proposal's 30 assumed writing the two tables by hand; the scene's part of it is under twenty minutes. |

Total scene time about 35 to 45 minutes against the proposal's 70. The difference is writing, and the handout has to carry it: the strategy paragraph before the commit, the one-structure-one-job table after Record only, the many-to-many table after the manipulations, and the design-an-experiment closer.

---

## 5. Where the build departed from the spec, and why

1. **2D, not 3D.** The first cut in §10, taken at the start: every model is an SVG side view drawn by one geometry function from the species parameters. Nothing in the lab depends on rotation.
2. **No `SceneCanvasLayout`.** The shared frame is a full-bleed 3D canvas with floating panels; a gallery of thirteen photographs needs a scrolling stage, so the scene has its own three-column layout (`layout.tsx`). The shell, routing, panels, the Lab pane and the seeded stream are reused as required.
3. **The Bench's numbers are schematic and seeded**, not measured from anything. The spec asks for a four-step activity scale and for results; it does not give magnitudes for freezing or presses. A trained animal is drawn against an untrained one with a small jitter so that two runs look like two runs, and the panel says the numbers are not measurements. The *kinds* of result (learned, not learned, slow, normal, not scorable) are what the tests pin.
4. **Stimulating the dopamine clusters is gated on the task selected.** The chapter's result (§6.2.9-C12) is about movement, so the bench reports it when Open field is the selected task and prints *no result reported* otherwise, rather than reporting it during a task the chapter says nothing about.
5. **The large-brain reveal line names parrots and crows**, as the spec asks, though the chapter does not say it. It is true and it is the spec's instruction; it is the one sentence on screen without a claim id behind it. If Jon prefers the chapter's own words only, delete the last sentence of that card's reveal line.
6. **The kiwi's credit names the paper's authors from the article page**, since the Commons file page gives *see above* for its author field.
7. **The derived cutouts have hashed names** (`derived/1bb5c66e85.png`), because an image's file name reaches the page as its `src` and the originals' names carry the species.
8. **The sea lion's size is left as its bar gives it** (see §2). Faithful and probably overstated.
9. **Doya's table is on screen** (cut-order item 5, not cut) and unchecked, as the spec says.
10. **`Show all seven` and the bird pallium shipped** (cut-order items 2 and 3, not cut).
11. **The dopamine shift in Record shipped** as a note across training rather than a plot across the run record: a box under the recording table, in the two food tasks, saying where the response is early and late. There is no training curve to draw, since training is instantaneous.
12. **The `.test.tsx` convention is new.** The reveal-gating tests render the tabs with `react-dom/server` and search the markup; `vitest.config.ts` and the close-out's claim matcher now include `.test.tsx`.

---

## 6. What the handout should not say

Not *lesion* as the tool's name (the tool is **Remove**; the line under it names lesions as the method). Not *mouse* for the comparison brain on screen (it is *mammal*, one parameter set; the chapter's mouse is fine to cite). Not *fear center* except as the misconception to name. No lobe, no cortical area, no homunculus. Not *log scale*. Not that the dolphin's brain is larger than the human's on these composites without checking §2. And nothing about what the hippocampus or the thalamus does.
