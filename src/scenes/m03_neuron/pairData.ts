import type { NeuronWorld } from '../../sim/neuron/neuronWorld'
import { wheelSpeeds } from '../../sim/creature/vehicle'
import type { Side } from './PairDiagram'

/** Everything the two-cell picture reads off the world, in one place. */
export function pairData(world: NeuronWorld) {
  const ws = wheelSpeeds(world.vehicle.actuators, world.vehicle.config)
  const l = world.left.cell
  const r = world.right.cell
  return {
    wiring: world.unit,
    sensors: { left: world.vehicle.sensors.left, right: world.vehicle.sensors.right },
    rates: {
      left: [l.input.x[0], l.input.x[1]] as [number, number],
      right: [r.input.x[0], r.input.x[1]] as [number, number],
    },
    outputs: { left: l.outputRate(), right: r.outputRate() },
    wheels: { left: ws.left, right: ws.right },
    profiles: { left: l.profile(), right: r.profile() },
    wrapped: (i: number) => l.isWrapped(i),
    fromSensors: world.inputSource === 'sensors',
  }
}

/** The cell the instruments below the picture show. */
export function cellOn(world: NeuronWorld, side: Side) {
  return side === 'left' ? world.left.cell : world.right.cell
}
