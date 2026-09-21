import { useReducer, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Grid } from '@react-three/drei'
import { SceneCanvasLayout } from '../../components/SceneCanvasLayout'
import { StepControls } from '../../components/StepControls'
import { CameraRig } from '../../components/CameraRig'
import { Terrain } from '../../components/Terrain'
import { DISH_BOUNDS } from '../../sim/bilaterian/dishWorld'
import { cloneCircuit, setWiring, type Circuit } from '../../sim/bilaterian/circuit'
import { LearningDish, type LearningDishOptions } from '../../sim/bilaterian/learning/learningDish'
import { LEARNING_SCENARIOS, learningScenarioByKey, type LaneSpec, type LearningScenario } from '../../sim/bilaterian/learning/scenarios'
import { randomSeed } from '../../sim/random'
import { palette } from '../../theme/theme'
import { WormMesh, CueFieldMesh, MealMarks } from '../m04_bilaterian/meshes'
import { CircuitTab } from '../m04_bilaterian/CircuitTab'
import { ChemistryTab } from '../m04_bilaterian/ChemistryTab'
import type { SceneState } from '../m04_bilaterian/BilaterianScene'
import { WorldTab } from './WorldTab'
import { LearningTab } from './LearningTab'
import { WeightTraceSection, DopamineControls, DopamineReadouts } from './instruments'

export type Tab = 'world' | 'circuit' | 'learning' | 'chemistry'

const MAX_STEP_S = 1 / 30
/** Simulated seconds of a skip paid per frame. */
const SKIP_SLICE_S = 30

export interface LearningSceneState {
  world: LearningDish
  scenario: LearningScenario
  loadScenario: (key: string) => void
  tab: Tab
  setTab: (t: Tab) => void
  bump: () => void
  seed: number
  reset: (seed: number) => void
  placeChannel: number
  setPlaceChannel: (c: number) => void
  /** Run the dish forward this many simulated seconds without drawing it. */
  skip: (seconds: number) => void
}

function Stepper({ world, scale, onAdvance }: { world: LearningDish; scale: number; onAdvance: () => void }) {
  const repaint = useRef(0)
  useFrame((_, delta) => {
    // A skip is being paid down by the scene's own timer; do not step underneath it.
    if (world.skipRemaining > 0) return
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
 * Module 5's scene, and **a configuration of Module 4's rather than a new
 * one**: the same animal, dish, camera, transport, Circuit tab and Chemistry
 * tab, imported from `m04_bilaterian` and not copied. What is added is the
 * learning layer — a `LearningDish` in place of the `DishWorld`, a Learning
 * tab in place of the Worms tab, the weight trace on the Circuit tab, and the
 * broadcast signal on the Chemistry tab.
 */
export default function LearningScene() {
  const [tab, setTab] = useState<Tab>('world')
  const [playing, setPlaying] = useState(true)
  const [speed, setSpeed] = useState(1)
  const [seed, setSeed] = useState(() => randomSeed())
  const [placeChannel, setPlaceChannel] = useState(0)
  const [, bump] = useReducer((x: number) => x + 1, 0)
  const worldRef = useRef<LearningDish | null>(null)

  if (!worldRef.current) worldRef.current = new LearningDish(seed, LEARNING_SCENARIOS[0])
  const world = worldRef.current
  const scenario = world.scenario

  /**
   * Reset starts the run again: the same seed, every control where the
   * student left it, and the weights back where the run started — a run
   * that kept its learned weights could not be compared with the one before.
   * A weight set by hand counts as a new start (see `afterWiring`).
   */
  const reset = (withSeed: number) => {
    setSeed(withSeed)
    const opts: LearningDishOptions = {
      circuit: startOf(world),
      modulators: { ...world.worm.mod.setPoint },
      concentration: world.concentration,
      learning: { ...world.learner.settings },
      interval: world.interval,
      flags: { ...world.flags },
    }
    worldRef.current = new LearningDish(withSeed, world.scenario, opts)
    bump()
  }

  const loadScenario = (key: string) => {
    worldRef.current = new LearningDish(seed, learningScenarioByKey(key), { concentration: world.concentration })
    setPlaceChannel(0)
    bump()
  }

  /**
   * Skip ahead, paid down on a timer and not in the frame loop: thirty
   * simulated seconds a slice, a slice per task, so the page stays responsive
   * and the cost does not depend on how fast this machine can draw. (The frame
   * loop is also the one thing a throttled or backgrounded tab stops running.)
   */
  const skip = (seconds: number) => {
    const owedAlready = world.skipRemaining > 0
    world.skipAhead(seconds)
    bump()
    if (owedAlready) return
    const pay = () => {
      if (worldRef.current !== world) return
      world.paySkip(SKIP_SLICE_S)
      bump()
      if (world.skipRemaining > 0) setTimeout(pay, 0)
    }
    setTimeout(pay, 0)
  }

  const state: LearningSceneState = { world, scenario, loadScenario, tab, setTab, bump, seed, reset, placeChannel, setPlaceChannel, skip }
  const tabBar = <TabBar tab={tab} onChange={setTab} />

  /** Lab 4's tabs, handed this world and this scene's slots. */
  const lab4: SceneState = {
    world,
    scenario,
    loadScenario,
    animal: 'healthy',
    loadAnimal: () => {},
    hideNumbers: false,
    revealed: true,
    setRevealed: () => {},
    tab: 'circuit',
    setTab: () => {},
    bump,
    seed,
    reset,
    placeChannel,
    setPlaceChannel,
    speed,
    playing,
    tabBar,
    wiringTitle: 'Wiring — yours to set, and now the rule’s to change',
    circuitExtra: <WeightTraceSection world={world} />,
    chemistryExtra: { controls: <DopamineControls />, readouts: <DopamineReadouts world={world} /> },
    // A weight, baseline or threshold set by hand is where the next run starts from.
    afterWiring: (patch) => {
      setWiring(world.startCircuit, patch)
      if (patch.weight) world.startWeights[patch.weight.input] = patch.weight.value
    },
  }

  const slots =
    tab === 'world' ? WorldTab(state) : tab === 'learning' ? LearningTab(state) : tab === 'circuit' ? CircuitTab(lab4) : ChemistryTab(lab4)
  const channelColors = scenario.channels.map((c) => c.color)

  return (
    <SceneCanvasLayout
      canvas={
        <>
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
          {scenario.learning.context && world.context.dish === 1 && (
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.003, 0]}>
              <planeGeometry args={[DISH_BOUNDS * 2, DISH_BOUNDS * 2]} />
              <meshBasicMaterial color="#c9a0ff" transparent opacity={0.16} />
            </mesh>
          )}
          {scenario.learning.lane && <LaneMesh lane={scenario.learning.lane} colors={channelColors} live={world.worm.internalDrive} />}
          <MealMarks world={world} />
          <WormMesh worm={world.worm} colors={channelColors} />
          <Stepper world={world} scale={playing ? speed : 0} onAdvance={bump} />
          <CameraRig target={[0, 0, 0]} />
        </Canvas>
        {world.skipRemaining > 0 && (
          <div
            style={{
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
            }}
          >
            <b>Skipping ahead</b> — {world.skipRemaining.toFixed(0)} s to go
          </div>
        )}
        </>
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
          maxSpeed={8}
        />
      }
    />
  )
}

/**
 * The corridor: two walls, and a strip of floor for each zone, bright while
 * the animal is on it. Flat colour, unlit, because the dark theme has hidden
 * lit geometry here before.
 */
function LaneMesh({ lane, colors, live }: { lane: LaneSpec; colors: string[]; live: number[] }) {
  const length = DISH_BOUNDS * 2
  return (
    <group>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[0, 0.15, side * (lane.halfWidth + 0.08)]}>
          <boxGeometry args={[length, 0.3, 0.12]} />
          <meshBasicMaterial color="#8fa6d6" />
        </mesh>
      ))}
      {lane.zones.map((z) => (
        <mesh key={z.cell} rotation={[-Math.PI / 2, 0, 0]} position={[(z.from + z.to) / 2, 0.006, 0]}>
          <planeGeometry args={[z.to - z.from, lane.halfWidth * 2]} />
          <meshBasicMaterial color={colors[z.cell]} transparent opacity={live[z.cell] ? 0.75 : 0.32} />
        </mesh>
      ))}
      {lane.distractor && (live[lane.distractor.cell] ?? 0) > 0 && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]}>
          <planeGeometry args={[length, lane.halfWidth * 2]} />
          <meshBasicMaterial color={colors[lane.distractor.cell]} transparent opacity={0.22} />
        </mesh>
      )}
    </group>
  )
}

/** The wiring a run of this world started from. */
function startOf(world: LearningDish): Circuit {
  return cloneCircuit(world.startCircuit)
}

export function TabBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  const tabs: { id: Tab; title: string; sub: string }[] = [
    { id: 'world', title: 'World', sub: 'the dish' },
    { id: 'circuit', title: 'Circuit', sub: 'the wiring' },
    { id: 'learning', title: 'Learning', sub: 'the rule' },
    { id: 'chemistry', title: 'Chemistry', sub: 'the modulators' },
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
