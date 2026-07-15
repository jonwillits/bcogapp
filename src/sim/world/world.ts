import { wrapAngle } from '../math'
import {
  computeMotors,
  weightsFromWiring,
  type MotorOutput,
  type SensorInput,
  type SensorimotorWeights,
} from '../neural/sensorimotor'
import {
  DEFAULT_VEHICLE_CONFIG,
  sensorPositions,
  stepVehicle,
  type VehicleConfig,
  type VehicleState,
} from '../creature/vehicle'
import { getPreset } from '../creature/vehiclePresets'
import { sensedIntensity, type Source } from './source'

/**
 * One focal creature: its pose, its sensor→motor weights, and the most recent
 * sensor/motor values (kept for the inspector UI). Multiple vehicles can share
 * a world, but only the focal creature's "network" is visualized (per
 * APP_DESIGN — the others are effectively NPCs running the same tiny circuit).
 */
export interface Vehicle {
  id: number
  presetId: string
  color: string
  state: VehicleState
  config: VehicleConfig
  weights: SensorimotorWeights
  sensors: SensorInput
  motors: MotorOutput
  /**
   * Rolling sensor trace, one sample appended per `step()` (so it advances in
   * sim time and freezes when the sim is paused). Oldest → newest.
   */
  history: { left: number[]; right: number[] }
}

/** Number of samples kept in each vehicle's sensor trace. */
export const HISTORY_LEN = 160

function pushCapped(arr: number[], v: number): void {
  arr.push(v)
  if (arr.length > HISTORY_LEN) arr.shift()
}

export interface WorldParams {
  gain: number
  base: number
  /** half-width of the square arena; vehicles reflect off the edges */
  bounds: number
}

export const DEFAULT_WORLD_PARAMS: WorldParams = {
  gain: 2.4,
  base: 0.6,
  bounds: 9,
}

let nextVehicleId = 1
let nextSourceId = 1

export class VehicleWorld {
  vehicles: Vehicle[] = []
  sources: Source[] = []
  params: WorldParams

  constructor(params: WorldParams = DEFAULT_WORLD_PARAMS) {
    this.params = { ...params }
  }

  addVehicle(
    presetId: string,
    color: string,
    state: VehicleState,
    config: VehicleConfig = DEFAULT_VEHICLE_CONFIG,
  ): Vehicle {
    const v: Vehicle = {
      id: nextVehicleId++,
      presetId,
      color,
      state,
      config,
      weights: weightsFromWiring(
        getPreset(presetId).wiring,
        this.params.gain,
        this.params.base,
      ),
      sensors: { left: 0, right: 0 },
      motors: { left: 0, right: 0 },
      history: { left: [], right: [] },
    }
    this.vehicles.push(v)
    return v
  }

  addSource(x: number, z: number, strength = 1): Source {
    const s: Source = { id: nextSourceId++, x, z, strength }
    this.sources.push(s)
    return s
  }

  removeSource(id: number): void {
    this.sources = this.sources.filter((s) => s.id !== id)
  }

  setVehiclePreset(id: number, presetId: string): void {
    const v = this.vehicles.find((veh) => veh.id === id)
    if (!v) return
    v.presetId = presetId
    v.weights = weightsFromWiring(
      getPreset(presetId).wiring,
      this.params.gain,
      this.params.base,
    )
  }

  /** Rebuild every vehicle's weights after a gain/base change. */
  reweight(): void {
    for (const v of this.vehicles) {
      v.weights = weightsFromWiring(
        getPreset(v.presetId).wiring,
        this.params.gain,
        this.params.base,
      )
    }
  }

  /** Advance the whole world by `dt` seconds. */
  step(dt: number): void {
    const b = this.params.bounds
    for (const v of this.vehicles) {
      const sp = sensorPositions(v.state, v.config)
      v.sensors = {
        left: sensedIntensity(sp.left.x, sp.left.z, this.sources),
        right: sensedIntensity(sp.right.x, sp.right.z, this.sources),
      }
      v.motors = computeMotors(v.weights, v.sensors)
      pushCapped(v.history.left, v.sensors.left)
      pushCapped(v.history.right, v.sensors.right)
      let next = stepVehicle(v.state, v.motors, v.config, dt)
      next = reflectInBounds(next, b)
      v.state = next
    }
  }
}

/** Keep a vehicle inside the square arena by reflecting its heading at walls. */
function reflectInBounds(s: VehicleState, bound: number): VehicleState {
  let { x, z, heading } = s
  if (x > bound) {
    x = bound
    heading = wrapAngle(Math.PI - heading)
  } else if (x < -bound) {
    x = -bound
    heading = wrapAngle(Math.PI - heading)
  }
  if (z > bound) {
    z = bound
    heading = wrapAngle(-heading)
  } else if (z < -bound) {
    z = -bound
    heading = wrapAngle(-heading)
  }
  return { x, z, heading }
}
