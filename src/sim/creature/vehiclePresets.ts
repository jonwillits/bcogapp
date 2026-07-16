import type { Wiring } from '../neural/sensorimotor'

/**
 * The six varieties: every combination of the three wiring patterns
 * (ipsilateral / contralateral / fully-connected) with the two connection signs
 * (excitatory / inhibitory). The `a` and `b` forms are Braitenberg's classic
 * vehicles 2 and 3; the `c` forms are the fully-connected case, which he does
 * not number but which is the general form the later modules build on.
 *
 * Whether a given wiring approaches or avoids also depends on the falloff and
 * connection strength, but with the defaults here each preset shows its characteristic
 * behavior.
 *
 * NOTE: `name` and `description` are "personality" labels kept here as an
 * answer-key reference. The lab deliberately does NOT show them — the UI
 * exposes only the neutral `label` (2a/2b/2c/3a/3b/3c) so students infer the
 * behavior→wiring relationship themselves. `color` is a non-semantic identifier
 * (chosen NOT to hint at behavior, e.g. aggression is not red).
 */
export interface VehiclePreset {
  id: string
  name: string
  /** Vehicle designation (2a/2b/2c/3a/3b/3c) — the only label shown in-app. */
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
      'Ipsilateral + excitatory. Each sensor speeds up the actuator on its own side, so the vehicle turns away from a source and flees — fastest when close.',
    color: '#4f9cff',
    wiring: { pattern: 'ipsilateral', sign: 1 },
  },
  {
    id: 'aggression',
    name: 'Aggression',
    label: '2b',
    description:
      'Contralateral + excitatory. Each sensor speeds up the opposite actuator, so the vehicle turns toward a source and charges into it, accelerating as it nears.',
    color: '#c084fc',
    wiring: { pattern: 'contralateral', sign: 1 },
  },
  {
    id: 'excitement',
    name: 'Excitement',
    label: '2c',
    description:
      'Fully connected + excitatory. Both sensors speed up both actuators equally, so there is no left/right difference to steer with: it drives straight and simply speeds up near a source, never turning toward or away.',
    color: '#94a3b8',
    wiring: { pattern: 'full', sign: 1 },
  },
  {
    id: 'love',
    name: 'Love',
    label: '3a',
    description:
      'Ipsilateral + inhibitory. Stimulus slows the same-side actuator, so the vehicle turns toward a source, slows, and comes to rest facing it.',
    color: '#2dd4bf',
    wiring: { pattern: 'ipsilateral', sign: -1 },
  },
  {
    id: 'explorer',
    name: 'Explorer',
    label: '3b',
    description:
      'Contralateral + inhibitory. Stimulus slows the opposite actuator, so the vehicle lingers near a source but keeps moving, wandering off to find others.',
    color: '#f472b6',
    wiring: { pattern: 'contralateral', sign: -1 },
  },
  {
    id: 'caution',
    name: 'Caution',
    label: '3c',
    description:
      'Fully connected + inhibitory. Both sensors slow both actuators equally, so again it cannot steer: it drives straight, slowing near a source and backing away once the inhibition exceeds its actuator bias.',
    color: '#a3e635',
    wiring: { pattern: 'full', sign: -1 },
  },
]

export const DEFAULT_PRESET_ID = 'aggression'

export function getPreset(id: string): VehiclePreset {
  return VEHICLE_PRESETS.find((p) => p.id === id) ?? VEHICLE_PRESETS[0]
}
