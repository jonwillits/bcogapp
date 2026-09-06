import { useEffect, useReducer, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Grid } from '@react-three/drei'
import { SceneCanvasLayout } from '../../components/SceneCanvasLayout'
import { StepControls } from '../../components/StepControls'
import { CameraRig } from '../../components/CameraRig'
import { VehicleMesh } from '../../components/VehicleMesh'
import { SourceMesh } from '../../components/SourceMesh'
import { Terrain } from '../../components/Terrain'
import { NeuronWorld } from '../../sim/neuron/neuronWorld'
import { HEALTHY_SCENARIO, DIAGNOSTIC_CELLS, type Scenario } from '../../sim/neuron/cells'
import { randomSeed } from '../../sim/random'
import { measureCeiling, measureSweep } from '../../sim/neuron/measure'
import { UNIT_INPUT_RANGE } from '../../sim/neuron/unitRanges'
import { DEFAULT_BUDGET } from '../../sim/neuron/energy'
import type { CellParams } from '../../sim/neuron/cell'
import { palette } from '../../theme/theme'
import { WorldTab } from './WorldTab'
import { UnitTab } from './UnitTab'
import { MembraneTab } from './MembraneTab'
import { DiagnosisTab } from './DiagnosisTab'

export type Tab = 'world' | 'unit' | 'membrane' | 'diagnosis'
export type LoadedCell = 'healthy' | 'N0' | 'N1' | 'N2' | 'N3' | 'N4'

/** One world step at most; slow motion takes smaller ones. */
const MAX_STEP_S = 1 / 30

/**
 * How long a diagnostic cell is run before the student sees it, seconds of
 * simulated time. N3's fault only appears under load, and a cell that has
 * been driving for a while is what a student is meant to be looking at.
 */
export const DIAGNOSTIC_WARM_UP_S = 45

/** Default slow-motion on the Membrane tab: milliseconds of cell time per real second. */
export const DEFAULT_MS_PER_SECOND = 20

/**
 * Per-tab UI state, kept here rather than in the tabs because the tabs are
 * plain functions returning panel slots, not components: a hook inside one
 * of them would change the hook order when the tab changes, which React
 * (rightly) refuses.
 */
export type Side = 'left' | 'right'

export interface UiState {
  /** Which of the vehicle's two cells the Unit and Membrane instruments show. */
  side: Side
  artificial: boolean
  overlay: boolean
  windowMs: number
  showEquations: boolean
  traceMs: number
  calcRate: number
  signalling: number
  spikeShare: number
}

export const DEFAULT_UI: UiState = {
  side: 'left',
  artificial: false,
  overlay: false,
  windowMs: 1000,
  showEquations: false,
  traceMs: 60,
  calcRate: 10,
  signalling: DEFAULT_BUDGET.signallingShare,
  spikeShare: DEFAULT_BUDGET.spikeShareOfSignalling,
}

export interface MeasuredCurve {
  floor: number
  ceiling: number
  sweep: { x: number[]; y: number[] } | null
}

/** The sweep the overlay draws, as totals along the plot's axis. */
const SWEEP_TOTALS = [-40, -20, 0, 10, 20, 30, 40, 60, 80, 100, 120, 150, 180, 210, 240, 260]

/**
 * Floor, ceiling and (when asked for) the whole curve, measured from a cell
 * with these parameters. Debounced, because a slider drag fires many changes
 * and each measurement runs a few seconds of simulated cell; skipped while
 * the Unit tab is not showing.
 */
function useMeasuredCurve(params: CellParams, overlay: boolean, enabled: boolean): MeasuredCurve {
  const key = enabled ? JSON.stringify(params) + (overlay ? '+' : '-') : ''
  const [state, setState] = useState<MeasuredCurve & { key: string }>({
    key: '',
    floor: 0,
    ceiling: 0,
    sweep: null,
  })
  useEffect(() => {
    if (!enabled || state.key === key) return
    const handle = setTimeout(() => {
      const [floor] = measureSweep([UNIT_INPUT_RANGE.min], params, 1)
      const ceiling = measureCeiling(params)
      const sweep = overlay ? { x: [...SWEEP_TOTALS], y: measureSweep(SWEEP_TOTALS, params, 1.2) } : null
      setState({ key, floor, ceiling, sweep })
    }, 350)
    return () => clearTimeout(handle)
  }, [key, params, overlay, enabled, state.key])
  return state
}

export interface SceneState {
  world: NeuronWorld
  ui: UiState
  patchUi: (patch: Partial<UiState>) => void
  curve: MeasuredCurve
  tab: Tab
  setTab: (t: Tab) => void
  bump: () => void
  loaded: LoadedCell
  load: (cell: LoadedCell) => void
  revealed: boolean
  setRevealed: (v: boolean) => void
  seed: number
  reset: (seed: number) => void
  msPerSecond: number
  setMsPerSecond: (v: number) => void
  speed: number
  playing: boolean
}

/**
 * Advances the world each frame. Inside the Canvas because `useFrame` only
 * works there (see Module 2's `Stepper`). `scale` is simulated seconds per
 * real second: the speed multiplier on the World and Unit tabs, and a small
 * fraction on the Membrane tab, which runs in slow motion.
 */
function Stepper({
  world,
  scale,
  onAdvance,
}: {
  world: NeuronWorld
  scale: number
  onAdvance: () => void
}) {
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

function scenarioFor(cell: LoadedCell): Scenario {
  if (cell === 'healthy') return HEALTHY_SCENARIO
  return DIAGNOSTIC_CELLS.find((c) => c.id === cell)!.scenario
}

/**
 * Module 3's scene: the Lab 1 vehicle with a neuron inside its connection,
 * shown three ways at three time scales. One `NeuronWorld`, four tabs, one
 * `<Canvas>` (mounting a second tears down the WebGL context).
 */
export default function NeuronScene() {
  const [tab, setTab] = useState<Tab>('world')
  const [playing, setPlaying] = useState(true)
  const [speed, setSpeed] = useState(1)
  const [msPerSecond, setMsPerSecond] = useState(DEFAULT_MS_PER_SECOND)
  const [seed, setSeed] = useState(() => randomSeed())
  const [loaded, setLoaded] = useState<LoadedCell>('healthy')
  const [revealed, setRevealed] = useState(false)
  const [, bump] = useReducer((x: number) => x + 1, 0)
  const [ui, setUi] = useState<UiState>(DEFAULT_UI)
  const patchUi = (patch: Partial<UiState>) => setUi((u) => ({ ...u, ...patch }))

  const worldRef = useRef<NeuronWorld | null>(null)
  const build = (cell: LoadedCell, withSeed: number) => {
    const w = new NeuronWorld(withSeed, scenarioFor(cell))
    if (cell !== 'healthy') w.run(DIAGNOSTIC_WARM_UP_S)
    return w
  }
  if (!worldRef.current) worldRef.current = build(loaded, seed)
  const world = worldRef.current

  const reset = (withSeed: number) => {
    setSeed(withSeed)
    worldRef.current = build(loaded, withSeed)
    bump()
  }
  const load = (cell: LoadedCell) => {
    setLoaded(cell)
    worldRef.current = build(cell, seed)
    bump()
  }

  const scale = tab === 'membrane' ? msPerSecond / 1000 : speed
  const curve = useMeasuredCurve(world.cellParams, ui.overlay, tab === 'unit')

  const state: SceneState = {
    world,
    ui,
    patchUi,
    curve,
    tab,
    setTab,
    bump,
    loaded,
    load,
    revealed,
    setRevealed,
    seed,
    reset,
    msPerSecond,
    setMsPerSecond,
    speed,
    playing,
  }

  const slots =
    tab === 'world'
      ? WorldTab(state)
      : tab === 'unit'
        ? UnitTab(state)
        : tab === 'membrane'
          ? MembraneTab(state)
          : DiagnosisTab(state)

  return (
    <SceneCanvasLayout
      canvas={
        <Canvas camera={{ position: [0, 20, 14], fov: 45 }} onContextMenu={(e) => e.preventDefault()}>
          <color attach="background" args={[palette.bg]} />
          <ambientLight intensity={0.55} />
          <directionalLight position={[6, 12, 6]} intensity={0.7} />
          <Terrain bounds={world.world.params.bounds} onAdd={() => {}} onRemoveNearest={() => {}} />
          <Grid
            args={[world.world.params.bounds * 2, world.world.params.bounds * 2]}
            cellSize={1}
            cellThickness={0.6}
            cellColor="#2c3c60"
            sectionSize={5}
            sectionThickness={1.2}
            sectionColor="#4a628f"
            fadeDistance={60}
            fadeStrength={0.6}
            position={[0, 0.002, 0]}
          />
          {world.world.sources.map((s) => (
            <SourceMesh key={s.id} source={s} />
          ))}
          {/* Drawn at a constant size whatever the body-size control says: the
              physics spans six orders of magnitude and the arena does not. */}
          <VehicleMesh vehicle={world.vehicle} selected={false} onSelect={() => {}} />
          <Stepper world={world} scale={playing ? scale : 0} onAdvance={bump} />
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
            world.step(tab === 'membrane' ? 0.001 : MAX_STEP_S)
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
  const tabs: { id: Tab; title: string; level: string }[] = [
    { id: 'world', title: 'World', level: 'computational' },
    { id: 'unit', title: 'Unit', level: 'algorithmic' },
    { id: 'membrane', title: 'Membrane', level: 'implementational' },
    { id: 'diagnosis', title: 'Diagnosis', level: 'five cells' },
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
          <div style={{ fontSize: 8.5, fontWeight: 400, opacity: 0.8 }}>{t.level}</div>
        </button>
      ))}
    </div>
  )
}

/** A muted one-liner. */
export function Note({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ margin: 0, fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.45 }}>{children}</p>
  )
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

/** Large numbers, for ATP counts: 1.2 × 10¹⁰. */
export function sci(x: number, digits = 2): string {
  if (!Number.isFinite(x)) return '—'
  if (x === 0) return '0'
  const e = Math.floor(Math.log10(Math.abs(x)))
  const m = x / 10 ** e
  const sup = String(e).replace(/[-0-9]/g, (c) => '⁻⁰¹²³⁴⁵⁶⁷⁸⁹'[c === '-' ? 0 : Number(c) + 1])
  return `${m.toFixed(digits)} × 10${sup}`
}

export const PANEL_STYLE = { width: 316, maxHeight: '84vh', overflowY: 'auto' as const }
export const RIGHT_STYLE = { width: 344, maxHeight: '84vh', overflowY: 'auto' as const }
