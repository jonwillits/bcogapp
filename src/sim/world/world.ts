import { wrapAngle } from '../math'
import {
  computeActuators,
  weightsFromWiring,
  type ActuatorOutput,
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
 * One focal creature: its pose, its sensor→actuator weights, and the most recent
 * sensor/actuator values (kept for the inspector UI). Multiple vehicles can share
 * a world, but only the focal creature's "network" is visualized (per
 * APP_DESIGN — the others are effectively NPCs running the same tiny circuit).
 */
export interface Vehicle {
  id: number
  presetId: string
  color: string
  state: VehicleState
  config: VehicleConfig
  /**
   * Tuning of this creature's nervous system. These live on the *creature*,
   * not the world: they describe an individual's wiring, so individuals can
   * differ — which is what lets a student vary one vehicle while holding the
   * others fixed, and what learning will eventually change per-individual.
   */
  strength: number
  bias: number
  /** Derived from `presetId` + `strength` + `bias`; recompute with `retune()`. */
  weights: SensorimotorWeights
  sensors: SensorInput
  actuators: ActuatorOutput
  /**
   * Rolling sensor trace, one sample appended per `step()` (so it advances in
   * sim time and freezes when the sim is paused). Oldest → newest.
   */
  history: { left: number[]; right: number[] }
}

export const DEFAULT_STRENGTH = 2.4
export const DEFAULT_BIAS = 0.6

/**
 * Recompute a vehicle's weights from its own wiring, strength, and bias.
 *
 * Also refreshes the actuator values from the current sensor readings. Without
 * this, retuning while the sim is paused would leave `actuators` stale — they
 * are otherwise only recomputed in `step()` — and the inspector would display
 * an equation whose terms had updated but whose total had not, i.e. visibly
 * wrong arithmetic. It does not move the creature; only `step()` does that.
 */
export function retune(v: Vehicle): void {
  v.weights = weightsFromWiring(getPreset(v.presetId).wiring, v.strength, v.bias)
  v.actuators = computeActuators(v.weights, v.sensors)
}

/** Number of samples kept in each vehicle's sensor trace. */
export const HISTORY_LEN = 160

function pushCapped(arr: number[], v: number): void {
  arr.push(v)
  if (arr.length > HISTORY_LEN) arr.shift()
}

export interface WorldParams {
  /** half-width of the square arena; vehicles reflect off the edges */
  bounds: number
}

export const DEFAULT_WORLD_PARAMS: WorldParams = {
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
      strength: DEFAULT_STRENGTH,
      bias: DEFAULT_BIAS,
      weights: weightsFromWiring(
        getPreset(presetId).wiring,
        DEFAULT_STRENGTH,
        DEFAULT_BIAS,
      ),
      sensors: { left: 0, right: 0 },
      actuators: { left: 0, right: 0 },
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
    retune(v)
  }

  /** Re-tune a single creature, leaving every other vehicle untouched. */
  setVehicleTuning(id: number, patch: { strength?: number; bias?: number }): void {
    const v = this.vehicles.find((veh) => veh.id === id)
    if (!v) return
    if (patch.strength !== undefined) v.strength = patch.strength
    if (patch.bias !== undefined) v.bias = patch.bias
    retune(v)
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
      v.actuators = computeActuators(v.weights, v.sensors)
      pushCapped(v.history.left, v.sensors.left)
      pushCapped(v.history.right, v.sensors.right)
      let next = stepVehicle(v.state, v.actuators, v.config, dt)
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
