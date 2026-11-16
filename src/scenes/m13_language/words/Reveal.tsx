import type { ProgressStore } from '../../../sim/language/progress/store'
import { Content, FixedLines, GroupLabel, Note, Para, Section } from '../ui'
import { LinePlot } from '../plots'
import { makeDesign, isCorrect, OCCURRENCES } from '../../../sim/language/words/design'
import { keyMeasure } from '../../../sim/language/words/keyMeasure'
import { RESTARTED_LINE } from '../lines'
import { objectUrl, type ObjectFile, type WordFile } from './assets'
import { WORDS_UNIT, type WordsResult } from './store'

/**
 * The reveal of Steps 1 and 2 (spec §7.2), once the test is done: the
 * percentage correct at each of a word's 5 occurrences with chance marked,
 * the test score out of 12 with chance, and every word with its object and
 * the student's five choices. The written words appear here for the first
 * time. The key measure is Step 3's.
 */
export function WordsReveal({ seed, result, words, objects }: { seed: number; result: WordsResult; words: WordFile[]; objects: ObjectFile[] }) {
  const d = makeDesign(seed, result.materials)
  const km = keyMeasure(d, result.choices)
  const testScore = d.test.filter((t, k) => isCorrect(d, t, result.testChoices[k])).length
  const byWord = d.pairing.map((obj, w) => {
    const trials = d.learning.map((t, i) => ({ t, i })).filter(({ t }) => t.word === w)
    return { w, obj, choices: trials.map(({ t, i }) => ({ chosen: result.choices[i], right: isCorrect(d, t, result.choices[i]) })) }
  })
  const name = (w: number) => words[w]?.word ?? `word ${w + 1}`
  const objId = (o: number) => objects[o]?.id ?? `object ${o + 1}`
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }} data-reveal="words">
      {result.restarts > 0 && <Content>{RESTARTED_LINE}</Content>}
      {result.materials === 1 && <Note>These are the reserve set of 12 words and 12 objects, used because the first set was interrupted.</Note>}
      <Section n={1} title="Your accuracy at each occurrence">
        <Para>Each word occurred 5 times in the 60 learning trials. The line is the percentage of the 12 words you clicked correctly at the first occurrence, the second, and so on. Chance is 20%, one object in five.</Para>
        <LinePlot series={[{ label: 'percent correct', color: 'var(--accent)', points: km.byOccurrence.map((v, i) => [i + 1, 100 * v] as [number, number]) }]} width={400} height={180} xLabel="occurrence of a word, 1 to 5" yLabel="percent of 12 words correct" xMin={1} xMax={OCCURRENCES} xTicks={[1, 2, 3, 4, 5].map((x) => ({ x, label: String(x) }))} hLines={[{ y: 20, label: 'chance, 20%' }]} testId="by-occurrence" />
        <FixedLines lines={km.byOccurrence.map((v, i) => `occurrence ${i + 1}: ${String(Math.round(12 * v)).padStart(2)} of 12 correct`)} testId="by-occurrence-table" />
      </Section>
      <Section n={2} title="The test">
        <Para>On the test, each word occurred once more with four objects on the screen. Chance is 25%, one in four.</Para>
        <FixedLines lines={[`Test score: ${testScore} of 12 (${Math.round((100 * testScore) / 12)}%)`]} testId="test-score" />
      </Section>
      <Section n={3} title="Every word, its object, and your five choices">
        <Para>One row per word: the word as written, the object it named, and what you clicked at each of its five occurrences, with a check for the right object.</Para>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }} data-word-table>
          {byWord.map(({ w, obj, choices }) => (
            <div key={w} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5 }} data-word-row={name(w)}>
              <span style={{ width: 60, fontFamily: 'var(--font-mono)' }}>{name(w)}</span>
              <img src={objectUrl(objId(obj))} alt="" width={28} height={28} />
              <span style={{ color: 'var(--text-muted)', width: 12 }}>=</span>
              {choices.map((c, k) => (
                <span key={k} title={c.right ? 'right' : 'wrong'} style={{ display: 'inline-flex', alignItems: 'center', gap: 2, padding: '1px 3px', borderRadius: 4, border: `1px solid ${c.right ? 'var(--actuator)' : 'var(--border)'}` }}>
                  <img src={objectUrl(objId(c.chosen))} alt="" width={22} height={22} />
                  <span style={{ fontSize: 10, color: c.right ? 'var(--actuator)' : 'var(--text-muted)' }}>{c.right ? 'right' : 'wrong'}</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </Section>
    </div>
  )
}

export function WordsResults({ progress, words, objects }: { progress: ProgressStore; words: WordFile[]; objects: ObjectFile[] }) {
  const r = progress.result(WORDS_UNIT) as WordsResult | undefined
  if (!r) return <Note>Part 3’s experiment is not finished yet.</Note>
  return (
    <div data-results="words">
      <GroupLabel>Steps 1 and 2</GroupLabel>
      <WordsReveal seed={progress.seed} result={r} words={words} objects={objects} />
    </div>
  )
}
