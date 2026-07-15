/**
 * The seed of the evolving-creature nervous system: a minimal sensor→motor
 * network. For Module 1 (Braitenberg vehicles) this is a 2-input × 2-output
 * linear map — two sensors driving two motors, plus a base (resting) drive.
 *
 * This is deliberately the simplest possible "neural" layer. Later stages
 * (M4 circuits, M5/M7 learning) extend the neural package with real neurons,
 * multiple layers, and learning rules; the sensor→motor framing carries over.
 */

export interface SensorInput {
  left: number
  right: number
}

export interface MotorOutput {
  left: number
  right: number
}

/**
 * Connection weights from each sensor to each motor, plus a shared base drive.
 * motorX = base + Σ (weight · sensor).
 */
export interface SensorimotorWeights {
  /** sensorLeft → motorLeft */
  leftToLeft: number
  /** sensorRight → motorLeft */
  rightToLeft: number
  /** sensorLeft → motorRight */
  leftToRight: number
  /** sensorRight → motorRight */
  rightToRight: number
  /** resting drive applied to both motors */
  base: number
}

export function computeMotors(
  w: SensorimotorWeights,
  s: SensorInput,
): MotorOutput {
  return {
    left: w.base + w.leftToLeft * s.left + w.rightToLeft * s.right,
    right: w.base + w.leftToRight * s.left + w.rightToRight * s.right,
  }
}

/**
 * The two wiring choices that define the classic Braitenberg vehicles:
 * - `crossed`: each sensor drives the motor on the *opposite* side
 *   (contralateral) vs. the *same* side (ipsilateral).
 * - `sign`: connections are excitatory (+1, more stimulus → faster) or
 *   inhibitory (−1, more stimulus → slower).
 */
export interface Wiring {
  crossed: boolean
  sign: 1 | -1
}

/** Build sensor→motor weights from a wiring choice, gain, and base drive. */
export function weightsFromWiring(
  wiring: Wiring,
  gain: number,
  base: number,
): SensorimotorWeights {
  const g = wiring.sign * gain
  if (wiring.crossed) {
    // sensorLeft → motorRight, sensorRight → motorLeft
    return {
      leftToLeft: 0,
      rightToLeft: g,
      leftToRight: g,
      rightToRight: 0,
      base,
    }
  }
  // uncrossed: sensorLeft → motorLeft, sensorRight → motorRight
  return {
    leftToLeft: g,
    rightToLeft: 0,
    leftToRight: 0,
    rightToRight: g,
    base,
  }
}
