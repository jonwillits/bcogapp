import { describe, it } from 'vitest'
import { OPEN_INTRO } from './Part0'
import { PARTNERS_WILL_DO, PARTNERS_KEYS, MATCH_SITTING_LINE, DIAGNOSIS_WILL_DO, PARTNERS_MINUTES } from './partners/screens'
import { STEPS as P2 } from './tournament/steps'
import { FILMS_WILL_DO, FILMS_KEYS, FILMS_SITTING_LINE, PATHS_WILL_DO, PATHS_KEYS, PATHS_SITTING_LINE, FILMS_MINUTES, PATHS_MINUTES } from './shapes/screens'
import { MODELS_INTRO } from './shapes/Reveal'
import { STEPS as P4 } from './arena/steps'
import { GROUPS_WILL_DO, GROUPS_KEYS, GROUPS_SITTING_LINE, GROUPS_MINUTES } from './groups/screens'
import { STEPS as P6 } from './mirror/steps'
import * as L from './lines'
import { ANIMALS } from '../../sim/social/arena/animals'
import { RULES } from '../../sim/social/game/rules'
import { TESTS } from '../../sim/social/arena/trial'

/**
 * Prints every instruction screen and every fixed line as Markdown, for
 * the as-built notes' §1a: PROBE=1 PROBE_DIR=src/scenes/m11_social npx vitest run --disable-console-intercept -t "texts:"
 */
const para = (lines: string[]) => lines.map((l) => (l.startsWith('- ') ? `  - *${l.slice(2)}*` : `*${l}*`)).join(' / ')

describe('texts:', () => {
  it('every instruction screen and fixed line', () => {
    const out: string[] = []
    out.push(`**Part 0.** ${para(OPEN_INTRO.lines)} + *${OPEN_INTRO.content[0]}* ${OPEN_INTRO.time} Footer: *${OPEN_INTRO.footer}*\n`)
    out.push(`**Part 1 — Six Partners.** ${para(PARTNERS_WILL_DO)} About ${PARTNERS_MINUTES} minutes. Pausing: *${MATCH_SITTING_LINE}* Keys: ${para(PARTNERS_KEYS)} Content: *${L.LENGTH_LINE}* **The diagnosis.** ${para(DIAGNOSIS_WILL_DO)} About 3 minutes; one sitting, the same list unanswered.\n`)
    for (const s of P2) out.push(`**Part 2, ${s.title}.** ${s.reread ? `*${s.reread}* ` : ''}${para(s.willDo)} About ${s.minutes} minutes; leave any time.${s.content.length ? ' Content: ' + s.content.map((c) => `*${c}*`).join(' ') : ''} Predictions: ${s.predictions.map((p) => `*${p.question}* [${p.choices.join(' / ')}]`).join('; ')}\n`)
    out.push(`**Part 3, Step 1 — Three films.** ${para(FILMS_WILL_DO)} About ${FILMS_MINUTES} minutes. Pausing: *${FILMS_SITTING_LINE}* Keys: ${para(FILMS_KEYS)}\n`)
    out.push(`**Part 3, Step 2 — Where is it going?** ${para(PATHS_WILL_DO)} About ${PATHS_MINUTES} minutes. Pausing: *${PATHS_SITTING_LINE}* Keys: ${para(PATHS_KEYS)}\n`)
    out.push(`**Part 3, the two procedures (after both units).** ${para(MODELS_INTRO)}\n`)
    for (const s of P4) out.push(`**Part 4, ${s.title}.** ${s.reread ? `*${s.reread}* ` : ''}${para(s.willDo)} About ${s.minutes} minutes; leave any time.${s.content.length ? ' Content: ' + s.content.map((c) => `*${c}*`).join(' ') : ''} Predictions: ${s.predictions.map((p) => `*${p.question}* [${p.choices.join(' / ')}]`).join('; ')}\n`)
    out.push(`**Part 5 — Two Groups.** ${para(GROUPS_WILL_DO)} About ${GROUPS_MINUTES} minutes. Pausing: *${GROUPS_SITTING_LINE}* Keys: ${para(GROUPS_KEYS)}\n`)
    for (const s of P6) out.push(`**Part 6, ${s.title}.** *${s.reread}* ${para(s.willDo)} About ${s.minutes} minutes; leave any time.${s.content.length ? ' Content: ' + s.content.map((c) => `*${c}*`).join(' ') : ''} Predictions: ${s.predictions.map((p) => `*${p.question}* [${p.choices.join(' / ')}]`).join('; ')}\n`)
    out.push('\n**The fixed lines (§12):**\n')
    for (const [k, v] of Object.entries(L)) if (typeof v === 'string') out.push(`- \`${k}\`: *${v}*`)
    out.push('\n**The six rules, as the diagnosis lists them:**\n')
    for (const r of RULES) out.push(`- ${r.label}: ${r.description}`)
    out.push('\n**The five animals, as the diagnosis lists them:**\n')
    for (const a of ANIMALS) out.push(`- ${a.label}: ${a.rule} (separated by ${a.separatedBy})`)
    out.push('\n**The tests, as the menu describes them:**\n')
    for (const t of TESTS) out.push(`- ${t.title}: ${t.what}. Scores: ${t.scoredLabel}.`)
    console.log(out.join('\n'))
  })
})
