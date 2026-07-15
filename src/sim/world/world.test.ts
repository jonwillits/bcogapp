import { describe, it, expect } from 'vitest'
import { VehicleWorld } from './world'
import { computeMotors, weightsFromWiring } from '../neural/sensorimotor'
import { stepVehicle, DEFAULT_VEHICLE_CONFIG } from '../creature/vehicle'

describe('sensorimotor wiring', () => {
  it('uncrossed connects each sensor to its own-side motor', () => {
    const w = weightsFromWiring({ crossed: false, sign: 1 }, 2, 0)
    const out = computeMotors(w, { left: 1, right: 0 })
    expect(out.left).toBeCloseTo(2)
    expect(out.right).toBeCloseTo(0)
  })

  it('crossed connects each sensor to the opposite motor', () => {
    const w = weightsFromWiring({ crossed: true, sign: 1 }, 2, 0)
    const out = computeMotors(w, { left: 1, right: 0 })
    expect(out.left).toBeCloseTo(0)
    expect(out.right).toBeCloseTo(2)
  })

  it('inhibitory sign slows the driven motor below base', () => {
    const w = weightsFromWiring({ crossed: false, sign: -1 }, 2, 1)
    const out = computeMotors(w, { left: 1, right: 0 })
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
