import { Btn, Choice, Content, DataTable, FixedLines, GroupLabel, Note, Para, Section, StagePanel } from '../ui'
import { ReferencePanel } from '../ReferencePanel'
import { reference } from '../../../sim/language/references'
import { share } from '../../../sim/language/words/keyMeasure'
import { FITTED_TO_YOUR_ACCURACY_LINE, SMALL_NUMBERS_LINE } from '../lines'
import { PREDICTION, type WordsStore } from './store'

/**
 * Step 3's screens (spec §7.3), all in the center (the left column is
 * navigation only; Jon, 2026-11-16): the prediction committed first; the
 * key measure for the student (or the one-line notice that the models run
 * on a sample sequence); the two models' panels; Run the models; the three
 * rows with each cell's mean and 90% range; the two sliders with Back to
 * the fitted value; the line about how often 48 pairs tell the models
 * apart, from the build's measurement; and the pending references.
 */
const pct = (x: number) => (Number.isNaN(x) ? '  —' : `${Math.round(100 * x)}%`.padStart(4))

/** From the build's measurement (docs/M13_AS_BUILT_NOTES.md §4.4): students simulated by each model at a range of accuracies, and how often their after-wrong share fell inside the other model's 90% range. */
export const HOW_OFTEN_LINE = 'Before the lab was posted, we simulated students with each model at a range of accuracies, to measure how often 48 pairs separate the two models. For simulated students with an overall accuracy near 60%, the share correct after a wrong choice fell inside both models’ ranges most of the time, so the two models could not be told apart. For simulated students at about 85% accuracy and above, that share fell inside the range of the model that produced it 16 to 19 times in 20, and inside the other model’s range 5 times in 20 or fewer. Between, at about 70 to 75% accuracy, the two models are told apart some of the time.'

/** The prediction, at the top of the stage. */
function PredictionBox({ s }: { s: WordsStore }) {
  const committed = s.predicted()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 8, border: '1px solid var(--border)', borderRadius: 8 }} data-predict="after-wrong">
      <GroupLabel>Predict first</GroupLabel>
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

export function Step3Stage({ s }: { s: WordsStore }) {
  const committed = s.predicted()
  const km = s.studentMeasure()
  const gc = s.gcRuns
  const ta = s.tallyRuns
  return (
    <StagePanel wide testId="words-3">
      <div style={{ fontSize: 14, fontWeight: 600 }}>Two models on your trials</div>
      {s.usingSample && <Note data-missing="steps12">Steps 1 and 2 are not done, so the models run on a sample sequence of 60 trials drawn from your seed. The choices of a scripted chooser stand in for yours. Your own row stays empty until Steps 1 and 2 are done.</Note>}
      <PredictionBox s={s} />
      {!committed && <Note data-awaiting-commit>Once you commit your prediction above, you will see the key measure and the two models.</Note>}
      {committed && (
        <div data-reveal="models" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Section n={1} title="The key measure">
            <Para>For each word, we pair each of its occurrences 2 to 5 with the occurrence just before: 12 words × 4 = 48 pairs. We sort the pairs by whether the earlier choice was right or wrong. In each group, the key measure is the share of the later choices that were correct. Chance is 1 in 2, 50%, since two objects are on the screen.</Para>
            {km ? (
              <DataTable testId="key-measure" rowHeader columns={[{ key: 'what', label: 'Pairs' }, { key: 'correct', label: 'Later choice correct', mono: true }, { key: 'n', label: 'Of how many pairs', mono: true }]} rows={[{ what: 'after a right choice', correct: pct(share(km.afterRight)).trim(), n: km.afterRight.n }, { what: 'after a wrong choice', correct: pct(share(km.afterWrong)).trim(), n: km.afterWrong.n }, { what: 'overall, occurrences 2 to 5', correct: pct(km.accuracy).trim(), n: 48 }]} />
            ) : (
              <Note>Your row is empty until Steps 1 and 2 are done.</Note>
            )}
          </Section>
          <Section n={2} title="The two models">
            <Para>Guess and check and tallying are names of two procedures, not descriptions of a person. Both run on your 60 trials: the same words and objects, in the same order and the same screen positions.</Para>
            <Para>
              <b>Guess and check</b> stores one object per word. On a word’s first occurrence, it picks one of the two objects on the screen at random. On each later occurrence, it reads its stored pick for that word with probability α. If it reads the pick and that object is on the screen, it picks that object again. Otherwise it picks one of the two at random and stores that pick. It reads no count.
            </Para>
            <Para>
              <b>Tallying</b> stores a count for every word with every object. On every trial, it adds one to the count of the word with each of the two objects on the screen. Then it picks between the two, each object with a probability proportional to its count with the word raised to the power β. At β = 0 every object is equally likely; the larger β, the more the highest count is favored. It reads no record of its own past picks.
            </Para>
            <Para>Each model’s one setting, α or β, is chosen to match your overall accuracy over occurrences 2 to 5. We run the model 50 times on your trials at each of 41 values of the setting, and keep the value whose mean accuracy is nearest yours. Then we compare the models on the key measure, which neither was fitted to. Each model runs 200 times at its fitted setting. Each cell of the table shows the mean over the 200 runs and the range that holds the middle 90% of them.</Para>
            <Content>{FITTED_TO_YOUR_ACCURACY_LINE}</Content>
          </Section>
          <Section n={3} title="The three rows">
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
          <Section n={4} title="Published values">
            <ReferencePanel reference={reference('trueswell-2013')} />
            <ReferencePanel reference={reference('medina-2011')} />
            <ReferencePanel reference={reference('yu-smith-2007')} />
          </Section>
        </div>
      )}
    </StagePanel>
  )
}
