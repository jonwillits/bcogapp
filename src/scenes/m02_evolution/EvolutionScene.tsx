import { useReducer, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Grid } from '@react-three/drei'
import { SceneCanvasLayout } from '../../components/SceneCanvasLayout'
import { Panel } from '../../components/Panel'
import { Button, Slider, SelectControl, Toggle } from '../../components/controls'
import { StepControls } from '../../components/StepControls'
import { CameraRig } from '../../components/CameraRig'
import { VehicleMesh } from '../../components/VehicleMesh'
import { SourceMesh, ORB_HOVER } from '../../components/SourceMesh'
import { Terrain } from '../../components/Terrain'
import { VehicleWorld, DEFAULT_WORLD_PARAMS, type Vehicle } from '../../sim/world/world'
import {
  ContinuousWorld,
  DEFAULT_CONTINUOUS_PARAMS,
  type Creature,
} from '../../sim/world/continuousWorld'
import type { LightRegime } from '../../sim/world/evolutionWorld'
import { genomeToWeights, bodyColour, markCss, type Genome } from '../../sim/creature/genome'
import { randomSeed } from '../../sim/random'
import { CONTINUOUS_LINEAGE_DATA } from '../../sim/world/continuousLineageData'
import { PopulationPlane, GeneHistograms, BirthRatePanel, MarkPanel } from './PopulationPanels'
import { LineageTree, TrueHistory } from './LineageTree'
import { IndividualPanel } from './IndividualPanel'
import { palette } from '../../theme/theme'

const FIXED_STEP = 1 / 30

type FounderChoice = 'diverse' | 'P' | 'Q'

function useBump() {
  const [, bump] = useReducer((x: number) => x + 1, 0)
  return bump
}

/**
 * Advances a world in fixed sub-steps.
 *
 * The speed multiplier used to scale the size of a single step, which meant
 * turning the speed up coarsened the physics — at 10x a creature moved a third
 * of a unit per step and steering stopped resolving. Sub-stepping keeps every
 * step the same size and simply takes more of them, so speed changes how fast
 * you watch and nothing else. That is what lets the cap go up far enough for a
 * student to watch a long run in a few minutes.
 *
 * A component rather than a hook, and it has to be: `useFrame` only works inside
 * the r3f reconciler, so this must be rendered *within* the `<Canvas>`. Calling
 * it from the tab hooks — which run in the parent — throws "Hooks can only be
 * used within the Canvas component".
 */
function Stepper({
  speed,
  advance,
}: {
  speed: number
  advance: (dt: number) => void
}) {
  const carry = useRef(0)
  useFrame((_, delta) => {
    if (speed <= 0) return
    // Cap the catch-up, so a backgrounded tab does not return and simulate a
    // minute of world in a single frame.
    carry.current = Math.min(carry.current + Math.min(delta, 0.05) * speed, 1)
    let guard = 0
    while (carry.current >= FIXED_STEP && guard++ < 400) {
      advance(FIXED_STEP)
      carry.current -= FIXED_STEP
    }
  })
  return null
}

function Arena({
  bounds,
  sources,
  onAdd,
  onRemoveNearest,
  children,
}: {
  bounds: number
  sources: { id: number; x: number; y: number; z: number; strength: number }[]
  onAdd: (x: number, y: number, z: number) => void
  onRemoveNearest: (x: number, z: number) => void
  children?: React.ReactNode
}) {
  return (
    <>
      <color attach="background" args={[palette.bg]} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[6, 12, 6]} intensity={0.7} />
      <Terrain bounds={bounds} onAdd={onAdd} onRemoveNearest={onRemoveNearest} />
      <Grid
        args={[bounds * 2, bounds * 2]}
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
      {sources.map((s) => (
        <SourceMesh key={s.id} source={s} />
      ))}
      {children}
      <CameraRig target={[0, 0, 0]} />
    </>
  )
}

function TabBar({
  tab,
  onChange,
}: {
  tab: 'evolve' | 'lineages'
  onChange: (t: 'evolve' | 'lineages') => void
}) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {(['evolve', 'lineages'] as const).map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => onChange(t)}
          style={{
            flex: 1,
            padding: '5px 8px',
            fontSize: 12,
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)',
            cursor: 'pointer',
            background: tab === t ? 'var(--accent)' : 'transparent',
            color: tab === t ? '#0b111c' : 'var(--text)',
            fontWeight: tab === t ? 600 : 400,
          }}
        >
          {t === 'evolve' ? 'Evolve' : 'Lineages'}
        </button>
      ))}
    </div>
  )
}

/** mm:ss, so elapsed time reads as a duration rather than a large number. */
function clock(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

interface TabSlots {
  world: React.ReactNode
  left: React.ReactNode
  right: React.ReactNode
  bottom: React.ReactNode
}

// ---------------------------------------------------------------- Evolve tab

function useEvolveTab(
  active: boolean,
  tab: 'evolve' | 'lineages',
  setTab: (t: 'evolve' | 'lineages') => void,
): TabSlots {
  const bump = useBump()
  const [seed, setSeed] = useState(() => randomSeed())
  const [founders, setFounders] = useState<FounderChoice>('diverse')
  const [mutationScale, setMutationScale] = useState(1)
  const [inheritance, setInheritance] = useState(true)
  const [selection, setSelection] = useState(true)
  const [capacity, setCapacity] = useState(16)
  const [regime, setRegime] = useState<LightRegime>('food')
  const [sensorNoise, setSensorNoise] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(4)
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const build = (withSeed: number) =>
    new ContinuousWorld(
      withSeed,
      {
        ...DEFAULT_CONTINUOUS_PARAMS,
        populationCap: capacity,
        initialPopulation: capacity,
        mutationScale,
        inheritance,
        selection,
        regime,
        sensorNoise,
      },
      founders,
    )

  const worldRef = useRef<ContinuousWorld | null>(null)
  if (!worldRef.current) worldRef.current = build(seed)
  const world = worldRef.current
  const repaint = useRef(0)

  const applyLive = (patch: Partial<typeof world.params>) => {
    Object.assign(world.params, patch)
    if (patch.sensorNoise !== undefined) world.world.params.sensorNoise = patch.sensorNoise
    bump()
  }
  const reset = (newSeed: number) => {
    setSeed(newSeed)
    worldRef.current = build(newSeed)
    setSelectedId(null)
    bump()
  }

  const selected = world.creatures.find((c) => c.vehicle.id === selectedId) ?? null
  const genomes = world.creatures.map((c) => c.genome)

  return {
    world: (
      <Arena
        bounds={world.params.bounds}
        sources={world.world.sources}
        onAdd={(x, groundY, z) => {
          world.addLight(x, groundY + ORB_HOVER, z)
          bump()
        }}
        onRemoveNearest={(x, z) => {
          if (world.removeLightNearest(x, z, 2.2)) bump()
        }}
      >
        {world.creatures.map((c: Creature) => (
          <VehicleMesh
            key={c.vehicle.id}
            vehicle={c.vehicle}
            selected={c.vehicle.id === selectedId}
            onSelect={setSelectedId}
            mark={markCss(c.genome.hue)}
            energy={c.energy / world.params.reproduceThreshold}
          />
        ))}
        <Stepper
          speed={playing && active ? speed : 0}
          advance={(dt) => {
            world.step(dt)
            repaint.current += dt
            if (repaint.current >= 0.15) {
              repaint.current = 0
              bump()
            }
          }}
        />
      </Arena>
    ),
    left: (
      <Panel
        title="Evolving creatures"
        style={{ width: 286, maxHeight: '82vh', overflowY: 'auto' }}
      >
        <TabBar tab={tab} onChange={setTab} />

        <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 600 }}>
            {clock(world.time)}
          </span>
          <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
            {world.creatures.length} alive · {world.births} born
          </span>
        </div>

        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.45 }}>
          Food appears, is eaten, and moves on. A creature whose <b>energy bar</b>{' '}
          fills reproduces as soon as there is room; one that runs out of life
          dies. <b>Left-click the floor</b> to add food, right-click to remove it.
          Click a creature to open its wiring.
        </p>

        <BirthRatePanel samples={world.samples} populationCap={world.params.populationCap} />
        <PopulationPlane genomes={genomes} />
        <MarkPanel genomes={genomes} />
        <GeneHistograms genomes={genomes} />
      </Panel>
    ),
    right: selected ? (
      <IndividualPanel
        vehicle={selected.vehicle}
        genome={selected.genome}
        individualId={selected.id}
        energy={selected.energy}
        age={selected.age}
        lifespan={selected.lifespan}
        lineage={world.lineage}
        treeSpan={Math.max(1, world.time)}
        treeRevealed
        onClose={() => setSelectedId(null)}
      />
    ) : (
      <Panel title="Controls" style={{ width: 276, maxHeight: '82vh', overflowY: 'auto' }}>
        <Slider
          label="Mutation rate"
          value={mutationScale}
          min={0}
          max={3}
          step={0.1}
          onChange={(v) => {
            setMutationScale(v)
            applyLive({ mutationScale: v })
          }}
        />
        <Toggle
          label="Inheritance"
          checked={inheritance}
          onChange={(v) => {
            setInheritance(v)
            applyLive({ inheritance: v })
          }}
        />
        <Toggle
          label="Selection"
          checked={selection}
          onChange={(v) => {
            setSelection(v)
            applyLive({ selection: v })
          }}
        />
        <Slider
          label="How many the pit holds"
          value={capacity}
          min={6}
          max={40}
          step={2}
          format={(v) => v.toFixed(0)}
          onChange={setCapacity}
        />
        <SelectControl
          label="Light regime"
          value={regime}
          options={[
            { value: 'food', label: 'Food' },
            { value: 'neutral', label: 'Neutral' },
            { value: 'poison', label: 'Poison' },
          ]}
          onChange={(v) => {
            setRegime(v)
            applyLive({ regime: v })
          }}
        />
        <SelectControl
          label="Founders"
          value={founders}
          options={[
            { value: 'diverse', label: 'Diverse mix' },
            { value: 'P', label: 'Pool P — weak light-chasers' },
            { value: 'Q', label: 'Pool Q — light-fleers' },
          ]}
          onChange={setFounders}
        />
        <Slider
          label="Sensor noise"
          value={sensorNoise}
          min={0}
          max={0.6}
          step={0.05}
          onChange={(v) => {
            setSensorNoise(v)
            applyLive({ sensorNoise: v })
          }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Run seed</span>
          <input
            value={seed}
            onChange={(e) => setSeed(Number(e.target.value) >>> 0)}
            style={{
              width: '100%',
              padding: '4px 6px',
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              background: 'var(--bg)',
              color: 'var(--text)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <Button onClick={() => reset(seed)} variant="primary">
            Reset (same seed)
          </Button>
          <Button onClick={() => reset(randomSeed())}>Reset</Button>
        </div>
        <p style={{ margin: 0, fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.45 }}>
          <b>Reset (same seed)</b> redraws the identical founding population, so you
          can change exactly one switch and be sure nothing else moved. The pit's
          capacity and the founders take effect on the next reset; everything else
          applies at once.
        </p>
      </Panel>
    ),
    bottom: (
      <StepControls
        playing={playing}
        onPlayPause={() => setPlaying((p) => !p)}
        onStep={() => {
          for (let i = 0; i < 30; i++) world.step(FIXED_STEP)
          bump()
        }}
        onReset={() => reset(seed)}
        speed={speed}
        onSpeedChange={setSpeed}
        maxSpeed={20}
      />
    ),
  }
}

// -------------------------------------------------------------- Lineages tab

function useLineagesTab(
  active: boolean,
  tab: 'evolve' | 'lineages',
  setTab: (t: 'evolve' | 'lineages') => void,
): TabSlots {
  const bump = useBump()
  const [which, setWhich] = useState('W')
  const [revealWiring, setRevealWiring] = useState(false)
  const [revealTree, setRevealTree] = useState(false)
  const [trueHistory, setTrueHistory] = useState(false)
  const [sensorNoise, setSensorNoise] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(2)
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const fixture = CONTINUOUS_LINEAGE_DATA.find((f) => f.id === which)!

  /**
   * A plain observation world: nothing eats, breeds or dies, and the light stays
   * put. In this tab a light is an instrument rather than a resource — one that
   * emptied or wandered off partway through would make a student's comparison
   * unrepeatable, which is the one thing Part 3 cannot afford.
   */
  const build = () => {
    const w = new VehicleWorld({ ...DEFAULT_WORLD_PARAMS, sensorNoise })
    w.addSource(0, ORB_HOVER, 0, 4)
    const n = fixture.genomes.length
    fixture.genomes.forEach((g: Genome, i: number) => {
      const angle = (i / n) * Math.PI * 2
      const r = DEFAULT_WORLD_PARAMS.bounds * 0.3
      w.addWeightedVehicle(genomeToWeights(g), bodyColour(g), {
        x: Math.cos(angle) * r,
        z: Math.sin(angle) * r,
        heading: angle + Math.PI / 2,
      })
    })
    return w
  }

  const worldRef = useRef<VehicleWorld | null>(null)
  const builtFor = useRef('')
  if (!worldRef.current || builtFor.current !== which) {
    worldRef.current = build()
    builtFor.current = which
  }
  const world = worldRef.current

  const restart = () => {
    worldRef.current = build()
    setSelectedId(null)
    bump()
  }

  const index = world.vehicles.findIndex((v) => v.id === selectedId)
  const selectedVehicle = index >= 0 ? world.vehicles[index] : null

  return {
    world: (
      <Arena
        bounds={world.params.bounds}
        sources={world.sources}
        onAdd={(x, groundY, z) => {
          world.addSource(x, groundY + ORB_HOVER, z, 4)
          bump()
        }}
        onRemoveNearest={(x, z) => {
          let best: number | null = null
          let bestD = Infinity
          for (const s of world.sources) {
            const d = Math.hypot(s.x - x, s.z - z)
            if (d < bestD) {
              bestD = d
              best = s.id
            }
          }
          if (best !== null && bestD <= 2.2) {
            world.removeSource(best)
            bump()
          }
        }}
      >
        {world.vehicles.map((v: Vehicle, i: number) => (
          <VehicleMesh
            key={v.id}
            // Body colour reads the wiring, so it stays hidden until the student
            // has committed and pressed Reveal wiring.
            vehicle={revealWiring ? { ...v, color: bodyColour(fixture.genomes[i]) } : { ...v, color: '#8d99ae' }}
            selected={v.id === selectedId}
            onSelect={setSelectedId}
            mark={revealWiring ? markCss(fixture.genomes[i].hue) : undefined}
          />
        ))}
        <Stepper
          speed={playing && active ? speed : 0}
          advance={(dt) => {
            world.step(dt)
            bump()
          }}
        />
      </Arena>
    ),
    left: (
      <Panel
        title="Four populations"
        style={{ width: 286, maxHeight: '82vh', overflowY: 'auto' }}
      >
        <TabBar tab={tab} onChange={setTab} />
        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.45 }}>
          Four populations someone else evolved. Run them, put lights wherever you
          like, and work out which ones behave alike — <b>before</b> you reveal
          anything.
        </p>

        <div style={{ display: 'flex', gap: 6 }}>
          {CONTINUOUS_LINEAGE_DATA.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => {
                setWhich(f.id)
                setSelectedId(null)
              }}
              style={{
                flex: 1,
                padding: '6px 0',
                fontSize: 13,
                fontFamily: 'var(--font-mono)',
                fontWeight: 600,
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
                cursor: 'pointer',
                background: which === f.id ? 'var(--accent)' : 'transparent',
                color: which === f.id ? '#0b111c' : 'var(--text)',
              }}
            >
              {f.id}
            </button>
          ))}
        </div>

        <Button onClick={restart}>Restart this population</Button>
        <Slider
          label="Sensor noise"
          value={sensorNoise}
          min={0}
          max={0.6}
          step={0.05}
          onChange={(v) => {
            setSensorNoise(v)
            world.params.sensorNoise = v
            bump()
          }}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Toggle label="Reveal wiring" checked={revealWiring} onChange={setRevealWiring} />
          <Toggle label="Reveal tree" checked={revealTree} onChange={setRevealTree} />
          <Toggle
            label="True history — all four"
            checked={trueHistory}
            onChange={(v) => {
              setTrueHistory(v)
              if (v) setRevealTree(true)
            }}
          />
        </div>

        {revealTree && !trueHistory && (
          <LineageTree
            lineage={fixture.lineage}
            memberIds={fixture.memberIds}
            span={fixture.duration}
            label={`Ancestry of population ${fixture.id}`}
          />
        )}
        {trueHistory && <TrueHistory fixtures={CONTINUOUS_LINEAGE_DATA} />}
      </Panel>
    ),
    right: selectedVehicle ? (
      revealWiring ? (
        <IndividualPanel
          vehicle={selectedVehicle}
          genome={fixture.genomes[index]}
          individualId={fixture.memberIds[index]}
          lineage={fixture.lineage}
          treeSpan={fixture.duration}
          treeRevealed={revealTree}
          onClose={() => setSelectedId(null)}
        />
      ) : (
        <Panel title="Individual" onClose={() => setSelectedId(null)} style={{ width: 300 }}>
          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            This creature's wiring is hidden — and so is its colour, which would
            give the wiring away. Watch what the four populations do, group them by
            behaviour, and commit to an answer. Then press <b>Reveal wiring</b>.
          </p>
        </Panel>
      )
    ) : undefined,
    bottom: (
      <StepControls
        playing={playing}
        onPlayPause={() => setPlaying((p) => !p)}
        onStep={() => {
          for (let i = 0; i < 15; i++) world.step(FIXED_STEP)
          bump()
        }}
        onReset={restart}
        speed={speed}
        onSpeedChange={setSpeed}
        maxSpeed={8}
      />
    ),
  }
}

/**
 * Module 2's scene: a breeding population of Module 1 creatures, and the four
 * saved lineages Part 3 is about.
 *
 * One <Canvas> for both tabs, and it has to be one — mounting a second when the
 * tab changes tears down the first WebGL context and the new tab renders black.
 * Each tab's world stays alive across the switch, so a run in progress is where
 * you left it.
 */
export default function EvolutionScene() {
  const [tab, setTab] = useState<'evolve' | 'lineages'>('evolve')
  const evolve = useEvolveTab(tab === 'evolve', tab, setTab)
  const lineages = useLineagesTab(tab === 'lineages', tab, setTab)
  const slots = tab === 'evolve' ? evolve : lineages

  return (
    <SceneCanvasLayout
      canvas={
        <Canvas
          camera={{ position: [0, 16, 18], fov: 45 }}
          onContextMenu={(e) => e.preventDefault()}
        >
          {slots.world}
        </Canvas>
      }
      left={slots.left}
      right={slots.right}
      bottom={slots.bottom}
    />
  )
}
