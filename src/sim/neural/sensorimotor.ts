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
 * The two wiring choices that define the classic Braitenberg vehicles:
 * - `crossed`: each sensor drives the actuator on the *opposite* side
 *   (contralateral) vs. the *same* side (ipsilateral).
 * - `sign`: connections are excitatory (+1, more stimulus → faster) or
 *   inhibitory (−1, more stimulus → slower).
 */
export interface Wiring {
  crossed: boolean
  sign: 1 | -1
}

/** Build sensor→actuator weights from a wiring choice, gain, and base drive. */
export function weightsFromWiring(
  wiring: Wiring,
  gain: number,
  base: number,
): SensorimotorWeights {
  const g = wiring.sign * gain
  if (wiring.crossed) {
    // sensorLeft → actuatorRight, sensorRight → actuatorLeft
    return {
      leftToLeft: 0,
      rightToLeft: g,
      leftToRight: g,
      rightToRight: 0,
      base,
    }
  }
  // uncrossed: sensorLeft → actuatorLeft, sensorRight → actuatorRight
  return {
    leftToLeft: g,
    rightToLeft: 0,
    leftToRight: 0,
    rightToRight: g,
    base,
  }
}
