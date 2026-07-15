import type { Wiring } from '../neural/sensorimotor'

/**
 * The four classic Braitenberg vehicles (his vehicles 2 and 3), each defined by
 * a wiring choice. The emergent "personality" names are Braitenberg's own.
 * Whether a given wiring approaches or avoids also depends on the falloff and
 * gain, but with the defaults here each preset shows its classic behavior.
 */
export interface VehiclePreset {
  id: string
  name: string
  /** Braitenberg's vehicle number (2a/2b/3a/3b). */
  label: string
  description: string
  wiring: Wiring
}

export const VEHICLE_PRESETS: VehiclePreset[] = [
  {
    id: 'fear',
    name: 'Fear',
    label: '2a',
    description:
      'Uncrossed + excitatory. Each sensor speeds up the motor on its own side, so the vehicle turns away from a source and flees — fastest when close.',
    wiring: { crossed: false, sign: 1 },
  },
  {
    id: 'aggression',
    name: 'Aggression',
    label: '2b',
    description:
      'Crossed + excitatory. Each sensor speeds up the opposite motor, so the vehicle turns toward a source and charges into it, accelerating as it nears.',
    wiring: { crossed: true, sign: 1 },
  },
  {
    id: 'love',
    name: 'Love',
    label: '3a',
    description:
      'Uncrossed + inhibitory. Stimulus slows the same-side motor, so the vehicle turns toward a source, slows, and comes to rest facing it.',
    wiring: { crossed: false, sign: -1 },
  },
  {
    id: 'explorer',
    name: 'Explorer',
    label: '3b',
    description:
      'Crossed + inhibitory. Stimulus slows the opposite motor, so the vehicle lingers near a source but keeps moving, wandering off to find others.',
    wiring: { crossed: true, sign: -1 },
  },
]

export const DEFAULT_PRESET_ID = 'aggression'

export function getPreset(id: string): VehiclePreset {
  return VEHICLE_PRESETS.find((p) => p.id === id) ?? VEHICLE_PRESETS[0]
}
