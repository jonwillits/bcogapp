import { useMemo, useReducer, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { SceneCanvasLayout } from '../../components/SceneCanvasLayout'
import { StepControls } from '../../components/StepControls'
import { CameraRig } from '../../components/CameraRig'
import { Button } from '../../components/controls'
import { fmtSigned } from '../../components/format'
import { FishWorld, type WorldOptions } from '../../sim/fish/world'
import { FISH_SCENARIOS, scenarioByKey, type Control, type FishScenario } from '../../sim/fish/scenarios'
import { fishById, type FishId } from '../../sim/fish/animals'
import { KINDS } from '../../sim/fish/kinds'
import { makeRng, randomSeed, type Rng } from '../../sim/random'
import { palette } from '../../theme/theme'
import { EncounterMesh, FishMesh, StreamBed, newShow, T_END, T_OUTCOME, T_VERDICT, type Show } from './meshes'
import { SDT_NAMES } from './labels'
import { WorldTab } from './WorldTab'
import { NetworkTab } from './NetworkTab'
import { LearningTab } from './LearningTab'
import { DecisionTab } from './DecisionTab'
import { FishTab } from './FishTab'

export type Tab = 'world' | 'network' | 'learning' | 'decision' | 'fish'

/** Encounters of a skip paid per slice, so nothing synchronous over a few tens of milliseconds sits on a click. */
export const SKIP_SLICE = 100
const SKIP_BADGE_MS = 1400

export const SKIPS = [
  { label: 'Skip ahead 100 encounters', encounters: 100 },
  { label: 'Skip ahead 1,000 encounters', encounters: 1000 },
] as const

export interface FishSceneState {
  world: FishWorld
  scenario: FishScenario
  tab: Tab
  setTab: (t: Tab) => void
  bump: () => void
  seed: number
  loadScenario: (key: string) => void
  /** Start the run again from the same seed, settings kept, weights back where the run started. */
  reset: () => void
  newSeed: () => void
  /** Which of Part 2's fish is in the stream. */
  fish: FishId
  loadFish: (id: FishId) => void
  revealed: boolean
  setRevealed: (v: boolean) => void
  /** A hidden fish whose numbers are withheld. */
  hide: boolean
  ownStream: boolean
  setOwnStream: (v: boolean) => void
  hoverUnit: number | null
  setHoverUnit: (u: number | null) => void
  view: ViewSettings
  setView: (v: Partial<ViewSettings>) => void
  energyPoints: { criterion: number; energy: number }[]
  scoreCriterion: () => void
  clearEnergy: () => void
  skip: (encounters: number) => void
  /** Whether this scenario lets the student change a control. */
  can: (c: Control) => boolean
  /** Something about the run changed that the stream view must start over from. */
  restartShow: () => void
}

export interface ViewSettings {
  showTest: boolean
  showPrototypes: boolean
  pair: [number, number]
}

/**
 * The frame loop: holds each stage of an encounter on screen for a while,
 * and asks the world for the next one. The world does the encounter; this
 * only decides when.
 */
function Stepper({ world, show, anim, scale, onAdvance }: { world: FishWorld; show: Show; anim: Rng; scale: number; onAdvance: () => void }) {
  useFrame((_, delta) => {
    const real = Math.min(delta, 0.05)
    show.clock += real * Math.min(Math.max(scale, 0), 3)
    if (scale <= 0) return
    show.t += real * scale
    let guard = 0
    let changed = false
    while (guard++ < 8) {
      if (show.stage === 0) {
        world.begin()
        show.lateral = anim.range(-3.4, 3.4)
        show.stage = 1
        changed = true
      } else if (show.stage === 1 && show.t >= T_VERDICT) {
        show.stage = 2
        changed = true
      } else if (show.stage === 2 && show.t >= T_OUTCOME) {
        world.finish()
        show.stage = 3
        changed = true
      } else if (show.stage === 3 && show.t >= T_END) {
        show.stage = 0
        show.t -= T_END
        changed = true
      } else break
    }
    if (changed) onAdvance()
  })
  return null
}

/**
 * Module 7's scene: a fish holding its place in a stream. The next
 * instalment of the creature spine, and the one scene in the app whose
 * network has a hidden layer.
 */
export default function FishScene() {
  const [tab, setTab] = useState<Tab>('world')
  const [playing, setPlaying] = useState(true)
  const [speed, setSpeed] = useState(1)
  const [seed, setSeed] = useState(() => randomSeed())
  const [, bump] = useReducer((x: number) => x + 1, 0)
  const [fish, setFish] = useState<FishId>('healthy')
  const [revealed, setRevealed] = useState(false)
  const [ownStream, setOwnStreamState] = useState(false)
  const [hoverUnit, setHoverUnit] = useState<number | null>(null)
  const [view, setViewState] = useState<ViewSettings>({ showTest: false, showPrototypes: false, pair: [0, 1] })
  const [energyPoints, setEnergyPoints] = useState<{ criterion: number; energy: number }[]>([])
  const [skipped, setSkipped] = useState({ encounters: 0, until: 0 })
  const worldRef = useRef<FishWorld | null>(null)
  const showRef = useRef<Show>(newShow())
  const owed = useRef(0)

  if (!worldRef.current) worldRef.current = new FishWorld(seed, FISH_SCENARIOS[0])
  const world = worldRef.current
  const scenario = world.scenario
  const show = showRef.current
  // The animation's own stream, started again with each world: a seed replays the same fish.
  const anim = useMemo(() => makeRng(world.animSeed), [world])

  const restartShow = () => {
    show.t = 0
    show.stage = 0
  }

  const install = (next: FishWorld) => {
    worldRef.current = next
    owed.current = 0
    restartShow()
    setHoverUnit(null)
    setEnergyPoints([])
    bump()
  }

  const loadScenario = (key: string) => {
    setFish('healthy')
    setRevealed(false)
    setOwnStreamState(false)
    setViewState({ showTest: false, showPrototypes: false, pair: [0, 1] })
    install(new FishWorld(seed, scenarioByKey(key)))
  }

  const reset = () => {
    world.reset()
    owed.current = 0
    restartShow()
    bump()
  }

  /** A new seed: a new stream and new test sets, and where the weights are drawn at random, new starting weights. Settings are kept. */
  const newSeed = () => {
    const next = randomSeed()
    setSeed(next)
    const b = world.brain
    const drawn = b.settings.hidden !== 'hand' && world.hiddenCount > 0
    const opts: WorldOptions = {
      settings: { ...world.settings, phase: 0 },
      learning: { ...b.settings },
      hidden: world.hiddenCount,
      hiddenMode: b.settings.hidden,
      sparse: world.sparse,
      builtIns: [...b.receptors.builtIns],
      raw: b.receptors.raw,
      activation: b.circuit.activation,
      circuit: drawn ? undefined : world.startWiring,
    }
    const w = new FishWorld(next, scenario, opts)
    if (drawn) w.wire({ layer: 'output', threshold: b.circuit.output!.threshold })
    install(w)
  }

  const loadFish = (id: FishId, own = false) => {
    const a = fishById(id)
    const diagnosis = scenarioByKey('diagnosis')
    const stream = own && a.ownStream ? { baseRate: a.ownStream.baseRate, stakes: a.ownStream.stakes } : {}
    setFish(id)
    setRevealed(false)
    setOwnStreamState(own && !!a.ownStream)
    install(new FishWorld(seed, diagnosis, { circuit: a.circuit, settings: { chemistry: a.chemistry, ...stream } }))
  }

  const setOwnStream = (v: boolean) => {
    const a = fishById(fish)
    if (!a.ownStream) return
    const keepRevealed = revealed
    loadFish(fish, v)
    setRevealed(keepRevealed)
  }

  /**
   * Skip ahead, paid down on a timer and not in the frame loop, a hundred
   * encounters a slice: the page stays responsive, and the cost does not
   * depend on how fast this machine can draw.
   */
  const skip = (encounters: number) => {
    const already = owed.current > 0
    owed.current += encounters
    setSkipped((was) => ({ encounters: (already || Date.now() < was.until ? was.encounters : 0) + encounters, until: Date.now() + SKIP_BADGE_MS }))
    setTimeout(bump, SKIP_BADGE_MS + 30)
    restartShow()
    bump()
    if (already) return
    const pay = () => {
      if (worldRef.current !== world) return
      const n = Math.min(SKIP_SLICE, owed.current)
      world.run(n)
      owed.current -= n
      restartShow()
      bump()
      if (owed.current > 0) setTimeout(pay, 0)
    }
    setTimeout(pay, 0)
  }

  const scoreCriterion = () => {
    const r = world.scoreFresh(500)
    setEnergyPoints((was) => [...was.slice(-39), { criterion: world.effectiveCriterion, energy: r.energyPer100 }])
  }

  const animal = fishById(fish)
  const hide = scenario.key === 'diagnosis' && animal.hidden && !revealed
  const state: FishSceneState = {
    world,
    scenario,
    tab,
    setTab,
    bump,
    seed,
    loadScenario,
    reset,
    newSeed,
    fish,
    loadFish: (id) => loadFish(id),
    revealed,
    setRevealed,
    hide,
    ownStream,
    setOwnStream,
    hoverUnit,
    setHoverUnit,
    view,
    setView: (v) => setViewState((was) => ({ ...was, ...v })),
    energyPoints,
    scoreCriterion,
    clearEnergy: () => setEnergyPoints([]),
    skip,
    can: (c) => scenario.unlocked.includes(c) && !hide,
    restartShow,
  }

  const slots =
    tab === 'world'
      ? WorldTab(state)
      : tab === 'network'
        ? NetworkTab(state)
        : tab === 'learning'
          ? LearningTab(state)
          : tab === 'decision'
            ? DecisionTab(state)
            : FishTab(state)

  return (
    <SceneCanvasLayout
      canvas={
        <>
          <Canvas camera={{ position: [0, 12.5, 11.5], fov: 45 }} onContextMenu={(e) => e.preventDefault()}>
            <color attach="background" args={['#0d2231']} />
            <ambientLight intensity={0.85} />
            <directionalLight position={[4, 12, 6]} intensity={0.8} />
            <StreamBed show={show} />
            <EncounterMesh world={world} show={show} />
            <FishMesh world={world} show={show} anim={anim} playing={playing} speed={speed} />
            <Stepper world={world} show={show} anim={anim} scale={playing && owed.current === 0 ? speed : 0} onAdvance={bump} />
            <CameraRig target={[0, 0, -0.5]} />
          </Canvas>
          <EncounterBadge world={world} show={show} hide={hide} />
          {(owed.current > 0 || Date.now() < skipped.until) && (
            <div style={{ ...BADGE, top: 136 }}>
              {owed.current > 0 ? (
                <>
                  <b>Skipping ahead</b> — {owed.current} encounters to go
                </>
              ) : (
                <>
                  <b>Skipped ahead {skipped.encounters.toLocaleString('en-US')} encounters</b> — {world.encounters.toLocaleString('en-US')} so far
                  {!world.brain.settings.on && ' · learning is off, so no weight changed'}
                </>
              )}
            </div>
          )}
        </>
      }
      left={slots.left}
      right={slots.right}
      bottom={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          <StepControls
            playing={playing}
            onPlayPause={() => setPlaying((p) => !p)}
            onStep={() => {
              // One whole encounter: the smell, the verdict, the outcome.
              world.runEncounter()
              show.stage = 3
              show.t = T_OUTCOME
              bump()
            }}
            onReset={reset}
            speed={speed}
            onSpeedChange={setSpeed}
            maxSpeed={8}
          />
          <div style={{ display: 'flex', gap: 6, pointerEvents: 'auto' }}>
            {SKIPS.map((k) => (
              <Button key={k.label} onClick={() => skip(k.encounters)} title="Run the stream forward without drawing it. Nothing is left out: it is the same run as watching it.">
                {k.label}
              </Button>
            ))}
          </div>
        </div>
      }
    />
  )
}

const BADGE: React.CSSProperties = {
  position: 'absolute',
  top: 12,
  left: '50%',
  transform: 'translateX(-50%)',
  padding: '6px 12px',
  borderRadius: 999,
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  fontSize: 12,
  color: 'var(--text)',
  whiteSpace: 'nowrap',
  maxWidth: '46vw',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}

/**
 * An encounter in words, one fact to a line and each line always worded the
 * same way. The verdict line is what the fish did: the column of the
 * chapter's table. The outcome line is what was there: its row. The name of
 * the cell follows from the two.
 */
export function describeOutcome(world: FishWorld, e: { kind: keyof typeof KINDS; verdict: boolean; happens: boolean }): { verdict: string; outcome: string; name: string } {
  const kind = KINDS[e.kind]
  const name = e.happens ? (e.verdict ? SDT_NAMES.hit : SDT_NAMES.miss) : e.verdict ? SDT_NAMES.falseAlarm : SDT_NAMES.correctRejection
  if (world.route === 'dart') {
    const a = /^[aeiou]/.test(kind.label) ? 'An' : 'A'
    return {
      name,
      verdict: e.verdict ? 'The fish darted to cover.' : 'The fish stayed.',
      outcome: `${a} ${kind.label} ${e.happens ? 'lunged' : 'drifted past'}.`,
    }
  }
  const what = kind.label.startsWith('twig') ? 'A twig or leaf' : kind.label[0].toUpperCase() + kind.label.slice(1)
  return {
    name,
    verdict: e.verdict ? 'The fish ate it.' : 'The fish left it.',
    outcome: `${what}. ${e.happens ? 'It nourished.' : kind.harms ? 'It sickened.' : 'Nothing to eat.'}`,
  }
}

const BADGE_LINE: React.CSSProperties = { height: 17, lineHeight: '17px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }

/**
 * The encounter counter, always on screen, and the encounter in front of
 * the fish. Six lines, each with its own place: a line that has nothing to
 * say yet is left empty, so nothing moves when the next one fills in, and
 * it can be read at a glance at any speed.
 */
function EncounterBadge({ world, show, hide }: { world: FishWorld; show: Show; hide: boolean }) {
  const e = world.pending ?? world.last
  const lines: React.ReactNode[] = ['waiting for a smell', '', '', '', '']
  if (e) {
    const o = describeOutcome(world, e)
    lines[0] = `smell A ${e.x1.toFixed(2)}, B ${e.x2.toFixed(2)}${e.far ? ' (far)' : ''}`
    const acted = !world.pending || show.stage >= 2
    if (acted && !hide) lines[1] = `evidence ${fmtSigned(e.evidence)}, criterion ${fmtSigned(e.criterion)}`
    if (acted) lines[2] = o.verdict
    if (!world.pending) {
      lines[3] = o.outcome
      lines[4] = <span style={{ color: palette.accent, fontWeight: 600 }}>{o.name}</span>
    }
  }
  return (
    <div style={{ ...BADGE, width: 250, textAlign: 'center', borderRadius: 12, fontVariantNumeric: 'tabular-nums' }}>
      <div style={BADGE_LINE}>
        <b>Encounter {(world.encounters + (world.pending ? 1 : 0)).toLocaleString('en-US')}</b>
      </div>
      {lines.map((line, i) => (
        <div key={i} style={BADGE_LINE}>
          {line || '\u00a0'}
        </div>
      ))}
    </div>
  )
}
