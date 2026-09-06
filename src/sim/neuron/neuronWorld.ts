import { makeRng, type Rng } from '../random'
import { VehicleWorld, DEFAULT_WORLD_PARAMS, type Vehicle } from '../world/world'
import { DEFAULT_VEHICLE_CONFIG, wheelSpeeds } from '../creature/vehicle'
import { driftLights, freshLight, respawnPoint, type FoodLight } from '../world/food'
import type { SensorInput, ActuatorOutput } from '../neural/sensorimotor'
import { NeuronCell, DEFAULT_AXON, type CellParams } from './cell'
import {
  HEALTHY_SCENARIO,
  type Scenario,
  type UnitSettings,
  type WorldSettings,
} from './cells'
import { travelTimeS, arrivingFraction, type SignalType } from './signals'
import { measureVelocity } from './measure'

/**
 * The Lab 1 vehicle with a neuron inside each of its two connections.
 *
 * The body, its two sensors and two actuators, the movement and the walls are
 * `VehicleWorld`'s, called unchanged; the moving lights are Module 2's
 * `driftLights`. What is new is what happens between a sensor reading and a
 * wheel: the reading becomes a rate, the rate drives a Hodgkin–Huxley cell,
 * the cell's spikes run down its axon, and what arrives at the far end is
 * what the wheel does.
 *
 * **Two cells, one parameter set.** The vehicle is bilaterally symmetric: the
 * left cell drives the left wheel from the left (same-side) and right
 * (opposite-side) sensors, and the right cell is its mirror image. They share
 * every parameter, and every control in the scene sets both. The Unit and
 * Membrane tabs show the left one. This is not two neurons kept in sync — it
 * is one cell type, instantiated twice, the way Lab 1's wiring was one matrix
 * with two rows.
 *
 * Only `spikes` runs the cells into the wheels. The other two signal types
 * are the comparison cases of the reading's §3.1 (see `signals.ts`): the
 * sensor reading itself is delayed and attenuated per its physics and put
 * through Lab 1's arithmetic. The cells keep running on the sensor rates
 * either way, so the other two tabs stay live.
 */

/** Spikes per second one unit of sensed intensity is worth as an input rate. */
export const RATE_PER_INTENSITY = 10
/** Wheel speed, arena units per second, per spike per second arriving. */
export const ACTUATOR_PER_HZ = 0.12
/** The sensor's own response time, seconds. */
export const SENSOR_TAU_S = 0.02
/** How long the actuator averages arriving spikes over, seconds. */
export const ACTUATOR_TAU_S = 0.05
/** A light is collected within this distance of the vehicle's centre. */
export const COLLECT_RADIUS = 0.8
/**
 * A light counts as collected only if the vehicle *catches* it: it has to be
 * driving at the light, and moving at least as fast as the light is moving.
 * A light that runs into a parked vehicle, or streaks through one that could
 * never have kept up with it, bounces off and carries on.
 *
 * Both clauses were forced by measurement. Without any rule, a vehicle that
 * never moved collected almost as many lights as a healthy one — 3.3 against
 * 3.8 a minute — because with three lights drifting round a walled arena, one
 * runs into anything parked on the floor every twenty seconds. Requiring the
 * vehicle to be driving at the light fixed that, but a healthy vehicle in a
 * world of lights faster than itself still scored 2.9, because a light
 * passing straight through a vehicle that happened to be facing it counted.
 * A dwell rule — stay on the light for a moment — cut that to nothing, but
 * cut the healthy vehicle's own head-on catches with it and halved its score.
 * "You catch what you can keep up with" is the rule that leaves a charging
 * healthy vehicle its catches and gives one in a too-fast world none, which
 * is the whole of N1's story: nothing wrong with the cell; no controller
 * could catch them.
 */
export const CATCH_CLOSING_SPEED = 0.5
/** The vehicle must be moving at least this fraction of the light's speed. */
export const CATCH_KEEP_UP = 0.9
/** Sensed strength of a light — Module 2's value, so the sensor readings match. */
export const LIGHT_STRENGTH = 4
/** Lights are sensed this far above the floor, as in Modules 1 and 2. */
export const LIGHT_HOVER = 0.7
/** The longest delay the signal pipeline remembers, seconds. */
const MAX_DELAY_S = 90

export type InputSource = 'sensors' | 'sliders'

export interface ReactionTime {
  sensing: number
  travel: number
  integration: number
  total: number
}

interface Side {
  cell: NeuronCell
  /** Sensor reading after the sensor's own low-pass. */
  filtered: number
  /** Time-stamped filtered readings, for the delayed signal types. */
  delayLine: { t: number; v: number }[]
  /** A diffusing signal that has arrived and not yet cleared. */
  lingering: number
  /** Far-end spikes that have left the simulated axon and not yet arrived. */
  pending: number[]
  /** Arriving spike rate as the actuator sees it, spikes per second. */
  rate: number
  /** Index into the cell's far-end spike list of the next one to forward. */
  farCursor: number
}

export class NeuronWorld {
  readonly world: VehicleWorld
  readonly vehicle: Vehicle
  readonly left: Side
  readonly right: Side
  lights: FoodLight[] = []
  time = 0
  lightsCollected = 0
  /** Sim times at which lights were collected. */
  collections: number[] = []
  cellParams: CellParams
  unit: UnitSettings
  settings: WorldSettings
  inputSource: InputSource = 'sensors'
  /** The Unit tab's own input rates, used when `inputSource` is 'sliders'. */
  sliderRates: [number, number] = [0, 0]
  readonly seed: number
  /**
   * Conduction velocity of the axon at full resolution, m/s, measured by the
   * instrument whenever the cell's parameters change. The world's travel
   * time and the actuator's delay use this rather than the live cell's own
   * reading, because the live axon runs coarsely while the Membrane tab is
   * hidden and conducts about a fifth slower there (0.65 against 0.81 m/s):
   * a travel time that changed when a student changed tabs would be
   * teaching against itself. Null while a spike cannot cross the axon at all.
   * (The coarse axon has since been switched off altogether — see
   * `REDUCED_COMPARTMENTS` — but the reading at high rates is still noisier
   * than the instrument's, so the calibration stays.)
   */
  calibratedVelocity: number | null = null
  private rng: Rng

  constructor(seed: number, scenario: Scenario = HEALTHY_SCENARIO) {
    this.seed = seed
    this.rng = makeRng(seed)
    this.cellParams = { ...scenario.cell }
    this.unit = { ...scenario.unit }
    this.settings = { ...scenario.world }
    const makeSide = (): Side => ({
      cell: new NeuronCell(this.rng.fork(), this.cellParams),
      filtered: 0,
      delayLine: [],
      lingering: 0,
      pending: [],
      rate: 0,
      farCursor: 0,
    })
    this.left = makeSide()
    this.right = makeSide()
    this.world = new VehicleWorld({ ...DEFAULT_WORLD_PARAMS }, this.rng)
    this.vehicle = this.world.addVehicle('aggression', '#c084fc', {
      x: 0,
      z: 0,
      heading: this.rng.range(0, Math.PI * 2),
    })
    this.vehicle.drive = (sensors, dt) => this.drive(sensors, dt)
    for (let i = 0; i < this.settings.lightCount; i++) this.spawnLight()
    this.calibrate()
  }

  private calibrate(): void {
    this.calibratedVelocity = measureVelocity(this.cellParams).velocity
  }

  /** The cell the Unit and Membrane tabs show. */
  get cell(): NeuronCell {
    return this.left.cell
  }

  private spawnLight(): void {
    const p = respawnPoint(this.lights, this.world.params.bounds, this.rng)
    const src = this.world.addSource(p.x, LIGHT_HOVER, p.z, LIGHT_STRENGTH)
    const heading = this.rng.range(0, Math.PI * 2)
    const s = this.settings.lightSpeed
    this.lights.push(freshLight(src, 1, Infinity, Math.cos(heading) * s, Math.sin(heading) * s))
  }

  /** Change how many lights there are, keeping the ones already out. */
  setLightCount(n: number): void {
    this.settings.lightCount = n
    while (this.lights.length > n) {
      const l = this.lights.pop()!
      this.world.removeSource(l.source.id)
    }
    while (this.lights.length < n) this.spawnLight()
  }

  /** Change how fast the lights move, keeping each one's heading. */
  setLightSpeed(s: number): void {
    this.settings.lightSpeed = s
    for (const l of this.lights) {
      const heading = Math.atan2(l.vz, l.vx)
      l.vx = Math.cos(heading) * s
      l.vz = Math.sin(heading) * s
    }
  }

  setSignal(signal: SignalType): void {
    this.settings.signal = signal
  }

  setBodySize(m: number): void {
    this.settings.bodySizeM = m
  }

  /** Every control on the Membrane tab sets both cells at once. */
  setCellParams(patch: Partial<CellParams>): void {
    this.cellParams = { ...this.cellParams, ...patch }
    this.left.cell.setParams(patch)
    this.right.cell.setParams(patch)
    this.calibrate()
  }

  setUnit(patch: Partial<UnitSettings>): void {
    this.unit = { ...this.unit, ...patch }
  }

  /** Signal path length, metres. */
  get pathLength(): number {
    return this.settings.bodySizeM
  }

  /** Conduction velocity the delay uses, m/s; a blocked axon conducts nothing. */
  get spikeVelocity(): number {
    return this.calibratedVelocity ?? 0
  }

  /** Travel time across the body for the current signal type, seconds. */
  get travelTime(): number {
    return travelTimeS(this.settings.signal, this.pathLength, this.spikeVelocity)
  }

  reactionTime(): ReactionTime {
    const travel = this.travelTime
    const { signal } = this.settings
    const integration =
      signal === 'spikes'
        ? this.cellParams.synapseTau / 1000 + ACTUATOR_TAU_S
        : signal === 'chemical'
          ? this.clearanceTime + ACTUATOR_TAU_S
          : ACTUATOR_TAU_S
    return { sensing: SENSOR_TAU_S, travel, integration, total: SENSOR_TAU_S + travel + integration }
  }

  /** How long a diffusing chemical takes to clear once it has arrived: about as long as it took to come. */
  get clearanceTime(): number {
    return Math.max(SENSOR_TAU_S, Math.min(this.travelTime, MAX_DELAY_S))
  }

  /** Lights collected per minute over the whole run so far. */
  get lightsPerMinute(): number {
    return this.time > 0 ? (this.lightsCollected / this.time) * 60 : 0
  }

  /** Lights collected per minute over the last minute. */
  get recentLightsPerMinute(): number {
    const span = Math.min(60, this.time)
    if (span <= 0) return 0
    const from = this.time - span
    const n = this.collections.filter((t) => t >= from).length
    return (n / span) * 60
  }

  /** ATP both cells' pumps have spent so far. */
  get atpTotal(): number {
    return this.left.cell.atpTotal + this.right.cell.atpTotal
  }

  /** ATP per light collected over the run; Infinity until a light has been collected. */
  get energyPerLight(): number {
    return this.lightsCollected > 0 ? this.atpTotal / this.lightsCollected : Infinity
  }

  /** The signal actually driving the wheels this step, per side, for the panel. */
  arriving = { left: 0, right: 0 }

  /** Advance the whole world by `dt` seconds. */
  step(dt: number): void {
    this.world.step(dt)
    this.time += dt
    // Collection: a light the vehicle catches is taken and reappears
    // elsewhere; one that merely runs into the vehicle bounces off it.
    const v = this.vehicle.state
    const ws = wheelSpeeds(this.vehicle.actuators, this.vehicle.config)
    const forward = (ws.left + ws.right) / 2
    for (const l of this.lights) {
      const dx = l.source.x - v.x
      const dz = l.source.z - v.z
      const dist = Math.hypot(dx, dz)
      if (dist > COLLECT_RADIUS) continue
      const ux = dist > 1e-6 ? dx / dist : Math.cos(v.heading)
      const uz = dist > 1e-6 ? dz / dist : Math.sin(v.heading)
      const closing = forward * (Math.cos(v.heading) * ux + Math.sin(v.heading) * uz)
      const lightSpeed = Math.hypot(l.vx, l.vz)
      if (closing >= CATCH_CLOSING_SPEED && Math.abs(forward) >= CATCH_KEEP_UP * lightSpeed) {
        this.lightsCollected++
        this.collections.push(this.time)
        this.world.removeSource(l.source.id)
        const p = respawnPoint(this.lights, this.world.params.bounds, this.rng)
        l.source = this.world.addSource(p.x, LIGHT_HOVER, p.z, LIGHT_STRENGTH)
        const heading = this.rng.range(0, Math.PI * 2)
        const s = this.settings.lightSpeed
        l.vx = Math.cos(heading) * s
        l.vz = Math.sin(heading) * s
        continue
      }
      // Not caught: keep it from passing through the body. Put it just
      // outside reach along the line between them and reflect the part of its
      // velocity that was carrying it inward.
      l.source.x = v.x + ux * (COLLECT_RADIUS + 0.02)
      l.source.z = v.z + uz * (COLLECT_RADIUS + 0.02)
      const along = l.vx * ux + l.vz * uz
      if (along < 0) {
        l.vx -= 2 * along * ux
        l.vz -= 2 * along * uz
      }
    }
    driftLights(this.lights, this.world.params.bounds, dt)
    if (this.collections.length && this.collections[0] < this.time - 120) {
      this.collections = this.collections.filter((t) => t >= this.time - 120)
    }
  }

  run(seconds: number, dt = 1 / 30): void {
    const steps = Math.round(seconds / dt)
    for (let i = 0; i < steps; i++) this.step(dt)
  }

  /**
   * The connection, opened up. Called by `VehicleWorld.step` with fresh sensor
   * readings; returns what the two wheels do.
   */
  private drive(sensors: SensorInput, dt: number): ActuatorOutput {
    const { signal } = this.settings
    // The sensor's own response time, applied to both readings.
    const a = 1 - Math.exp(-dt / SENSOR_TAU_S)
    this.left.filtered += (sensors.left - this.left.filtered) * a
    this.right.filtered += (sensors.right - this.right.filtered) * a

    // Each cell's two sensor-driven inputs: same side first, opposite second.
    const rates = (own: number, other: number): [number, number] =>
      this.inputSource === 'sensors'
        ? [own * RATE_PER_INTENSITY, other * RATE_PER_INTENSITY]
        : [this.sliderRates[0], this.sliderRates[1]]
    const [lIpsi, lContra] = rates(this.left.filtered, this.right.filtered)
    const [rIpsi, rContra] = rates(this.right.filtered, this.left.filtered)
    const u = this.unit
    this.left.cell.setInput({ b0: u.b0, b: [u.bIpsi, u.bContra, u.b3], x: [lIpsi, lContra, u.x3] })
    this.right.cell.setInput({ b0: u.b0, b: [u.bIpsi, u.bContra, u.b3], x: [rIpsi, rContra, u.x3] })
    this.left.cell.advance(dt * 1000)
    this.right.cell.advance(dt * 1000)

    if (signal === 'spikes') {
      const l = this.spikeDrive(this.left, dt)
      const r = this.spikeDrive(this.right, dt)
      this.arriving = { left: l, right: r }
      return { left: l * ACTUATOR_PER_HZ, right: r * ACTUATOR_PER_HZ }
    }

    // A diffusing chemical or a graded electrical signal: the reading itself,
    // delayed by its travel time and attenuated by its distance, put through
    // Lab 1's arithmetic. The rate scale is the same one the cells use, so the
    // baseline and strengths mean the same thing on every signal type.
    const lDel = this.delayedReading(this.left, dt)
    const rDel = this.delayedReading(this.right, dt)
    this.arriving = { left: lDel, right: rDel }
    const linear = (own: number, other: number) =>
      Math.max(
        0,
        u.b0 + u.bIpsi * own * RATE_PER_INTENSITY + u.bContra * other * RATE_PER_INTENSITY + u.b3 * u.x3,
      )
    return {
      left: linear(lDel, rDel) * ACTUATOR_PER_HZ,
      right: linear(rDel, lDel) * ACTUATOR_PER_HZ,
    }
  }

  /**
   * Spikes: what left the far end of the simulated axon, delayed by whatever
   * of the body lies beyond it, averaged by the actuator.
   */
  private spikeDrive(side: Side, dt: number): number {
    const far = side.cell.farSpikes
    // The list is trimmed from the front as it ages; keep the cursor honest.
    if (side.farCursor > far.length) side.farCursor = 0
    while (side.farCursor < far.length) {
      const tMs = far[side.farCursor++]
      // Sim time (s) at which this spike left the axon, then the rest of the trip.
      const left = this.time + (tMs - side.cell.time) / 1000
      const beyond = Math.max(0, this.pathLength - DEFAULT_AXON.lengthMm / 1000)
      side.pending.push(left + beyond / this.spikeVelocity)
    }
    side.rate *= Math.exp(-dt / ACTUATOR_TAU_S)
    const now = this.time + dt
    let keep = 0
    for (const t of side.pending) {
      if (t <= now) side.rate += 1 / ACTUATOR_TAU_S
      else side.pending[keep++] = t
    }
    side.pending.length = keep
    return side.rate
  }

  /** Chemical and graded: the reading from `travel` seconds ago, scaled. */
  private delayedReading(side: Side, dt: number): number {
    const now = this.time + dt
    side.delayLine.push({ t: now, v: side.filtered })
    while (side.delayLine.length && side.delayLine[0].t < now - MAX_DELAY_S) side.delayLine.shift()
    const travel = this.travelTime
    let delayed = 0
    if (travel <= MAX_DELAY_S) {
      const at = now - travel
      for (let i = side.delayLine.length - 1; i >= 0; i--) {
        if (side.delayLine[i].t <= at) {
          delayed = side.delayLine[i].v
          break
        }
      }
    }
    const scaled = delayed * arrivingFraction(this.settings.signal, this.pathLength)
    if (this.settings.signal === 'chemical') {
      // What arrives spreads out in time and lingers about as long as it took
      // to come: slow to clear.
      const k = 1 - Math.exp(-dt / this.clearanceTime)
      side.lingering += (scaled - side.lingering) * k
      return side.lingering
    }
    return scaled
  }
}

/** Top speed of the vehicle, so the World tab can print it beside the lights'. */
export const VEHICLE_TOP_SPEED = DEFAULT_VEHICLE_CONFIG.maxSpeed
