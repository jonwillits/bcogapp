import { Btn, Choice, Content, DataTable, FixedLines, GroupLabel, Note, StagePanel } from '../ui'
import { LinePlot, type Series } from '../plots'
import { ReferencePanel } from '../ReferencePanel'
import { reference } from '../../../sim/language/references'
import { nonwords, partwords } from '../../../sim/language/stream/test'
import { ADULTS_21_MINUTES_LINE, INFANTS_MEASURED_DIFFERENTLY_LINE } from '../lines'
import { LEARNER_NAMES, LEARNER_TEXT, PARSER_RULE_LINES, PARSER_RULE_NAMES, PREDICTION_QUESTIONS, STEP3_PANEL } from './texts'
import { AMOUNTS_MIN, LEARNERS, type LearnerId, type ParserRule, type StreamStore } from './store'
import { useState } from 'react'

/**
 * Step 3's screens (spec §6.3), all in the center (the left column is
 * navigation only; Jon, 2026-11-16): three predictions committed before
 * the first run; the slider of how much of the stream; Run the learners;
 * the plot of percent correct against minutes on a logarithmic axis, one
 * line per learner per test with the 20 streams' range shaded, chance, the
 * adults' means at 21 minutes, and the infants' 2 minutes marked on the
 * axis with no point; the reveal's aligned rows; PARSER's test rule, the
 * spec's by default and the paper's on a two-option control, both scored
 * at every run; each learner's description.
 */
const COLORS: Record<LearnerId, string> = { dips: 'var(--accent)', srn: 'var(--sensor)', parser: 'var(--actuator)' }
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length

/** The predictions, the slider and Run the learners, at the top of the stage under the two paragraphs. */
function Step3Controls({ s }: { s: StreamStore }) {
  const keys = ['partwords', 'reach76', 'least'] as const
  const committed = s.allPredicted
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-step3-controls>
      {!committed ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 8, border: '1px solid var(--border)', borderRadius: 8 }} data-predict="learners">
          <GroupLabel>Predict first</GroupLabel>
          {keys.map((k) => (
            <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <Note>{PREDICTION_QUESTIONS[k].question}</Note>
              <Choice value={s.drafts[k] ?? null} options={PREDICTION_QUESTIONS[k].choices.map((c) => ({ id: c, label: c }))} onChange={(c) => s.draft(k, c)} />
            </div>
          ))}
          <div>
            <Btn primary onClick={() => s.commitPredictions()} disabled={!keys.every((k) => s.drafts[k])}>
              Commit my predictions
            </Btn>
          </div>
        </div>
      ) : (
        <FixedLines lines={keys.map((k) => `Committed: ${s.predicted(k)}`)} mono={false} testId="committed" />
      )}
      <GroupLabel>How much of the stream</GroupLabel>
      <input type="range" min={0} max={AMOUNTS_MIN.length - 1} step={1} value={s.amountIndex} onChange={(e) => s.setAmount(Number(e.target.value))} aria-label="How much of the stream" disabled={!committed} style={{ width: '100%' }} />
      <FixedLines lines={[`${AMOUNTS_MIN[s.amountIndex] < 1 ? '30 seconds' : `${AMOUNTS_MIN[s.amountIndex]} minute${AMOUNTS_MIN[s.amountIndex] === 1 ? '' : 's'}`}: ${s.amountSyllables.toLocaleString()} syllables`]} testId="amount" />
      <div>
        <Btn primary onClick={() => void s.runLearners()} disabled={!committed || s.running !== null || s.results.has(s.amountIndex)}>
          Run the learners
        </Btn>
      </div>
      {s.running && <Note data-running>{`Running: stream ${s.running.done} of 20 at this amount.`}</Note>}
      {s.results.has(s.amountIndex) && !s.running && <Note>This amount is run. Move the slider to another amount and press “Run the learners” again.</Note>}
    </div>
  )
}

export function Step3Stage({ s }: { s: StreamStore }) {
  const [which, setWhich] = useState<keyof typeof LEARNER_NAMES>('dips')
  const amounts = [...s.results.keys()].sort((a, b) => a - b)
  const series: Series[] = []
  for (const l of LEARNERS)
    for (const test of ['nonword', 'partword'] as const) {
      const pts = amounts.map((a) => [AMOUNTS_MIN[a], mean(s.scoresOf(s.results.get(a)!, l, test))] as [number, number])
      const band = amounts.map((a) => [AMOUNTS_MIN[a], Math.min(...s.scoresOf(s.results.get(a)!, l, test)), Math.max(...s.scoresOf(s.results.get(a)!, l, test))] as [number, number, number])
      series.push({ label: `${LEARNER_NAMES[l]}, ${test === 'nonword' ? 'nonwords' : 'part-words'}`, color: COLORS[l], dashed: test === 'partword', points: pts, band })
    }
  const ran = amounts.length > 0
  return (
    <StagePanel wide testId="stream-3">
      <div style={{ fontSize: 14, fontWeight: 600 }}>Three learners</div>
      {STEP3_PANEL.map((p) => (
        <Note key={p.slice(0, 12)} style={{ color: 'var(--text)' }}>
          {p}
        </Note>
      ))}
      <Step3Controls s={s} />
      {!s.allPredicted && <Note data-awaiting-commit>The plot appears once your three predictions are committed above and the learners have run.</Note>}
      {ran && (
        <div data-reveal="learners">
          <LinePlot series={series} width={620} height={260} xLabel="minutes of the stream taken in (logarithmic axis)" yLabel="percent of 36 test trials correct" xMin={0.5} xMax={21} logX xTicks={AMOUNTS_MIN.map((m) => ({ x: m, label: m < 1 ? '0.5' : String(m) }))} yMin={0} yMax={100} yTicks={[0, 25, 50, 75, 100]} hLines={[{ y: 50, label: 'chance, 50%' }, { y: 76, label: 'adults, nonwords, 76% at 21 min', color: 'var(--accent)' }, { y: 65, label: 'adults, part-words, 65% at 21 min', color: 'var(--sensor)' }]} marks={[{ x: 2, label: 'infants, 2 minutes: measured by listening times, not by a test like this one' }]} testId="learners-plot" />
          <Note>Each line is one learner on one version of the test: the mean over your stream and 19 others, with the shaded band from the lowest to the highest of the 20 streams. The solid lines are the nonword test, the dashed lines the part-word test.</Note>
          <GroupLabel>Scores at the amounts you have run</GroupLabel>
          <DataTable
            testId="learners-table"
            columns={[{ key: 'learner', label: 'Learner' }, { key: 'test', label: 'Test' }, ...amounts.map((a) => ({ key: `a${a}`, label: `${AMOUNTS_MIN[a] < 1 ? '0.5' : AMOUNTS_MIN[a]} min`, mono: true }))]}
            rows={LEARNERS.flatMap((l) => (['nonword', 'partword'] as const).map((t) => ({ learner: LEARNER_NAMES[l], test: t === 'nonword' ? 'nonwords' : 'part-words', ...Object.fromEntries(amounts.map((a) => [`a${a}`, `${mean(s.scoresOf(s.results.get(a)!, l, t)).toFixed(1)}%`])) })))}
          />
          <Note>The table shows each learner’s mean percentage correct over the 20 streams at each amount run so far; the adults scored 76% against nonwords and 65% against part-words after 21 minutes.</Note>
          <GroupLabel>PARSER’s test rule</GroupLabel>
          <div data-parser-rule={s.parserRule}>
            <Choice value={s.parserRule} options={(Object.keys(PARSER_RULE_NAMES) as ParserRule[]).map((r) => ({ id: r, label: PARSER_RULE_NAMES[r] }))} onChange={(r) => s.setParserRule(r)} />
          </div>
          {PARSER_RULE_LINES.map((p) => (
            <Note key={p.slice(0, 12)}>{p}</Note>
          ))}
          <Content>{ADULTS_21_MINUTES_LINE}</Content>
          <Content>{INFANTS_MEASURED_DIFFERENTLY_LINE}</Content>
          <Note>{`The six nonwords: ${nonwords().map((f) => f.syllables.join('')).join(', ')}. The six part-words: ${partwords().map((f) => f.syllables.join('')).join(', ')}.`}</Note>
        </div>
      )}
      <GroupLabel>What each learner computes</GroupLabel>
      <Choice value={which} options={(Object.keys(LEARNER_NAMES) as (keyof typeof LEARNER_NAMES)[]).map((k) => ({ id: k, label: LEARNER_NAMES[k] }))} onChange={(k) => setWhich(k)} />
      {LEARNER_TEXT[which].map((p) => (
        <Note key={p.slice(0, 12)} style={{ color: 'var(--text)' }}>
          {p}
        </Note>
      ))}
      {which === 'parser' && <ReferencePanel reference={reference('perruchet-1998')} />}
      {which === 'parser' && <ReferencePanel reference={reference('perruchet-1998-speed')} />}
      {ran && (
        <>
          <ReferencePanel reference={reference('saffran-adults')} />
          <ReferencePanel reference={reference('saffran-infants')} />
        </>
      )}
    </StagePanel>
  )
}
