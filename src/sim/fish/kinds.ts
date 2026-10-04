import type { Rng } from '../random'

/**
 * The kinds of thing in the stream. Each has a typical smell — a point in the
 * two-receptor smell space — and an outcome.
 *
 * **Danger is the outcome, not a property of a receptor.** A receptor is a
 * number with no flag on it saying good or bad; what an encounter leads to is
 * a rule of the world, carried here on the kind of thing and nowhere on the
 * channel (Lab 4's rule, kept).
 */

export type KindId =
  | 'eel'
  | 'sucker'
  | 'pike'
  | 'chub'
  | 'twig'
  | 'ripe-a'
  | 'ripe-b'
  | 'rotting'
  | 'fruit-right'
  | 'fruit-wrong'

export interface Kind {
  id: KindId
  label: string
  /** Its typical smell near the fish, or null when it is spread over a region (the island). */
  typical: readonly [number, number] | null
  /** Whether the outcome the output unit predicts happens: a lunge, or a nourishing fruit. */
  happens: boolean
  /** What the world does, in a line. */
  does: string
  /** Whether an encounter the fish gets wrong costs it: a strike, or a sickening fruit. */
  harms: boolean
  color: string
}

/** The island: nourishing only within this distance of (0.5, 0.5). */
export const ISLAND_CENTER = 0.5
export const ISLAND_RADIUS = 0.25

export const KINDS: Record<KindId, Kind> = {
  eel: { id: 'eel', label: 'eel', typical: [0.75, 0.45], happens: true, does: 'An eel lunges.', harms: true, color: '#ff6b6b' },
  sucker: {
    id: 'sucker',
    label: 'sucker',
    typical: [0.45, 0.6],
    happens: false,
    does: 'A sucker drifts past. It is harmless.',
    harms: false,
    color: '#5fb3ff',
  },
  pike: { id: 'pike', label: 'pike', typical: [0.15, 0.9], happens: true, does: 'A pike lunges.', harms: true, color: '#ffa94d' },
  chub: {
    id: 'chub',
    label: 'chub',
    typical: [0.95, 0.1],
    happens: false,
    does: 'A chub drifts past. It is harmless.',
    harms: false,
    color: '#63e6be',
  },
  twig: {
    id: 'twig',
    label: 'twig or leaf',
    typical: [0.15, 0.15],
    happens: false,
    does: 'A twig or leaf is nothing to eat.',
    harms: false,
    color: '#9aa5b1',
  },
  'ripe-a': {
    id: 'ripe-a',
    label: 'ripe fruit, first kind',
    typical: [0.85, 0.15],
    happens: true,
    does: 'Ripe fruit of the first kind nourishes.',
    harms: false,
    color: '#ffd43b',
  },
  'ripe-b': {
    id: 'ripe-b',
    label: 'ripe fruit, second kind',
    typical: [0.15, 0.85],
    happens: true,
    does: 'Ripe fruit of the second kind nourishes.',
    harms: false,
    color: '#fab005',
  },
  rotting: {
    id: 'rotting',
    label: 'rotting fruit',
    typical: [0.85, 0.85],
    happens: false,
    does: 'Rotting fruit sickens.',
    harms: true,
    color: '#b197fc',
  },
  'fruit-right': {
    id: 'fruit-right',
    label: 'fruit at the right strength',
    typical: null,
    happens: true,
    does: 'Fruit whose smell lies within 0.25 of (0.5, 0.5) nourishes.',
    harms: false,
    color: '#ffd43b',
  },
  'fruit-wrong': {
    id: 'fruit-wrong',
    label: 'fruit too weak or too strong',
    typical: null,
    happens: false,
    does: 'Fruit whose smell lies farther out than that sickens.',
    harms: true,
    color: '#b197fc',
  },
}

/** How much every smell is weakened far from the fish. */
export const FAR_DILUTION = 0.3
/**
 * Moment-to-moment noise on every sniff, on top of how much one eel differs
 * from the next. It does not shrink with distance; what one eel's smell is
 * like does.
 */
export const SNIFF_JITTER = 0.02

export const SPREAD_RANGE = { min: 0.04, max: 0.2, step: 0.01 } as const
export const POOL_RANGE = { min: 6, max: 60, step: 2 } as const
export const BASE_RATE_RANGE = { min: 0.1, max: 0.9, step: 0.05 } as const

export function clip01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

function insideIsland(x1: number, x2: number): boolean {
  return Math.hypot(x1 - ISLAND_CENTER, x2 - ISLAND_CENTER) < ISLAND_RADIUS
}

/**
 * What one individual of a kind typically smells like: the kind's typical
 * smell, moved by `spread`. For the island it is a point drawn evenly from
 * the kind's region.
 */
export function drawIndividual(kind: Kind, spread: number, rng: Rng): [number, number] {
  if (kind.typical === null) {
    const wantInside = kind.id === 'fruit-right'
    for (;;) {
      const x1 = rng.next()
      const x2 = rng.next()
      if (insideIsland(x1, x2) === wantInside) return [x1, x2]
    }
  }
  return [kind.typical[0] + spread * rng.normal(), kind.typical[1] + spread * rng.normal()]
}

/** One sniff of an individual, at a distance: its smell diluted, then the sniff's own jitter, held in [0, 1]. */
export function sniff(kind: Kind, individual: readonly [number, number], far: boolean, rng: Rng): [number, number] {
  if (kind.typical === null) return [individual[0], individual[1]]
  const d = far ? FAR_DILUTION : 1
  return [
    clip01(d * individual[0] + SNIFF_JITTER * rng.normal()),
    clip01(d * individual[1] + SNIFF_JITTER * rng.normal()),
  ]
}
