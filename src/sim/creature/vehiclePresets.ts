import type { Wiring } from '../neural/sensorimotor'

/**
 * The four classic Braitenberg vehicles (his vehicles 2 and 3), each defined by
 * a wiring choice. Whether a given wiring approaches or avoids also depends on
 * the falloff and gain, but with the defaults here each preset shows its
 * classic behavior.
 *
 * NOTE: `name` and `description` are Braitenberg's "personality" labels kept
 * here as an answer-key reference. The lab deliberately does NOT show them —
 * the UI exposes only the neutral `label` (2a/2b/3a/3b) so students infer the
 * behavior→wiring relationship themselves. `color` is a non-semantic identifier
 * (chosen NOT to hint at behavior, e.g. aggression is not red).
 */
export interface VehiclePreset {
  id: string
  name: string
  /** Braitenberg's vehicle number (2a/2b/3a/3b) — the only label shown in-app. */
  label: string
  description: string
  /** Phenotype identity color, shown on the vehicle and in the legend. */
  color: string
  wiring: Wiring
}

export const VEHICLE_PRESETS: VehiclePreset[] = [
  {
    id: 'fear',
    name: 'Fear',
    label: '2a',
    description:
      'Uncrossed + excitatory. Each sensor speeds up the actuator on its own side, so the vehicle turns away from a source and flees — fastest when close.',
    color: '#4f9cff',
    wiring: { crossed: false, sign: 1 },
  },
  {
    id: 'aggression',
    name: 'Aggression',
    label: '2b',
    description:
      'Crossed + excitatory. Each sensor speeds up the opposite actuator, so the vehicle turns toward a source and charges into it, accelerating as it nears.',
    color: '#c084fc',
    wiring: { crossed: true, sign: 1 },
  },
  {
    id: 'love',
    name: 'Love',
    label: '3a',
    description:
      'Uncrossed + inhibitory. Stimulus slows the same-side actuator, so the vehicle turns toward a source, slows, and comes to rest facing it.',
    color: '#2dd4bf',
    wiring: { crossed: false, sign: -1 },
  },
  {
    id: 'explorer',
    name: 'Explorer',
    label: '3b',
    description:
      'Crossed + inhibitory. Stimulus slows the opposite actuator, so the vehicle lingers near a source but keeps moving, wandering off to find others.',
    color: '#f472b6',
    wiring: { crossed: true, sign: -1 },
  },
]

export const DEFAULT_PRESET_ID = 'aggression'

export function getPreset(id: string): VehiclePreset {
  return VEHICLE_PRESETS.find((p) => p.id === id) ?? VEHICLE_PRESETS[0]
}
