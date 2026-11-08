import { NEEDS, RESERVES_MAX, RESERVES_MIN, RULE_IDS, RULE_LABEL, RULE_TEXT, survivalChance, SURE_GIVES, VARIABLE_GIVES, exactSurvival } from '../../../sim/planning/choices/forager'
import { SAME_EXPECTED_VALUE_LINE } from '../lines'
import { Btn, Content, FixedLines, GroupLabel, Note, Para, Section } from '../ui'
import type { ChoicesStore } from './store'

/**
 * Part 1, Step 4 (spec §5.5): the reading's small bird on a winter evening,
 * in 2D: the bird, two feeding patches, and a bar of its reserves against
 * the 10 units it needs. Twelve evenings, then the exact survival table,
 * then three programmed foragers over 1,000 evenings. A fixed line names
 * what is shown and does not say which rule is better.
 */
export function ForagerScreen({ s }: { s: ChoicesStore }) {
  const n = s.evenings.length
  const last = s.evenings[n - 1]
  const reserves = s.pendingReserves ?? last?.reserves ?? 0
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }} data-forager>
      <Content>{SAME_EXPECTED_VALUE_LINE}</Content>
      <BirdView reserves={s.pendingReserves ?? (last ? last.reserves + last.ate : 0)} />
      {n < 12 ? (
        <>
          <div style={{ fontSize: 13 }} data-evening>
            Evening {n + 1} of 12. The bird has {reserves} units in reserve and needs {NEEDS} to survive the night. The sure patch would give {SURE_GIVES} units. The variable patch would give {VARIABLE_GIVES} units or nothing.
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn primary onClick={() => s.feedAt('sure')}>
              Feed at the sure patch
            </Btn>
            <Btn primary onClick={() => s.feedAt('variable')}>
              Feed at the variable patch
            </Btn>
          </div>
        </>
      ) : (
        <div style={{ fontSize: 13 }}>The twelve evenings are done.</div>
      )}
      {last && (
        <Para>
          Last evening: the bird had {last.reserves} units, fed at the {last.patch} patch, ate {last.ate} units, and {last.survived ? 'survived the night' : 'did not survive the night'}.
        </Para>
      )}
      <GroupLabel>Your evenings so far</GroupLabel>
      <FixedLines lines={[`${'evening'.padEnd(9)}${'reserves'.padEnd(10)}${'patch'.padEnd(10)}${'ate'.padEnd(5)}survived`, ...s.evenings.map((e, i) => `${String(i + 1).padEnd(9)}${String(e.reserves).padEnd(10)}${e.patch.padEnd(10)}${String(e.ate).padEnd(5)}${e.survived ? 'yes' : 'no'}`)]} testId="evenings" />
      {n >= 12 && (
        <>
          <Section title="The chance of surviving the night, from each level of reserves, computed exactly">
            <Para>Each row is a level of reserves the bird can start with. The sure patch adds {SURE_GIVES} units every time, so the bird survives from the sure patch when its reserves are {NEEDS - SURE_GIVES} or more, and never when they are less. The variable patch adds {VARIABLE_GIVES} units on half the evenings, so from any level here the bird survives half the time.</Para>
            <FixedLines lines={[`${'reserves'.padEnd(10)}${'sure patch'.padEnd(13)}variable patch`, ...Array.from({ length: RESERVES_MAX - RESERVES_MIN + 1 }, (_, i) => RESERVES_MIN + i).map((r) => `${String(r).padEnd(10)}${pct(survivalChance(r, 'sure')).padEnd(13)}${pct(survivalChance(r, 'variable'))}`)]} testId="survival-table" />
          </Section>
          <Section title="Three programmed foragers, over 1,000 evenings from the same spread of reserves">
            <Para>Each forager is a fixed rule. {RULE_IDS.map((r) => `${RULE_LABEL[r]}: ${RULE_TEXT[r]}`).join(' ')}</Para>
            {!s.rules ? (
              <div>
                <Btn primary onClick={() => s.runRules()}>
                  Run 1,000 evenings
                </Btn>
              </div>
            ) : (
              <>
                <FixedLines lines={[`${'forager'.padEnd(40)}${'survived'.padStart(9)}${'exact'.padStart(8)}`, ...RULE_IDS.map((r) => `${RULE_LABEL[r].padEnd(40)}${pct(s.rules![r]).padStart(9)}${pct(exactSurvival(r)).padStart(8)}`), `${'You, over your 12 evenings'.padEnd(40)}${(s.ownSurvival() === null ? '—' : pct(s.ownSurvival()!)).padStart(9)}${''.padStart(8)}`]} testId="rules-table" />
                <Note>“survived” is the share of the 1,000 nights the forager lived through; “exact” is the share the rules give exactly, over the even spread of reserves from {RESERVES_MIN} to {RESERVES_MAX}. The panel shows what each rule did and does not say which rule is better.</Note>
              </>
            )}
          </Section>
          <Section title="From Module 7: the best criterion depends on what each outcome gains or loses">
            <Para>In Module 7, signal detection theory said where the best criterion lies: it depends on what each of the four outcomes gains or loses, and on how common targets are, so the most accurate criterion is not always the best one. Expected value is like accuracy in that respect. The reading’s example (§12.1.1): “If receiving nothing would mean missing a rent payment, the sure $240 is the choice most likely to keep the chooser above that line.” For the bird, whether caution or a gamble is the better choice depends on what the bird needs, and not on expected value alone.</Para>
          </Section>
          <div>
            <Btn onClick={() => s.startEvenings()}>Start the evenings again</Btn>
          </div>
        </>
      )}
    </div>
  )
}

const pct = (v: number) => `${Math.round(v * 100)}%`

/** The bird, the two patches, and the bar of reserves against the 10 units needed. */
function BirdView({ reserves }: { reserves: number }) {
  const w = 360
  return (
    <svg width={w} height={120} viewBox={`0 0 ${w} 120`} role="img" aria-label="a bird between a sure patch and a variable patch, with a bar of its reserves">
      <rect x={10} y={70} width={100} height={30} rx={6} fill="var(--actuator)" opacity={0.5} />
      <text x={60} y={89} fontSize={11} textAnchor="middle" fill="var(--text)">
        sure patch: 4
      </text>
      <rect x={250} y={70} width={100} height={30} rx={6} fill="var(--sensor)" opacity={0.5} />
      <text x={300} y={89} fontSize={11} textAnchor="middle" fill="var(--text)">
        variable: 8 or 0
      </text>
      <ellipse cx={180} cy={80} rx={18} ry={12} fill="var(--text-muted)" />
      <circle cx={196} cy={72} r={7} fill="var(--text-muted)" />
      <polygon points="203,72 212,70 203,75" fill="var(--accent)" />
      <rect x={60} y={20} width={240} height={14} rx={4} fill="var(--surface-2)" stroke="var(--border)" />
      <rect x={60} y={20} width={Math.min(240, (240 * reserves) / NEEDS)} height={14} rx={4} fill="var(--accent)" />
      <text x={60} y={14} fontSize={10} fill="var(--text-muted)">
        reserves: {reserves} of the {NEEDS} units needed to survive the night
      </text>
    </svg>
  )
}
