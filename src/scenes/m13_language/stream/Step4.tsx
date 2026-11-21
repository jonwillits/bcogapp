import { Btn, Choice, Content, DataTable, FixedLines, GroupLabel, LoadingLine, Note, StagePanel } from '../ui'
import { BarChart } from '../plots'
import { ReferencePanel } from '../ReferencePanel'
import { reference } from '../../../sim/language/references'
import { REAL_SPEECH_LINE } from '../lines'
import { STEP4_PANEL } from './texts'
import type { StreamStore } from './store'

/**
 * Step 4's screens (spec §6.4), all in the center (the left column is
 * navigation only; Jon, 2026-11-16): a menu of utterances, the strip with
 * the transitional probability above each pair and the true boundaries
 * under it, Show stress, the histogram of transitional probabilities inside
 * words and across boundaries in the sample beside the made-up language's,
 * the dips learner's two shares on both, the other cues, and the pending
 * reference.
 */
function Step4Controls({ s }: { s: StreamStore }) {
  const r = s.real
  if (!r) return <LoadingLine text="Loading the sample." testId="stream-4-controls" />
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-step4-controls>
      <GroupLabel>Utterance</GroupLabel>
      <Choice value={String(s.utterance)} options={r.utterances.map((u, i) => ({ id: String(i), label: u.words.join(' ') }))} onChange={(v) => s.chooseUtterance(Number(v))} />
      <div>
        <Btn onClick={() => s.toggleStress()}>{s.showStress ? 'Hide stress' : 'Show stress'}</Btn>
      </div>
    </div>
  )
}

export function Step4Stage({ s }: { s: StreamStore }) {
  const r = s.real
  if (!r)
    return (
      <StagePanel wide testId="stream-4">
        <LoadingLine text="Loading the sample." testId="stream-4" />
      </StagePanel>
    )
  const u = r.utterances[s.utterance]
  const h = r.histogram
  const norm = (xs: number[]) => {
    const t = xs.reduce((a, b) => a + b, 0) || 1
    return xs.map((x) => (100 * x) / t)
  }
  const bins = h.bins.slice(0, -1).map((b, i) => `${b.toFixed(2)}–${h.bins[i + 1].toFixed(2)}`)
  const realIn = norm(h.inside)
  const realAcross = norm(h.across)
  const madeIn = norm(r.madeUpLanguage.hist.inside)
  const madeAcross = norm(r.madeUpLanguage.hist.across)
  const pct = (x: number) => `${(100 * x).toFixed(1)}%`
  return (
    <StagePanel wide testId="stream-4">
      <div style={{ fontSize: 14, fontWeight: 600 }}>Real speech</div>
      {STEP4_PANEL.map((p) => (
        <Note key={p.slice(0, 12)} style={{ color: 'var(--text)' }}>
          {p}
        </Note>
      ))}
      <Step4Controls s={s} />
      <GroupLabel>{u.words.join(' ')}</GroupLabel>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 0, overflowX: 'auto', paddingBottom: 6 }} data-utterance-strip>
        {u.syllables.map((syl, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', height: 12 }}>{s.showStress ? (u.stress[i] === 1 ? 'stressed' : u.stress[i] === 2 ? 'second' : '') : ''}</div>
              <div data-syllable={syl} style={{ padding: '4px 6px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--surface-2)', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: s.showStress && u.stress[i] === 1 ? 700 : 400 }}>
                {syl.toLowerCase()}
              </div>
              <div style={{ height: 10, width: '100%', borderBottom: i > 0 && u.wordOf[i] !== u.wordOf[i - 1] ? 'none' : '2px solid var(--sensor)' }} />
            </div>
            {i + 1 < u.syllables.length && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 36 }}>
                <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: u.wordOf[i] !== u.wordOf[i + 1] ? 'var(--sensor)' : 'var(--text)' }} data-tp={u.tp[i]}>
                  {u.tp[i].toFixed(3)}
                </div>
                <div style={{ height: 22 }} />
                <div style={{ fontSize: 9, color: 'var(--sensor)', height: 12 }}>{u.wordOf[i] !== u.wordOf[i + 1] ? '| boundary' : ''}</div>
              </div>
            )}
          </div>
        ))}
      </div>
      <Note>The number between two syllables is the transitional probability from the first to the second over the whole sample, to three decimals; the orange bars under the tiles join the syllables of one word, and “boundary” marks where one word ends and the next begins. The syllables are written in the dictionary’s symbols, in which AH is the vowel of the, IY the vowel of see, and so on.</Note>
      <GroupLabel>Transitional probabilities inside words and across word boundaries</GroupLabel>
      <Note>{`Each bar is the share of pairs whose transitional probability falls in that range: in the real speech sample, ${h.insideN.toLocaleString()} pairs inside words (mean ${h.insideMean.toFixed(2)}) and ${h.acrossN.toLocaleString()} pairs across boundaries (mean ${h.acrossMean.toFixed(2)}); in the made-up language over 21 minutes, the same two kinds of pair.`}</Note>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <Note>Real speech: inside words (blue) and across boundaries (orange), percent of pairs</Note>
          <BarChart bars={bins.flatMap((b, i) => [{ label: b, value: realIn[i], color: 'var(--accent)' }, { label: '', value: realAcross[i], color: 'var(--sensor)' }])} width={300} rowH={9} format={(v) => `${v.toFixed(0)}%`} testId="hist-real" />
        </div>
        <div>
          <Note>The made-up language: the same two kinds</Note>
          <BarChart bars={bins.flatMap((b, i) => [{ label: b, value: madeIn[i], color: 'var(--accent)' }, { label: '', value: madeAcross[i], color: 'var(--sensor)' }])} width={300} rowH={9} format={(v) => `${v.toFixed(0)}%`} testId="hist-made" />
        </div>
      </div>
      <GroupLabel>The dips learner on real speech</GroupLabel>
      <Note>The first learner of Step 3, run on the whole sample: a cut wherever a transitional probability is lower than at both neighboring pairs. Two shares: how many of its cuts fall on a true word boundary, and how many of the true boundaries it finds. The same two shares for the made-up language over 21 minutes are beside them.</Note>
      <DataTable
        testId="dips-shares"
        rowHeader
        columns={[{ key: 'what', label: '' }, { key: 'real', label: 'Real speech', mono: true }, { key: 'made', label: 'Made-up language', mono: true }]}
        rows={[
          { what: 'cuts that fall on a word boundary', real: pct(r.dipsLearner.precision).trim(), made: pct(r.madeUpLanguage.shares.precision).trim() },
          { what: 'word boundaries found', real: pct(r.dipsLearner.recall).trim(), made: pct(r.madeUpLanguage.shares.recall).trim() },
          { what: 'cuts made', real: r.dipsLearner.cuts.toLocaleString(), made: r.madeUpLanguage.shares.cuts.toLocaleString() },
          { what: 'true boundaries', real: r.dipsLearner.boundaries.toLocaleString(), made: r.madeUpLanguage.shares.boundaries.toLocaleString() },
        ]}
      />
      <GroupLabel>The other cues</GroupLabel>
      <Note>In English conversation, about 90% of content words, such as nouns and verbs, begin with a stressed syllable, and infants use stress and the patterns of which sounds can occur together as cues to word boundaries as well (§13.2.3). Press “Show stress” above the strip to mark the syllables the dictionary gives primary stress.</Note>
      <FixedLines lines={[`The sample: ${r.utterancesUsed.toLocaleString()} utterances from ${r.transcriptsUsed.toLocaleString()} transcripts in ${r.corpora.length} corpora; ${r.syllableTokens.toLocaleString()} syllables of ${r.syllableTypes.toLocaleString()} kinds; ${r.utterancesDropped.toLocaleString()} utterances dropped for a word not in the dictionary.`, `Syllables: ${r.syllabification}.`]} mono={false} />
      <Content>{REAL_SPEECH_LINE}</Content>
      <Note>{r.citation}</Note>
      <ReferencePanel reference={reference('swingley-2005')} />
    </StagePanel>
  )
}
