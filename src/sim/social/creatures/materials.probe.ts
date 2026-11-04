import { describe, it } from 'vitest'
import { MATERIALS, PATCH_NAMES, roundMaterials, testItems, trainingMembers } from './materials'

/** Prints the materials for the walk-through: PROBE=1 PROBE_DIR=src/sim/social/creatures npx vitest run --disable-console-intercept -t "materials:" */
describe('materials:', () => {
  it('every family of both pairs: the members, the changed items, the new items', () => {
    const out: string[] = []
    MATERIALS.forEach((pair, slot) => {
      out.push(`\n**${slot === 0 ? 'The main pair' : 'The reserve pair'}** (names ${pair.names.join(' and ')}; the marking–color pairing of the tall group shifted by ${pair.shift}):`)
      for (const family of pair.families) {
        const members = trainingMembers(family, pair.shift)
        const items = testItems(members, family.base)
        out.push(`\n- *${family.family}*, body hue ${family.hue}, base ${family.base} px. Members (id: group, height, marking, color): ${members.map((m) => `${m.id}: ${m.group === 0 ? 'short' : 'tall'} ${m.height.toFixed(1)} ${m.marking} ${PATCH_NAMES[m.patch]}`).join('; ')}.`)
        out.push(`  Changed-detail items (from member → feature now): ${items.filter((i) => i.kind === 'changed').map((i) => `${i.id}: from ${i.member}, ${i.changed} now ${i.changed === 'marking' ? i.marking : PATCH_NAMES[i.patch]}`).join('; ')}.`)
        out.push(`  New typical items (group, height, marking, color): ${items.filter((i) => i.kind === 'new').map((i) => `${i.id}: ${i.group === 0 ? 'short' : 'tall'} ${i.height.toFixed(1)} ${i.marking} ${PATCH_NAMES[i.patch]}`).join('; ')}.`)
      }
    })
    const r = roundMaterials(1, 0, 0)
    out.push(`\nSeed 1, Round 1: family ${r.family.family}; training order ${r.training.join(' ')}; memory order ${r.memoryOrder.join(' ')}.`)
    console.log(out.join('\n'))
  })
})
