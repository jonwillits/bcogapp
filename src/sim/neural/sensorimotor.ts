/**
 * The seed of the evolving-creature nervous system: a minimal sensor→actuator
 * network. For Module 1 (Braitenberg vehicles) this is a 2-input × 2-output
 * linear map — two sensors driving two actuators, plus a base (resting) drive.
 *
 * This is deliberately the simplest possible "neural" layer. Later stages
 * (M4 circuits, M5/M7 learning) extend the neural package with real neurons,
 * multiple layers, and learning rules; the sensor→actuator framing carries over.
 */

export interface SensorInput {
  left: number
  right: number
}

export interface ActuatorOutput {
  left: number
  right: number
}

/**
 * Connection weights from each sensor to each actuator, plus a shared base drive.
 * actuatorX = base + Σ (weight · sensor).
 */
export interface SensorimotorWeights {
  /** sensorLeft → actuatorLeft */
  leftToLeft: number
  /** sensorRight → actuatorLeft */
  rightToLeft: number
  /** sensorLeft → actuatorRight */
  leftToRight: number
  /** sensorRight → actuatorRight */
  rightToRight: number
  /** resting drive applied to both actuators */
  base: number
}

export function computeActuators(
  w: SensorimotorWeights,
  s: SensorInput,
): ActuatorOutput {
  return {
    left: w.base + w.leftToLeft * s.left + w.rightToLeft * s.right,
    right: w.base + w.leftToRight * s.left + w.rightToRight * s.right,
  }
}

/**
 * Which sensors connect to which actuators.
 * - `ipsilateral`: each sensor drives the actuator on the *same* side.
 * - `contralateral`: each sensor drives the actuator on the *opposite* side.
 * - `full`: every sensor drives every actuator (the fully-connected case).
 *
 * Note that `ipsilateral` and `contralateral` are really *sparse* special cases
 * of `full` — they're the same 2×2 weight matrix with one diagonal zeroed out.
 * `full` is the general form later stages build on: once learning arrives
 * (M5/M7), plasticity adjusts all four weights and the wiring stops being a
 * fixed choice at all.
 */
export type WiringPattern = 'ipsilateral' | 'contralateral' | 'full'

/**
 * The two wiring choices that define the classic Braitenberg vehicles:
 * - `pattern`: which sensor reaches which actuator (see above).
 * - `sign`: connections are excitatory (+1, more stimulus → faster) or
 *   inhibitory (−1, more stimulus → slower).
 */
export interface Wiring {
  pattern: WiringPattern
  sign: 1 | -1
}

/** Build sensor→actuator weights from a wiring choice, gain, and base drive. */
export function weightsFromWiring(
  wiring: Wiring,
  gain: number,
  base: number,
): SensorimotorWeights {
  const g = wiring.sign * gain
  switch (wiring.pattern) {
    case 'contralateral':
      // sensorLeft → actuatorRight, sensorRight → actuatorLeft
      return { leftToLeft: 0, rightToLeft: g, leftToRight: g, rightToRight: 0, base }
    case 'full':
      // Every sensor drives every actuator. Both actuators therefore receive
      // an identical signal, so the creature cannot steer — it only changes
      // speed. That symmetry is the point: steering requires an *asymmetry*.
      return { leftToLeft: g, rightToLeft: g, leftToRight: g, rightToRight: g, base }
    case 'ipsilateral':
      // sensorLeft → actuatorLeft, sensorRight → actuatorRight
      return { leftToLeft: g, rightToLeft: 0, leftToRight: 0, rightToRight: g, base }
  }
}
