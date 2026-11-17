import { Fragment } from 'react'
import { Btn, Content, FixedLines, GroupLabel, Note, StagePanel } from '../ui'
import { ONE_CORPUS_LINE } from '../lines'
import { END, NOUNS, SETTINGS, VERBS, VOCABULARY, WHO, type Category, type VerbClass } from '../../../sim/language/predictors/grammar'
import { CLASS_NAMES, GRAMMAR_RULES, GRAMMAR_SYMBOLS, GROUP_NAMES, REWRITE_RULES, groupsInWords } from './texts'
import type { PredictorsStore } from './store'

/**
 * Step 1's screens (spec §8.2; Jon, 2026-11-17): in the center, above the
 * “Show me sentences” button, the rules of the world: the vocabulary by
 * group, each verb with what may be its subject and its object, the grammar
 * as rewrite rules with every symbol defined, the rules the symbols leave
 * out, and the generator's settings; all built from grammar.ts so that they
 * cannot go stale. Then the button, which prints 20 sentences at a time.
 */
const MONO = 'var(--font-mono)'
const grid = { display: 'grid', gridTemplateColumns: 'max-content minmax(0, 1fr)', gap: '3px 12px', fontSize: 11.5, lineHeight: 1.45 } as const
const muted = { color: 'var(--text-muted)' } as const

const forms = (n: { singular: string; plural: string | null }) => (n.plural ? `${n.singular}/${n.plural}` : n.singular)

/** The vocabulary by group: the nouns in their six groups, the verbs in their three classes, who, and the end mark. */
export function VocabularyBlock() {
  return (
    <div data-vocabulary style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      <GroupLabel>{`The vocabulary: ${VOCABULARY.length} tokens, by group`}</GroupLabel>
      <div style={grid}>
        {(Object.keys(GROUP_NAMES) as Category[]).map((g) => (
          <Fragment key={g}>
            <span style={muted}>{`nouns, ${GROUP_NAMES[g]}`}</span>
            <span style={{ fontFamily: MONO, overflowWrap: 'anywhere' }}>{NOUNS.filter((n) => n.category === g).map(forms).join('   ')}</span>
          </Fragment>
        ))}
        {(Object.keys(CLASS_NAMES) as VerbClass[]).map((cls) => (
          <Fragment key={cls}>
            <span style={muted}>{cls === 'transitive' ? 'verbs that need an object' : cls === 'optional' ? 'verbs that may have an object or not' : 'verbs that never have an object'}</span>
            <span style={{ fontFamily: MONO, overflowWrap: 'anywhere' }}>{VERBS.filter((v) => v.cls === cls).map(forms).join('   ')}</span>
          </Fragment>
        ))}
        <span style={muted}>the word who</span>
        <span style={{ fontFamily: MONO }}>{WHO}</span>
        <span style={muted}>the end mark</span>
        <span style={{ fontFamily: MONO }}>{END}</span>
      </div>
      <Note>A noun with two forms is written singular/plural. John and Mary have one form each, singular. A verb is written singular/plural too: the singular form goes with a singular subject (boy walks), the plural form with a plural one (boys walk).</Note>
      <GroupLabel>Each verb: what may be its subject, and what may be its object</GroupLabel>
      <div style={grid} data-verb-list>
        {VERBS.map((v) => (
          <Fragment key={v.singular}>
            <span style={{ fontFamily: MONO }}>{forms(v)}</span>
            <span>{`${CLASS_NAMES[v.cls]}; the subject is ${groupsInWords(v.subjects)}${v.cls === 'intransitive' ? '' : `; the object is ${groupsInWords(v.objects)}`}.`}</span>
          </Fragment>
        ))}
      </div>
    </div>
  )
}

/** The grammar as rewrite rules, with every symbol defined beside its use, then the rules the symbols leave out and the generator's settings. */
export function GrammarBlock() {
  return (
    <div data-grammar-rules style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      <GroupLabel>The grammar, as rewrite rules</GroupLabel>
      <Note>Four rules make every sentence in the corpus. Each rule is read as “is made of”; the symbols are defined under the rules.</Note>
      <div style={grid} data-rewrite-rules>
        {REWRITE_RULES.map((r) => (
          <Fragment key={r.rule}>
            <span style={{ fontFamily: MONO, whiteSpace: 'pre' }}>{r.rule}</span>
            <span style={muted}>{r.reading}</span>
          </Fragment>
        ))}
      </div>
      <GroupLabel>The symbols</GroupLabel>
      <div style={grid} data-grammar-symbols>
        {GRAMMAR_SYMBOLS.map((s) => (
          <Fragment key={s.symbol}>
            <span style={{ fontFamily: MONO, textAlign: 'center' }}>{s.symbol}</span>
            <span>{s.meaning}</span>
          </Fragment>
        ))}
      </div>
      <GroupLabel>The rules the symbols leave out</GroupLabel>
      {GRAMMAR_RULES.map((r) => (
        <Note key={r.slice(0, 16)} style={{ color: 'var(--text)' }}>
          {r}
        </Note>
      ))}
      <Note>{`The generator’s settings: a relative clause after a person or animal with probability ${SETTINGS.relativeClause} at the top level, halved at each level of nesting, to ${SETTINGS.maxDepth} levels; a subject-relative or an object-relative with equal probability; an optional object taken with probability ${SETTINGS.optionalObject}; a plural with probability ${SETTINGS.plural}.`}</Note>
    </div>
  )
}

export function Step1Stage({ s }: { s: PredictorsStore }) {
  return (
    <StagePanel wide testId="predictors-1">
      <div style={{ fontSize: 14, fontWeight: 600 }}>The corpus</div>
      <Note style={{ color: 'var(--text)' }}>{`The corpus is ${s.sentences.length.toLocaleString()} sentences, ${s.tokens.length.toLocaleString()} tokens in all, made by a generator from the vocabulary and the grammar below, from one fixed seed, so that every student sees the same corpus.`}</Note>
      <VocabularyBlock />
      <GrammarBlock />
      <GroupLabel>The sentences</GroupLabel>
      <Note>Press “Show me sentences” to print 20 sentences from the corpus, each on its own line. Press it again for the next 20.</Note>
      <div>
        <Btn primary onClick={() => s.showMore()} disabled={s.shown >= s.sentences.length}>
          Show me sentences
        </Btn>
      </div>
      {s.shown > 0 && <FixedLines lines={s.sentences.slice(Math.max(0, s.shown - 20), s.shown).map((sent, i) => `${String(s.shown - 20 + i + 1).padStart(5)}  ${sent.join(' ')}`)} testId="sentences" scroll />}
      {s.shown > 0 && <Note>{`Sentences ${s.shown - 19} to ${s.shown} of ${s.sentences.length.toLocaleString()}. Press “Show me sentences” again for the next 20.`}</Note>}
      <Content>{ONE_CORPUS_LINE}</Content>
    </StagePanel>
  )
}
