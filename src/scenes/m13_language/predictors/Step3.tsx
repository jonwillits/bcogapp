import { Btn, Choice, Content, FixedLines, GroupLabel, Note, StagePanel } from '../ui'
import { BarChart } from '../plots'
import { ONE_CORPUS_LINE } from '../lines'
import { VOCABULARY, kindOf, verbOf } from '../../../sim/language/predictors/grammar'
import { contribution, embedding, sameCounts } from '../../../sim/language/predictors/counts'
import { predictFromOne, predictFromTwo } from '../../../sim/language/predictors/ngram'
import { STEP3_ONE_POINT, STEP3_ORDER, STEP3_PREDICT } from './texts'
import { PREDICTIONS, type PredictorsStore } from './store'

/**
 * Step 3's screens (spec §8.4): Order, with the two sentences' contributions
 * and the switch; Prediction from counts, with its committed prediction,
 * Compute, and the two distributions over every word; One point per word.
 */
const idx = (t: string) => VOCABULARY.indexOf(t)

export function Step3Controls({ s }: { s: PredictorsStore }) {
  const committed = s.predicted('counts')
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-step3-controls>
      <Choice value={s.screen3} options={[{ id: 'order', label: 'Order' }, { id: 'predict', label: 'Prediction from counts' }, { id: 'point', label: 'One point per word' }]} onChange={(v) => s.goScreen3(v as 'order' | 'predict' | 'point')} />
      {s.screen3 === 'order' && (
        <label style={{ fontSize: 12, display: 'flex', gap: 6, alignItems: 'center' }}>
          <input type="checkbox" checked={s.separate} onChange={(e) => s.setSeparate(e.target.checked)} /> Count words before and after separately
        </label>
      )}
      {s.screen3 === 'predict' && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 8, border: '1px solid var(--border)', borderRadius: 8 }} data-predict="counts">
            <GroupLabel>Predict first</GroupLabel>
            <Note>{PREDICTIONS.counts.question}</Note>
            {committed ? (
              <FixedLines lines={[`Committed: ${committed}`]} mono={false} />
            ) : (
              <>
                <Choice value={s.drafts.counts ?? null} options={PREDICTIONS.counts.choices.map((c) => ({ id: c, label: c }))} onChange={(c) => s.draft('counts', c)} />
                <div>
                  <Btn primary onClick={() => s.commit('counts')} disabled={!s.drafts.counts}>
                    Commit my prediction
                  </Btn>
                </div>
              </>
            )}
          </div>
          <div>
            <Btn primary onClick={() => s.compute()} disabled={!committed || s.computed}>
              Compute
            </Btn>
          </div>
        </>
      )}
    </div>
  )
}

function Contribution({ sentence, separate }: { sentence: string[]; separate: boolean }) {
  const toks = sentence.map(idx)
  const m = contribution(4, separate, toks)
  const ws = [...new Set(sentence)]
  return (
    <div data-contribution={sentence.join(' ')}>
      <FixedLines lines={[`${sentence.join(' ')}`, '        ' + ws.map((w) => w.padStart(8)).join('') + (separate ? '   (before)' : ''), ...ws.map((r) => `${r.padEnd(8)}${ws.map((c) => String(m.before[idx(r)][idx(c)] + (separate ? 0 : m.after[idx(r)][idx(c)])).padStart(8)).join('')}`), ...(separate ? ['        ' + ws.map((w) => w.padStart(8)).join('') + '   (after)', ...ws.map((r) => `${r.padEnd(8)}${ws.map((c) => String(m.after[idx(r)][idx(c)]).padStart(8)).join('')}`)] : [])]} />
    </div>
  )
}

export function Step3Stage({ s }: { s: PredictorsStore }) {
  const a = ['dog', 'chases', 'cat', '.']
  const b = ['cat', 'chases', 'dog', '.']
  const same = sameCounts(contribution(4, s.separate, a.slice(0, 3).map(idx)), contribution(4, s.separate, b.slice(0, 3).map(idx)))
  const prompt = ['boys', 'who', 'the', 'dog', 'chases']
  const hasThe = idx('the') >= 0
  const usedPrompt = hasThe ? prompt : ['boys', 'who', 'dogs', 'chase']
  const one = predictFromOne(s.ngram, idx(usedPrompt[usedPrompt.length - 1]))
  const two = predictFromTwo(s.ngram, idx(usedPrompt[usedPrompt.length - 2]), idx(usedPrompt[usedPrompt.length - 1]))
  const bars = (p: { probs: number[]; numerators: number[]; denominator: number }) =>
    VOCABULARY.map((t, j) => ({ label: t, value: p.probs[j], color: kindOf(t) === 'verb' ? (verbOf(t)!.number === 'pl' ? 'var(--actuator)' : 'var(--sensor)') : 'var(--accent)' }))
      .filter((x) => x.value > 0)
      .sort((x, y) => y.value - x.value)
  const plural = (p: { probs: number[] }) => VOCABULARY.reduce((acc, t, j) => acc + (kindOf(t) === 'verb' && verbOf(t)!.number === 'pl' ? p.probs[j] : 0), 0)
  const singular = (p: { probs: number[] }) => VOCABULARY.reduce((acc, t, j) => acc + (kindOf(t) === 'verb' && verbOf(t)!.number === 'sg' ? p.probs[j] : 0), 0)
  return (
    <StagePanel wide testId={`predictors-3-${s.screen3}`}>
      <div style={{ fontSize: 14, fontWeight: 600 }}>What counts cannot do</div>
      {s.screen3 === 'order' && (
        <>
          {STEP3_ORDER.map((p) => (
            <Note key={p.slice(0, 12)} style={{ color: 'var(--text)' }}>
              {p}
            </Note>
          ))}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <Contribution sentence={a.slice(0, 3)} separate={s.separate} />
            <Contribution sentence={b.slice(0, 3)} separate={s.separate} />
          </div>
          <FixedLines lines={[`With the setting ${s.separate ? 'on' : 'off'}, the two sentences add ${same ? 'the same' : 'different'} counts.`]} mono={false} testId="same-counts" />
        </>
      )}
      {s.screen3 === 'predict' && (
        <>
          {STEP3_PREDICT.map((p) => (
            <Note key={p.slice(0, 12)} style={{ color: 'var(--text)' }}>
              {p}
            </Note>
          ))}
          <Note>{`The prompt: ${usedPrompt.join(' ')}. ${hasThe ? '' : 'The grammar has no article, so the prompt is boys who dogs chase: a plural subject, boys, with a relative clause whose own noun, dogs, is also plural; the next word in the grammar is a plural verb.'}`}</Note>
          {!s.computed && <Note data-awaiting-commit>The two distributions appear once your prediction is committed on the left and “Compute” is pressed.</Note>}
          {s.computed && (
            <div data-reveal="ngram" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <GroupLabel>{`From the one word before: after ${usedPrompt[usedPrompt.length - 1]}`}</GroupLabel>
              <Note>{`Each probability is the count of ${usedPrompt[usedPrompt.length - 1]} followed by the word, divided by ${one.denominator.toLocaleString()}, the count of ${usedPrompt[usedPrompt.length - 1]} followed by anything. Plural verb forms are green, singular forms orange, other tokens blue. Summed: plural verbs ${plural(one).toFixed(2)}, singular verbs ${singular(one).toFixed(2)}.`}</Note>
              <BarChart bars={bars(one)} width={560} format={(v) => v.toFixed(3)} testId="from-one" />
              <GroupLabel>{`From the two words before: after ${usedPrompt.slice(-2).join(' ')}`}</GroupLabel>
              <Note>{`Each probability is the count of ${usedPrompt.slice(-2).join(' ')} followed by the word, divided by ${two.denominator.toLocaleString()}. Summed: plural verbs ${plural(two).toFixed(2)}, singular verbs ${singular(two).toFixed(2)}.`}</Note>
              <BarChart bars={bars(two)} width={560} format={(v) => v.toFixed(3)} testId="from-two" />
              <Note>{`Your prediction: ${s.predicted('counts')}. What decides each prediction is the word or two words just before it, ${usedPrompt[usedPrompt.length - 1]} alone or ${usedPrompt.slice(-2).join(' ')}; the subject of the sentence, boys, is further back than either count reaches.`}</Note>
            </div>
          )}
        </>
      )}
      {s.screen3 === 'point' && (
        <>
          {STEP3_ONE_POINT.map((p) => (
            <Note key={p.slice(0, 12)} style={{ color: 'var(--text)' }}>
              {p}
            </Note>
          ))}
          {s.model && !s.counting ? (
            <FixedLines lines={[`chases, in “boys who Mary chases walk”:  the one list of ${embedding(s.model, idx('chases')).length} counts`, `chases, in “Mary chases boys”:           the same list of ${embedding(s.model, idx('chases')).length} counts`, `the first ten counts of that list: ${Array.from(embedding(s.model, idx('chases')).slice(0, 10)).map((v) => Math.round(v)).join(' ')}`]} testId="one-point" />
          ) : (
            <Note>Run “Count” in Step 2 to see the list.</Note>
          )}
        </>
      )}
      <Content>{ONE_CORPUS_LINE}</Content>
    </StagePanel>
  )
}
