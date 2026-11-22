import { Btn, Choice, Content, DataTable, FixedLines, GroupLabel, Note, StagePanel, useRef, useWidth } from '../ui'
import { LinePlot, type Series } from '../plots'
import { ReferencePanel } from '../ReferencePanel'
import { reference } from '../../../sim/language/references'
import { nonwords, partwords } from '../../../sim/language/stream/test'
import { ADULTS_21_MINUTES_LINE, INFANTS_MEASURED_DIFFERENTLY_LINE } from '../lines'
import { SrnSchematic } from '../predictors/Schematics'
import { DipsSchematic, ErrorProfileFigure, ParserSchematic } from './Schematics'
import { EXPLANATIONS_TEXT, INTERPRET_QUESTIONS, LEARNER_HOW, LEARNER_NAMES, LEARNER_TEST, PARSER_RULE_LINES, PARSER_RULE_NAMES, PEOPLE_TEXT, PREDICTION_QUESTIONS, STEP3_PANEL } from './texts'
import { AMOUNTS_MIN, LEARNERS, TABLE_AMOUNTS_MIN, type LearnerId, type ParserRule, type StreamStore } from './store'
import { meanAndSd } from '../../../sim/language/sounds/classifier'

/**
 * Step 3's screens (spec §6.3), all in the center (the left column is
 * navigation only; Jon, 2026-11-16). In order down the panel (Jon,
 * 2026-11-21): what the adults and the infants of the original experiments
 * did; the three learners as three explanations, and what counts as success;
 * the run and the test; the three learners, side by side where the panel
 * is wide, each with a drawing and how it works (the recurrent network's
 * with its prediction-error figure, as Elman's Fig. 6); the three predictions,
 * committed before the run; Run the learners, one press for every amount
 * from nothing to 21 minutes by the minute, the plot filling in as each
 * amount is done; the plot of percent correct against minutes on a linear
 * axis from 0 (Jon, 2026-11-22: to show that every learner starts at
 * chance, with the axis scaled to the time), one line per learner per test
 * with the 95% confidence interval of the mean over the 20 streams shaded
 * (as Part 1's band over 10 networks; before, the range), the people's
 * lines in white with dashes of their own, since blue and orange are two
 * learners' colors (Jon, 2026-11-22), its key
 * at the left of the axis and the adults' two means labeled at the right
 * of the plot area, chance, and the infants' 2 minutes marked; the table;
 * how each learner takes the test; PARSER's test rule, the spec's by
 * default and the paper's on a two-option control, both scored at every
 * run; and the questions to answer from the results.
 */
const COLORS: Record<LearnerId, string> = { dips: 'var(--accent)', srn: 'var(--sensor)', parser: 'var(--actuator)' }
const GAP = 16
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
/** Student's t for 19 degrees of freedom at 95%: the band over the 20 streams. */
const T_95_DF19 = 2.093
const amountLabel = (i: number) => (AMOUNTS_MIN[i] === 0 ? 'nothing' : AMOUNTS_MIN[i] < 1 ? '30 seconds' : `${AMOUNTS_MIN[i]} minute${AMOUNTS_MIN[i] === 1 ? '' : 's'}`)
const tickLabel = (m: number) => (m === 0 ? '0' : m < 1 ? '0.5' : String(m))

/** The predictions and Run the learners, under the three learners. */
function Step3Controls({ s }: { s: StreamStore }) {
  const keys = ['partwords', 'reach76', 'least'] as const
  const committed = s.allPredicted
  const allRun = s.results.size === AMOUNTS_MIN.length
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
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <Btn primary onClick={() => void s.runLearners()} disabled={!committed || s.running !== null || allRun}>
          Run the learners
        </Btn>
        {s.running && <Note data-running>{`Running: ${amountLabel(s.running.amount)} of the stream, stream ${s.running.done} of 20.`}</Note>}
        {!s.running && allRun && <Note data-all-run>Every amount is run, nothing to 21 minutes.</Note>}
      </div>
    </div>
  )
}

const DRAWINGS: Record<LearnerId, (s: StreamStore) => React.JSX.Element> = {
  dips: () => <DipsSchematic />,
  srn: (s) => (
    <>
      <SrnSchematic units={12} hidden={12} what="syllable" />
      <ErrorProfileFigure {...s.errorFigure()} />
    </>
  ),
  parser: () => <ParserSchematic />,
}

export function Step3Stage({ s }: { s: StreamStore }) {
  const ref = useRef<HTMLDivElement>(null)
  const w = useWidth(ref, 960)
  const threeColumns = w >= 880
  const amounts = [...s.results.keys()].sort((a, b) => a - b)
  const series: Series[] = []
  for (const l of LEARNERS)
    for (const test of ['nonword', 'partword'] as const) {
      const pts = amounts.map((a) => [AMOUNTS_MIN[a], mean(s.scoresOf(s.results.get(a)!, l, test))] as [number, number])
      // The band: the 95% confidence interval of the mean over the 20 streams, mean ± t · sd / √20, kept within the axis.
      const band = amounts.map((a) => {
        const xs = s.scoresOf(s.results.get(a)!, l, test)
        const { mean: m, sd } = meanAndSd(xs)
        const half = (T_95_DF19 * sd) / Math.sqrt(xs.length)
        return [AMOUNTS_MIN[a], Math.max(0, m - half), Math.min(100, m + half)] as [number, number, number]
      })
      series.push({ label: `${LEARNER_NAMES[l]}, ${test === 'nonword' ? 'nonwords' : 'part-words'}`, color: COLORS[l], dashed: test === 'partword', points: pts, band })
    }
  const ran = amounts.length > 0
  const tableAmounts = amounts.filter((a) => TABLE_AMOUNTS_MIN.includes(AMOUNTS_MIN[a]))
  return (
    <StagePanel wide testId="stream-3">
      <div ref={ref} style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0, width: '100%' }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>Three learners</div>
        <GroupLabel>What the people did</GroupLabel>
        {PEOPLE_TEXT.map((p) => (
          <Note key={p.slice(0, 12)} style={{ color: 'var(--text)' }} data-people>
            {p}
          </Note>
        ))}
        <GroupLabel>Three explanations, and what would count as success</GroupLabel>
        {EXPLANATIONS_TEXT.map((p) => (
          <Note key={p.slice(0, 12)} style={{ color: 'var(--text)' }} data-explanations>
            {p}
          </Note>
        ))}
        <GroupLabel>The run and the test</GroupLabel>
        {STEP3_PANEL.map((p) => (
          <Note key={p.slice(0, 12)} style={{ color: 'var(--text)' }}>
            {p}
          </Note>
        ))}
        <GroupLabel>The three learners</GroupLabel>
        <div style={{ display: 'flex', flexDirection: threeColumns ? 'row' : 'column', gap: GAP, alignItems: 'flex-start' }} data-learners>
          {LEARNERS.map((l) => (
            <div key={l} style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }} data-learner={l}>
              <GroupLabel>{LEARNER_NAMES[l]}</GroupLabel>
              {DRAWINGS[l](s)}
              {LEARNER_HOW[l].map((p) => (
                <Note key={p.slice(0, 20)} style={{ color: 'var(--text)' }}>
                  {p}
                </Note>
              ))}
              {l === 'srn' && <ReferencePanel reference={reference('elman-1990')} />}
              {l === 'parser' && <ReferencePanel reference={reference('perruchet-1998')} />}
              {l === 'parser' && <ReferencePanel reference={reference('perruchet-1998-speed')} />}
            </div>
          ))}
        </div>
        <Step3Controls s={s} />
        {!s.allPredicted && <Note data-awaiting-commit>The plot appears once you have committed your three predictions above and run the learners.</Note>}
        {ran && (
          <div data-reveal="learners" style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
            <LinePlot
              series={series}
              width={880}
              height={280}
              fluid
              legend="left"
              hLineLabels="right"
              markLabels="bottom"
              xLabel="minutes of the stream taken in"
              yLabel="percent of 36 test trials correct"
              xMin={0}
              xMax={21}
              xTicks={[0, 3, 6, 9, 12, 15, 18, 21].map((m) => ({ x: m, label: tickLabel(m) }))}
              yMin={0}
              yMax={100}
              yTicks={[0, 25, 50, 75, 100]}
              hLines={[{ y: 50, label: 'chance, 50%', dash: '2 4' }, { y: 76, label: 'adults, nonwords, 76% at 21 min', color: 'var(--text)', dash: '8 4', width: 1.4 }, { y: 65, label: 'adults, part-words, 65% at 21 min', color: 'var(--text)', dash: '3 4', width: 1.4 }]}
              marks={[{ x: 2, label: 'infants, 2 minutes: measured by listening times, not by a test like this one', color: 'var(--text)', dash: '8 4' }]}
              testId="learners-plot"
            />
            <Note>{`Each line is one learner on one version of the test: the mean over your stream and 19 others, one point per amount run. The shaded band is the 95% confidence interval of that mean over the 20 streams: the mean plus or minus ${T_95_DF19} times the standard deviation divided by the square root of 20, where ${T_95_DF19} is Student’s t for 19 degrees of freedom. The solid lines are the nonword test, the dashed lines the part-word test. The key is at the left of the plot; the adults’ two means are labeled at its right.`}</Note>
            <GroupLabel>Scores at eight of the amounts</GroupLabel>
            <DataTable
              testId="learners-table"
              columns={[{ key: 'learner', label: 'Learner' }, { key: 'test', label: 'Test' }, ...tableAmounts.map((a) => ({ key: `a${a}`, label: `${tickLabel(AMOUNTS_MIN[a])} min`, mono: true }))]}
              rows={LEARNERS.flatMap((l) => (['nonword', 'partword'] as const).map((t) => ({ learner: LEARNER_NAMES[l], test: t === 'nonword' ? 'nonwords' : 'part-words', ...Object.fromEntries(tableAmounts.map((a) => [`a${a}`, `${mean(s.scoresOf(s.results.get(a)!, l, t)).toFixed(1)}%`])) })))}
            />
            <Note>The table shows each learner’s mean percentage correct over the 20 streams at 0, 30 seconds, 1, 2, 4, 7, 14, and 21 minutes, of the amounts run so far; the plot has every amount. The adults scored 76% against nonwords and 65% against part-words after 21 minutes.</Note>
            <GroupLabel>Questions to answer from the plot and the table</GroupLabel>
            <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4 }} data-interpret>
              {INTERPRET_QUESTIONS.map((q) => (
                <li key={q.slice(0, 12)} style={{ fontSize: 12.5, color: 'var(--text)' }}>
                  {q}
                </li>
              ))}
            </ol>
            <GroupLabel>How each learner takes the test</GroupLabel>
            {LEARNERS.map((l) => (
              <Note key={l} style={{ color: 'var(--text)' }} data-learner-test={l}>
                <span style={{ fontWeight: 600 }}>{LEARNER_NAMES[l]}.</span> {LEARNER_TEST[l]}
              </Note>
            ))}
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
            <ReferencePanel reference={reference('saffran-adults')} />
            <ReferencePanel reference={reference('saffran-infants')} />
          </div>
        )}
      </div>
    </StagePanel>
  )
}
