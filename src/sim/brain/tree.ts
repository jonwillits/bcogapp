/**
 * The Tree tab's data: a cladogram of the specimen lineages, the trait cards,
 * and the answer key (spec §7).
 *
 * The tips are lineages, not the gallery's specimens: the bird tip is
 * *a bird*, not the kiwi. The invertebrate sits outside the vertebrates as an
 * outgroup, and no vertebrate trait card may be placed on its branch.
 *
 * A student places every card freely, on as many branches as they like, and
 * nothing is marked until *Reveal the answer* (proposal decision 8). The key
 * is what the chapter states, claim by claim, and two cards are traps with a
 * lesson in them: the pallium belongs at the root because the lamprey has
 * one, and the amygdala-like region has no settled answer at the root.
 */

export type BranchId =
  | 'root'
  | 'outgroup'
  | 'vertebrates'
  | 'lamprey'
  | 'jawed'
  | 'shark'
  | 'bonyVertebrates'
  | 'bonyFish'
  | 'tetrapods'
  | 'frog'
  | 'amniotes'
  | 'sauropsids'
  | 'lizard'
  | 'bird'
  | 'mammals'
  | 'platypus'
  | 'therians'
  | 'kangaroo'
  | 'placentals'
  | 'dolphin'
  | 'ratAndPrimates'
  | 'rat'
  | 'primates'
  | 'chimpanzee'
  | 'human'

export interface TreeNode {
  id: BranchId
  /** Printed at a tip; a branch's description otherwise. */
  label: string
  children: TreeNode[]
}

const tip = (id: BranchId, label: string): TreeNode => ({ id, label, children: [] })
const node = (id: BranchId, label: string, ...children: TreeNode[]): TreeNode => ({ id, label, children })

/**
 * §7.1's topology:
 * (invertebrate outgroup, (lamprey, (shark, (bony fish, (frog, ((lizard, bird),
 *   (platypus, (kangaroo, (dolphin, (rat, (chimpanzee, human)))))))))))
 *
 * The root itself is not a branch: a card cannot be placed above the split
 * between the outgroup and the vertebrates.
 */
export const TREE: TreeNode = node(
  'root', // never placeable, never listed
  'root',
  tip('outgroup', 'an invertebrate (outgroup)'),
  node(
    'vertebrates',
    'all vertebrates: lamprey and everything after',
    tip('lamprey', 'lamprey'),
    node(
      'jawed',
      'jawed vertebrates: shark and everything after',
      tip('shark', 'a shark'),
      node(
        'bonyVertebrates',
        'bony fish and the land vertebrates',
        tip('bonyFish', 'a bony fish'),
        node(
          'tetrapods',
          'land vertebrates: frog and everything after',
          tip('frog', 'a frog'),
          node(
            'amniotes',
            'lizard, bird and the mammals',
            node('sauropsids', 'lizard and bird', tip('lizard', 'a lizard'), tip('bird', 'a bird')),
            node(
              'mammals',
              'mammals: platypus and everything after',
              tip('platypus', 'platypus'),
              node(
                'therians',
                'kangaroo and the placental mammals',
                tip('kangaroo', 'kangaroo'),
                node(
                  'placentals',
                  'placental mammals: dolphin and everything after',
                  tip('dolphin', 'dolphin'),
                  node(
                    'ratAndPrimates',
                    'rat, chimpanzee and human',
                    tip('rat', 'rat'),
                    node('primates', 'chimpanzee and human', tip('chimpanzee', 'chimpanzee'), tip('human', 'human')),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  ),
)

/** Newick form of the topology, for the test that pins it to §7.1. */
export function newick(n: TreeNode = TREE): string {
  if (n.children.length === 0) return n.label
  return `(${n.children.map(newick).join(', ')})`
}

/** Every placeable branch: every node below the root, in drawing order. */
export function branches(n: TreeNode = TREE): TreeNode[] {
  const out: TreeNode[] = []
  const walk = (x: TreeNode, isRoot: boolean) => {
    if (!isRoot) out.push(x)
    x.children.forEach((c) => walk(c, false))
  }
  walk(n, true)
  return out
}

export function branch(id: BranchId): TreeNode {
  const b = branches().find((x) => x.id === id)
  if (!b) throw new Error(`no branch ${id}`)
  return b
}

/** The tip labels under a branch, in order. */
export function tipsUnder(id: BranchId): string[] {
  const out: string[] = []
  const walk = (x: TreeNode) => {
    if (x.children.length === 0) out.push(x.label)
    x.children.forEach(walk)
  }
  walk(branch(id))
  return out
}

/** Tip ids in left-to-right drawing order. */
export function tipOrder(): BranchId[] {
  return branches()
    .filter((b) => b.children.length === 0)
    .map((b) => b.id)
}

export type CardId =
  | 'tectum'
  | 'basalGangliaTwoPathways'
  | 'pallium'
  | 'cerebellum'
  | 'sixLayers'
  | 'dividedOutput'
  | 'corpusCallosum'
  | 'amygdalaLike'
  | 'largeBrain'

export interface Card {
  id: CardId
  label: string
  /** The branches the key places this card on. More than one means more than one origin. */
  key: BranchId[]
  /** Branches the chapter leaves open: neither right nor wrong. */
  notSettled?: BranchId[]
  claims: string[]
  /** The reveal's one extra line, if the key needs one. */
  revealLine?: string
}

export const CARDS: readonly Card[] = [
  {
    id: 'tectum',
    label: 'A tectum that maps space and orients the animal',
    key: ['vertebrates'],
    claims: ['§6.1.8-C8', '§6.3.5-C20'],
  },
  {
    id: 'basalGangliaTwoPathways',
    label: 'Basal ganglia with two opposed pathways',
    key: ['vertebrates'],
    claims: ['§6.1.8-C24', '§6.2.10-C1'],
    revealLine: 'A lamprey’s selection circuitry and a mouse’s are nearly the same. The design was not improved; it was copied.',
  },
  {
    id: 'pallium',
    label: 'A pallium',
    key: ['vertebrates'],
    claims: ['§6.1.8-C15', '§6.1.8-C16'],
    revealLine: 'The lamprey has one: thin, with three layers. What changed later is what the pallium is made of, not whether there is one.',
  },
  {
    id: 'cerebellum',
    label: 'A cerebellum',
    key: ['jawed'],
    claims: ['§6.1.8-C19', '§6.1.8-C20', '§6.1.8-C28'],
    revealLine:
      'A 2026 study reports a small cerebellum-like region in the lamprey, without the layered structure of a jawed vertebrate’s cerebellum. Whether it counts as a simple cerebellum is debated.',
  },
  {
    id: 'sixLayers',
    label: 'A six-layered pallium (neocortex)',
    key: ['mammals'],
    claims: ['§6.3.4-C6', '§6.3.5-C7'],
  },
  {
    id: 'dividedOutput',
    label: 'Basal ganglia output nucleus divided in two',
    key: ['mammals'],
    claims: ['§6.3.5-C4'],
  },
  {
    id: 'corpusCallosum',
    label: 'A corpus callosum',
    key: ['placentals'],
    claims: ['§6.3.6-C20', '§6.3.6-C21', '§6.3.5-C22'],
    revealLine: 'The platypus and the kangaroo connect their hemispheres through smaller commissures instead. So do birds and fishes.',
  },
  {
    id: 'amygdalaLike',
    label: 'An amygdala-like region',
    key: ['jawed'],
    notSettled: ['vertebrates'],
    claims: ['§6.3.3-C13', '§6.3.3-C14'],
    revealLine:
      'Whether a lamprey has an amygdala-like region is not settled, so the chapter’s claim is about jawed vertebrates. A placement at the root is neither right nor wrong.',
  },
  {
    id: 'largeBrain',
    label: 'A large brain for its body size',
    key: ['bird', 'dolphin', 'primates'],
    claims: ['§6.3.5-C10', '§6.3.5-C9'],
    revealLine:
      'It cannot be placed once. Relative brain size increased independently in every major group, and some sharks and bony fishes not in this set are large-brained too. Among birds it is parrots and crows that have large brains for their size, not every bird.',
  },
] as const

export function card(id: CardId): Card {
  const c = CARDS.find((x) => x.id === id)
  if (!c) throw new Error(`no card ${id}`)
  return c
}

/** §6.1.8-C2, on screen from the start. */
export const RULE_LINE =
  'A part two species both have was most likely present in their common ancestor. A part only one has most likely arose after the split.'

/** The student's placements: card → branches. */
export type Placements = Record<CardId, BranchId[]>

export function emptyPlacements(): Placements {
  const p = {} as Placements
  for (const c of CARDS) p[c.id] = []
  return p
}

/**
 * Add a placement, or remove it if it is already there. The outgroup refuses
 * every card: every card is a vertebrate trait (§7.1).
 */
export function togglePlacement(p: Placements, c: CardId, b: BranchId): { placements: Placements; refused?: string } {
  if (b === 'outgroup') {
    return { placements: p, refused: 'The invertebrate is the outgroup. Every card is a vertebrate trait, so none can go on its branch.' }
  }
  const have = p[c].includes(b)
  return { placements: { ...p, [c]: have ? p[c].filter((x) => x !== b) : [...p[c], b] } }
}

export function allPlaced(p: Placements): boolean {
  return CARDS.every((c) => p[c.id].length > 0)
}

export type Mark = 'match' | 'miss' | 'notSettled'

export interface CardVerdict {
  card: Card
  /** One mark per placement the student made. */
  placed: { branch: BranchId; mark: Mark }[]
  /** Key branches the student did not place on. */
  missed: BranchId[]
  /** For the large-brain card: how many separate origins the student used, and how many the key uses. */
  origins: { used: number; key: number }
}

/** The reveal: the key drawn over the student's placements, branch by branch. */
export function reveal(p: Placements): CardVerdict[] {
  return CARDS.map((c) => {
    const placed = p[c.id].map((b) => ({
      branch: b,
      mark: (c.key.includes(b) ? 'match' : c.notSettled?.includes(b) ? 'notSettled' : 'miss') as Mark,
    }))
    const missed = c.key.filter((k) => !p[c.id].includes(k))
    return { card: c, placed, missed, origins: { used: p[c.id].length, key: c.key.length } }
  })
}
