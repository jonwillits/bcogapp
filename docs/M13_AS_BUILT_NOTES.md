# Module 13 as built — Sounds, Words, and Predictions (`m13-language`)

**Started 2026-11-15 by the build session, from the code as it stands at the two stops of spec §13: the stimulus review sheet (Stop 1) and the measurements (Stop 2), before any screen is drawn.** Nothing is merged or pushed; the work is on branch `m13-language`. This file grows into the record the handout gets written from. The spec is `course_creation/labs/13_language/m13_language_SCENE_SPEC.md`; the stimulus sheet beside it is `LAB_13_STIMULI.md`; the walk-through, once the first draft runs, will be `LAB_13_WALKTHROUGH.md`.

**Every number here was measured, not predicted** (spec: numbers in the spec are expectations). The probes that produced them: `src/sim/language/sounds/classifier.probe.ts` (Part 1), `src/sim/language/stream/learners/learners.probe.ts` (Part 2), `src/sim/language/words/words.probe.ts` (Part 3), `src/sim/language/predictors/runtime/agreement.probe.ts` with `training/m13/train_predictors.py` (Part 4), and `training/m13/make_stream.py` (the boundary probe). Their printed output is kept under `~/Documents/Projects/bcogapp_data/m13/out/probe_*.txt`.

## 2. Every material, as it shipped (so far)

See `LAB_13_STIMULI.md` §1 to §10 for every sound, the continuum's parameters, the stream's settings and the probe's numbers, the 24 words and 24 objects, the real-speech sample, and the corpus's vocabulary and settings; and `public/m13/audio/NOTICE` for every license. The foils of Part 2's tests, built by the paper's rules (p. 613) with the two it names: nonwords *papipu, paputa, patapi, patipi, pabapu, pabipu* (no pair of which ever occurs in any stream); part-words *pidata, bitaba* (the paper's), *bupadu, tutipa* (a word's first two syllables plus the first syllable of a following word), *bibupu, datubi* (a word's last two syllables plus the last syllable of a preceding word).

## 3. The models, as they shipped (so far)

- **Part 1's classifier** (`sounds/classifier.ts`): 400 inputs (40 bands × 10 frames of 10 ms, from 20 ms before the burst, bands pooled from the wide-band spectrogram up to 5 kHz, scaled from 60 dB below the patch's peak to the peak), 12 sigmoid hidden units (width 0.25), 3 sigmoid outputs; Lab 7's rule, Φ at the outputs the Teacher setting, Φ at the hidden units passed back; rate 0.02, 12 passes, weights from ±0.05, chosen once before any measurement; 377 ms per training in Node.
- **Part 2's learners**: cut at the dips (`stream/learners/dips.ts`), with its score the mean transitional probability inside a string; the simple recurrent network (`stream/learners/srn.ts`), 12 inputs plus 12 context units, 12 hidden tanh-free sigmoid units of width 0.25, 12 outputs, rate 0.1, one online pass, context starting at 0.5 (Elman, 1990, p. 182), its score minus the mean squared prediction error on a string's second and third syllables with the context reset; **PARSER waits on Perruchet and Vinter (1998)**, which is not in the library.
- **Part 3's models** (`words/models/`): guess and check with one stored object per word and α; tallying with β; each fitted by a grid search (41 values; 50 runs per value) to the student's accuracy over occurrences 2 to 5; 200 runs at the fitted value.
- **Part 4's predictors**: the count model (`predictors/counts.ts`, window 1 to 8, weight window − distance + 1, before and after separate or summed, the corpus as one stream with end marks); prediction from counts (`predictors/ngram.ts`); a transformer of 2 layers, 2 heads, width 32, positions 32, feed-forward 128, 29,941 parameters; Elman's simple recurrent network with 64 tanh hidden units, 10,997 parameters; both trained with AdamW at 0.001, batch 32, 20,000 updates on the corpus's first 9,000 sentences, the last 1,000 held out (63.5% of the held-out sentences also occur among the training sentences, since the grammar is small); 8 snapshots at 0, 50, 200, 500, 1,000, 3,000, 10,000, and 20,000 updates; the runtime (`predictors/runtime/seqNet.ts`) matches PyTorch within 1e-4 on 34 prompts' probabilities and attention weights.

## 4. Every number a student will read off the screen (Stop 2, measured before any screen)

### 4.1 Part 1, the classifier (10 seeds, 1000 to 1009)

| Run | Measured | The spec's expectation |
|---|---|---|
| Run 1, trained on 10 voices (450 tokens), tested on voices 11 and 12 (90 tokens) | **77.3%** correct, sd 5.9 (66.7 to 84.4); the curve by pass 42, 53, 68, 66, 75, 75, 68, 71, 72, 79, 79, 77 | a prediction in four bins |
| Run 1, confusion summed over seeds (rows b, d, g right; columns the network's) | b 277/11/12; d 88/200/12; g 47/34/219: *d* is most often mistaken for *b* | — |
| Run 2, one pitch (every voice's own pitch only, 150 tokens; tested on the 390 others) | **73.0%**, sd 3.6 | higher, the same, or lower than run 1 |
| Run 2, one voice (voice 1 at three pitches, 45 tokens; tested on the 495 others) | **54.7%**, sd 7.7 | higher, the same, or lower than run 1 |
| Run 3, the run-1 network on the 14 continuum steps | most likely label by step: **b g b g g g d g b d b b b b**; shares of *b* from 0.63 at step 1 to 0.56 at step 14, *d* never above 0.49 | sharp, gradual, or not in that order |

Run 3 is the case spec §15, question 3 names: a network trained on natural voices labels the synthetic two-formant continuum far from any listener. The curve is kept as a finding for the handout; the walk decides whether more is wanted. One correction was made before the measurement, not after it: the continuum files begin at the release, so 40 ms of silence is put before each file so that the patch starts 20 ms before the burst, as it does for every natural token.

### 4.2 Part 2, the learners (20 streams, seeds 2000 to 2019; percent correct, mean [min–max])

| Learner, test | 30 s | 1 min | 2 min | 4 min | 7 min | 14 min | 21 min |
|---|---|---|---|---|---|---|---|
| dips, nonwords | 100 [100–100] | 100 | 100 | 100 | 100 | 100 | 100 |
| dips, part-words | 86.0 [75–94] | 87.8 [81–94] | 87.2 [83–89] | 86.7 [83–89] | 86.9 [83–89] | 86.9 | 86.9 |
| SRN, nonwords | 89.2 [67–100] | 98.1 [86–100] | 100 [100–100] | 100 | 99.9 [97–100] | 98.2 [92–100] | 96.5 [83–100] |
| SRN, part-words | 70.6 [50–89] | 84.2 [75–92] | 93.5 [86–100] | 95.3 [86–100] | 97.4 [86–100] | 92.1 [83–100] | 88.9 [78–100] |

The adults' means at 21 minutes were 76% against nonwords and 65% against part-words (p. 613). Both learners pass both tests within 30 seconds to 2 minutes of the stream: the case the prompt names (*learners that reach the adults' scores in 30 seconds*). The dips learner's part-word score sits near 87% at every amount, because a part-word's one across-boundary transition has a transitional probability near 0.1 to 0.2 while its within-word transition is as high as a word's, and three of the six words have a within-word transition of 0.25 to 0.5, so some word-against-part-word pairs tie or reverse. The SRN's scores fall a little after 7 minutes. The dips learner on the made-up language over 21 minutes: 96.5% of its cuts fall on word boundaries, and it finds 96.5% of them. All 20 streams' tables are in the probe's output.

### 4.3 Part 2, the real-speech sample

831,345 utterances, 4,332,075 syllable tokens of 5,563 types; transitional probabilities inside words average 0.371 and across word boundaries 0.064, and the two distributions overlap (across boundaries 70% of pairs fall under 0.05; inside words 20% do); the dips learner's cuts fall on true boundaries 97.0% of the time, and it finds 44.9% of true boundaries, against 96.5% and 96.5% on the made-up language.

### 4.4 Part 3, the two models (200 runs per cell; one design, seed 1234; 20 scripted students per row for the second table)

Each model across its parameter: accuracy over occurrences 2 to 5, then the key measure, correct on the next occurrence after a right choice and after a wrong one, with 90% ranges.

| Model, parameter | accuracy | after right | after wrong |
|---|---|---|---|
| guess and check, α 0 | 20% [10–29] | 20% [0–43] | 20% [12–31] |
| α 0.5 | 28% [15–42] | 58% [27–80] | 17% [7–27] |
| α 0.9 | 41% [21–63] | 92% [75–100] | 15% [6–27] |
| α 1 | 44% [25–65] | 100% | 14% [5–27] |
| tallying, β 0 | 19% [10–29] | 18% [0–43] | 20% [10–30] |
| β 1 | 30% [19–42] | 28% [8–50] | 31% [18–44] |
| β 2 | 41% [29–52] | 42% [21–63] | 41% [27–57] |
| β 4 | 59% [48–71] | 61% [45–76] | 57% [42–71] |
| β 8 | 74% [65–83] | 81% [69–90] | 64% [52–78] |

Guess and check, as the spec states it, cannot reach an accuracy above about 44% over occurrences 2 to 5 (at α = 1 a wrong guess is kept whenever its object is on the screen again, and the chance of that is about 4 in 11). A student above that is matched by α = 1 and the panel will say that the model's accuracy falls short of the student's. Its after-wrong share stays at chance (14 to 20%) at every α; tallying's rises with β.

How often 48 pairs tell the two models apart: students simulated by each model at a range of accuracies, each student's after-wrong share tested against both fitted models' 90% ranges.

| Student simulated by | accuracy | inside guess and check's range | inside tallying's range |
|---|---|---|---|
| guess and check, α 0.3 | 26% | 14/20 | 15/20 |
| α 0.6 | 30% | 16/20 | 6/20 |
| α 0.9 | 37% | 16/20 | 0/20 |
| α 1 | 40% | 19/20 | 0/20 |
| tallying, β 0.5 | 25% | 13/20 | 20/20 |
| β 1 | 33% | 2/20 | 20/20 |
| β 2 | 44% | 0/20 | 19/20 |
| β 4 | 59% | 0/20 | 20/20 |

Near chance (accuracy about 25%) the two accounts cannot be told apart from 48 pairs; from about 33% accuracy upward they can, nearly always. The panel's sentence (spec §10, line 15) will be written from this table.

### 4.5 Part 4, the predictors (one training run, seed 1)

| Updates | Transformer: held-out accuracy | agreement, depth 0 / 1 / 2 / 3 | SRN: held-out accuracy | agreement, depth 0 / 1 / 2 / 3 |
|---|---|---|---|---|
| 0 | 2.1% | 42 / 46 / 48 / 36% | 1.6% | 58 / 48 / 58 / 40% |
| 50 | 35.4% | 54 / 38 / 40 / 44 | 34.8% | 58 / 44 / 52 / 44 |
| 200 | 39.3% | 100 / 90 / 56 / 42 | 36.6% | 60 / 44 / 52 / 44 |
| 500 | 39.9% | 100 / 100 / 100 / 76 | 38.9% | 100 / 90 / 30 / **0** |
| 1,000 | 40.3% | 100 / 100 / 100 / 98 | 40.0% | 100 / 100 / 74 / 44 |
| 3,000 | 41.0% | 100 / 100 / 98 / 100 | 40.1% | 100 / 100 / 100 / 96 |
| 10,000 | 40.3% | 100 / 100 / 98 / 94 | 40.4% | 100 / 100 / 100 / 96 |
| 20,000 | 40.5% | 100 / 100 / 96 / 90 | 40.1% | 100 / 100 / 100 / 90 |

Held-out next-token accuracy levels off near 40% for both, which is about the ceiling the grammar's random choices allow. The spec's expectation that the transformer holds agreement across more nesting than the recurrent network holds in *how soon*, not in the end: at 500 updates the transformer agrees on 76% of depth-3 probes and the SRN on 0% (it then goes by the nearest noun, which every probe sets to the wrong number); by 3,000 updates both are at 96 to 100% at every depth. The 50 probes per depth and their construction are in `predictors/probes.ts`.

## 7. Timing

Not yet measured: no screen exists.

## 8. Where the build departed from the spec, or where its expectations turned out wrong

1. The within-word transitional probabilities of the stream, counted as the count of a pair over the count of its first syllable, run from about 0.25 to 1.0, and across boundaries from about 0.05 to 0.2; the paper states 0.31 to 1.0 and 0.1 to 0.2 (p. 612). The screens state the computed table from the student's own stream.
2. The six words use eleven of the twelve syllables; *di* occurs only in test foils. The palette shows twelve, as the spec says, and the as-built notes record it.
3. The paper's own part-words show that the added syllable need not form a sequence the stream contains; the four part-words built here do.
4. The predicted-discrimination formula prints with .5 where the derivation gives 2 (`LAB_13_STIMULI.md` §11).
5. The classifier's continuum curve, the learners' speed, guess and check's ceiling, and the networks' agreement are findings, recorded above, not tuned.
6. Spec §10, line 7; the notice on Part 3, Step 3; Step 4's run-3 prediction wording: `LAB_13_STIMULI.md` §12.
