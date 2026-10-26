# `src/sim/memory/` — Lab 10, What Happened Last Night

Headless, plain TypeScript, every draw from one seeded stream (`../random.ts`). The scene is `src/scenes/m10_memory/`.

- `parts.ts` — the parts and the units of work, shared by everything below.
- `progress/` — saved progress on the student's own device: the one storage key, the fallback to memory, the unit rules and reserve materials, the part locks, Export and Load.
- `words/` — Part 1's lists (unrelated and of associates), the presenter's design, the matcher and the scorer, the recognition test; Part 2's word sets and the clustering score.
- `room/` — Part 3's items by type, the two arrangements, the checklist, the camera path.
- `logs/` — Part 4: the clearings, the logs, the refill rule, a night, nursing, the night features, the map question, the tallies.
- `foragers/` — Part 5: the programmed foragers, the tendency unit (`tendency.ts`, which stores no occasion by test), the fast store with Lab 7's separation stage, and the slow learner.
- `references.ts` — every reference panel's data, one entry per published result; an unfilled entry shows *Reference pending*.
