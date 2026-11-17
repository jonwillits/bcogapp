import { Btn, Choice, Content, FixedLines, GroupLabel, Note, Para, Section, StagePanel } from '../ui'
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
export const HOW_OFTEN_LINE = 'In the build’s measurement, for simulated students with an overall accuracy near chance (about 25%), the after-wrong share fell inside both models’ ranges about 7 times in 10, so 48 pairs did not tell the two apart. For simulated students at 33% accuracy and above, the after-wrong share fell inside the range of the model that produced it 19 times in 20 and inside the other model’s range 2 times in 20 or fewer.'

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
      {s.computing && <Note data-computing>Fitting each model’s setting and running it 200 times.</Note>}
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
      {s.usingSample && <Note data-missing="steps12">Steps 1 and 2 are not done, so the models run on a sample sequence of 60 trials drawn from your seed, with the choices of a scripted chooser standing in for yours. Your own row stays empty until Steps 1 and 2 are done.</Note>}
      <PredictionBox s={s} />
      {!committed && <Note data-awaiting-commit>The key measure and the models appear once your prediction is committed above.</Note>}
      {committed && (
        <div data-reveal="models" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Section n={1} title="The key measure">
            <Para>For each word, its occurrences 2 to 5 are each paired with the occurrence just before: 12 words × 4 = 48 pairs. Each pair is sorted by whether the earlier choice was right or wrong, and the share of the later choices that were correct is computed in each group. Chance is 1 in 5, 20%, since five objects are on the screen.</Para>
            {km ? (
              <FixedLines lines={[`after a right choice:  ${pct(share(km.afterRight))} correct, of ${km.afterRight.n} pairs`, `after a wrong choice:  ${pct(share(km.afterWrong))} correct, of ${km.afterWrong.n} pairs`, `overall, occurrences 2 to 5: ${pct(km.accuracy)} correct, of 48`]} testId="key-measure" />
            ) : (
              <Note>Your row is empty until Steps 1 and 2 are done.</Note>
            )}
          </Section>
          <Section n={2} title="The two models">
            <Para>Guess and check and tallying are names of two procedures, not descriptions of a person. Each runs on exactly the same 60 trials: the same words and objects, in the same order and the same screen positions.</Para>
            <Para>
              <b>Guess and check</b> stores one object per word. On a word’s first occurrence, it picks one of the five objects on the screen at random. On each later occurrence, it recalls its last pick for that word with probability α. If it recalls the pick and that object is on the screen, it picks it again. Otherwise it picks one of the five at random, and stores that. It reads no count.
            </Para>
            <Para>
              <b>Tallying</b> stores a count for every word with every object. On every trial, it adds one to the count of the word with each of the five objects on the screen. Then it picks among the five with probabilities proportional to each object’s count with the word raised to the power β: at β = 0 every object is equally likely, and the larger β, the more the highest count is favored. It reads no record of its own past picks.
            </Para>
            <Para>Each model’s one setting, α or β, is chosen to match your overall accuracy over occurrences 2 to 5: a search over 41 values of the setting, each run 50 times on your trials, picks the value whose mean accuracy is nearest yours. The models are then compared on the key measure, which neither was fitted to. Each runs 200 times at its fitted setting, and each cell shows the mean over the 200 runs and the range that holds the middle 90% of them.</Para>
            <Content>{FITTED_TO_YOUR_ACCURACY_LINE}</Content>
          </Section>
          <Section n={3} title="The three rows">
            <RunButton s={s} />
            {gc && ta && (
              <>
                <FixedLines lines={['                     after right          after wrong         overall', `you                  ${km ? pct(share(km.afterRight)).padEnd(21) : '  —'.padEnd(21)}${km ? pct(share(km.afterWrong)).padEnd(20) : '  —'.padEnd(20)}${km ? pct(km.accuracy) : '  —'}`, `guess and check      ${pct(gc.afterRight.mean)} [${pct(gc.afterRight.lo).trim()}–${pct(gc.afterRight.hi).trim()}]`.padEnd(42) + `${pct(gc.afterWrong.mean)} [${pct(gc.afterWrong.lo).trim()}–${pct(gc.afterWrong.hi).trim()}]`.padEnd(20) + pct(gc.accuracy.mean), `tallying             ${pct(ta.afterRight.mean)} [${pct(ta.afterRight.lo).trim()}–${pct(ta.afterRight.hi).trim()}]`.padEnd(42) + `${pct(ta.afterWrong.mean)} [${pct(ta.afterWrong.lo).trim()}–${pct(ta.afterWrong.hi).trim()}]`.padEnd(20) + pct(ta.accuracy.mean), 'chance                20%                  20%                 20%']} testId="three-rows" />
                <Para>{`Guess and check at α = ${gc.param.toFixed(3)} reaches an overall accuracy of ${pct(gc.accuracy.mean).trim()} (the fit aimed at ${pct(s.targetAccuracy).trim()}); tallying at β = ${ta.param.toFixed(2)} reaches ${pct(ta.accuracy.mean).trim()}. After a wrong choice, guess and check is correct ${pct(gc.afterWrong.mean).trim()} of the time and tallying ${pct(ta.afterWrong.mean).trim()}${km ? `; you were correct ${pct(share(km.afterWrong)).trim()} of the time` : ''}.`}</Para>
                {s.fitted && gc.accuracy.mean < s.targetAccuracy - 0.05 && <Note data-ceiling>{`Guess and check, as stated here, cannot reach an overall accuracy of ${pct(s.targetAccuracy).trim()}: at α = 1 it keeps a wrong pick whenever that object is on the screen again, and its accuracy tops out near ${pct(gc.accuracy.mean).trim()}. The fit chose the value nearest your accuracy.`}</Note>}
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
