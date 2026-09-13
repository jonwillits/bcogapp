/**
 * The chemistry: four modulators, stored apart from every weight.
 *
 * A modulator is a **gain applied at simulation time**. It never touches a
 * stored weight, a baseline, a threshold or a routing switch, and nothing on
 * the wiring panel changes when one moves. That is §4.3.5 made operable: the
 * complete wiring diagram does not predict the behaviour, because something
 * that is not a connection is varying.
 *
 * Each is named for what it does. No molecule is named anywhere in the scene;
 * matching a control to its molecule is a handout question.
 */

export type ModulatorId = 'pursuit' | 'satiety' | 'arousal' | 'relief'

export interface ModulatorSpec {
  id: ModulatorId
  label: string
  /** What the control does, in a line. */
  does: string
  min: number
  max: number
  /** The healthy tonic level. */
  healthy: number
}

export const MODULATORS: readonly ModulatorSpec[] = [
  {
    id: 'pursuit',
    label: 'pursuit',
    does: 'How loudly a food cue speaks to the animal: a gain on the food-odor cell’s own output, applied before anything downstream hears it.',
    min: 0,
    max: 2,
    healthy: 1,
  },
  {
    id: 'satiety',
    label: 'satiety and tone',
    does: 'How fed the animal is. A hungry animal’s chemistry turns some sensory cells down, so a cue a fed animal avoids barely registers.',
    min: 0,
    max: 1,
    healthy: 1,
  },
  {
    id: 'arousal',
    label: 'arousal and vigilance',
    does: 'How strongly the animal reacts to anything at all: a gain on the rule that triggers a reversal.',
    min: 0.2,
    max: 8,
    healthy: 1,
  },
  {
    id: 'relief',
    label: 'relief',
    does: 'Satisfaction after a cue is reached: the animal rests, and reverses less on its own.',
    min: 0,
    max: 1,
    healthy: 0,
  },
]

export const MODULATOR_IDS = MODULATORS.map((m) => m.id)

export type Levels = Record<ModulatorId, number>

export function healthyLevels(): Levels {
  const out = {} as Levels
  for (const m of MODULATORS) out[m.id] = m.healthy
  return out
}

/**
 * A modulator's level relaxes toward its tonic set-point over about a minute
 * and a half. Events — reaching a cue, being harmed — kick the level away
 * from the set-point, and the animal's state then outlasts the event by
 * minutes. That is the persistence Part 3 asks about: the state is held by
 * a level decaying over minutes, not by anything the animal wrote down.
 */
export const MODULATOR_DECAY_S = 90

export interface ModulatorState {
  /** The tonic level — what the Chemistry sliders set, and what a fault sets. */
  setPoint: Levels
  /** The current level; equals the set-point except after an event. */
  level: Levels
  /** Sim time of the last event that kicked each level, if any. */
  lastEvent: Record<ModulatorId, number | null>
}

export function makeModulators(setPoint: Partial<Levels> = {}): ModulatorState {
  const base = { ...healthyLevels(), ...setPoint }
  return {
    setPoint: { ...base },
    level: { ...base },
    lastEvent: { pursuit: null, satiety: null, arousal: null, relief: null },
  }
}

export function relaxModulators(m: ModulatorState, dt: number): void {
  const k = dt / MODULATOR_DECAY_S
  for (const id of MODULATOR_IDS) m.level[id] += (m.setPoint[id] - m.level[id]) * k
}

/** Kick a level by `amount`, clamped to the control's range, and remember when. */
export function kickModulator(m: ModulatorState, id: ModulatorId, amount: number, time: number): void {
  const spec = MODULATORS.find((s) => s.id === id)!
  m.level[id] = Math.max(spec.min, Math.min(spec.max, m.level[id] + amount))
  m.lastEvent[id] = time
}

/**
 * Where the animal sits on the chapter's valence–arousal plane, from its
 * chemistry, each modulator pushing in the direction §4.3.6's table gives:
 * pursuit up and right, satiety down and right, arousal straight up, relief
 * right and slightly down. Both coordinates run −1..1. `verdict` is what the
 * running circuit currently says about the animal's situation, −1..1, and
 * nudges valence — things going well or badly right now.
 */
export function valenceArousal(level: Levels, verdict = 0): { valence: number; arousal: number } {
  const p = level.pursuit - 1
  const s = level.satiety - 0.5
  const a = level.arousal - 1
  const r = level.relief
  const valence = clampUnit(0.35 * p + 0.6 * s + 0.7 * r + 0.3 * verdict)
  const arousal = clampUnit(0.35 * p - 0.5 * s + 0.45 * a - 0.4 * r)
  return { valence, arousal }
}

function clampUnit(v: number): number {
  return v < -1 ? -1 : v > 1 ? 1 : v
}

/** The chapter's five named states on that plane (its `f-valence-arousal`). */
export const AFFECT_STATES: { name: string; valence: number; arousal: number }[] = [
  { name: 'panic', valence: -0.7, arousal: 0.75 },
  { name: 'excitement', valence: 0.7, arousal: 0.75 },
  { name: 'gloom', valence: -0.7, arousal: -0.6 },
  { name: 'boredom', valence: -0.15, arousal: -0.6 },
  { name: 'contentment', valence: 0.6, arousal: -0.6 },
]

/** The named state nearest a point. */
export function nearestState(valence: number, arousal: number): string {
  let best = AFFECT_STATES[0]
  let bestD = Infinity
  for (const s of AFFECT_STATES) {
    const d = Math.hypot(s.valence - valence, s.arousal - arousal)
    if (d < bestD) {
      bestD = d
      best = s
    }
  }
  return best.name
}
