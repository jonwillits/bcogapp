import { describe, it, expect } from 'vitest'
import { VehicleWorld, DEFAULT_STRENGTH, DEFAULT_WORLD_PARAMS } from './world'
import { makeRng } from '../random'
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

  it('inhibitory sign slows the driven actuator below bias', () => {
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
    world.addSource(0, 0.7, 5, 1) // ahead along +Z, sitting on the floor
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
    world.addSource(0, 0.7, 5, 1)
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

  it('height costs signal: a source up on the rim is weaker than one on the floor', () => {
    const sense = (sourceY: number) => {
      const world = new VehicleWorld()
      world.addSource(0, sourceY, 4, 1) // same x/z either way
      const v = world.addVehicle('aggression', '#fff', {
        x: 0,
        z: 0,
        heading: Math.PI / 2, // facing the source
      })
      world.step(0.01)
      return v.sensors.left + v.sensors.right
    }
    const onFloor = sense(0.7)
    const onRim = sense(3.7) // same spot, but 3 units up the cliff
    expect(onRim).toBeGreaterThan(0) // still sensed...
    expect(onRim).toBeLessThan(onFloor) // ...but genuinely weaker
  })

  it('tuning one vehicle leaves every other vehicle untouched', () => {
    const world = new VehicleWorld()
    const a = world.addVehicle('fear', '#fff', { x: 0, z: 0, heading: 0 })
    const b = world.addVehicle('fear', '#fff', { x: 2, z: 0, heading: 0 })
    const bWeightBefore = b.weights.leftToLeft

    world.setVehicleTuning(a.id, { strength: 5, bias: 1.5 })

    expect(a.strength).toBeCloseTo(5)
    expect(a.bias).toBeCloseTo(1.5)
    expect(a.weights.leftToLeft).toBeCloseTo(5) // excitatory → +strength
    expect(a.weights.bias).toBeCloseTo(1.5)
    // the untouched vehicle keeps its own tuning
    expect(b.strength).toBeCloseTo(DEFAULT_STRENGTH)
    expect(b.weights.leftToLeft).toBeCloseTo(bWeightBefore)
  })

  it('retuning refreshes actuator values, so the inspector equation stays true while paused', () => {
    const world = new VehicleWorld()
    world.addSource(0, 0.7, 3, 1)
    const v = world.addVehicle('aggression', '#fff', {
      x: 0,
      z: 0,
      heading: Math.PI / 2,
    })
    world.step(0.1) // populate sensors + actuators
    const before = v.actuators.left

    world.setVehicleTuning(v.id, { strength: 5 })

    // The actuator must equal its own equation: bias + Σ(weight × sensor).
    // If retune only touched the weights, this would still hold the old value.
    const w = v.weights
    expect(v.actuators.left).toBeCloseTo(
      v.bias + w.leftToLeft * v.sensors.left + w.rightToLeft * v.sensors.right,
    )
    expect(v.actuators.right).toBeCloseTo(
      v.bias + w.leftToRight * v.sensors.left + w.rightToRight * v.sensors.right,
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

describe('weights as the general form of a wiring', () => {
  /**
   * The wiring diagram now draws from the weight matrix alone, and decides
   * whether to draw a connection by whether its weight is exactly zero. That
   * only shows a Module 1 vehicle correctly if the sparse patterns really do
   * zero their absent connections rather than merely making them small — so
   * pin it here, where breaking it is visible.
   */
  it('sparse patterns zero their absent connections exactly', () => {
    const ipsi = weightsFromWiring({ pattern: 'ipsilateral', sign: 1 }, 2.4, 0.6)
    expect(ipsi.leftToRight).toBe(0)
    expect(ipsi.rightToLeft).toBe(0)

    const contra = weightsFromWiring({ pattern: 'contralateral', sign: -1 }, 2.4, 0.6)
    expect(contra.leftToLeft).toBe(0)
    expect(contra.rightToRight).toBe(0)

    const full = weightsFromWiring({ pattern: 'full', sign: 1 }, 2.4, 0.6)
    for (const w of [full.leftToLeft, full.leftToRight, full.rightToLeft, full.rightToRight]) {
      expect(w).not.toBe(0)
    }
  })
})

describe('the world as a population substrate', () => {
  const facingSource = (world: VehicleWorld) => {
    world.addSource(0, 0.7, 4, 1)
    return world
  }

  it('a weights-only vehicle runs the same arithmetic as a preset one', () => {
    // The one-engine claim, at its narrowest: a creature built from four
    // numbers and one built from a named variety must produce the same
    // actuator values, because they are the same body running the same map.
    const preset = facingSource(new VehicleWorld())
    const p = preset.addVehicle('aggression', '#fff', { x: 0, z: 0, heading: Math.PI / 2 })

    const genomic = facingSource(new VehicleWorld())
    const g = genomic.addWeightedVehicle(
      { ...p.weights },
      '#fff',
      { x: 0, z: 0, heading: Math.PI / 2 },
    )

    for (let i = 0; i < 50; i++) {
      preset.step(0.05)
      genomic.step(0.05)
    }
    expect(g.state.x).toBeCloseTo(p.state.x, 9)
    expect(g.state.z).toBeCloseTo(p.state.z, 9)
    expect(g.actuators.left).toBeCloseTo(p.actuators.left, 9)
  })

  it('zero sensor noise leaves Module 1 bit-for-bit unchanged', () => {
    // Even with an rng attached: at noise 0 the world must not draw from the
    // stream at all, or M1 would move and every downstream draw would shift.
    const run = (rng: ReturnType<typeof makeRng> | null) => {
      const world = facingSource(new VehicleWorld({ ...DEFAULT_WORLD_PARAMS }, rng))
      const v = world.addVehicle('aggression', '#fff', { x: 0, z: 0, heading: 1 })
      for (let i = 0; i < 100; i++) world.step(0.05)
      return v.state
    }
    const without = run(null)
    const withRng = run(makeRng(1))
    expect(withRng.x).toBe(without.x)
    expect(withRng.z).toBe(without.z)
    expect(withRng.heading).toBe(without.heading)
  })

  it('sensor noise perturbs the run but replays exactly from the same seed', () => {
    const run = (seed: number, noise: number) => {
      const world = facingSource(
        new VehicleWorld({ ...DEFAULT_WORLD_PARAMS, sensorNoise: noise }, makeRng(seed)),
      )
      const v = world.addVehicle('aggression', '#fff', { x: 0, z: 0, heading: 1 })
      for (let i = 0; i < 100; i++) world.step(0.05)
      return v.state
    }
    const clean = run(5, 0)
    const noisy = run(5, 0.3)
    const noisyAgain = run(5, 0.3)

    expect(noisy.x).not.toBeCloseTo(clean.x, 3) // noise actually did something
    expect(noisyAgain.x).toBe(noisy.x) // ...and it is replayable
    expect(noisyAgain.heading).toBe(noisy.heading)
  })

  it('never reports a negative sensor reading, however noisy', () => {
    const world = new VehicleWorld(
      { ...DEFAULT_WORLD_PARAMS, sensorNoise: 2 },
      makeRng(3),
    )
    const v = world.addVehicle('love', '#fff', { x: 0, z: 0, heading: 0 })
    for (let i = 0; i < 500; i++) {
      world.step(0.02)
      expect(v.sensors.left).toBeGreaterThanOrEqual(0)
      expect(v.sensors.right).toBeGreaterThanOrEqual(0)
    }
  })
})
