import { wrapAngle } from '../math'
import type { Rng } from '../random'
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
  /**
   * Which of Module 1's six named varieties this is, or `null` for a creature
   * whose wiring came from somewhere other than a preset -- an inherited
   * genome, from Module 2 on. Only the M1 scene reads it.
   */
  presetId: string | null
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
  // A creature with no preset has no wiring pattern to rebuild its weights
  // from -- its weights *are* its description. Only the bias, which the
  // sensorimotor layer keeps inside the weight object, needs carrying across.
  if (v.presetId === null) {
    v.weights = { ...v.weights, bias: v.bias }
  } else {
    v.weights = weightsFromWiring(getPreset(v.presetId).wiring, v.strength, v.bias)
  }
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
  /**
   * Standard deviation of Gaussian noise added to each sensor reading, in
   * sensor units. Zero — the Module 1 case — costs nothing and draws nothing
   * from the random stream, so M1 remains bit-for-bit what it was.
   *
   * Module 2 raises it as one of Part 3's perturbations: two populations that
   * approach a light identically in a clean world may fail differently once
   * their sensors are unreliable, which is the reading's rule about breaking
   * the same way, made operable.
   */
  sensorNoise: number
}

export const DEFAULT_WORLD_PARAMS: WorldParams = {
  bounds: 9,
  sensorNoise: 0,
}

let nextVehicleId = 1
let nextSourceId = 1

export class VehicleWorld {
  vehicles: Vehicle[] = []
  sources: Source[] = []
  params: WorldParams
  /**
   * The world's slice of the run's single seeded stream. Only consulted when
   * something in the world is actually stochastic — today that is sensor noise
   * alone — so a world with noise at zero never touches it and two runs that
   * differ only in a later-drawn quantity stay aligned.
   */
  rng: Rng | null

  constructor(params: WorldParams = DEFAULT_WORLD_PARAMS, rng: Rng | null = null) {
    this.params = { ...params }
    this.rng = rng
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

  /**
   * Add a vehicle whose nervous system is given as weights outright, with no
   * preset behind it.
   *
   * This is the Module 2 path, and the asymmetry with `addVehicle` is the point
   * of the whole refactor: a Module 1 vehicle *is* one of six named varieties
   * and its weights are derived from that name, while a Module 2 vehicle is
   * whatever four numbers it inherited and has no name at all. Both are the
   * same body running the same sensor model, the same actuator arithmetic and
   * the same collisions — which is what `APP_DESIGN`'s one-engine claim asks
   * for, and the first time it has been tested.
   */
  addWeightedVehicle(
    weights: SensorimotorWeights,
    color: string,
    state: VehicleState,
    config: VehicleConfig = DEFAULT_VEHICLE_CONFIG,
  ): Vehicle {
    const v: Vehicle = {
      id: nextVehicleId++,
      presetId: null,
      color,
      state,
      config,
      strength: DEFAULT_STRENGTH,
      bias: weights.bias,
      weights,
      sensors: { left: 0, right: 0 },
      actuators: { left: 0, right: 0 },
      history: { left: [], right: [] },
    }
    this.vehicles.push(v)
    return v
  }

  /** `y` is the orb's height; sources are sensed in 3D, so height matters. */
  addSource(x: number, y: number, z: number, strength = 1): Source {
    const s: Source = { id: nextSourceId++, x, y, z, strength }
    this.sources.push(s)
    return s
  }

  /** Remove a creature from the world — the continuous life cycle needs it. */
  removeVehicle(id: number): void {
    this.vehicles = this.vehicles.filter((v) => v.id !== id)
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
      const h = v.config.sensorHeight
      const noise = this.params.sensorNoise
      let sensedLeft = sensedIntensity(sp.left.x, h, sp.left.z, this.sources)
      let sensedRight = sensedIntensity(sp.right.x, h, sp.right.z, this.sources)
      if (noise > 0 && this.rng) {
        // Clamped at zero: a sensor reports how much light it sees, and
        // "less than none" is not a reading a real one could produce. Letting
        // it go negative would also hand an inhibitory vehicle free forward
        // drive out of pure noise.
        sensedLeft = Math.max(0, sensedLeft + this.rng.normal() * noise)
        sensedRight = Math.max(0, sensedRight + this.rng.normal() * noise)
      }
      v.sensors = { left: sensedLeft, right: sensedRight }
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
