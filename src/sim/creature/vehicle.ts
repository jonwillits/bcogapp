import { clamp } from '../math'
import type { ActuatorOutput } from '../neural/sensorimotor'

/**
 * A creature body at Module-1 stage: a two-wheeled cart on the XZ plane with two
 * forward-facing sensors. Position is (x, z); `heading` is the facing angle in
 * radians measured from +X toward +Z. Forward = (cos h, sin h).
 *
 * Movement is differential drive: the two actuator outputs are wheel speeds.
 */
export interface VehicleState {
  x: number
  z: number
  heading: number
}

export interface VehicleConfig {
  /** distance between the two wheels (affects turn rate) */
  wheelBase: number
  /** how far ahead of the body center the sensors sit */
  sensorForward: number
  /** lateral offset of each sensor from the centerline */
  sensorHalfWidth: number
  /** height of the sensors above the floor; sources are sensed in 3D, so this
   *  is what a source's height is measured against. Matches the mesh. */
  sensorHeight: number
  /** wheel speed magnitude cap (units/sec) */
  maxSpeed: number
  /**
   * Forbid driving a wheel backwards, so an actuator driven negative stalls at
   * zero instead of reversing.
   *
   * Off everywhere by default, and Module 1 must never turn it on: students have
   * already watched 3c reverse once inhibition exceeds its bias, and the answer
   * key in `vehiclePresets.ts` says so. It exists for Module 2's §6 problem,
   * where an inhibitory approacher's reversal zone covers the whole arena and
   * makes population Y sortable on sight.
   *
   * Arguably the more faithful kinematics either way — Braitenberg's 3a comes to
   * *rest* facing the source, and reversing is an artifact of letting wheel
   * speed go negative. But it changes what the creature does near a light, so
   * it is a measured choice, not a tidy-up.
   */
  clampReverse?: boolean
}

export const DEFAULT_VEHICLE_CONFIG: VehicleConfig = {
  wheelBase: 0.6,
  sensorForward: 0.5,
  sensorHalfWidth: 0.36,
  sensorHeight: 0.2,
  maxSpeed: 3.2,
}

export interface SensorWorldPositions {
  left: { x: number; z: number }
  right: { x: number; z: number }
}

/** World-space positions of the two sensors given the vehicle pose. */
export function sensorPositions(
  s: VehicleState,
  cfg: VehicleConfig,
): SensorWorldPositions {
  const cos = Math.cos(s.heading)
  const sin = Math.sin(s.heading)
  // forward = (cos, sin); left-hand perpendicular = (-sin, cos)
  const fx = cos
  const fz = sin
  const px = -sin
  const pz = cos
  return {
    left: {
      x: s.x + fx * cfg.sensorForward + px * cfg.sensorHalfWidth,
      z: s.z + fz * cfg.sensorForward + pz * cfg.sensorHalfWidth,
    },
    right: {
      x: s.x + fx * cfg.sensorForward - px * cfg.sensorHalfWidth,
      z: s.z + fz * cfg.sensorForward - pz * cfg.sensorHalfWidth,
    },
  }
}

/**
 * Actuator output as the wheel speeds the body actually turns at.
 *
 * The single place the cap (and `clampReverse`) is applied. It is exported and
 * used by the observation layer as well as by `stepVehicle`, deliberately: the
 * separability measures are only worth anything if the speed they score is the
 * speed on screen, and two copies of this rule would be free to drift apart.
 */
export function wheelSpeeds(
  actuators: ActuatorOutput,
  cfg: VehicleConfig,
): { left: number; right: number } {
  const lo = cfg.clampReverse ? 0 : -cfg.maxSpeed
  return {
    left: clamp(actuators.left, lo, cfg.maxSpeed),
    right: clamp(actuators.right, lo, cfg.maxSpeed),
  }
}

/**
 * Advance the pose by `dt` seconds under differential-drive kinematics.
 * Returns a new state (pure — does not mutate the input).
 */
export function stepVehicle(
  s: VehicleState,
  actuators: ActuatorOutput,
  cfg: VehicleConfig,
  dt: number,
): VehicleState {
  const { left: vL, right: vR } = wheelSpeeds(actuators, cfg)
  const v = (vL + vR) / 2
  const omega = (vR - vL) / cfg.wheelBase
  const heading = s.heading + omega * dt
  return {
    heading,
    x: s.x + v * Math.cos(heading) * dt,
    z: s.z + v * Math.sin(heading) * dt,
  }
}
