import type { ReactNode } from 'react'
import { Btn, Choice, Content, FixedLines, GroupLabel, Note, StagePanel, useRef, useWidth } from '../ui'
import { BarChart } from '../plots'
import { ReferencePanel } from '../ReferencePanel'
import { reference } from '../../../sim/language/references'
import { NOT_ENGLISH_LINE, REAL_WEIGHTS_LINE, TRAINED_BEFORE_LINE } from '../lines'
import { VOCABULARY, kindOf, verbOf, END, WHO } from '../../../sim/language/predictors/grammar'
import type { TransformerOutput } from '../../../sim/language/predictors/runtime/seqNet'
import { STEP4_INTRO, STEP4_SRN, STEP4_TRANSFORMER, TEMPERATURE_LINE } from './texts'
import { SrnSchematic, TransformerSchematic } from './Schematics'
import { PREDICTIONS, TEMPERATURES, type CountPrediction, type PredictorsStore } from './store'

/**
 * Step 4's screens (spec §8.5; Jon, 2026-11-17: everything in the center;
 * Jon, 2026-11-19: the two networks drawn side by side with their texts
 * under the drawings; three next-token distributions at the panel's width,
 * the prediction from counts beside the two networks, in the order count
 * model, recurrent network, transformer everywhere (Jon, 2026-11-20); the palette offers
 * the whole vocabulary with the grammar's next tokens outlined; Generate a
 * sentence draws from both networks at once; 2026-11-20: the one
 * prediction, the temperature line, no size lines). The prediction and
 * Commit above the palette; attention as lines from the last token back to
 * each earlier token per layer and computation; the same word in two
 * sentences; Temperature and Generate a sentence beside the generated
 * sentences in two columns.
 */
const groupOf = (t: string) => (t === WHO ? 'who' : t === END ? 'the end mark' : kindOf(t) === 'verb' ? 'verbs' : 'nouns')
const GROUPS = ['nouns', 'verbs', 'who', 'the end mark']
const GAP = 16

/** The one prediction, asked once, above what it predicts (Jon, 2026-11-20: the temperature prediction was cut). */
export function Step4Predictions({ s }: { s: PredictorsStore }) {
  const ok = s.allPredicted4
  const committed = s.predicted('agree')
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-step4-controls>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 8, border: '1px solid var(--border)', borderRadius: 8, maxWidth: 560, minWidth: 0 }} data-predict="agree">
        <GroupLabel>Predict first</GroupLabel>
        <Note>{PREDICTIONS.agree.question}</Note>
        {committed ? <FixedLines lines={[`Committed: ${committed}`]} mono={false} /> : <Choice value={s.drafts.agree ?? null} options={PREDICTIONS.agree.choices.map((c) => ({ id: c, label: c }))} onChange={(c) => s.draft('agree', c)} />}
      </div>
      {!ok && (
        <div>
          <Btn primary onClick={() => s.commit('agree')} disabled={!s.drafts.agree}>
            Commit my prediction
          </Btn>
        </div>
      )}
    </div>
  )
}

/** Temperature and Generate a sentence, beside the generated sentences. */
function GenerateControls({ s }: { s: PredictorsStore }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: 220, flexShrink: 0 }} data-step4-generate>
      <GroupLabel>Temperature</GroupLabel>
      <input type="range" min={TEMPERATURES.min} max={TEMPERATURES.max} step={TEMPERATURES.step} value={s.temperature} onChange={(e) => s.setTemperature(Number(e.target.value))} aria-label="Temperature" style={{ width: '100%' }} />
      <FixedLines lines={[`${s.temperature.toFixed(1)}`]} />
      <div>
        <Btn onClick={() => s.generate()} disabled={!s.final}>
          Generate a sentence
        </Btn>
      </div>
    </div>
  )
}

/**
 * The line under a chart of the prediction from counts: which words it was
 * computed from, and the division. Its box is the height of its longest
 * form, four lines at a chart's width, so that what stands under it does
 * not move when the prompt changes (Jon, 2026-11-20); a very long form
 * still grows past it.
 */
export const COUNT_NOTE_LINES = 4
export function CountNote({ c }: { c: CountPrediction }) {
  const two = c.from === 'two'
  const text = c.denominator === 0 ? 'The count model has not counted any sentence yet, so every probability is zero.' : two ? `From the two words before, “${c.context.join(' ')}”: each probability is the count of “${c.context.join(' ')}” followed by that token, divided by ${c.denominator.toLocaleString()}, the count of “${c.context.join(' ')}” followed by anything.` : `The two words before never occurred together in the corpus, so the prediction is from the one word before, “${c.context[0]}”: each probability is the count of “${c.context[0]}” followed by that token, divided by ${c.denominator.toLocaleString()}, the count of “${c.context[0]}” followed by anything.`
  return (
    <Note data-count-from={c.denominator === 0 ? 'none' : c.from} style={{ minHeight: `${COUNT_NOTE_LINES * 1.45}em` }}>
      {text}
    </Note>
  )
}

/** The palette of every token, pressed to append to a prompt; the ones the grammar allows next are outlined (Steps 4 and 5). */
export function PromptPalette({ tokens, allowed, complete, promptAllowed, onAdd }: { tokens: string[]; allowed: Set<string>; complete: boolean; promptAllowed: boolean; onAdd: (t: string) => void }) {
  return (
    <>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }} data-palette>
        {tokens.map((t) => (
          <button key={t} type="button" onClick={() => onAdd(t)} disabled={complete} data-allowed={allowed.has(t) || undefined} style={{ padding: '3px 8px', fontSize: 11.5, borderRadius: 999, border: `2px solid ${allowed.has(t) ? 'var(--accent)' : 'var(--border)'}`, background: 'var(--surface-2)', color: 'var(--text)', cursor: complete ? 'default' : 'pointer', opacity: complete ? 0.6 : 1 }}>
            {t}
          </button>
        ))}
      </div>
      <Note data-palette-line>{complete ? 'The prompt is a complete sentence. Clear it, or remove the end mark, to go on.' : promptAllowed ? 'The outlined tokens are the ones the grammar allows next. You can press any token.' : 'The grammar does not allow this prompt, so it allows no next token and none is outlined. You can still press any token.'}</Note>
    </>
  )
}

/** How many charts sit in one row at a panel width, and each chart's width. */
export function chartColumns(w: number, n = 3): { cols: number; width: number } {
  const cols = Math.min(n, w >= 960 ? 3 : w >= 640 ? 2 : 1)
  return { cols, width: Math.max(220, Math.floor((w - GAP * (cols - 1)) / cols)) }
}

function Distribution({ probs, title, testId, width, children }: { probs: ArrayLike<number>; title: string; testId: string; width: number; children?: ReactNode }) {
  const bars = GROUPS.flatMap((g) =>
    VOCABULARY.map((t, j) => ({ t, j }))
      .filter(({ t }) => groupOf(t) === g)
      .sort((a, b) => probs[b.j] - probs[a.j])
      .slice(0, g === 'nouns' ? 10 : 20)
      .map(({ t, j }) => ({ label: t, value: probs[j], group: g, color: g === 'verbs' ? (verbOf(t)!.number === 'pl' ? 'var(--actuator)' : 'var(--sensor)') : g === 'nouns' ? 'var(--accent)' : 'var(--text-muted)' })),
  )
  const sums = GROUPS.map((g) => `${g === 'who' ? '“who”' : g}: ${VOCABULARY.reduce((a, t, j) => a + (groupOf(t) === g ? probs[j] : 0), 0).toFixed(2)}`)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width, minWidth: 0 }} data-distribution={testId}>
      <GroupLabel>{title}</GroupLabel>
      <Note>{`Summed by group: ${sums.join('; ')}. The ten most probable nouns are shown, and every verb.`}</Note>
      <BarChart bars={bars} width={width} max={1} format={(v) => v.toFixed(3)} rowH={12} testId={testId} />
      {children}
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
                <title>{`“${tokens[T - 1]}” to “${tokens[j]}”: ${wt.toFixed(3)}`}</title>
              </path>
            ))}
          </svg>
        )),
      )}
    </div>
  )
}

/** The generated sentences of one network, one line per press of Generate a sentence, each marked allowed or not. */
function GeneratedColumn({ title, lines, testId }: { title: string; lines: { temperature: number; tokens: string[]; allowed: boolean }[]; testId: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 280px', minWidth: 0 }} data-generated={testId}>
      <GroupLabel>{title}</GroupLabel>
      {lines.length > 0 ? <FixedLines lines={lines.map((g) => `T ${g.temperature.toFixed(1)}  ${g.allowed ? 'allowed    ' : 'not allowed'}  ${g.tokens.join(' ')}`)} testId={testId} scroll /> : <Note>No sentence yet.</Note>}
    </div>
  )
}

export function Step4Stage({ s }: { s: PredictorsStore }) {
  const ref = useRef<HTMLDivElement>(null)
  const w = useWidth(ref, 960)
  const twoColumns = w >= 760
  const { width: chartW } = chartColumns(w)
  const out = s.outputs()
  const count = s.countPrediction(s.prompt)
  const ok = s.allPredicted4
  const last = (o: { probs: Float64Array[] }) => o.probs[o.probs.length - 1]
  const two = s.final ? [s.outputs(['boys', 'who', 'Mary', 'chases', 'walk']), s.outputs(['Mary', 'chases', 'boys'])] : null
  const chasesIn = (o: TransformerOutput | null, pos: number) => (o ? Array.from(o.hidden[o.hidden.length - 1][pos].slice(0, 12)) : null)
  const allowed = new Set(s.allowedNext)
  const complete = s.parse.complete
  return (
    <StagePanel wide testId="predictors-4">
      <div ref={ref} style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0, width: '100%' }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>A simple recurrent network and a transformer</div>
        <Note style={{ color: 'var(--text)' }}>{STEP4_INTRO}</Note>
        <div style={{ display: 'flex', flexDirection: twoColumns ? 'row' : 'column', gap: GAP, alignItems: 'flex-start' }} data-schematics>
          <div style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <GroupLabel>The simple recurrent network</GroupLabel>
            <SrnSchematic />
            {STEP4_SRN.map((p) => (
              <Note key={p.slice(0, 20)} style={{ color: 'var(--text)' }}>
                {p}
              </Note>
            ))}
          </div>
          <div style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <GroupLabel>The transformer</GroupLabel>
            <TransformerSchematic />
            {STEP4_TRANSFORMER.map((p) => (
              <Note key={p.slice(0, 20)} style={{ color: 'var(--text)' }}>
                {p}
              </Note>
            ))}
          </div>
        </div>
        {s.loadError && <Note data-load-error>{s.loadError}</Note>}
        {!s.final && !s.loadError && <Note data-loading>The two networks are loading.</Note>}
        <Content>{TRAINED_BEFORE_LINE}</Content>
        <Step4Predictions s={s} />
        {!ok && <Note data-awaiting-commit>The palette, the three bar charts, and the attention panels appear once you have committed your prediction above.</Note>}
        {ok && (
          <div data-reveal="networks" style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
            <GroupLabel>Your prompt</GroupLabel>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }} data-prompt>
              <FixedLines lines={[s.prompt.length ? s.prompt.join(' ') : '(empty: press a token below)']} />
              {!s.promptAllowed && <Note data-not-allowed>not a sentence the grammar allows</Note>}
              <Btn small onClick={() => s.removeLast()} disabled={!s.prompt.length}>
                Remove the last token
              </Btn>
              <Btn small onClick={() => s.clearPrompt()} disabled={!s.prompt.length}>
                Clear the prompt
              </Btn>
            </div>
            <PromptPalette tokens={s.palette} allowed={allowed} complete={complete} promptAllowed={s.promptAllowed} onAdd={(t) => s.addToken(t)} />
            {out && count && (
              <>
                <div style={{ display: 'flex', gap: GAP, flexWrap: 'wrap', alignItems: 'flex-start' }} data-distributions>
                  <Distribution probs={count.probs} title="The prediction from counts: probability of each token as the next" testId="counts" width={chartW}>
                    <CountNote c={count} />
                  </Distribution>
                  <Distribution probs={last(out.srn)} title="The recurrent network: probability of each token as the next" testId="srn" width={chartW} />
                  <Distribution probs={last(out.transformer)} title="The transformer: probability of each token as the next" testId="transformer" width={chartW} />
                </div>
                <GroupLabel>Attention in the transformer, for the last token of your prompt</GroupLabel>
                <Note>Each panel is one attention computation in one layer. Lines run from the last token back to each earlier token, and to the last token itself. A line’s thickness is set by the weight the computation gives that position; the weights in a panel sum to one. Hover a line to see its number.</Note>
                <Attention out={out.transformer} tokens={s.prompt} />
                <Content>{REAL_WEIGHTS_LINE}</Content>
              </>
            )}
            {two && two[0] && two[1] && (
              <>
                <GroupLabel>The same word in two sentences</GroupLabel>
                <Note>The bars are the transformer’s numbers for “chases” after its last layer, the first 12 of the 32, in “boys who Mary chases walk” (position 4) and in “Mary chases boys” (position 2). In the count model of Step 3, “chases” had one list whatever the sentence.</Note>
                <div style={{ display: 'flex', gap: GAP, flexWrap: 'wrap' }} data-same-word>
                  {[
                    ['boys who Mary chases walk', chasesIn(two[0].transformer, 3)],
                    ['Mary chases boys', chasesIn(two[1].transformer, 1)],
                  ].map(([title, vals]) => (
                    <div key={title as string}>
                      <Note>{`“${title as string}”`}</Note>
                      <BarChart bars={(vals as number[]).map((v, i) => ({ label: `n${i + 1}`, value: Math.abs(v), color: v >= 0 ? 'var(--accent)' : 'var(--avoid)' }))} width={240} rowH={11} format={(v) => v.toFixed(2)} />
                    </div>
                  ))}
                </div>
                <Note>A blue bar is a positive number and a red bar a negative one; the length is the size.</Note>
              </>
            )}
            <GroupLabel>Generated sentences</GroupLabel>
            <Note>{`Press “Generate a sentence” to draw one sentence from each network at the temperature set beside the button. The networks were trained on sentences from their first word on, so the first token is drawn by how often each token begins a sentence in the corpus. Every token after it is drawn from the network’s probabilities, one at a time, until the end mark or 32 tokens. Each sentence is marked with whether the grammar allows it. The newest pair is at the top.`}</Note>
            <Note data-temperature-line>{TEMPERATURE_LINE}</Note>
            <div style={{ display: 'flex', gap: GAP, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <GenerateControls s={s} />
              <div style={{ display: 'flex', gap: GAP, flexWrap: w >= 640 ? 'nowrap' : 'wrap', flex: '1 1 400px', minWidth: 0 }} data-generated-columns>
                <GeneratedColumn title="The recurrent network" lines={s.generated.map((g) => g.srn)} testId="generated-srn" />
                <GeneratedColumn title="The transformer" lines={s.generated.map((g) => g.transformer)} testId="generated" />
              </div>
            </div>
            <Content>{NOT_ENGLISH_LINE}</Content>
            <Note>{`Your prediction: after “boys who Mary chases”, ${s.predicted('agree')}.`}</Note>
            <ReferencePanel reference={reference('elman-1991')} />
            <ReferencePanel reference={reference('mao-2025')} />
          </div>
        )}
      </div>
    </StagePanel>
  )
}
