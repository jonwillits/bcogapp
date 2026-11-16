import { describe, it } from 'vitest'
import { OPEN_INTRO } from './Part0'
import { SCREENS as P1 } from './sounds/screens'
import { SCREENS as P2 } from './stream/screens'
import { SCREENS as P3 } from './words/screens'
import { SCREENS as P4 } from './predictors/screens'
import { PREDICTIONS as P1_PRED } from './sounds/store'
import { PREDICTION_QUESTIONS as P2_PRED, LEARNER_TEXT, LEARNER_NAMES } from './stream/texts'
import { PREDICTION } from './words/store'
import { PREDICTIONS as P4_PRED } from './predictors/store'
import { TOUR_TEXT, TOUR_TITLES, STEP4_PANEL } from './sounds/texts'
import { GRAMMAR_RULES } from './predictors/texts'
import * as L from './lines'
import type { StepScreen } from './steps'

/**
 * Prints every instruction screen, every prediction, and every fixed line
 * as Markdown, for the as-built notes' §1a:
 *   PROBE=1 PROBE_DIR=src/scenes/m13_language npx vitest run --disable-console-intercept -t "texts:"
 */
const para = (lines: readonly string[]) => lines.map((l) => (l.startsWith('- ') ? `  - *${l.slice(2)}*` : `*${l}*`)).join(' / ')
const screen = (part: string, s: StepScreen) => `**${part}, ${s.title}.** ${para(s.willDo)} About ${s.minutes} minute${s.minutes === 1 ? '' : 's'}; ${s.sitting}: *${s.sittingLine}* Keys: ${para(s.keys)} When you are done: *${s.next}*${s.content.length ? ' Content: ' + s.content.map((c) => `*${c}*`).join(' ') : ''}\n`

describe('texts:', () => {
  it('every instruction screen and fixed line', () => {
    const out: string[] = []
    out.push(`**Part 0.** ${para(OPEN_INTRO.lines)} + ${OPEN_INTRO.content.map((c) => `*${c}*`).join(' ')} ${OPEN_INTRO.time} Footer: *${OPEN_INTRO.footer}*\n`)
    for (const s of Object.values(P1)) out.push(screen('Part 1', s))
    out.push(`**Part 1, the predictions:** ${Object.entries(P1_PRED).map(([k, p]) => `${k}: *${p.question}* [${p.choices.join(' / ')}]`).join('; ')}\n`)
    out.push(`**Part 1, Step 1's tour:** ${Object.entries(TOUR_TEXT).map(([k, ps]) => `${TOUR_TITLES[k as keyof typeof TOUR_TITLES]}: ${ps.map((p) => `*${p}*`).join(' ')}`).join(' // ')}\n`)
    out.push(`**Part 1, Step 4's panel:** ${STEP4_PANEL.map((p) => `*${p}*`).join(' ')}\n`)
    for (const s of Object.values(P2)) out.push(screen('Part 2', s))
    out.push(`**Part 2, the predictions:** ${Object.entries(P2_PRED).map(([k, p]) => `${k}: *${p.question}* [${p.choices.join(' / ')}]`).join('; ')}\n`)
    out.push(`**Part 2, the learners:** ${(Object.keys(LEARNER_NAMES) as (keyof typeof LEARNER_NAMES)[]).map((k) => `${LEARNER_NAMES[k]}: ${LEARNER_TEXT[k].map((p) => `*${p}*`).join(' ')}`).join(' // ')}\n`)
    for (const s of Object.values(P3)) out.push(screen('Part 3', s))
    out.push(`**Part 3, the prediction:** *${PREDICTION.question}* [${PREDICTION.choices.join(' / ')}]\n`)
    for (const s of Object.values(P4)) out.push(screen('Part 4', s))
    out.push(`**Part 4, the predictions:** ${Object.entries(P4_PRED).map(([k, p]) => `${k}: *${p.question}*${'choices' in p ? ` [${(p as { choices: readonly string[] }).choices.join(' / ')}]` : ' [a menu of every noun]'}`).join('; ')}\n`)
    out.push(`**Part 4, the grammar's rules:** ${GRAMMAR_RULES.map((p) => `*${p}*`).join(' ')}\n`)
    out.push('\n**The fixed lines (§10):**\n')
    for (const [k, v] of Object.entries(L)) if (typeof v === 'string') out.push(`- \`${k}\`: *${v}*`)
    console.log(out.join('\n'))
  })
})
