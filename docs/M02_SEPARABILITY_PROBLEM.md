# §6's separability requirement, and why it was retired

**Status: resolved, 2026-09-01.** Not by satisfying §6 — it cannot be satisfied in this engine — but by establishing that, retiring the claim, and replacing it with four criteria the scene does meet. The suite is green and Module 2 is unblocked.

Kept because the argument is worth not re-deriving, and because two of the three failures recorded here were a measure that could not detect the thing it was standing in for. That pattern is the useful part.

---

## What the problem was

§6 called it "the one hard build requirement": in the default world, populations **W, X and Y must not be tellable apart by watching**. Part 3 rested on a student being unable to sort them, committing to a guess, and only then designing a perturbation that separates them.

The acceptance test said they matched. **Jon watched the scene and sorted them instantly.** Population Y drives backwards — 81% of the time — where W and X drive forwards, and `ObservationResult.meanSpeed` took an **absolute value**, so Y reversing at 1.05 and W cruising forward at 1.05 recorded as the same number.

That was the second instance of one failure mode, not the first. §10's divergence test had already been restated because it was defined on *mean distance*, a statistic structurally blind to mechanism. The same error was then committed in the neighbouring metric.

## Why it cannot be fixed

Two lines of algebra, and 108 measured configurations agreeing with them.

An inhibitory approacher reverses whenever sensed intensity exceeds `bias / |w|`. It **steers** by `|w| ×` the intensity *difference* — the same intensity scale. So any light bright enough to steer by is bright enough to reverse in. There is no window.

Raising the bias to open one makes it worse. Bias cancels out of `a_R − a_L`, so it adds nothing to steering, but it does not cancel out of `a_R + a_L`, so it adds to forward speed. Turning radius is `v/ω`, so **raising bias inflates the turning radius** and the creature stops being able to curve into the light at all.

**Reversal is not a side effect of how a 3a approaches. It is how a 3a approaches.**

And the mechanism space is closed. Of the six varieties only **2b and 3a** turn toward a source and stay — 2a flees, 3b lingers and wanders off, and the two fully-connected patterns drive both actuators identically and cannot steer at all. W and X must share wiring, because that is the homology; Y must differ, because that is the analogy. So it is always two-against-one on wiring, and reversal tracks wiring.

§6 asked for two mechanisms to look alike. The physics forbids it.

## Everything tried, with the data

**1. Re-run the fixture search with direction of travel as a constraint.** Zero triples pass, from 68 clean 2b branches and 10 clean 3a Q runs.

**2. Find a 3a that does not reverse.** Every pool-Q run reaching a clean 3a, now scored on whether it *approaches* as well as on how it moves:

| run | bias | \|w\| | % reverse | arrived | mean dist |
|---|---|---|---|---|---|
| Q7 @2400 | 0.06 | 1.76 | 89.5 | 0.94 | 1.26 |
| Q17 @4800 | 0.05 | 2.29 | 81.4 | 0.81 | 1.34 |
| **Q2 @4800** (shipped as Y) | 0.06 | 1.76 | 81.4 | 0.81 | 1.37 |
| Q17 @2400 | 0.12 | 1.86 | 81.3 | 0.81 | 1.54 |
| Q2 @2400 | 0.26 | 1.61 | 61.8 | 0.56 | 2.75 |
| Q7 @4800 | 0.18 | 2.18 | 58.1 | 0.63 | 2.25 |
| Q9 @2400 | 0.13 | 1.61 | 56.9 | 0.56 | 2.08 |
| Q9 @4800 | 0.26 | 2.10 | 54.8 | 0.56 | 2.88 |
| Q16 @4800 | 0.19 | 2.16 | 52.8 | 0.56 | 2.74 |
| Q16 @2400 | 0.37 | 0.64 | 15.6 | **0.08** | **4.54** |

W and X reach 0.81 arrived at 1.40–1.61. **Four rows meet that, and all four reverse at least 81%.** Monotonic, no exceptions.

**Q16@2400 was the last live candidate and it was an artifact.** The earlier version of this scan reported bias, |w|, signed speed and % reverse — none of which can say whether a population *goes anywhere*. Q16 scored +0.15 speed and 16% reverse, which reads as "travels forwards", and it earns those numbers by being too weakly wired to move much in any direction. Measured on approach it reaches the light 8% of the time and sits at Z's distance of 4.41. It is behaviourally the *fleeing* population. **That was the third instance of the same failure mode, this time in the search that generates candidates rather than the test that accepts them.**

**3. Forbid reversing** (`clampReverse` on `VehicleConfig`). Y's closest approach stays at **2.70** — its starting distance. It never moves toward the light at all, because its reversal radius is 10.8 against an arena half-width of 9, so it begins *inside* its own reversal zone and there is no forward phase to arrive during. The prediction that arrival would survive and only station-keeping would change was wrong.

**4. Put a floor under the bias gene.** A floor of 0.15 costs a quarter of Y's arrivals; 0.60 destroys approach entirely at every light strength. Swept 7 floors × 6 strengths, with and without clamping.

**5. Weaken the observation light**, and **6. raise it**, since height enters the reversal radius as `√(S|w|/bias − 1 − h²)` — subtracted, where strength divides, so it is a genuinely different lever. Swept 6 heights × 4 strengths. The cells that score best are cells where *W and X have stopped approaching too* (arrived 0.13–0.25 against 0.81); the count falls because the scene stops working.

**Across all 108 configurations, reverse fraction was never within 6.9× of the threshold of invisibility.**

**7. Find a world where W and X come apart**, so that indistinguishability could be taught as a property of the world rather than of the populations. Sixty student-reachable worlds. Nothing survives: the best candidate separates them at four of eight light angles, runs the **other way** at 225°, and closes entirely at ninety seconds — W is *slower*, not worse. Its own nudge test called it ROBUST 9/9, because jiggling a light by 0.6 units measures local stability and calls it robustness. `sisters.probe.ts` now rotates the world instead.

## What replaced it

Part 3 no longer claims the three match. It asks which populations do the same **job**, and Y approaching backwards is still Y approaching — same function, different machinery, which is exactly the analogy Q12 is about. Y and Z remain cousins from pool Q that behave oppositely.

Four criteria, in `separability.ts` so both engines assert one definition:

1. **Same job** — W, X and Y all reach the light and stay; Z does not.
2. **The sisters are indistinguishable** — zero battery tells between W and X. This is both the battery's calibration point and a real requirement: if a regenerated pair became tellable apart, a student would split the homology by watching and nothing would fail.
3. **Y differs by driving backwards and by nothing a student is not told about** — the battery inverted from a constraint into a specification. A Y that also parked, span, hugged the rim or arrived visibly later would make the handout wrong in a new way.
4. **Divergence, on station-keeping alone** — three of five perturbations separate Y by ≥2×.

**These were retired, not relaxed, and the difference is the whole point.** Relaxing keeps the claim and widens the bar until it passes, which is the failure this area has twice produced. Retiring means the claim is no longer made — legitimate only because the replacement is written down and checked.

## The battery, and where its thresholds come from

Twelve measures, each a *kind* of behaviour a viewer could describe in words rather than a magnitude: reverses, parks, spins, which way it swings relative to the light, where it ends up facing, hugs the rim, what it does in the opening five seconds, whether the population moves as a body. Both prior failures were a quantitative statistic policing a categorical difference; a student in the Lineages tab views one population at a time and compares from memory, and memory keeps kinds.

**Thresholds are derived, not chosen.** Jon cannot sort W from X by eye, so whatever that pair differs by is by observation invisible, and every just-noticeable difference is set at or above the measured W↔X gap. Gaps are absolute on each measure's own scale — ratios explode near zero and are meaningless across a sign flip, where +0.7 and −0.7 are as far apart as behaviour gets and the ratio is 1.

Two controls, both in `separability.probe.ts`: **silent** on the sisters, **firing on five measures** for the Y Jon sorted instantly. One of those five, `meanTurnTowardsRate`, is a cue nothing in the old suite could see — the previous turn metric took an absolute value, so it could not tell hunting the light from fleeing it. W +0.64, X +0.83, **Y −1.65**.

The tests are verified to go red by three mutations: restoring the absolute value, clamping reverse, and nudging X's wiring.

## Two bugs found on the way, both of the same family

**A perturbation nobody could build.** `a light up on the rim` was `[0, 1.7, 7.5]` — height 1.7 at z = 7.5, which is *inside* the arena where the floor is flat at 0. The arena floor sits at ground height 0 and the plateau outside at `RIM_HEIGHT` = 2, with the cliff walls deliberately not pointer targets, so the only heights obtainable are **0.7 inside the bounds and 2.7 outside them**. It was the strongest of the four divergence perturbations and described a world no student could make.

**A light under a creature could not be removed.** `VehicleMesh` swallowed pointer-down for every button; `Terrain` records the button on pointer-down and acts on pointer-up, so a swallowed press left nothing recorded and the release did nothing, silently. Once a population swarms the light it is approaching, thirteen of sixteen creatures cover it — so the light a student most wants to remove was the one they could not. Q14 rests on removing lights.

## Verified by eye

The tests are headless because the Browser pane throttles `requestAnimationFrame` and freezes r3f's `useFrame`, so motion can only be checked by a person. Jon confirmed at `localhost:5173` on 2026-09-01: W and X not discriminable; all three approachers reaching and swarming the light and Z not; Y differing by driving backwards and by none of the seven things the specification says it must not; the three separating perturbations and the two that do not; and Module 1's 3c still reversing. `viewing.crib.probe.ts` prints the predictions as counts out of sixteen.

## What is still owed

- **The spec.** §6 is unsatisfiable and the Box copy needs to say so.
- **The handout.** Part 3's Q9/Q10 shift from sorting to "which of these do the same job"; the rest is listed in `M02_SPEC_DEVIATIONS.md`.
