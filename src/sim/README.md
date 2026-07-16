# sim/

Stack-independent simulation + neural logic (plain TS), driven from scenes
via r3f `useFrame`. The evolving-creature engine lives here:

- `creature/` — body plans + sensor→actuator wiring, parameterized by stage
- `neural/` — neurons, circuits, learning rules
- `world/` — environment, stimuli, hard-coded NPCs

Kept out of components so it is unit-testable without a browser.
