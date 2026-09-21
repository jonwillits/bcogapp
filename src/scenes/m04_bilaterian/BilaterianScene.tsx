import { useReducer, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Grid } from '@react-three/drei'
import { SceneCanvasLayout } from '../../components/SceneCanvasLayout'
import { StepControls } from '../../components/StepControls'
import { CameraRig } from '../../components/CameraRig'
import { Terrain } from '../../components/Terrain'
import { DishWorld, DISH_BOUNDS } from '../../sim/bilaterian/dishWorld'
import { SCENARIOS, DIAGNOSIS, scenarioByKey, type Scenario } from '../../sim/bilaterian/scenarios'
import { ANIMALS, animalById, type AnimalId } from '../../sim/bilaterian/animals'
import { cloneCircuit, type Circuit, type WiringPatch } from '../../sim/bilaterian/circuit'
import type { Levels } from '../../sim/bilaterian/modulators'
import { randomSeed } from '../../sim/random'
import { palette } from '../../theme/theme'
import { WormMesh, CueFieldMesh, MealMarks } from './meshes'
import { WorldTab } from './WorldTab'
import { CircuitTab } from './CircuitTab'
import { ChemistryTab } from './ChemistryTab'
import { WormsTab } from './WormsTab'

export type Tab = 'world' | 'circuit' | 'chemistry' | 'worms'

/** One world step at most. */
const MAX_STEP_S = 1 / 30

/**
 * How long an animal has been running before the student sees it, seconds
 * of simulated time, so the scorecard has a minute to read.
 */
export const ANIMAL_WARM_UP_S = 60

export interface SceneState {
  world: DishWorld
  scenario: Scenario
  loadScenario: (key: string) => void
  animal: AnimalId
  loadAnimal: (id: AnimalId) => void
  /** W1–W4 keep their numbers hidden until the student has committed. */
  hideNumbers: boolean
  revealed: boolean
  setRevealed: (v: boolean) => void
  tab: Tab
  setTab: (t: Tab) => void
  bump: () => void
  seed: number
  reset: (seed: number) => void
  placeChannel: number
  setPlaceChannel: (c: number) => void
  speed: number
  playing: boolean
  /**
   * Slots for a scene that configures this one. Module 5 is this animal in
   * this dish with one tab replaced and an instrument added, so it supplies
   * its own tab bar, a section for the Circuit tab, and one for Chemistry.
   */
  tabBar?: React.ReactNode
  wiringTitle?: string
  circuitExtra?: React.ReactNode
  chemistryExtra?: { controls?: React.ReactNode; readouts?: React.ReactNode }
  /** Called after a control on the Circuit tab has written the wiring. */
  afterWiring?: (patch: WiringPatch) => void
}

function Stepper({ world, scale, onAdvance }: { world: DishWorld; scale: number; onAdvance: () => void }) {
  const repaint = useRef(0)
  useFrame((_, delta) => {
    if (scale <= 0) return
    let remaining = Math.min(delta, 0.05) * scale
    let guard = 0
    while (remaining > 1e-6 && guard++ < 200) {
      const dt = Math.min(MAX_STEP_S, remaining)
      world.step(dt)
      remaining -= dt
    }
    repaint.current += delta
    if (repaint.current >= 0.08) {
      repaint.current = 0
      onAdvance()
    }
  })
  return null
}

/**
 * Module 4's scene: a nematode-like bilaterian in a dish, with a layered
 * nervous system whose every number is on screen. One `DishWorld`, three
 * tabs, one `<Canvas>`. The second instalment of the creature spine: M1's
 * vehicle became this animal, and Modules 5 and 7 configure what is here.
 */
export default function BilaterianScene() {
  const [tab, setTabState] = useState<Tab>('world')
  const [playing, setPlaying] = useState(true)
  const [speed, setSpeed] = useState(1)
  const [seed, setSeed] = useState(() => randomSeed())
  const [scenarioKey, setScenarioKey] = useState('labeled-line')
  const [animal, setAnimal] = useState<AnimalId>('healthy')
  const [revealed, setRevealed] = useState(false)
  const [placeChannel, setPlaceChannel] = useState(0)
  const [, bump] = useReducer((x: number) => x + 1, 0)

  const worldRef = useRef<DishWorld | null>(null)

  /**
   * A fresh world. Loading a scenario starts from its wiring — except that
   * `target-or` copies the interneuron's numbers from `target-and` when it
   * is loaded from there, because the lesson is that one number changes.
   * Reset and New seed keep every control where the student left it, as
   * Labs 2 and 3 do, so one thing can be changed and nothing else moves.
   */
  const build = (
    scenario: Scenario,
    withSeed: number,
    opts: { circuit?: Circuit; modulators?: Partial<Levels>; concentration?: number; warm?: number } = {},
  ) => {
    const w = new DishWorld(withSeed, scenario, opts)
    if (opts.warm) w.run(opts.warm)
    return w
  }
  if (!worldRef.current) worldRef.current = build(scenarioByKey(scenarioKey), seed)
  const world = worldRef.current
  const scenario = world.scenario

  const keepOf = (w: DishWorld) => ({
    circuit: cloneCircuit(w.worm.circuit),
    modulators: { ...w.worm.mod.setPoint },
    concentration: w.concentration,
  })

  const reset = (withSeed: number) => {
    setSeed(withSeed)
    const keep = keepOf(world)
    worldRef.current = build(world.scenario, withSeed, {
      ...keep,
      warm: animal === 'healthy' && world.scenario !== DIAGNOSIS ? 0 : ANIMAL_WARM_UP_S,
    })
    bump()
  }

  const loadScenario = (key: string) => {
    const next = scenarioByKey(key)
    const opts: { circuit?: Circuit; concentration?: number } = { concentration: world.concentration }
    if (next.keepWiringFrom === scenarioKey) {
      const from = world.worm.circuit
      const c = cloneCircuit(next.circuit)
      c.activation = from.activation
      c.interneurons = from.interneurons.map((u) => ({
        baseline: u.baseline,
        threshold: u.threshold,
        weights: [...u.weights],
      }))
      opts.circuit = c
    }
    setScenarioKey(key)
    setAnimal('healthy')
    worldRef.current = build(next, seed, opts)
    bump()
  }

  const loadAnimal = (id: AnimalId) => {
    const a = animalById(id)
    setScenarioKey(DIAGNOSIS.key)
    setAnimal(id)
    worldRef.current = build(DIAGNOSIS, seed, {
      circuit: a.circuit,
      modulators: a.modulators,
      concentration: world.concentration,
      warm: ANIMAL_WARM_UP_S,
    })
    bump()
  }

  /** Opening the Worms tab puts the healthy animal in the diagnosis dish, unless an animal is already there. */
  const setTab = (t: Tab) => {
    if (t === 'worms' && world.scenario.key !== DIAGNOSIS.key) loadAnimal('healthy')
    setTabState(t)
  }

  const hideNumbers = animal !== 'healthy' && animal !== 'W0' && !revealed

  const state: SceneState = {
    world,
    scenario,
    loadScenario,
    animal,
    loadAnimal,
    hideNumbers,
    revealed,
    setRevealed,
    tab,
    setTab,
    bump,
    seed,
    reset,
    placeChannel,
    setPlaceChannel,
    speed,
    playing,
  }

  const slots =
    tab === 'world' ? WorldTab(state) : tab === 'circuit' ? CircuitTab(state) : tab === 'chemistry' ? ChemistryTab(state) : WormsTab(state)
  const channelColors = scenario.channels.map((c) => c.color)

  return (
    <SceneCanvasLayout
      canvas={
        <Canvas camera={{ position: [0, 18, 12], fov: 45 }} onContextMenu={(e) => e.preventDefault()}>
          <color attach="background" args={[palette.bg]} />
          <ambientLight intensity={0.6} />
          <directionalLight position={[6, 12, 6]} intensity={0.7} />
          <Terrain
            bounds={DISH_BOUNDS}
            onAdd={(x, _y, z) => {
              world.addSource(placeChannel, x, z)
              bump()
            }}
            onRemoveNearest={(x, z) => {
              world.removeNearest(x, z)
              bump()
            }}
          />
          <Grid
            args={[DISH_BOUNDS * 2, DISH_BOUNDS * 2]}
            cellSize={1}
            cellThickness={0.6}
            cellColor="#2c3c60"
            sectionSize={4}
            sectionThickness={1.2}
            sectionColor="#4a628f"
            fadeDistance={60}
            fadeStrength={0.6}
            position={[0, 0.002, 0]}
          />
          {world.sources.map((s) => (
            <CueFieldMesh
              key={s.id}
              source={s}
              channel={scenario.channels[s.channel] ?? scenario.channels[0]}
              scale={s.lifetime === null ? 1 : world.concentration}
              now={world.time}
            />
          ))}
          <MealMarks world={world} />
          <WormMesh worm={world.worm} colors={channelColors} />
          <Stepper world={world} scale={playing ? speed : 0} onAdvance={bump} />
          <CameraRig target={[0, 0, 0]} />
        </Canvas>
      }
      left={slots.left}
      right={slots.right}
      bottom={
        <StepControls
          playing={playing}
          onPlayPause={() => setPlaying((p) => !p)}
          onStep={() => {
            world.step(MAX_STEP_S)
            bump()
          }}
          onReset={() => reset(seed)}
          speed={speed}
          onSpeedChange={setSpeed}
        />
      }
    />
  )
}

/** The tab bar every left panel starts with. */
export function TabBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  const tabs: { id: Tab; title: string; sub: string }[] = [
    { id: 'world', title: 'World', sub: 'the dish' },
    { id: 'circuit', title: 'Circuit', sub: 'the wiring' },
    { id: 'chemistry', title: 'Chemistry', sub: 'the modulators' },
    { id: 'worms', title: 'Worms', sub: 'the diagnosis' },
  ]
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          style={{
            flex: 1,
            padding: '5px 4px',
            fontSize: 11.5,
            lineHeight: 1.15,
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)',
            cursor: 'pointer',
            background: tab === t.id ? 'var(--accent)' : 'transparent',
            color: tab === t.id ? '#0b111c' : 'var(--text)',
            fontWeight: tab === t.id ? 600 : 400,
          }}
        >
          {t.title}
          <div style={{ fontSize: 8.5, fontWeight: 400, opacity: 0.8 }}>{t.sub}</div>
        </button>
      ))}
    </div>
  )
}

/** A muted one-liner. */
export function Note({ children }: { children: React.ReactNode }) {
  return <p style={{ margin: 0, fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.45 }}>{children}</p>
}

/** A label/value row in the panel's own style. */
export function Row({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12 }}>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontFamily: mono ? 'var(--font-mono)' : undefined, textAlign: 'right' }}>{value}</span>
    </div>
  )
}

/** A small heading that separates one kind of control from another. */
export function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 0.4,
        textTransform: 'uppercase',
        color: 'var(--text-muted)',
        borderBottom: '1px solid var(--border)',
        paddingBottom: 3,
        marginTop: 2,
      }}
    >
      {children}
    </div>
  )
}

export const PANEL_STYLE = { width: 320, maxHeight: '84vh', overflowY: 'auto' as const }
export const RIGHT_STYLE = { width: 352, maxHeight: '84vh', overflowY: 'auto' as const }
export { SCENARIOS, ANIMALS }
