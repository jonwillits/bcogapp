import { describe, it, expect } from 'vitest'
import { newick, branches, CARDS, card, emptyPlacements, togglePlacement, allPlaced, reveal, tipsUnder, tipOrder } from './tree'

/** The tree tests of the spec's §11. */
describe('the tree', () => {
  it('has the topology of §7.1', () => {
    expect(newick()).toBe(
      '(an invertebrate (outgroup), (lamprey, (a shark, (a bony fish, (a frog, ((a lizard, a bird), (platypus, (kangaroo, (dolphin, (rat, (chimpanzee, human)))))))))))',
    )
    expect(tipOrder()).toEqual(['outgroup', 'lamprey', 'shark', 'bonyFish', 'frog', 'lizard', 'bird', 'platypus', 'kangaroo', 'dolphin', 'rat', 'chimpanzee', 'human'])
  })

  it('tips are lineages, not the gallery’s specimens: the bird tip is “a bird”', () => {
    const labels = branches().filter((b) => b.children.length === 0).map((b) => b.label)
    expect(labels).toContain('a bird')
    expect(labels.join(' ')).not.toMatch(/kiwi|marmoset|manatee|sea lion|elephant|pig|sheep/)
    expect(labels.length).toBe(13)
  })

  it('the answer key matches §7.2 card for card', () => {
    const key = Object.fromEntries(CARDS.map((c) => [c.id, c.key]))
    expect(key).toEqual({
      tectum: ['vertebrates'],
      basalGangliaTwoPathways: ['vertebrates'],
      pallium: ['vertebrates'],
      cerebellum: ['jawed'],
      sixLayers: ['mammals'],
      dividedOutput: ['mammals'],
      corpusCallosum: ['placentals'],
      amygdalaLike: ['jawed'],
      largeBrain: ['bird', 'dolphin', 'primates'],
    })
    expect(card('amygdalaLike').notSettled).toEqual(['vertebrates'])
    expect(tipsUnder('jawed')[0]).toBe('a shark')
    expect(tipsUnder('placentals')).toEqual(['dolphin', 'rat', 'chimpanzee', 'human'])
    expect(tipsUnder('mammals')[0]).toBe('platypus')
  })

  it('the large-brain card’s key has three separate origins', () => {
    const lb = card('largeBrain')
    expect(lb.key.length).toBe(3)
    // No key branch is an ancestor of another: three origins, not one placement counted thrice.
    for (const a of lb.key) for (const b of lb.key) if (a !== b) expect(tipsUnder(a).some((t) => tipsUnder(b).includes(t)), `${a} vs ${b}`).toBe(false)
  })

  it('no vertebrate card is accepted on the outgroup branch', () => {
    let p = emptyPlacements()
    for (const c of CARDS) {
      const r = togglePlacement(p, c.id, 'outgroup')
      expect(r.refused).toMatch(/outgroup/)
      p = r.placements
      expect(p[c.id]).toEqual([])
    }
  })

  it('every card carries claim ids', () => {
    for (const c of CARDS) for (const id of c.claims) expect(id).toMatch(/^§6\.\d(\.\d+)?-C\d+$/)
  })

  it('placing is free until every card has a placement, then the reveal marks each one', () => {
    let p = emptyPlacements()
    expect(allPlaced(p)).toBe(false)
    p = togglePlacement(p, 'pallium', 'mammals').placements // the trap
    p = togglePlacement(p, 'amygdalaLike', 'vertebrates').placements // the open question
    p = togglePlacement(p, 'largeBrain', 'mammals').placements // once, where three are needed
    for (const c of CARDS) if (p[c.id].length === 0) p = togglePlacement(p, c.id, c.key[0]).placements
    expect(allPlaced(p)).toBe(true)
    const v = reveal(p)
    const by = (id: string) => v.find((x) => x.card.id === id)!
    expect(by('pallium').placed[0].mark).toBe('miss')
    expect(by('pallium').missed).toEqual(['vertebrates'])
    expect(by('amygdalaLike').placed[0].mark).toBe('notSettled')
    expect(by('amygdalaLike').missed).toEqual(['jawed'])
    expect(by('largeBrain').origins).toEqual({ used: 1, key: 3 })
    expect(by('tectum').placed[0].mark).toBe('match')
    // Toggling again removes a placement.
    p = togglePlacement(p, 'pallium', 'mammals').placements
    expect(p.pallium).toEqual([])
  })
})
