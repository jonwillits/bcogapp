import { describe, it, expect } from 'vitest'
import { VehicleWorld, DEFAULT_GAIN } from './world'
import { computeActuators, weightsFromWiring } from '../neural/sensorimotor'
import { stepVehicle, DEFAULT_VEHICLE_CONFIG } from '../creature/vehicle'

describe('sensorimotor wiring', () => {
  it('ipsilateral connects each sensor to its own-side actuator', () => {
    const w = weightsFromWiring({ pattern: 'ipsilateral', sign: 1 }, 2, 0)
    const out = computeActuators(w, { left: 1, right: 0 })
    expect(out.left).toBeCloseTo(2)
    expect(out.right).toBeCloseTo(0)
  })

  it('contralateral connects each sensor to the opposite actuator', () => {
    const w = weightsFromWiring({ pattern: 'contralateral', sign: 1 }, 2, 0)
    const out = computeActuators(w, { left: 1, right: 0 })
    expect(out.left).toBeCloseTo(0)
    expect(out.right).toBeCloseTo(2)
  })

  it('full connects every sensor to every actuator', () => {
    const w = weightsFromWiring({ pattern: 'full', sign: 1 }, 2, 0)
    const out = computeActuators(w, { left: 1, right: 0.5 })
    // both actuators see the sum of both sensors
    expect(out.left).toBeCloseTo(3)
    expect(out.right).toBeCloseTo(3)
  })

  it('full wiring drives both actuators equally, so it cannot steer', () => {
    for (const sign of [1, -1] as const) {
      const w = weightsFromWiring({ pattern: 'full', sign }, 2.4, 0.6)
      for (const s of [
        { left: 0, right: 0 },
        { left: 1, right: 0 },
        { left: 0.3, right: 0.9 },
      ]) {
        const out = computeActuators(w, s)
        expect(out.left).toBeCloseTo(out.right)
      }
    }
  })

  it('inhibitory sign slows the driven actuator below base', () => {
    const w = weightsFromWiring({ pattern: 'ipsilateral', sign: -1 }, 2, 1)
    const out = computeActuators(w, { left: 1, right: 0 })
    expect(out.left).toBeCloseTo(-1)
  })
})

describe('vehicle kinematics', () => {
  it('equal wheel speeds drive straight along the heading', () => {
    const next = stepVehicle(
      { x: 0, z: 0, heading: 0 },
      { left: 1, right: 1 },
      DEFAULT_VEHICLE_CONFIG,
      1,
    )
    expect(next.x).toBeCloseTo(1)
    expect(next.z).toBeCloseTo(0)
    expect(next.heading).toBeCloseTo(0)
  })

  it('unequal wheel speeds turn the vehicle', () => {
    const next = stepVehicle(
      { x: 0, z: 0, heading: 0 },
      { left: 0, right: 1 },
      DEFAULT_VEHICLE_CONFIG,
      1,
    )
    expect(next.heading).not.toBeCloseTo(0)
  })
})

describe('VehicleWorld', () => {
  it('a vehicle with a source in front reacts (sensors become non-zero)', () => {
    const world = new VehicleWorld()
    world.addSource(0, 5, 1) // ahead along +Z
    const v = world.addVehicle('aggression', '#fff', {
      x: 0,
      z: 0,
      heading: Math.PI / 2, // facing +Z toward the source
    })
    world.step(0.1)
    expect(v.sensors.left + v.sensors.right).toBeGreaterThan(0)
  })

  it('appends one sensor-history sample per step and freezes otherwise', () => {
    const world = new VehicleWorld()
    world.addSource(0, 5, 1)
    const v = world.addVehicle('aggression', '#fff', {
      x: 0,
      z: 0,
      heading: Math.PI / 2,
    })
    expect(v.history.left).toHaveLength(0)
    world.step(0.1)
    world.step(0.1)
    expect(v.history.left).toHaveLength(2)
    expect(v.history.right).toHaveLength(2)
    // No step → no new samples (the paused case).
    const len = v.history.left.length
    expect(v.history.left).toHaveLength(len)
  })

  it('tuning one vehicle leaves every other vehicle untouched', () => {
    const world = new VehicleWorld()
    const a = world.addVehicle('fear', '#fff', { x: 0, z: 0, heading: 0 })
    const b = world.addVehicle('fear', '#fff', { x: 2, z: 0, heading: 0 })
    const bWeightBefore = b.weights.leftToLeft

    world.setVehicleTuning(a.id, { gain: 5, base: 1.5 })

    expect(a.gain).toBeCloseTo(5)
    expect(a.base).toBeCloseTo(1.5)
    expect(a.weights.leftToLeft).toBeCloseTo(5) // excitatory → +gain
    expect(a.weights.base).toBeCloseTo(1.5)
    // the untouched vehicle keeps its own tuning
    expect(b.gain).toBeCloseTo(DEFAULT_GAIN)
    expect(b.weights.leftToLeft).toBeCloseTo(bWeightBefore)
  })

  it('retuning refreshes actuator values, so the inspector equation stays true while paused', () => {
    const world = new VehicleWorld()
    world.addSource(0, 3, 1)
    const v = world.addVehicle('aggression', '#fff', {
      x: 0,
      z: 0,
      heading: Math.PI / 2,
    })
    world.step(0.1) // populate sensors + actuators
    const before = v.actuators.left

    world.setVehicleTuning(v.id, { gain: 5 })

    // The actuator must equal its own equation: base + Σ(weight × sensor).
    // If retune only touched the weights, this would still hold the old value.
    const w = v.weights
    expect(v.actuators.left).toBeCloseTo(
      v.base + w.leftToLeft * v.sensors.left + w.rightToLeft * v.sensors.right,
    )
    expect(v.actuators.right).toBeCloseTo(
      v.base + w.leftToRight * v.sensors.left + w.rightToRight * v.sensors.right,
    )
    expect(v.actuators.left).not.toBeCloseTo(before)
  })

  it('keeps vehicles inside the arena bounds', () => {
    const world = new VehicleWorld()
    const v = world.addVehicle('fear', '#fff', {
      x: 8.9,
      z: 0,
      heading: 0, // driving straight at the +X wall
    })
    for (let i = 0; i < 200; i++) world.step(0.1)
    expect(Math.abs(v.state.x)).toBeLessThanOrEqual(world.params.bounds + 1e-6)
    expect(Math.abs(v.state.z)).toBeLessThanOrEqual(world.params.bounds + 1e-6)
  })
})
