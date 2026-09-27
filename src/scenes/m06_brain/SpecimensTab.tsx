import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { BrainLayout } from './layout'
import { Panel } from '../../components/Panel'
import {
  type Manifest,
  type Specimen,
  type SpecimenView,
  type Guesses,
  VIEW_LABEL,
  TRUE_SCALE_LINE,
  SIZE_NOT_RECORDED,
  shuffledOrder,
  matchingList,
  allNamed,
  score,
  defaultView,
  drawnSizePx,
  trueSizeCm,
  cmPerPx,
} from '../../sim/brain/specimens'
import { Btn, GroupLabel, Note, StageTitle, PANEL_STYLE, RIGHT_STYLE } from './ui'

/**
 * Part 1's first activity: the identification game (spec §5.4).
 *
 * Nothing is revealed until *Commit my matches*. Before that press, this
 * component renders no species name against any image, no correctness, no
 * credit line, no original file and no source link — `reveal.test.ts`
 * renders it headlessly and checks the markup. The matching list holds the
 * names, since matching is the task; what it never does is attach one to a
 * picture. Every image is a grayscale cutout on one neutral stage, at one
 * display size, identified only by a number.
 */

/** Where the specimen files live, under the app's base. */
export const SPECIMENS_URL = `${import.meta.env.BASE_URL ?? '/'}m06/specimens/`

/** The neutral stage every cutout sits on. */
const STAGE = '#4a5060'

export interface SpecimensProps {
  seed: number
  onNewSeed: () => void
  header?: ReactNode
  /** Supplied by tests; fetched otherwise. */
  manifest?: Manifest
  /** Supplied by tests to render the after-reveal state. */
  initial?: { guesses?: Guesses; committed?: boolean; trueScale?: boolean; credits?: boolean }
}

export function SpecimensTab({ seed, onNewSeed, header, manifest: given, initial }: SpecimensProps) {
  const [manifest, setManifest] = useState<Manifest | null>(given ?? null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    if (given) return
    const ctrl = new AbortController()
    fetch(`${SPECIMENS_URL}manifest.json`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((m: Manifest) => setManifest(m))
      .catch(() => {
        if (!ctrl.signal.aborted) setFailed(true)
      })
    return () => ctrl.abort()
  }, [given])

  const specimens = useMemo(() => (manifest ? shuffledOrder(manifest.specimens, seed) : []), [manifest, seed])
  const names = useMemo(() => matchingList(specimens), [specimens])
  const [guesses, setGuesses] = useState<Guesses>(initial?.guesses ?? {})
  const [committed, setCommitted] = useState(initial?.committed ?? false)
  const [trueScale, setTrueScale] = useState(initial?.trueScale ?? false)
  const [credits, setCredits] = useState(initial?.credits ?? false)
  const [enlarged, setEnlarged] = useState<string | null>(null)
  const [views, setViews] = useState<Record<string, SpecimenView['view']>>({})
  const [showOriginal, setShowOriginal] = useState(true)

  const viewOf = (s: Specimen): SpecimenView => s.views.find((v) => v.view === views[s.id]) ?? defaultView(s)
  const matches = committed ? score(specimens, guesses) : null
  const right = matches ? matches.filter((m) => m.correct).length : 0

  const reset = () => {
    setGuesses({})
    setCommitted(false)
    setTrueScale(false)
    setCredits(false)
    setEnlarged(null)
    onNewSeed()
  }

  const left = (
    <Panel title="Specimens" style={PANEL_STYLE}>
      <Note>
        Real brains, photographed, shown at one size in grayscale. Name each one from the list. Nothing is marked until you commit. You can enlarge any image and switch between the views it has.
      </Note>
      <GroupLabel>Progress</GroupLabel>
      <Note>
        {specimens.length ? `${specimens.filter((s) => guesses[s.id]).length} of ${specimens.length} named` : failed ? 'The specimen list could not be loaded.' : 'Loading the specimens…'}
      </Note>
      {!committed && (
        <Btn primary disabled={!specimens.length || !allNamed(specimens, guesses)} onClick={() => setCommitted(true)}>
          Commit my matches
        </Btn>
      )}
      {committed && matches && (
        <>
          <Note>
            <b>
              {right} of {matches.length} right.
            </b>{' '}
            Each image now shows its name, whether you had it, and the full-color original with its title and scale bar.
          </Note>
          <GroupLabel>After the reveal</GroupLabel>
          <Btn onClick={() => setTrueScale((v) => !v)} primary={trueScale}>
            {trueScale ? 'True scale: on' : 'True scale'}
          </Btn>
          <Btn onClick={() => setCredits((v) => !v)} primary={credits}>
            {credits ? 'Credits: showing' : 'Credits'}
          </Btn>
          <Btn small onClick={() => setShowOriginal((v) => !v)}>
            {showOriginal ? 'Show the cutouts again' : 'Show the originals'}
          </Btn>
          <Btn small onClick={reset}>
            Play again with a new order
          </Btn>
        </>
      )}
      {!committed && !allNamed(specimens, guesses) && specimens.length > 0 && <Note>The button is available once every image has a name.</Note>}
      <Note>Write down the strategy you used before you commit. The reflection asks for it.</Note>
    </Panel>
  )

  const stage = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <StageTitle sub={committed ? 'Revealed. The originals carry their titles, scale bars and collection credits.' : 'Every specimen at the same display size, as a grayscale cutout. Identified only by a number.'}>
        {trueScale ? 'The specimens at their true relative sizes' : 'Which brain is which?'}
      </StageTitle>
      {trueScale && matches ? (
        <TrueScaleView specimens={specimens} viewOf={viewOf} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
          {specimens.map((s, i) => (
            <Card
              key={s.id}
              n={i + 1}
              s={s}
              view={viewOf(s)}
              setView={(v) => setViews({ ...views, [s.id]: v })}
              names={names}
              guess={guesses[s.id]}
              setGuess={committed ? undefined : (g) => setGuesses({ ...guesses, [s.id]: g })}
              match={matches ? matches.find((m) => m.specimen.id === s.id)! : null}
              onEnlarge={() => setEnlarged(s.id)}
              enlarged={enlarged === s.id}
              showOriginal={committed && showOriginal}
            />
          ))}
        </div>
      )}
    </div>
  )

  const enlargedSpecimen = specimens.find((s) => s.id === enlarged) ?? null
  const rightPanel = (
    <Panel title={credits && committed ? 'Credits' : 'Enlarged'} style={RIGHT_STYLE}>
      {credits && committed ? (
        <CreditsView specimens={specimens} />
      ) : enlargedSpecimen ? (
        <Enlarged n={specimens.indexOf(enlargedSpecimen) + 1} s={enlargedSpecimen} view={viewOf(enlargedSpecimen)} setView={(v) => setViews({ ...views, [enlargedSpecimen.id]: v })} committed={committed} />
      ) : (
        <Note>Press <b>Enlarge</b> on any image to see it larger here, and to switch between its views.</Note>
      )}
    </Panel>
  )

  return <BrainLayout header={header} left={left} stage={stage} right={rightPanel} />
}

function Cutout({ view, height, alt }: { view: SpecimenView; height: number; alt: string }) {
  return (
    <div style={{ background: STAGE, borderRadius: 8, height, display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
      <img src={`${SPECIMENS_URL}${view.derived}`} alt={alt} data-specimen-image="cutout" style={{ maxWidth: '92%', maxHeight: '92%', objectFit: 'contain', filter: 'grayscale(1)' }} />
    </div>
  )
}

function ViewSwitch({ s, view, setView }: { s: Specimen; view: SpecimenView; setView: (v: SpecimenView['view']) => void }) {
  if (s.views.length < 2) return <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{VIEW_LABEL[view.view]}</span>
  return (
    <span style={{ display: 'inline-flex', gap: 3 }}>
      {s.views.map((v) => (
        <button
          key={v.view}
          type="button"
          onClick={() => setView(v.view)}
          style={{ fontSize: 10.5, padding: '1px 6px', borderRadius: 999, border: '1px solid var(--border)', background: v.view === view.view ? 'var(--accent)' : 'var(--surface-2)', color: v.view === view.view ? '#0b111c' : 'var(--text)', cursor: 'pointer' }}
        >
          {VIEW_LABEL[v.view]}
        </button>
      ))}
    </span>
  )
}

function Card({
  n,
  s,
  view,
  setView,
  names,
  guess,
  setGuess,
  match,
  onEnlarge,
  enlarged,
  showOriginal,
}: {
  n: number
  s: Specimen
  view: SpecimenView
  setView: (v: SpecimenView['view']) => void
  names: string[]
  guess: string | undefined
  setGuess?: (g: string) => void
  match: { correct: boolean; guess: string | undefined } | null
  onEnlarge: () => void
  enlarged: boolean
  showOriginal: boolean
}) {
  return (
    <div data-card={n} style={{ border: `1px solid ${enlarged ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 10, padding: 8, background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <b style={{ fontSize: 13 }}>#{n}</b>
        <span style={{ flex: 1 }} />
        <ViewSwitch s={s} view={view} setView={setView} />
      </div>
      {showOriginal ? (
        <div style={{ background: STAGE, borderRadius: 8, height: 150, display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
          <img src={`${SPECIMENS_URL}${s.file}`} alt={`${s.name}: the original photograph, with its title and scale bar`} data-specimen-image="original" style={{ maxWidth: '96%', maxHeight: '96%', objectFit: 'contain' }} />
        </div>
      ) : (
        <Cutout view={view} height={150} alt={`specimen ${n}, ${VIEW_LABEL[view.view]}`} />
      )}
      {match ? (
        <div data-verdict={match.correct ? 'right' : 'wrong'} style={{ fontSize: 12, color: match.correct ? '#34d399' : '#f87171' }}>
          {match.correct ? '✓' : '✗'} <b>{s.name}</b>
          {!match.correct && <span style={{ color: 'var(--text-muted)' }}> — you said {match.guess}</span>}
        </div>
      ) : (
        <select
          value={guess ?? ''}
          onChange={(e) => setGuess?.(e.target.value)}
          aria-label={`name for specimen ${n}`}
          style={{ width: '100%', padding: '4px 6px', background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }}
        >
          <option value="">— choose a name —</option>
          {names.map((nm) => (
            <option key={nm} value={nm}>
              {nm}
            </option>
          ))}
        </select>
      )}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <Btn small onClick={onEnlarge}>
          Enlarge
        </Btn>
        {match && (
          <a href={s.source} target="_blank" rel="noreferrer" style={{ fontSize: 11.5 }}>
            See the original
          </a>
        )}
      </div>
    </div>
  )
}

function Enlarged({ n, s, view, setView, committed }: { n: number; s: Specimen; view: SpecimenView; setView: (v: SpecimenView['view']) => void; committed: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <b>#{n}</b>
        {committed && <span>{s.name}</span>}
        <span style={{ flex: 1 }} />
        <ViewSwitch s={s} view={view} setView={setView} />
      </div>
      <Cutout view={view} height={300} alt={`specimen ${n}, ${VIEW_LABEL[view.view]}, enlarged`} />
      {committed && (
        <Note>
          {s.scientificName}. Credit: {s.credit}{' '}
          <a href={s.source} target="_blank" rel="noreferrer">
            See the original
          </a>
        </Note>
      )}
    </div>
  )
}

/**
 * Every specimen at its true linear size at one zoom, from a marmoset's or a
 * kiwi's brain to an elephant's. A magnifier for the small ones, not a log
 * scale: a log scale would hide the lesson.
 */
function TrueScaleView({ specimens, viewOf }: { specimens: Specimen[]; viewOf: (s: Specimen) => SpecimenView }) {
  const [pxPerCm, setPxPerCm] = useState(8)
  const [magnified, setMagnified] = useState<string | null>(null)
  const MAG = 4
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', fontSize: 12 }}>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          zoom
          <input type="range" min={3} max={20} step={1} value={pxPerCm} onChange={(e) => setPxPerCm(Number(e.target.value))} style={{ accentColor: 'var(--accent)' }} />
          <span style={{ fontFamily: 'var(--font-mono)' }}>{pxPerCm} px per cm</span>
        </label>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ display: 'inline-block', width: 5 * pxPerCm, height: 4, background: '#e7ecf3' }} /> 5 cm
        </span>
        <span style={{ color: 'var(--text-muted)' }}>Sizes come from each original’s own scale bar. Click a small one to magnify it ×{MAG}.</span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'flex-end', background: STAGE, borderRadius: 10, padding: 14 }}>
        {specimens.map((s) => {
          const v = viewOf(s)
          const drawn = drawnSizePx(s, v, pxPerCm)
          const cm = trueSizeCm(s, v)
          const isMag = magnified === s.id
          return (
            <div key={s.id} data-true-scale={s.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, fontSize: 11 }}>
              {drawn ? (
                <img
                  src={`${SPECIMENS_URL}${v.derived}`}
                  alt={`${s.name}, ${VIEW_LABEL[v.view]}, at true scale`}
                  data-drawn-width={drawn[0].toFixed(2)}
                  data-drawn-height={drawn[1].toFixed(2)}
                  onClick={() => setMagnified(isMag ? null : s.id)}
                  style={{ width: drawn[0], height: drawn[1], cursor: 'zoom-in', filter: 'grayscale(1)' }}
                />
              ) : (
                <div data-size-not-recorded style={{ width: 60, height: 40, borderRadius: 6, border: '1px dashed #9aa6b8', display: 'grid', placeItems: 'center', color: '#9aa6b8', fontSize: 9.5, opacity: 0.6 }}>
                  {SIZE_NOT_RECORDED}
                </div>
              )}
              <span style={{ color: '#e7ecf3' }}>{s.name}</span>
              <span style={{ color: '#c9d2df', fontFamily: 'var(--font-mono)' }}>{cm ? `${cm[0].toFixed(1)} cm across` : SIZE_NOT_RECORDED}</span>
            </div>
          )
        })}
      </div>
      {magnified && (() => {
        const s = specimens.find((x) => x.id === magnified)!
        const v = viewOf(s)
        const drawn = drawnSizePx(s, v, pxPerCm * MAG)
        if (!drawn) return null
        return (
          <div data-magnifier={s.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-end', border: '1px solid var(--accent)', borderRadius: 10, padding: 12, background: STAGE }}>
            <img src={`${SPECIMENS_URL}${v.derived}`} alt={`${s.name}, magnified ${MAG} times`} style={{ width: drawn[0], height: drawn[1], filter: 'grayscale(1)' }} />
            <div style={{ fontSize: 12, color: '#e7ecf3' }}>
              <div>
                <b>{s.name}</b>, magnified ×{MAG}
              </div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <span style={{ display: 'inline-block', width: pxPerCm * MAG, height: 4, background: '#e7ecf3' }} /> 1 cm at ×{MAG}
              </div>
              <div style={{ color: '#c9d2df', fontSize: 11 }}>{cmPerPx(s) ? `${(trueSizeCm(s, v)![0]).toFixed(1)} cm across` : SIZE_NOT_RECORDED}</div>
            </div>
          </div>
        )
      })()}
      <Note>
        <b>{TRUE_SCALE_LINE}</b>
      </Note>
    </div>
  )
}

function CreditsView({ specimens }: { specimens: Specimen[] }) {
  const sorted = [...specimens].sort((a, b) => a.name.localeCompare(b.name))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 11.5 }}>
      <Note>Every photograph, its credit, its licence and where it came from. The photographs are excluded from the app’s GPL licence; the specimens folder carries the full list.</Note>
      {sorted.map((s) => (
        <div key={s.id} data-credit={s.id} style={{ borderTop: '1px solid var(--border)', paddingTop: 6 }}>
          <div>
            <b>{s.name}</b> <i style={{ color: 'var(--text-muted)' }}>{s.scientificName}</i>
          </div>
          <div>{s.credit}</div>
          <div style={{ color: 'var(--text-muted)' }}>Licence: {s.licence}</div>
          <a href={s.source} target="_blank" rel="noreferrer">
            See the original
          </a>
        </div>
      ))}
    </div>
  )
}
