import type { ReactNode } from 'react'
import { Btn, Choice, Content, DataTable, FixedLines, GroupLabel, Note, Para, Section, StagePanel } from '../ui'
import { LinePlot } from '../plots'
import { ReferencePanel } from '../ReferencePanel'
import { reference } from '../../../sim/language/references'
import { share } from '../../../sim/language/words/keyMeasure'
import { FITTED_TO_YOUR_ACCURACY_LINE, SMALL_NUMBERS_LINE } from '../lines'
import { objectUrl } from './assets'
import { DEMO_OBJECTS, DEMO_OBJECT_IDS, DEMO_PAIRING, DEMO_TRIALS, DEMO_WORDS, demoState, isDemoRight, type DemoObject } from './demo'
import { PREDICTION, type WordsStore } from './store'

/**
 * Step 3's panel (spec §7.3), rebuilt 2026-11-23 on the pattern of Part 2,
 * Step 3 (Jon): what the people did first, with their curve and the
 * student's over it; the two explanations and what counts as success; the
 * prediction, committed after the numbers (Jon's call); a six-trial
 * demonstration stepped through one trial at a time, each model's memory
 * drawn beside the objects; then, after the commit, the student's key
 * measure, Run the models, the three rows with the sliders, questions to
 * answer from the rows, and the three references. The left column is
 * navigation only (Jon, 2026-11-16).
 */
const pct = (x: number) => (Number.isNaN(x) ? '  —' : `${Math.round(100 * x)}%`.padStart(4))

/** Trueswell et al. (2013), Experiment 3, two objects on every occurrence (`references.ts`, trueswell-2013): the curve and the two shares, read from Fig. 7. */
export const ADULTS = { byOccurrence: [50, 66, 78, 84, 90], afterRight: [78, 84, 90, 93], afterWrong: [61, 58, 53, 72] }
const ADULTS_LABEL = 'the adults of the original experiment'

/** From the build's measurement (docs/M13_AS_BUILT_NOTES.md §4.4): students simulated by each model at a range of accuracies, and how often their after-wrong share fell inside the other model's 90% range. */
export const HOW_OFTEN_LINE = 'Before the lab was posted, we simulated students with each model at a range of accuracies, to measure how often 48 pairs separate the two models. For simulated students with an overall accuracy near 60%, the share correct after a wrong choice fell inside both models’ ranges most of the time, so the two models could not be told apart. For simulated students at about 85% accuracy and above, that share fell inside the range of the model that produced it 16 to 19 times in 20, and inside the other model’s range 5 times in 20 or fewer. Between, at about 70 to 75% accuracy, the two models are told apart some of the time.'

export const PEOPLE_TEXT = [
  'In the original experiment (Trueswell, Medina, Hafri, and Gleitman, 2013), adults did what you did in Steps 1 and 2: 12 made-up words, each heard 5 times, two objects on the screen each time, one click, and no word about right or wrong. Their objects were photographs of familiar things, a different ball or bear on each occurrence. On the first occurrence of a word they were at chance, 50%. By the fifth they were right 90% of the time.',
  'The authors then sorted occurrences 2 to 5 by what the person had clicked for that word the time before. After a right click, people were right 78% of the time at occurrence 2, rising to 93% at occurrence 5. After a wrong click, they were at chance, about 50%, at every occurrence. The object the word names had been on the screen the time before, with only one other object beside it, and after a wrong click people showed no sign of remembering it.',
  'An earlier study by the same group (Medina, Snedeker, Trueswell, and Gleitman, 2011) found the same pattern with muted videos of parents talking to their children. People kept a guess when the next scene fit it and dropped the guess when it did not, and after a wrong guess they did no better than people who saw the scene with no earlier scene at all.',
]

export const EXPLANATIONS_TEXT = [
  'The two models below are two explanations of what a person stores from a trial. Both are names of procedures, not descriptions of a person. Both run on the same trials: the same words and objects, in the same order and the same screen positions.',
  '“Guess and check” stores one object per word and nothing else. On a word’s first occurrence, it picks one of the two objects on the screen at random. On each later occurrence, it reads its stored pick for that word with probability α. If it reads the pick and that object is on the screen, it picks that object again. Otherwise it picks one of the two at random and stores that pick. It reads no count.',
  '“Tallying” stores a count for every word with every object. On every trial, it adds one to the count of the word with each of the two objects on the screen. Then it picks between the two, each object with a probability proportional to its count with the word raised to the power β. At β = 0 every object is equally likely; the larger β, the more the higher count is favored. It reads no record of its own past picks.',
  'A model succeeds as an explanation of the people if it reaches their accuracy and shows their pattern: well above chance after a right click, and at chance after a wrong one. Tallying predicts above chance after a wrong click too, since it keeps a count for the object that was on the screen. Guess and check predicts chance, since it keeps nothing but the pick it has just dropped. That difference is the test.',
]

export const DEMO_TEXT = [
  'These six trials are made for clarity, not drawn from yours: two words and three objects. ‹Word 1› names object A and ‹word 2› names object C. Press “Next trial” to step through them. Where a model’s rule says at random, the pick is scripted here, so that every step shows the rule at work. Each model’s memory is drawn under its pick: the one object guess and check stores for each word, and tallying’s count for each word with each object.',
  'On trial 3, guess and check had stored object B for ‹word 1›. B was gone, so it picked at random. Tallying had a count of 1 for A with ‹word 1›, left from trial 1, and picked A. After a wrong pick, only tallying has something stored to recover from.',
]

export const INTERPRET_QUESTIONS = [
  'Which model reached your overall accuracy, and at what setting?',
  'Which model showed the people’s pattern: above chance after a right choice, and at chance after a wrong one?',
  'What does your own row say? After a wrong choice, were you at chance, as the adults were, or above it?',
  'Move each slider. Is there any setting at which guess and check is above chance after a wrong choice? Is there any at which tallying is at chance there while still reaching your accuracy?',
]

/** The prediction, between the explanations and the demonstration. */
function PredictionBox({ s }: { s: WordsStore }) {
  const committed = s.predicted()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 8, border: '1px solid var(--border)', borderRadius: 8 }} data-predict="after-wrong">
      <GroupLabel>Predict before you see your own numbers</GroupLabel>
      <Note>{PREDICTION.question}</Note>
      {committed ? (
        <FixedLines lines={[`Committed: ${committed}`]} mono={false} />
      ) : (
        <>
          <Choice value={s.draft} options={PREDICTION.choices.map((c) => ({ id: c, label: c }))} onChange={(c) => s.setDraft(c)} />
          <div>
            <Btn primary onClick={() => s.commit()} disabled={!s.draft}>
              Commit my prediction
            </Btn>
          </div>
        </>
      )}
    </div>
  )
}

/** Run the models, in the section of the three rows. */
function RunButton({ s }: { s: WordsStore }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }} data-step3-controls>
      <div>
        <Btn primary onClick={() => s.runModels()} disabled={!s.predicted() || s.computing || s.fitted !== null}>
          Run the models
        </Btn>
      </div>
      {s.computing && <Note data-computing>Fitting each model’s setting and running the model 200 times.</Note>}
    </div>
  )
}

/** The two settings, under the rows, once the models have run. */
function Sliders({ s }: { s: WordsStore }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-step3-sliders>
      {s.fitted && (
        <>
          <GroupLabel>Guess and check’s setting, α</GroupLabel>
          <input type="range" min={0} max={1} step={0.025} value={s.alpha ?? 0} onChange={(e) => s.setAlpha(Number(e.target.value))} aria-label="alpha" style={{ width: '100%' }} />
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <FixedLines lines={[`α = ${(s.alpha ?? 0).toFixed(3)} (fitted ${s.fitted.alpha.toFixed(3)})`]} />
            <Btn small onClick={() => s.backToFitted('guessCheck')}>
              Back to the fitted value
            </Btn>
          </div>
          <GroupLabel>Tallying’s setting, β</GroupLabel>
          <input type="range" min={0} max={10} step={0.25} value={s.beta ?? 0} onChange={(e) => s.setBeta(Number(e.target.value))} aria-label="beta" style={{ width: '100%' }} />
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <FixedLines lines={[`β = ${(s.beta ?? 0).toFixed(2)} (fitted ${s.fitted.beta.toFixed(2)})`]} />
            <Btn small onClick={() => s.backToFitted('tally')}>
              Back to the fitted value
            </Btn>
          </div>
        </>
      )}
    </div>
  )
}

// ------------------------------------------------------------ the people

function PeoplePlot({ s }: { s: WordsStore }) {
  const km = s.studentMeasure()
  const series = [{ label: ADULTS_LABEL, color: 'var(--sensor)', points: ADULTS.byOccurrence.map((v, i) => [i + 1, v] as [number, number]) }]
  if (km) series.push({ label: 'you', color: '#ffffff', points: km.byOccurrence.map((v, i) => [i + 1, 100 * v] as [number, number]) })
  return <LinePlot series={series} width={520} height={240} xLabel="occurrence of a word, 1 to 5" yLabel="percent correct" xMin={1} xMax={5} xTicks={[1, 2, 3, 4, 5].map((x) => ({ x, label: String(x) }))} yTicks={[0, 20, 40, 60, 80, 100]} hLines={[{ y: 50, label: 'chance, 50%', dash: '2 3', color: 'var(--text)' }]} legend="left" legendWidth={170} fluid testId="people-curve" />
}

function PeopleTable({ s }: { s: WordsStore }) {
  const km = s.studentMeasure()
  const rows: Record<string, ReactNode>[] = [{ who: ADULTS_LABEL, right: `${ADULTS.afterRight[0]}% rising to ${ADULTS.afterRight[3]}%`, wrong: 'at chance, about 50%' }]
  if (km) rows.push({ who: 'you, occurrences 2 to 5 together', right: pct(share(km.afterRight)).trim(), wrong: pct(share(km.afterWrong)).trim() })
  return <DataTable testId="people-shares" rowHeader columns={[{ key: 'who', label: '' }, { key: 'right', label: 'After a right click' }, { key: 'wrong', label: 'After a wrong click' }]} rows={rows} />
}

// ------------------------------------------------------------- the demo

function Tile({ o, size = 44, marked }: { o: DemoObject; size?: number; marked?: 'right' | 'wrong' | null }) {
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 2 }} data-demo-object={o}>
      <span style={{ display: 'inline-flex', padding: 3, borderRadius: 8, border: `2px solid ${marked === 'right' ? 'var(--actuator)' : marked === 'wrong' ? 'var(--sensor)' : 'var(--border)'}`, background: 'var(--surface-2)' }}>
        <img src={objectUrl(DEMO_OBJECT_IDS[o])} alt="" width={size} height={size} draggable={false} />
      </span>
      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{o}</span>
    </span>
  )
}

/** Guess and check's memory: one slot per word. */
function GuessCheckMemory({ stored }: { stored: (DemoObject | null)[] }) {
  return (
    <div style={{ display: 'flex', gap: 14 }} data-demo-memory="guess-check">
      {DEMO_WORDS.map((w, i) => (
        <div key={w} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, fontSize: 11 }}>
          <i>{w}</i>
          {stored[i] ? <Tile o={stored[i]} size={30} /> : <span style={{ width: 40, height: 40, borderRadius: 8, border: '2px dashed var(--border)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 10 }}>none</span>}
        </div>
      ))}
    </div>
  )
}

/** Tallying's memory: a count for every word with every object, as a number and a bar. */
function TallyMemory({ counts }: { counts: Record<DemoObject, number>[] }) {
  const max = Math.max(1, ...counts.flatMap((c) => DEMO_OBJECTS.map((o) => c[o])))
  return (
    <table style={{ borderCollapse: 'collapse', fontSize: 11 }} data-demo-memory="tally">
      <thead>
        <tr>
          <th></th>
          {DEMO_OBJECTS.map((o) => (
            <th key={o} style={{ fontWeight: 400, color: 'var(--text-muted)', padding: '0 6px' }}>
              {o}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {DEMO_WORDS.map((w, i) => (
          <tr key={w}>
            <th style={{ fontWeight: 400, textAlign: 'right', padding: '2px 6px' }}>
              <i>{w}</i>
            </th>
            {DEMO_OBJECTS.map((o) => (
              <td key={o} style={{ padding: '2px 6px', textAlign: 'center' }} data-count={`${i}-${o}`}>
                <div style={{ height: 6, width: 40, background: 'var(--surface-2)', borderRadius: 3, overflow: 'hidden', margin: '0 auto' }}>
                  <div style={{ height: 6, width: `${(100 * counts[i][o]) / max}%`, background: 'var(--accent)' }} />
                </div>
                <span style={{ fontFamily: 'var(--font-mono)' }}>{counts[i][o]}</span>
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function Demo({ s }: { s: WordsStore }) {
  const k = s.demoStep
  const t = DEMO_TRIALS[k]
  const before = demoState(k)
  const after = demoState(k + 1)
  const gcMark = isDemoRight(t, t.gc.pick) ? 'right' : 'wrong'
  const taMark = isDemoRight(t, t.tally.pick) ? 'right' : 'wrong'
  const col = (title: string, children: ReactNode) => (
    <div style={{ flex: 1, minWidth: 220, display: 'flex', flexDirection: 'column', gap: 6, padding: 8, border: '1px solid var(--border)', borderRadius: 8 }}>
      <GroupLabel>{title}</GroupLabel>
      {children}
    </div>
  )
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} data-demo data-demo-trial={k + 1}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }} data-demo-controls>
        <Btn small onClick={() => s.demoBack()} disabled={k === 0}>
          Back
        </Btn>
        <Btn primary small onClick={() => s.demoNext()} disabled={k >= DEMO_TRIALS.length - 1}>
          Next trial
        </Btn>
        <FixedLines lines={[`Trial ${k + 1} of ${DEMO_TRIALS.length}: ‹${DEMO_WORDS[t.word]}› plays, and it names object ${DEMO_PAIRING[t.word]}.`]} mono={false} />
      </div>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center' }} data-demo-screen>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>On the screen:</span>
        {t.screen.map((o) => (
          <Tile key={o} o={o} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {col(
          'Guess and check',
          <>
            <Note>{`Stored for ‹${DEMO_WORDS[t.word]}› before this trial: ${t.gc.stored ?? 'nothing'}. Rule: ${t.gc.rule}.`}</Note>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }} data-demo-pick="guess-check">
              <span style={{ fontSize: 11 }}>Picks</span>
              <Tile o={t.gc.pick} size={30} marked={gcMark} />
              <span style={{ fontSize: 11, color: gcMark === 'right' ? 'var(--actuator)' : 'var(--sensor)' }}>{gcMark}</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>and stores it.</span>
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Its memory after the trial:</span>
            <GuessCheckMemory stored={after.stored} />
          </>,
        )}
        {col(
          'Tallying',
          <>
            <Note>{`Counts for ‹${DEMO_WORDS[t.word]}› before this trial: ${t.screen.map((o) => `${o} ${before.counts[t.word][o]}`).join(', ')}. Rule: ${t.tally.rule}.`}</Note>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }} data-demo-pick="tally">
              <span style={{ fontSize: 11 }}>Picks</span>
              <Tile o={t.tally.pick} size={30} marked={taMark} />
              <span style={{ fontSize: 11, color: taMark === 'right' ? 'var(--actuator)' : 'var(--sensor)' }}>{taMark}</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>and adds one to each count for the two objects.</span>
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Its memory after the trial:</span>
            <TallyMemory counts={after.counts} />
          </>,
        )}
      </div>
    </div>
  )
}

// ------------------------------------------------------------- the stage

export function Step3Stage({ s }: { s: WordsStore }) {
  const committed = s.predicted()
  const km = s.studentMeasure()
  const gc = s.gcRuns
  const ta = s.tallyRuns
  let n = 0
  const next = () => ++n
  return (
    <StagePanel wide testId="words-3">
      <div style={{ fontSize: 14, fontWeight: 600 }}>Two models on your trials</div>
      {s.usingSample && <Note data-missing="steps12">Steps 1 and 2 are not done, so the models run on a sample sequence of 60 trials drawn from your seed. The choices of a scripted chooser stand in for yours. Your own curve and rows stay empty until Steps 1 and 2 are done.</Note>}
      <Section n={next()} title="What the people did">
        <div data-people style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Para>{PEOPLE_TEXT[0]}</Para>
          <PeoplePlot s={s} />
          <Para>{PEOPLE_TEXT[1]}</Para>
          <PeopleTable s={s} />
          <Para>{PEOPLE_TEXT[2]}</Para>
        </div>
      </Section>
      <Section n={next()} title="Two explanations, and what counts as success">
        {EXPLANATIONS_TEXT.map((p, i) => (
          <Para key={i}>{p}</Para>
        ))}
      </Section>
      <PredictionBox s={s} />
      <Section n={next()} title="Six trials, step by step">
        <Para>{DEMO_TEXT[0]}</Para>
        <Demo s={s} />
        <Para>{DEMO_TEXT[1]}</Para>
      </Section>
      {!committed && <Note data-awaiting-commit>Once you commit your prediction above, you will see your own key measure and the two models on your trials.</Note>}
      {committed && (
        <div data-reveal="models" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Section n={next()} title="Your key measure">
            <Para>For each word, we pair each of its occurrences 2 to 5 with the occurrence just before: 12 words × 4 = 48 pairs. We sort the pairs by whether the earlier choice was right or wrong. In each group, the key measure is the share of the later choices that were correct. Chance is 1 in 2, 50%, since two objects are on the screen.</Para>
            {km ? (
              <DataTable testId="key-measure" rowHeader columns={[{ key: 'what', label: 'Pairs' }, { key: 'correct', label: 'Later choice correct', mono: true }, { key: 'n', label: 'Of how many pairs', mono: true }]} rows={[{ what: 'after a right choice', correct: pct(share(km.afterRight)).trim(), n: km.afterRight.n }, { what: 'after a wrong choice', correct: pct(share(km.afterWrong)).trim(), n: km.afterWrong.n }, { what: 'overall, occurrences 2 to 5', correct: pct(km.accuracy).trim(), n: 48 }]} />
            ) : (
              <Note>Your row is empty until Steps 1 and 2 are done.</Note>
            )}
            <Para>Each model’s one setting, α or β, is chosen to match your overall accuracy over occurrences 2 to 5. We run the model 50 times on your trials at each of 41 values of the setting, and keep the value whose mean accuracy is nearest yours. Then we compare the models on the key measure, which neither was fitted to. Each model runs 200 times at its fitted setting. Each cell of the table shows the mean over the 200 runs and the range that holds the middle 90% of them.</Para>
            <Content>{FITTED_TO_YOUR_ACCURACY_LINE}</Content>
          </Section>
          <Section n={next()} title="The three rows">
            <RunButton s={s} />
            {gc && ta && (
              <>
                <DataTable
                  testId="three-rows"
                  rowHeader
                  columns={[{ key: 'who', label: '' }, { key: 'right', label: 'After a right choice', mono: true }, { key: 'wrong', label: 'After a wrong choice', mono: true }, { key: 'overall', label: 'Overall', mono: true }]}
                  rows={[
                    { who: 'you', right: km ? pct(share(km.afterRight)).trim() : '—', wrong: km ? pct(share(km.afterWrong)).trim() : '—', overall: km ? pct(km.accuracy).trim() : '—' },
                    { who: 'guess and check', right: `${pct(gc.afterRight.mean).trim()} [${pct(gc.afterRight.lo).trim()}–${pct(gc.afterRight.hi).trim()}]`, wrong: `${pct(gc.afterWrong.mean).trim()} [${pct(gc.afterWrong.lo).trim()}–${pct(gc.afterWrong.hi).trim()}]`, overall: pct(gc.accuracy.mean).trim() },
                    { who: 'tallying', right: `${pct(ta.afterRight.mean).trim()} [${pct(ta.afterRight.lo).trim()}–${pct(ta.afterRight.hi).trim()}]`, wrong: `${pct(ta.afterWrong.mean).trim()} [${pct(ta.afterWrong.lo).trim()}–${pct(ta.afterWrong.hi).trim()}]`, overall: pct(ta.accuracy.mean).trim() },
                    { who: ADULTS_LABEL, right: `${ADULTS.afterRight[0]}% to ${ADULTS.afterRight[3]}%`, wrong: 'about 50%', overall: '—' },
                    { who: 'chance', right: '50%', wrong: '50%', overall: '50%' },
                  ]}
                  footer="A bracket holds the range of the middle 90% of the 200 runs."
                />
                <Para>{`Guess and check at α = ${gc.param.toFixed(3)} reaches an overall accuracy of ${pct(gc.accuracy.mean).trim()}; the target was ${pct(s.targetAccuracy).trim()}. Tallying at β = ${ta.param.toFixed(2)} reaches ${pct(ta.accuracy.mean).trim()}. After a wrong choice, guess and check is correct ${pct(gc.afterWrong.mean).trim()} of the time and tallying ${pct(ta.afterWrong.mean).trim()} of the time.${km ? ` You were correct ${pct(share(km.afterWrong)).trim()} of the time.` : ''}`}</Para>
                {s.fitted && gc.accuracy.mean < s.targetAccuracy - 0.05 && <Note data-ceiling>{`Guess and check, as stated here, cannot reach an overall accuracy of ${pct(s.targetAccuracy).trim()}. At α = 1 it keeps a wrong pick whenever that object is on the screen again, so its accuracy goes no higher than about ${pct(gc.accuracy.mean).trim()}. The fitted value is the one whose accuracy is nearest yours.`}</Note>}
                <Sliders s={s} />
              </>
            )}
            <Content>{SMALL_NUMBERS_LINE}</Content>
            <Note data-how-often>{HOW_OFTEN_LINE}</Note>
          </Section>
          <Section n={next()} title="Questions to answer from the rows">
            <Para>Nothing here is scored. Answer for yourself, from the rows and the sliders.</Para>
            <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }} data-interpret>
              {INTERPRET_QUESTIONS.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ol>
          </Section>
          <Section n={next()} title="Published values">
            <ReferencePanel reference={reference('trueswell-2013')} />
            <ReferencePanel reference={reference('medina-2011')} />
            <ReferencePanel reference={reference('yu-smith-2007')} />
          </Section>
        </div>
      )}
    </StagePanel>
  )
}
