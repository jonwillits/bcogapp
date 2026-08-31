# Open problem: population Y is visibly distinct, and the acceptance test could not see it

**Status: unresolved. Four tests are failing on purpose.** This is the one thing standing between Module 2 and being finished. Everything else in the scene works.

---

## The problem in one paragraph

§6 of the scene spec calls it "the one hard build requirement": in the default world, populations **W, X and Y must not be tellable apart by watching**. The whole of Part 3 rests on a student being unable to sort them by eye, having to commit to a guess, and only then designing a perturbation that separates them. The acceptance test said they matched. **Jon watched the scene and sorted them instantly.** He was right and the test was wrong.

## What Y actually does

Y drives **backwards**, almost all the time. Measured over a 30-second run at a single centre light:

| | signed speed | % of time in reverse |
|---|---|---|
| W | +0.67 | 0.7% |
| X | +0.91 | 1.0% |
| **Y** | **−1.05** | **81%** |
| Z | +0.29 | 0% |

W and X cruise forwards; Y spends four fifths of its life reversing. That is the first thing anyone notices, and no amount of statistical matching on the other measures hides it.

## Why the test missed it

`ObservationResult.meanSpeed` took the **absolute value** of the actuator average. Y reversing at 1.05 and W cruising forward at 1.05 were recorded as the same number. The separability test then compared those numbers, found them within tolerance, and passed.

This is the same class of error as the one already documented in `M02_SPEC_DEVIATIONS.md` §4 — where §10's divergence test is defined on *mean distance*, a statistic structurally blind to mechanism. I identified that failure mode, wrote it up, and then committed it again in the neighbouring metric.

**Fixed.** `meanSpeed` is now signed and `reverseFraction` has been added. With the corrected metric, four tests fail:

- `continuousLineages.test.ts` — separability, and "the default world still does not [separate them]"
- `lineages.test.ts` — the same two, for the **discrete** engine

That second pair matters: **this was never a continuous-engine problem.** The generational fixtures had a reversing Y too. The bug hid it in both, and it has been there since the original fixture search.

## Root cause

An inhibitory approacher reverses whenever `bias + w × intensity` goes negative — that is, whenever it is closer to the light than

    d = √( lightStrength × |w| / bias − 1 )

Y has bias **0.06** and mean |w| **1.76**, so at the observation light's strength of 4 that radius is **10.8 units** — larger than the whole arena, whose half-width is 9. Y is inside its own reversal zone everywhere, so it reverses everywhere.

And the low bias is not bad luck: **selection produces it.** Movement costs energy, so the efficient forager evolves a near-zero resting drive and moves only when light drives it. Every clean 3a population the search produced has this property.

## What has been tried, and the data

**1. Re-run the fixture search with direction of travel as a constraint.** Requires all three populations to travel the same way. **Result: zero triples pass**, from 68 clean 2b branches and 10 clean 3a Q runs. The one triple that previously passed was eliminated by the reverse-fraction filter.

**2. Look for a 3a population that does not reverse.** Every pool-Q run that reached a clean 3a was scanned:

| run | mean bias | mean \|w\| | signed speed | % reverse |
|---|---|---|---|---|
| Q2 @2400 | 0.26 | 1.61 | −0.49 | 62% |
| Q7 @2400 | 0.06 | 1.76 | −1.02 | 90% |
| Q9 @2400 | 0.13 | 1.61 | −0.62 | 57% |
| **Q16 @2400** | **0.37** | **0.64** | **+0.15** | **16%** |
| Q17 @2400 | 0.12 | 1.86 | −1.00 | 81% |
| Q2 @4800 | 0.06 | 1.76 | −1.05 | 81% |
| Q7 @4800 | 0.18 | 2.18 | −0.70 | 58% |
| Q9 @4800 | 0.26 | 2.10 | −0.69 | 55% |
| Q16 @4800 | 0.19 | 2.16 | −0.62 | 53% |
| Q17 @4800 | 0.05 | 2.29 | −0.97 | 81% |

Exactly one candidate — **Q16 at 2400 s** — mostly travels forwards, and it does so by being **weakly wired** (|w| 0.64 against the others' 1.6–2.3). That is the condition that historically fails the *divergence* test, because a weakly wired population does not express its mechanism under perturbation either. **Untested as a Y candidate; this is the cheapest next thing to try.**

**3. Weaken the observation light.** The Lineages tab's light strength and start distance are build choices, not spec requirements, so a gentler gradient might put the difference below threshold without touching the engine. Swept 4 / 2.5 / 1.5 / 1 at two start distances. **Result: Y still reverses at every setting** — 79%, 68%, 49%, down to 19% at the very weakest — and by the time it is that low, *nothing is happening at all*: arrival times run to 27–30 seconds, meaning the populations barely reach the light. Trading a visible difference for a scene where nothing moves is not a fix.

## The structural bind

- **Strongly wired 3a** → reverses everywhere → visibly distinct → separability fails
- **Weakly wired 3a** → travels forwards → but may not express its mechanism → divergence fails

Y has to be mechanistically different from W and X (that is Q12's whole point) while being behaviourally identical (that is §6's requirement). Different mechanisms produce different behaviour. The spec anticipated the tension and called tuning it "a deliberate step"; what it did not anticipate is that the difference shows up as *direction of travel*, which is the most salient variable on the screen.

## Options, with costs

**A. Try Q16@2400 as Y.** Cheapest. It is the one non-reversing 3a found. Needs checking against separability *and* divergence with a matching W/X pair. May well fail divergence, but it is one search away from being known.

**B. Stop creatures reversing at all** — clamp actuator output at zero, so a wheel cannot be driven backwards. Arguably more faithful: Braitenberg's 3a comes to rest facing the source; reversing is an artifact of allowing negative wheel speeds. **The Lab 1 handout never mentions backing away** (checked — the only match for "reverse" is the section title "Reverse Engineering the Mind"), so nothing student-facing contradicts it; the sole reference is an internal answer-key comment on preset 3c in `vehiclePresets.ts`.
  - *But:* clamping may only swap one giveaway for another. A clamped 3a **parks** at the light while W and X **orbit** it. That is still visibly different, and it is exactly the difference the divergence test relies on. Would need measuring before committing.
  - Can be scoped to Module 2 alone via a `VehicleConfig` flag, leaving Module 1 exactly as students have already seen it.

**C. Put a floor under the bias gene.** Raises resting drive so the reversal radius shrinks. Helps but does not cure: at bias 0.6 with |w| 1.76 the radius is still 3.3 units, and the creatures live at 1.5–2.2. Would also change what evolves throughout.

**D. Accept it and restructure Part 3.** Y is honestly distinguishable, so the handout stops claiming otherwise. Large handout change; loses the commit-then-test arc that is the point of Part 3.

## Repo state

- Branch `m02-evolution`, not merged. `main` auto-deploys, so nothing is student-facing.
- **4 tests failing, deliberately** — they are the corrected separability and default-world checks in both `continuousLineages.test.ts` and `lineages.test.ts`. They are failing because the metric was fixed, not because anything regressed. Leave them failing until this is resolved; a green suite here would mean the blindness is back.
- The evidence probes are committed: `visible.probe.ts` (what a viewer sees vs what the test measures, and the scan of every 3a candidate) and `viewing.probe.ts` (the observation-light sweep). Run with `PROBE=1 npx vitest run --disable-console-intercept -t "<name>"`.
