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
 * Advance the pose by `dt` seconds under differential-drive kinematics.
 * Returns a new state (pure — does not mutate the input).
 */
export function stepVehicle(
  s: VehicleState,
  actuators: ActuatorOutput,
  cfg: VehicleConfig,
  dt: number,
): VehicleState {
  const vL = clamp(actuators.left, -cfg.maxSpeed, cfg.maxSpeed)
  const vR = clamp(actuators.right, -cfg.maxSpeed, cfg.maxSpeed)
  const v = (vL + vR) / 2
  const omega = (vR - vL) / cfg.wheelBase
  const heading = s.heading + omega * dt
  return {
    heading,
    x: s.x + v * Math.cos(heading) * dt,
    z: s.z + v * Math.sin(heading) * dt,
  }
}
