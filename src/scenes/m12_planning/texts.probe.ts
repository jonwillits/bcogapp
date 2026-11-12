import { describe, it } from 'vitest'
import { OPEN_INTRO } from './Part0'
import { SCREENS as P1 } from './choices/screens'
import { SCREENS as P2, PROCEDURE_PREDICTIONS, NEXT_LINE as N2 } from './puzzles/screens'
import { SCREENS as P3, NEXT_LINE as N3, TEST_DESCRIPTION, TEST_TAKES_AWAY, PROCEDURE_DESCRIPTIONS, ERECTUS_CARD, THREE_STUDIES } from './band/screens'
import { SCREENS as P4, NEXT_LINE as N4 } from './corn/screens'
import { PREDICTIONS as P4_PREDICTIONS } from './corn/store'
import * as L from './lines'
import { PROCEDURES } from '../../sim/planning/puzzles/procedures'
import { LOOKER_LABEL, LOOKER_RULE } from '../../sim/planning/puzzles/lookers'
import { DISPENSER_RULE } from '../../sim/planning/choices/dispensers'
import { FRAMING, ANCHOR } from '../../sim/planning/choices/gambles'

/**
 * Prints every instruction screen and every fixed line as Markdown, for
 * the as-built notes' §1a: PROBE=1 PROBE_DIR=src/scenes/m12_planning npx vitest run --disable-console-intercept -t "texts:"
 */
const para = (lines: readonly string[]) => lines.map((l) => (l.startsWith('- ') ? `  - *${l.slice(2)}*` : `*${l}*`)).join(' / ')

describe('texts:', () => {
  it('every instruction screen and fixed line', () => {
    const out: string[] = []
    out.push(`**Part 0.** ${para(OPEN_INTRO.lines)} + ${OPEN_INTRO.content.map((c) => `*${c}*`).join(' ')} ${OPEN_INTRO.time} Footer: *${OPEN_INTRO.footer}*\n`)
    for (const s of Object.values(P1)) out.push(`**Part 1, ${s.title}.** ${para(s.willDo)} About ${s.minutes} minutes; ${s.sitting}: *${s.sittingLine}* Keys: ${para(s.keys)} When you are done: *${s.next}*${s.content.length ? ' Content: ' + s.content.map((c) => `*${c}*`).join(' ') : ''}\n`)
    for (const s of Object.values(P2)) out.push(`**Part 2, ${s.title}.** ${para(s.willDo)} About ${s.minutes} minutes; ${s.sitting}: *${s.sittingLine}* Keys: ${para(s.keys)} When you are done: *${N2[s.step]}*\n`)
    out.push(`**Part 2, the predictions before each procedure’s first run:** ${Object.values(PROCEDURE_PREDICTIONS).map((p) => `*${p.question}* [${p.choices.join(' / ')}]`).join('; ')}\n`)
    for (const s of Object.values(P3)) out.push(`**Part 3, ${s.title}.** ${s.reread ? `*${s.reread}* ` : ''}${para(s.willDo)} About ${s.minutes} minutes; ${s.sitting}: *${s.sittingLine}* Keys: ${para(s.keys)} When you are done: *${N3[s.step]}*${s.content.length ? ' Content: ' + s.content.map((c) => `*${c}*`).join(' ') : ''}${s.predictions.length ? ' Predictions: ' + s.predictions.map((p) => `*${p.question}* [${p.choices.join(' / ')}]`).join('; ') : ''}\n`)
    for (const s of Object.values(P4)) out.push(`**Part 4, ${s.title}.** ${para(s.willDo)} About ${s.minutes} minutes; leave any time. When you are done: *${N4[s.step]}*${s.content.length ? ' Content: ' + s.content.map((c) => `*${c}*`).join(' ') : ''}\n`)
    out.push(`**Part 4, the predictions:** ${Object.values(P4_PREDICTIONS).map((p) => `*${p.question}* [${p.choices.join(' / ')}]`).join('; ')}\n`)
    out.push('\n**The fixed lines (§10):**\n')
    for (const [k, v] of Object.entries(L)) if (typeof v === 'string') out.push(`- \`${k}\`: *${v}*`)
    out.push('\n**The framing problem, both versions, and the reserve:**\n')
    for (const [name, f] of Object.entries(FRAMING)) out.push(`- ${name}: *${f.intro}* Saved: ${f.saved.join(' / ')} Lost: ${f.lost.join(' / ')} *${f.question}*`)
    out.push(`- The wheel’s quantities: published, *${ANCHOR.published.quantity}*; reserve, *${ANCHOR.reserve.quantity}*; the wheel stops at ${ANCHOR.anchors.join(' or ')}.`)
    out.push('\n**The dispensers’ rules (on the reveal):**\n')
    for (const [k, v] of Object.entries(DISPENSER_RULE)) out.push(`- ${k}: ${v}`)
    out.push('\n**The five procedures on the puzzle:**\n')
    for (const p of Object.values(PROCEDURES)) out.push(`- ${p.label}: ${p.does} Stores ${p.stores}. Source: ${p.source}.`)
    out.push('\n**The three lookers:**\n')
    for (const k of Object.keys(LOOKER_LABEL) as (keyof typeof LOOKER_LABEL)[]) out.push(`- ${LOOKER_LABEL[k]}: ${LOOKER_RULE[k]}`)
    out.push('\n**The tests, as the menu describes them, and what each takes away (after the commit):**\n')
    for (const t of Object.keys(TEST_DESCRIPTION)) out.push(`- ${t}: ${TEST_DESCRIPTION[t]} Takes away: ${TEST_TAKES_AWAY[t]}`)
    out.push('\n**The five hominins, as the diagnosis lists them (names added after the commit):**\n')
    for (const [k, v] of Object.entries(PROCEDURE_DESCRIPTIONS)) out.push(`- ${k}: ${v}`)
    out.push(`\n**The information card:** ${ERECTUS_CARD.title}. ${ERECTUS_CARD.lines.join(' ')}\n`)
    out.push(`**Three studies from the reading:** ${THREE_STUDIES.join(' ')}\n`)
    console.log(out.join('\n'))
  })
})
