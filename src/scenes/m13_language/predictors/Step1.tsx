import { Fragment } from 'react'
import { Btn, Content, DataTable, FixedLines, GroupLabel, Note, StagePanel } from '../ui'
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
 * cannot go stale. The verbs are a table with labeled columns (Jon,
 * 2026-11-19). Then the button, which prints 20 sentences at a time; the
 * button that comes next is at the end (`NextRow`).
 */
const MONO = 'var(--font-mono)'
const grid = { display: 'grid', gridTemplateColumns: 'max-content minmax(0, 1fr)', gap: '3px 12px', fontSize: 11.5, lineHeight: 1.45 } as const
const muted = { color: 'var(--text-muted)' } as const

const forms = (n: { singular: string; plural: string | null }) => (n.plural ? `${n.singular}/${n.plural}` : n.singular)
/** The verb table's Object? column (Jon, 2026-11-19): one word per class. */
const OBJECT_WORD: Record<VerbClass, string> = { transitive: 'required', optional: 'optional', intransitive: 'never' }

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
        <span style={muted}>the word “who”</span>
        <span style={{ fontFamily: MONO }}>{WHO}</span>
        <span style={muted}>the end mark</span>
        <span style={{ fontFamily: MONO }}>{END}</span>
      </div>
      <Note>The proper nouns, “John” and “Mary”, have a single form each. All other nouns have two forms, singular and plural, written singular/plural. As in English, verbs can be singular or plural too, written the same way. The singular verb form goes with a singular subject (for example, “boy walks”), and the plural verb form with a plural subject (for example, “boys walk”).</Note>
      <GroupLabel>Each verb: what may be its subject, and what may be its object</GroupLabel>
      <DataTable
        testId="verb-list"
        columns={[
          { key: 'verb', label: 'Verb', mono: true, align: 'left' },
          { key: 'subject', label: 'Subject group' },
          { key: 'object', label: 'Object?' },
          { key: 'objectGroup', label: 'Object group' },
        ]}
        rows={VERBS.map((v) => ({ verb: forms(v), subject: groupsInWords(v.subjects), object: OBJECT_WORD[v.cls], objectGroup: v.cls === 'intransitive' ? '—' : groupsInWords(v.objects) }))}
      />
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
      <Note style={{ color: 'var(--text)' }}>{`The corpus is ${s.sentences.length.toLocaleString()} sentences, ${s.corpusTokens.toLocaleString()} tokens in all. Each sentence is made by a generator function that uses the vocabulary and the grammar (rules for how to combine words) below. The sentences are generated pseudo-randomly, using a single fixed seed for all students, so you all see the same sentences.`}</Note>
      <Note style={{ color: 'var(--text)' }} data-held-out>{`Every model in this part learns from the first ${s.training.length.toLocaleString()} sentences only. The last ${s.heldOut.length.toLocaleString()} sentences, ${(s.training.length + 1).toLocaleString()} to ${s.sentences.length.toLocaleString()}, are held out as test sentences, to see how each model performs on sentences it has never seen. No model learns from them, and Step 5 tests the models on them.`}</Note>
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
