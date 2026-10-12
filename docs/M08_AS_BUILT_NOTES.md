# Module 8 as built — notes for the session that writes the handout

Written 2026-10-10 by the session that built `m08-objects`, from the code on branch `m08-objects` and from measurements, for whoever writes `intro_to_bcs/perception_and_action/object_lab/object_lab.md`. **Jon walked the scene on 2026-10-12** (`course_creation/labs/08_perception_and_action/LAB_8_WALKTHROUGH.md` beside the spec, revised in place; §9 holds the decisions and §10 the targets the networks did not meet), and **the handout was written the same day** from these notes: `object_lab.md`, 22 questions, with `object_lab_report.docx` and `build_report.py`, to the course voice guide. **Live since 2026-10-12**: merged to `main` at `b9592e4` and deployed; the handout is committed in the course repo at `5b43a03` and its push is Jon's. The short account of the lab is `LAB_8_AS_BUILT.md` beside the spec.

**Every number here was measured, not predicted.** Part 1, Part 2 and Part 4 numbers come from Python (`training/m08/measure_*.py`), over held-out sets that do not ship, on the exported weights as the browser has them (float16 for the photo networks), and are shipped in `public/m08/measurements.json`, which the scene prints and `measurements.test.ts` pins. Part 3's readout numbers come from `src/sim/objects/readout.probe.ts`, which trains the same unit through the same rule on the same shipped images in the same runtime, over 8 targets and 5 seeds (1000 to 1004). A handout that quotes a number should quote one from §4 and say "about".

**The handout may assert what the close-out's claim list says and nothing it cannot find there.** Twenty-nine claims (`scripts/labs.config.mjs`, entry `m08-objects`); twenty-seven name the test that goes red if it stops being true. Two have none: the glimpse duration on a real screen (measured by `scripts/m08-timing.mjs`, reported in the walk-through) and legibility on the dark theme.

---

## 1. Every control, as it shipped

The header panel, titled **Lab 8: Does It Fail Where We Fail?**, is on every tab: five tabs (**Draw** Part 1, **Parts** Part 2, **Views** Part 3, **Noise** Part 4, **Closer**), the about line, the two lines of §8 that belong on every tab, and the **Run seed** with **New seed**. The developer control of spec §7 was retired on 2026-10-12 once every mode was decided and the noise made adaptive; `?dev=1` now exposes only the benchmark hook. The layout is Lab 6's three columns: controls, a scrolling stage, an inspector. A tab keeps its state while it shows and starts fresh when returned to; a new seed restarts the open part.

### Draw tab (left panel "Inside the stack")

| Name on screen | Range | Default | Where |
|---|---|---|---|
| the pad, **Undo**, **Clear**, stroke count; *Draw this:* names a category from the seed | 256 × 256 stroke space | empty | stage |
| **Center and scale the drawing first** (toggle) | — | on | left |
| **Turn it upside down**, **Mirror it**, **Squash it flat**, **Squeeze it thin**, **Restore the drawing** | each replaces the strokes | — | left |
| **Version B: trained on shifted, turned and resized copies** (toggle) | — | off | left |

Stage: *As the network receives it (64 × 64)*; *The five most likely labels* as five fixed lines `name  p`; **the layer strip** (input, then per block convolution maps and pooled maps, eight of each shown, sizes printed, click to enlarge; the output as 24 bars); the two **tolerance plots** (shift 2, 4, 6, 8 px; turn 45°, 90°, 180°) over input and pooled 1 to 4, **shown only with centering off**, with the three labels after each turn. Right panel "What to look for": the measured shift and turn tables and the network's description.

### Parts tab (left panel "Parts")

| Name on screen | Range | Default | Where |
|---|---|---|---|
| Step 1: **Begin** on an orienting screen, then the grid of 24 names, **Previous**, **Next**, **Commit my answers** under the drawing | 12 trials | free (fixed, Jon 2026-10-12) | stage |
| Step 2: **Mid-line** / **At the joints**; **share of ink removed** | 20% to 80%, step 5 | Mid-line, 50% | left; the pad and the erased drawing on the stage |
| Step 3: the prompt chip (**mushroom**, **ice cream**, **coffee cup**); two pads; **yes** / **no** / **only just**; **Commit my answer** | — | from the seed | left and stage |
| Step 4: ten pairs each with **yes** / **no** / **only just**; **Commit my answers for the ten pairs** | — | — | stage |

After Step 1's commit: four fixed lines on the left (your percent per eraser, the network's), the twelve revealed on the stage (`it is / you / network p`), and on the right **The larger test** (200 drawings per eraser at 35%, 50%, 65%) and the moved-set count. Lines: the Biederman line, the our-networks line, the glimpse line in glimpse mode, *Glimpses shown*.

### Views tab (left panel "Views")

**One run, both sets** (revised 2026-10-12 on Jon's walk). The stage opens on *What will happen* with **Begin**, and the warning that the run takes about five minutes without a break. Then the study (the target wobbling ±10° around 0° then 75°, 10 s each; the image goes when the study ends), **Start the test**, 48 trials in one seeded order with both sets mixed (**same shoe** / **not the same shoe**; *Previous*, *Next*, *Commit my answers* on the stage under the picture), and after the commit six scorecards for the student by set and condition, six for the readouts, two pairs of curves, and the trial list.

| Name on screen | Range | Default | Where |
|---|---|---|---|
| **Begin**, **Start the test**, **same shoe** / **not the same shoe**, **Previous**, **Next**, **Commit my answers** | 48 trials | free (fixed, Jon 2026-10-12) | stage |
| **Learning on**; **learning rate η** | 0.005 to 0.2, step 0.005 | off; 0.050 | left |
| **Skip ahead 50 steps** (enabled after the commit, with learning on and the features ready; moves both readouts); **Start from new random weights** | — | — | left |
| **By hand** (Lab 7's box, collapsed) | — | 42, 8, 8, 42 | right |

Fixed lines on the left: *Features ready: n of 229*; steps so far; training images, shoes (80) and things (90); percent right on each with *(at the target)* at 95%; a line when both are at 100% saying the prediction error is near zero; then *The units' numbers* for each readout: baseline b₀, weight b₁, criterion θ, last prediction error Φ (signed with the sign's place kept). Lines: the readout line, the our-networks line, the glimpse line in glimpse mode, the correction line under any card with a rate of 0 or 1, *Glimpses shown*.

### Noise tab (left panel "Noise")

**Begin** on an orienting screen that says the three conditions are mixed and not announced and that the noise adapts; then **Show it** (glimpse, fixed, Jon 2026-10-12), the grid of 16 names, **Previous**, **Next**, **Commit my answers** under the picture, 36 trials. **The strengths are adaptive** (Jon, 2026-10-12): a one-up, one-down staircase per kind of noise, A from 0.20 by 0.05 within 0.05 to 0.60, B from ±0.35 by 0.10 within 0.10 to 0.90 (`STAIRCASE` in config.ts); a trial's strength is fixed the first time it is shown and logged; a first answer moves its kind's level; a changed answer does not change a strength already shown. The two current levels are fixed lines on the left. After the commit: the table *Percent correct on the thirty-six* (the three networks on the same noisy images, you, chance), **Where your noise settled** (the mean of the last six levels per kind, the twelve levels in order, and each network's score at the settled level read off the larger test's sweep by interpolation), every trial revealed with its strength, and on the right **The larger test** at the starting strengths and across strengths. Lines: the eye line, the our-networks line, the glimpse line, *Glimpses shown*.

### Closer tab

The pad with *Draw this:* (one of the sixteen), **Label my drawing**, the drawing as the photo networks receive it (160 × 160), four fixed lines (the three photo networks' labels with probabilities, then the drawing network's), and on the right the larger test on 800 held-out drawings. Lines: the eye line, the our-networks line, the clock line.

---

## 2. Every network, as it shipped

All trained 2026-10-10 on an Apple M5 Pro (24 GB) through PyTorch's MPS backend, scripts in `training/m08/`, seed 1, metrics in `models/*.metrics.json` on the Mac and in `public/m08/measurements.json`. Exported to the app's own format (`export_model.py`) and run by `src/sim/objects/net.ts`.

| Network | Architecture | Trained on | Time | Shipped | Score |
|---|---|---|---|---|---|
| **the drawing network** (Version A) | 4 × (conv 3×3, ReLU, max pool 2×2) with 16, 32, 64, 96 maps, then linear 1536 → 24; 115,576 weights; input 1 × 64 × 64, ink = 1 | 144,000 Quick, Draw! drawings (6,000 per category, recognized by the game), rasterized by the shared rasterizer after the dataset's normalization; 12 passes, batch 128 | 119 s | `drawing.bin`, 0.46 MB float32 | 92.6% on 12,000 held-out drawings |
| **Version B** | the same | the same, each copy shifted ±8 px, turned ±180°, scaled 0.6 to 1.1 at random | 126 s | `drawing_b.bin`, 0.46 MB | 82.6% on the same held-out set (intact); 82.5% upside down |
| **Standard** | MobileNetV3-small (torchvision, ImageNet-pretrained), first convolution folded to one grayscale channel, last layer 1024 → 16; 1,533,968 weights; input 1 × 160 × 160 gray, normalized (g − 0.449)/0.226 | 9,296 Open Images crops (train split of the 10,776 kept: 50 test and 40 validation per category held out; bear 140, clock 231, oven 214, knife 541, the rest 710), grayscale, random crop and flip; 10 passes, batch 64 | 90 s | `photo_standard.bin`, 3.06 MB float16 | 87.4% on 800 clean held-out crops |
| **Trained on noise A** | the same | the same images, each with salt-and-pepper noise at a share drawn per image from 0 to 0.35 | 112 s | `photo_noise.bin`, 3.06 MB | 78.3% clean |
| **Trained on blurred and sharp** | the same | the same images, each sharp or Gaussian-blurred (σ 1 to 4 px) at random, half and half | 114 s | `photo_blur.bin`, 3.06 MB | 86.0% clean |

**Agreement with Python** (`drawingNet.test.ts`, `photoNet.test.ts`): on 50 fixed inputs per model the top label matches every time, probabilities within 1e-4 (drawing) and 0.01 (photo), the penultimate layer within 1e-2. **Speed**: one drawing inference 21 ms in Chromium (42 ms at a 4× throttle); one photo inference 55 ms in the worker (Node 53 ms); headless Chromium 111 ms.

**Why a runtime of our own, not ONNX Runtime Web.** Three reasons, in order: the layer strip and the tolerance plots need every intermediate map, which a library returns only by naming each as an output; the photo networks are MobileNetV3-small, whose few kinds of layer (1 × 1 and depthwise convolutions, hardswish, squeeze-and-excitation, a residual add) fit in 300 lines; and ORT's WebAssembly runtime is 14 MB, more than every model and image in the lab together. The cost was a morning of loop tuning: channels-last layout, four outputs at a time in the 1 × 1 path, tap-major depthwise weights.

---

## 3. Every stimulus set, as it shipped

**The sixteen categories** (Geirhos's), with their names in the two datasets: airplane (Open Images *Fixed-wing aircraft*; Quick, Draw! *airplane*), bear, bicycle, bird, boat (*Boat*; *sailboat*), bottle (*Bottle*; *wine bottle*), car, cat, chair, clock, dog, elephant, keyboard (*Computer keyboard*; *keyboard*), knife, oven, truck. **The eight extra drawing categories** for Part 2: mushroom, ice cream, coffee cup, bucket, umbrella, snowman, floor lamp, wine glass (all as proposed; none swapped).

**Photographs** (`public/m08/photos/`, 192 files, 2.7 MB, grayscale 160 × 160 PNG so the browser's pixels are Python's): 12 per category from the networks' held-out test set. The pipeline kept a box only if the image's own metadata gave CC BY 2.0 (every candidate did; CC0 was also allowed), no box and no verified image-level label on the image was a person, face or body part (17 label names; 76,040 images dropped for it), the box was not a group, a depiction or inside another object, and its shorter side was at least a quarter of the image and 120 px. Each crop is the box padded 8% to a square. `manifest.json` carries each photograph's author, title, page, licence and its full Open Images label list (124 distinct labels over the 192); `notice.test.ts` scans them. Training crops (10,776) stay on the Mac.

**Scanned objects** (`public/m08/scanned/`, 880 files, 2.9 MB): eight shoes (`shoe00` to `shoe07`: ASICS GEL-1140V white/black/silver and white/royal/silver, GEL-Challenger 9, GEL-Resolution 5, Hyper-Rocketgirl SP 5; Reebok REALFLEX SELECT, SMOOTHFLEX CUSHRUN 2.0, TURBO RC) and eight other things (`other08` to `other15`: an Android figure, a brown hat, a gaming mouse, a stacking ring, a red ceramic planter, a Schleich Hereford bull, a white cereal bowl, a JanSport backpack), rendered with Three.js in headless Chromium through Playwright (`render_gso.mjs`): fixed camera, hemisphere plus two directional lights fixed in the world, the object turned on a turntable, neutral gray 0x808080, bounding sphere scaled to one size, 224 × 224 then grayscale 160 × 160. **55 views per object**: headings 0° to 345° every 15° at eye level (`h000`…`h345`), pitches 15° to 345° every 15° at heading 0 (`p015`…`p345`), and the wobble frames ±5° and ±10° around 0° and 75° (`w350`, `w355`, `w005`, `w010`, `w065`, `w070`, `w080`, `w085`). The 3D models never ship.

**The view design.** Learned views `h000` and `h075`, each shown as five frames. Test views, four per condition (`VIEWS_PER_CONDITION`; three is also matched, at 18 trials per set): **between** 15°, 30°, 45°, 60°; **beyond** 345°, 330°, 90°, 105°; **at right angles** tipped 15°, 30°, −15°, −30°. Distances from the nearest learned view are {15, 15, 30, 30} in every condition (`views.test.ts`). A set's 24 trials: the target at each of its 12 test views, and 12 other objects (drawn from the set's seven or eight others) at the same views; the two sets' 48 trials are mixed in one seeded order (`bothSetTrials`).

**Drawings** (`public/m08/drawings/`): `display.json`, 72 drawings (3 per category) from the test split, chosen so that the network names the intact drawing and both erasers reach 35%, 50% and 65% to within 1% (14 drawings excluded for a wrong intact label, 12 because an eraser fell short, 2 for having no joint), each with its joints precomputed; `moved.json`, the ten moved-part pairs with the stroke group, the placement (the part's box put just above or below the rest's box, centered, a 4-unit gap) and what moved. Credited by Quick, Draw! key in the NOTICE. **The deletion levels**: the student's test at 50%; the larger test at 35%, 50% and 65%. **The erasers**: joints are corners (a turn over 60° within a 12-unit window), stroke ends within 10 units of another stroke, and crossings; gaps grow by bisection until the asked share of total stroke length is gone; pieces under 2 units are dropped.

**Noise**: A is salt and pepper (each pixel replaced by 0 or 1 with probability p); B is uniform (U(−w, w) added, clipped). Strengths adapt per student from A 0.20 and B 0.35, where the larger test was scored. The browser generator is pinned to the Python one's statistics (`noise.test.ts`). The mask is the image's own 16 × 16 (photographs) or 8 × 8 (drawings) patches scrambled, from the seed.

---

## 4. Every number a student will read off the screen

### Part 1 (Version A, 200 held-out drawings, `measure_drawing.py`)

Match between the original's and the changed drawing's activity, per layer (input, pooled 1, pooled 2, pooled 3, pooled 4), and percent named:

| Change | input | pooled 1 | pooled 2 | pooled 3 | pooled 4 | named |
|---|---|---|---|---|---|---|
| none | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 94.5% |
| shift 2 px | 0.44 | 0.62 | 0.77 | 0.81 | 0.84 | 93% |
| shift 4 px | 0.27 | 0.44 | 0.50 | 0.65 | 0.70 | 90% |
| shift 6 px | 0.21 | 0.38 | 0.35 | 0.44 | 0.58 | 87% |
| shift 8 px | 0.17 | 0.34 | 0.30 | 0.25 | 0.55 | 84% |
| turn 45° | 0.07 | 0.25 | 0.21 | 0.11 | 0.11 | 23% |
| turn 90° | 0.03 | 0.21 | 0.17 | 0.08 | 0.08 | 19% |
| turn 180° | 0.14 | 0.32 | 0.31 | 0.24 | 0.23 | 39% |

Centering off: shrunk to 40% in a corner 13%; shrunk to 40% centered 31%; at 70% 86%; the raw unaligned strokes as drawn 77%. **Version B** (200 drawings): intact 88.5%; upside down 82.5%; mirrored 86.5%; squashed flat 45%; squeezed thin 53%; 40% in a corner 6%. Version A on the same: 94.5%, 39%, 93.5%, 68%, 55%, 13%. Version B's shift matches at pooled 4: 0.91, 0.81, 0.71, 0.65 for 2 to 8 px.

### Part 2 (`measure_erasers.py`, `moved_parts.py`)

| Ink removed | Mid-line | At the joints | Gap |
|---|---|---|---|
| 35% | 83.5% | 81.0% | +2.5 |
| 50% | 55.0% | 58.5% | −3.5 |
| 65% | 29.5% | 36.5% | −7.0 |

Over 200 held-out drawings per eraser that the network names intact. **The moved-part set** (the part placed just on the other side of the rest, so the moved version's longer side is 0.98 to 1.54 times the original's and the dataset's scaling leaves its size about the same): the label changed on **4 of 10** (d04 coffee cup → bucket 0.61; d17 coffee cup → snowman 1.00; d43 ice cream → chair 1.00; d15 umbrella → floor lamp 0.91) and stayed on 6 (d08 coffee cup 0.99; **d18 and d25 mushroom, 0.98 and 1.00, with the cap under the stem**; d13 snowman 0.57; d46 floor lamp 1.00; d63 wine glass 1.00). Last-layer match, moved pair against an ordinary pair of the category: 0.27/0.18, 0.17/0.18, 0.11/0.29, 0.90/0.27, 0.71/0.27, 0.02/0.45, 0.15/0.23, 0.19/0.23, 0.81/0.46, 0.58/0.27. A first version shoved the part 200 units away, which halved the moved version after scaling and changed the label on 8 of 10; that was a size change on top of the move, and Jon caught it on 2026-10-12.

### Part 3 (`readout.probe.ts`, 8 targets × 5 seeds, η 0.05; the probe trains one readout per set as the scene does)

Steps to 95% on the 80 training images: shoes 20 to 230 (median 80); other things 10 to 70 (median 40). d′ by hand on the 24 trials (median; range), from four trials of each kind so the values are 0, ±0.48, ±0.67, ±1.15, ±1.35, ±1.82 or ±2.30:

| Set | between | beyond | at right angles |
|---|---|---|---|
| one shoe among shoes | 0.48 (0.00 to 2.30) | 1.15 (0.00 to 2.30) | 0.00 (−0.48 to 2.30) |
| one shoe among other things | 2.30 (0.48 to 2.30) | 2.30 (0.48 to 2.30) | 0.67 (−0.67 to 2.30) |

Per target shoe among shoes, median over seeds (between/beyond/right angles): shoe00 0.00/1.15/0.00; shoe01 0.48/0.48/0.00; shoe02 0.48/1.82/0.00; shoe03 0.48/0.48/0.00; shoe04 1.15/1.15/0.48; shoe05 1.82/1.82/0.67; shoe06 0.48/1.15/1.15; shoe07 1.82/1.15/0.00. The penultimate activity over the learned views has mean 0.22 and spread 0.75. The curve for shoe00 after 130 steps: 13.5 at 0°, 6.1 at 75°, negative at most other headings, above zero near 120° to 135°.

### Part 4 (`measure_photo.py`, 800 held-out photographs per condition)

| | clean | noise A 0.05 | 0.1 | 0.2 | 0.35 | 0.5 | noise B 0.1 | 0.2 | 0.35 | 0.5 | 0.7 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Standard | 87.4% | 55.1 | 39.4 | **15.6** | 6.4 | 7.4 | 69.6 | 49.4 | **23.7** | 11.5 | 7.6 |
| Trained on noise A | 78.0% | 76.6 | 73.8 | **68.4** | 58.4 | 39.9 | 77.6 | 73.5 | **69.3** | 62.9 | 47.2 |
| Trained on blurred and sharp | 86.3% | 58.4 | 44.1 | **14.4** | 7.9 | 6.5 | 73.0 | 57.1 | **27.6** | 17.2 | 10.4 |

Bold: the loaded strengths. Chance 6.25%. **Three other kinds of change** (`measure_other_noise.py`, not shipped as a condition): Gaussian σ 0.35: 8.5 / 61.4 / 12.1; low-frequency blotches 0.35: 26.4 / 17.2 / 32.0; contrast reduced 90%: 68.5 / 10.5 / 66.9 (Standard / noise-trained / blur-trained).

### The Closer (800 held-out drawings, black strokes 4 px wide on white at 160 × 160)

Standard 25.1%; Trained on noise A 30.1%; Trained on blurred and sharp 27.1%; the drawing network 91.9%; chance 6.25%.

### Glimpse durations

Headless Chromium, 36 trials: mean 233 ms. The three panels print *Glimpses shown: n, mean, from, to* for Jon's screen.

---

## 5. Timing, in wall-clock minutes

A walk by the build session with no writing, in the in-app browser: Part 1 about 10; Part 2 about 12 (3 for the twelve, 3 for the erasers on a drawing, 4 for the moved part, 2 for the built set); Part 3 about 12 per set (half a minute of study, 3 for the test, 3 for the readout and the curve, the rest reading); Part 4 about 8 (5 for the thirty-six); the Closer about 3. **About 45 minutes of scene time with one Part 3 set**, 57 with both, against the 70-minute target; the writing the handout adds carries the rest. Nobody has yet timed a student.

---

## 6. Where the build departed from the spec, or its targets turned out wrong

1. **The runtime is the lab's own TypeScript, not ONNX Runtime Web** (§3.5 named ORT as the default and let the build choose). Reasons in §2. The spec's agreement and speed tests pass against it.
2. **The photo networks run at 160 × 160, not 224**, so that one inference fits the 300 ms budget in plain JavaScript; the shipped photographs and renders are 160 × 160. The Standard network's 87.4% clears the 85% target at that size.
3. **The larger tests are scored at build time** (cut-order item 4, taken deliberately) and printed from `measurements.json` with a line saying so; the student's own trials are scored live.
4. **The tolerance plots are shown only with centering off.** With it on, a shift or a turn would be undone before the network saw it and the plot would show tolerance from the preprocessing; a line on the stage says so. (Walk-through 9.1.)
5. **The readout reads the 1,024-unit penultimate layer** (the classifier's hidden layer after its hardswish), not the 576 pooled convolutional features; η loads at 0.05, starting weights ±0.05, a wide ±6 range.
6. **d′ uses Lab 7's existing repair** (half a response short of the end), not the add-0.5 one, because Lab 7's By hand box already had it; the scene prints the line when it applied.
7. **Every mode is decided** (Jon, 2026-10-12): Parts 2 and 3 free, Part 4 glimpse, pinned by test; **Part 4's strengths adapt by staircase** instead of being set by Jon; the developer control is retired. A timer stands guard behind the animation-frame schedule so a stalled tab still gets its mask.
8. **Noise B does not break the noise-trained network** (target: at most 20%; measured 69%). Kept as uniform noise, the spec's starting pair, and raised in the walk-through with the measurements of three other kinds of change; Jon decides.
9. **No eraser gap for the network** (a finding, not a target), and **the moved-part pairs keep the network's label on 6 of 10**, both mushrooms among them: the reading's finding that networks confuse a moved version with the original, reproduced. Both reported as findings.
10. **The blur-trained network beats Standard on drawings by 2 points**, within error; the noise-trained network is highest at 30%.
11. **The readout's between is not better than beyond**; at right angles is worst in both sets, and the other-things set is flat and high.
12. **Version B shipped** (cut-order item 1 not taken), as did the full curve (item 2), the built moved-part set (item 3), and eight channels per block (item 5 as specified).
13. **Shift tolerance rises from the input to pooled 4 for every shift, but not monotonically layer by layer** in the means (pooled 2 dips below pooled 1 at 6 and 8 px).

---

## 7. What the handout should not say

Not *salt-and-pepper* or *uniform* on screen: *noise A* and *noise B* (the handout may name them in a footnote). Not *loss*, not *epoch*. Not *ONNX*, *TensorFlow* or *WebAssembly*. Not that a network *sees*, *knows*, *notices*, *recognizes* or *decides*. Not *invariant*: the networks have *tolerance*, and *invariance* is the problem. Not the reading's numbers (80% against 46%, about 10%) as ours. Not that noise B breaks the noise-trained network: it does not. Not that the drawing network fails on nonrecoverable drawings more than recoverable ones: it does not. Not that a moved part always changes the network's label: on 6 of 10 built pairs it does not, and both mushrooms stay mushrooms. Not a cortical area, and not the ventral stream: §8.3.4 belongs to the handout's own prose, not to the scene.
