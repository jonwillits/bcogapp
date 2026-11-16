import { Btn, Content, FixedLines, GroupLabel, Note, StagePanel } from '../ui'
import { ONE_CORPUS_LINE } from '../lines'
import { SETTINGS, VOCABULARY } from '../../../sim/language/predictors/grammar'
import { GRAMMAR_RULES } from './texts'
import type { PredictorsStore } from './store'

/** Step 1's screens (spec §8.2): Show me sentences prints 20 sentences; the panel lists the grammar's rules in plain sentences and what the corpus is for. */
export function Step1Stage({ s }: { s: PredictorsStore }) {
  return (
    <StagePanel wide testId="predictors-1">
      <div style={{ fontSize: 14, fontWeight: 600 }}>The corpus</div>
      <Note style={{ color: 'var(--text)' }}>{`The corpus is ${s.sentences.length.toLocaleString()} sentences, ${s.tokens.length.toLocaleString()} tokens in all, made by a generator from the grammar on the right, from one fixed seed, so that every student sees the same corpus. The vocabulary has ${VOCABULARY.length} tokens: ${VOCABULARY.join(' ')}.`}</Note>
      <div>
        <Btn primary onClick={() => s.showMore()} disabled={s.shown >= s.sentences.length}>
          Show me sentences
        </Btn>
      </div>
      {s.shown > 0 && <FixedLines lines={s.sentences.slice(Math.max(0, s.shown - 20), s.shown).map((sent, i) => `${String(s.shown - 20 + i + 1).padStart(5)}  ${sent.join(' ')}`)} testId="sentences" />}
      {s.shown > 0 && <Note>{`Sentences ${s.shown - 19} to ${s.shown} of ${s.sentences.length.toLocaleString()}. Press “Show me sentences” again for the next 20.`}</Note>}
      <Content>{ONE_CORPUS_LINE}</Content>
    </StagePanel>
  )
}

export function Step1Panel() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }} data-grammar-rules>
      <GroupLabel>The grammar’s rules</GroupLabel>
      {GRAMMAR_RULES.map((r) => (
        <Note key={r.slice(0, 16)} style={{ color: 'var(--text)' }}>
          {r}
        </Note>
      ))}
      <Note>{`The generator’s settings: a relative clause after a person or animal with probability ${SETTINGS.relativeClause} at the top level, halved at each level of nesting, to ${SETTINGS.maxDepth} levels; a subject-relative or an object-relative with equal probability; an optional object taken with probability ${SETTINGS.optionalObject}; a plural with probability ${SETTINGS.plural}.`}</Note>
    </div>
  )
}
