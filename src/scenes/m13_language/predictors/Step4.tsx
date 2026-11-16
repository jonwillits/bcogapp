import { Btn, Choice, Content, FixedLines, GroupLabel, Note, StagePanel } from '../ui'
import { BarChart } from '../plots'
import { ReferencePanel } from '../ReferencePanel'
import { reference } from '../../../sim/language/references'
import { NOT_ENGLISH_LINE, REAL_WEIGHTS_LINE, TRAINED_BEFORE_LINE } from '../lines'
import { VOCABULARY, kindOf, verbOf, END, WHO } from '../../../sim/language/predictors/grammar'
import type { TransformerOutput } from '../../../sim/language/predictors/runtime/seqNet'
import { STEP4_MODELS } from './texts'
import { PREDICTIONS, TEMPERATURES, type PredictorsStore } from './store'

/**
 * Step 4's screens (spec §8.5): the prompt palette from the parser, Allow
 * any token, the two next-token distributions grouped as nouns, verbs,
 * who and the end mark, attention as lines from the last token back to
 * each earlier token per layer and computation, the same word in two
 * sentences, and temperature with Generate a sentence.
 */
const groupOf = (t: string) => (t === WHO ? 'who' : t === END ? 'the end mark' : kindOf(t) === 'verb' ? 'verbs' : 'nouns')
const GROUPS = ['nouns', 'verbs', 'who', 'the end mark']

export function Step4Controls({ s }: { s: PredictorsStore }) {
  const ok = s.allPredicted4
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-step4-controls>
      {(['agree', 'temp'] as const).map((k) => {
        const committed = s.predicted(k)
        return (
          <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 8, border: '1px solid var(--border)', borderRadius: 8 }} data-predict={k}>
            <GroupLabel>Predict first</GroupLabel>
            <Note>{PREDICTIONS[k].question}</Note>
            {committed ? <FixedLines lines={[`Committed: ${committed}`]} mono={false} /> : <Choice value={s.drafts[k] ?? null} options={PREDICTIONS[k].choices.map((c) => ({ id: c, label: c }))} onChange={(c) => s.draft(k, c)} />}
          </div>
        )
      })}
      {!ok && (
        <div>
          <Btn
            primary
            onClick={() => {
              s.commit('agree')
              s.commit('temp')
            }}
            disabled={!s.drafts.agree || !s.drafts.temp}
          >
            Commit my predictions
          </Btn>
        </div>
      )}
      <GroupLabel>Temperature</GroupLabel>
      <input type="range" min={TEMPERATURES.min} max={TEMPERATURES.max} step={TEMPERATURES.step} value={s.temperature} onChange={(e) => s.setTemperature(Number(e.target.value))} aria-label="Temperature" disabled={!ok} style={{ width: '100%' }} />
      <FixedLines lines={[`${s.temperature.toFixed(1)}`]} />
      <div>
        <Btn onClick={() => s.generate()} disabled={!ok || !s.final}>
          Generate a sentence
        </Btn>
      </div>
    </div>
  )
}

function Distribution({ probs, title, testId }: { probs: Float64Array; title: string; testId: string }) {
  const bars = GROUPS.flatMap((g) =>
    VOCABULARY.map((t, j) => ({ t, j }))
      .filter(({ t }) => groupOf(t) === g)
      .sort((a, b) => probs[b.j] - probs[a.j])
      .slice(0, g === 'nouns' ? 10 : 20)
      .map(({ t, j }) => ({ label: t, value: probs[j], group: g, color: g === 'verbs' ? (verbOf(t)!.number === 'pl' ? 'var(--actuator)' : 'var(--sensor)') : g === 'nouns' ? 'var(--accent)' : 'var(--text-muted)' })),
  )
  const sums = GROUPS.map((g) => `${g}: ${VOCABULARY.reduce((a, t, j) => a + (groupOf(t) === g ? probs[j] : 0), 0).toFixed(2)}`)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }} data-distribution={testId}>
      <GroupLabel>{title}</GroupLabel>
      <Note>{`Summed by group: ${sums.join('; ')}. The ten most probable nouns are shown, and every verb.`}</Note>
      <BarChart bars={bars} width={300} max={1} format={(v) => v.toFixed(3)} rowH={12} testId={testId} />
    </div>
  )
}

export function Attention({ out, tokens }: { out: TransformerOutput; tokens: string[] }) {
  const T = tokens.length
  const w = 300
  const xs = tokens.map((_, i) => 20 + (i * (w - 40)) / Math.max(1, T - 1))
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }} data-attention>
      {out.attention.map((layer, L) =>
        layer.map((head, h) => (
          <svg key={`${L}-${h}`} width={w} height={90} viewBox={`0 0 ${w} 90`} data-attention-panel={`layer ${L + 1}, computation ${h + 1}`} style={{ background: 'var(--bg)', borderRadius: 8 }}>
            <text x={6} y={12} fontSize={9} fill="var(--text-muted)">{`layer ${L + 1}, attention computation ${h + 1}`}</text>
            {tokens.map((t, i) => (
              <text key={i} x={xs[i]} y={84} fontSize={9} textAnchor="middle" fill="var(--text)">
                {t}
              </text>
            ))}
            {head[T - 1].map((wt, j) => (
              <path key={j} d={`M ${xs[T - 1]} 72 Q ${(xs[T - 1] + xs[j]) / 2} ${72 - 40 * Math.min(1, (xs[T - 1] - xs[j]) / (w - 40) + 0.2)} ${xs[j]} 72`} fill="none" stroke="var(--sensor)" strokeWidth={Math.max(0.4, 6 * wt)} opacity={0.9}>
                <title>{`${tokens[T - 1]} to ${tokens[j]}: ${wt.toFixed(3)}`}</title>
              </path>
            ))}
          </svg>
        )),
      )}
    </div>
  )
}

export function Step4Stage({ s }: { s: PredictorsStore }) {
  const out = s.outputs()
  const ok = s.allPredicted4
  const last = (o: { probs: Float64Array[] }) => o.probs[o.probs.length - 1]
  const two = s.final ? [s.outputs(['boys', 'who', 'Mary', 'chases', 'walk']), s.outputs(['Mary', 'chases', 'boys'])] : null
  const chasesIn = (o: TransformerOutput | null, pos: number) => (o ? Array.from(o.hidden[o.hidden.length - 1][pos].slice(0, 12)) : null)
  return (
    <StagePanel wide testId="predictors-4">
      <div style={{ fontSize: 14, fontWeight: 600 }}>A simple recurrent network and a transformer</div>
      {STEP4_MODELS.map((p) => (
        <Note key={p.slice(0, 12)} style={{ color: 'var(--text)' }}>
          {p}
        </Note>
      ))}
      {s.descs && <FixedLines lines={[`transformer: ${s.descs.transformer.params.toLocaleString()} weights; held-out next-token accuracy ${(100 * s.descs.transformer.snapshots[s.descs.transformer.snapshots.length - 1].heldOutAccuracy).toFixed(1)}% after ${s.descs.transformer.snapshots[s.descs.transformer.snapshots.length - 1].updates.toLocaleString()} updates`, `recurrent network: ${s.descs.srn.params.toLocaleString()} weights; held-out next-token accuracy ${(100 * s.descs.srn.snapshots[s.descs.srn.snapshots.length - 1].heldOutAccuracy).toFixed(1)}% after ${s.descs.srn.snapshots[s.descs.srn.snapshots.length - 1].updates.toLocaleString()} updates`]} testId="model-sizes" />}
      {s.loadError && <Note data-load-error>{s.loadError}</Note>}
      {!s.final && !s.loadError && <Note data-loading>The two networks are loading.</Note>}
      <Content>{TRAINED_BEFORE_LINE}</Content>
      {!ok && <Note data-awaiting-commit>The palette, the distributions, and the attention appear once your two predictions are committed on the left.</Note>}
      {ok && (
        <div data-reveal="networks" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <GroupLabel>Your prompt</GroupLabel>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }} data-prompt>
            <FixedLines lines={[s.prompt.length ? s.prompt.join(' ') : '(empty: click a token below)']} />
            {!s.promptAllowed && <Note data-not-allowed>not a sentence the grammar allows</Note>}
            <Btn small onClick={() => s.removeLast()} disabled={!s.prompt.length}>
              Remove the last token
            </Btn>
            <Btn small onClick={() => s.clearPrompt()} disabled={!s.prompt.length}>
              Clear the prompt
            </Btn>
            <label style={{ fontSize: 12, display: 'flex', gap: 6, alignItems: 'center' }}>
              <input type="checkbox" checked={s.anyToken} onChange={(e) => s.setAnyToken(e.target.checked)} /> Allow any token
            </label>
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }} data-palette>
            {s.palette.map((t) => (
              <button key={t} type="button" onClick={() => s.addToken(t)} style={{ padding: '3px 8px', fontSize: 11.5, borderRadius: 999, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', cursor: 'pointer' }}>
                {t}
              </button>
            ))}
            {s.palette.length === 0 && <Note>{s.parse.complete ? 'The prompt is a complete sentence. Clear it, or remove the end mark, to go on.' : 'The grammar allows no token here. Turn on “Allow any token” to add one anyway.'}</Note>}
          </div>
          {out && (
            <>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <Distribution probs={last(out.transformer)} title="The transformer: probability of each token as the next" testId="transformer" />
                <Distribution probs={last(out.srn)} title="The recurrent network: probability of each token as the next" testId="srn" />
              </div>
              <GroupLabel>Attention in the transformer, for the last token of your prompt</GroupLabel>
              <Note>Each panel is one attention computation in one layer: lines run from the last token back to each earlier token, and to itself, with a line’s thickness set by the weight the computation gives that position. The weights in a panel sum to one. Hover a line for its number.</Note>
              <Attention out={out.transformer} tokens={s.prompt} />
              <Content>{REAL_WEIGHTS_LINE}</Content>
            </>
          )}
          {two && two[0] && two[1] && (
            <>
              <GroupLabel>The same word in two sentences</GroupLabel>
              <Note>The transformer’s numbers for chases at its last layer, in boys who Mary chases walk (position 4) and in Mary chases boys (position 2): the first 12 of the 32 numbers, as bars. In the count model of Step 3, chases had one list whatever the sentence.</Note>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }} data-same-word>
                {[
                  ['boys who Mary chases walk', chasesIn(two[0].transformer, 3)],
                  ['Mary chases boys', chasesIn(two[1].transformer, 1)],
                ].map(([title, vals]) => (
                  <div key={title as string}>
                    <Note>{title as string}</Note>
                    <BarChart bars={(vals as number[]).map((v, i) => ({ label: `n${i + 1}`, value: Math.abs(v), color: v >= 0 ? 'var(--accent)' : 'var(--avoid)' }))} width={240} rowH={11} format={(v) => v.toFixed(2)} />
                  </div>
                ))}
              </div>
              <Note>A blue bar is a positive number and a red bar a negative one; the length is the size.</Note>
            </>
          )}
          <GroupLabel>Generated sentences</GroupLabel>
          <Note>{`“Generate a sentence” samples one token at a time from the transformer’s probabilities at the temperature on the left, from the start of a sentence, until the end mark or 32 tokens. A low temperature favors the most probable tokens; a high one flattens the probabilities. Each sentence is marked with whether the grammar allows it.`}</Note>
          {s.generated.length > 0 && <FixedLines lines={s.generated.map((g) => `T ${g.temperature.toFixed(1)}  ${g.allowed ? 'allowed    ' : 'not allowed'}  ${g.tokens.join(' ')}`)} testId="generated" />}
          <Content>{NOT_ENGLISH_LINE}</Content>
          <Note>{`Your predictions: after boys who Mary chases, ${s.predicted('agree')}; at temperature 2.0, ${s.predicted('temp')}.`}</Note>
          <ReferencePanel reference={reference('elman-1991')} />
          <ReferencePanel reference={reference('mao-2025')} />
        </div>
      )}
    </StagePanel>
  )
}
