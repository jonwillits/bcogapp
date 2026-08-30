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
import { VehicleWorld, DEFAULT_WORLD_PARAMS } from '../../sim/world/world'
import {
  EvolutionWorld,
  DEFAULT_EVOLUTION_PARAMS,
  type FounderSetting,
  type LightRegime,
} from '../../sim/world/evolutionWorld'
import { genomeToWeights, hueToCss } from '../../sim/creature/genome'
import { randomSeed } from '../../sim/random'
import { LINEAGE_DATA } from '../../sim/world/lineageData'
import { PopulationPlane, GeneHistograms, FitnessPanel, ColourPanel } from './PopulationPanels'
import { LineageTree, TrueHistory } from './LineageTree'
import { IndividualPanel } from './IndividualPanel'
import { palette } from '../../theme/theme'

const FIXED_STEP = 1 / 30
const REMOVE_RADIUS = 2.2

/**
 * Two floor lights to start, not the four the world is tuned for.
 *
 * The handout asks a student to place the other two, which gives them something
 * to do in the first thirty seconds — and the instruction is load-bearing rather
 * than decorative. Measured across light counts, two lights put strategy parity
 * at 1.53 (roaming beats parking by half again, outside §3.1's ±20% band)
 * because food is scarce enough that finding it dominates extracting it; at
 * three or more it is inside the band. So placing the lights is itself a
 * demonstration that the economics of a world decide which strategy wins.
 */
const STARTING_LIGHTS = 2

function useBump() {
  const [, bump] = useReducer((x: number) => x + 1, 0)
  return bump
}

/** Shared scaffolding: the pit, the grid, the lights, the camera. */
function Arena({
  bounds,
  sources,
  vehicles,
  selectedId,
  onSelect,
  onAdd,
  onRemoveNearest,
}: {
  bounds: number
  sources: { id: number; x: number; y: number; z: number; strength: number }[]
  vehicles: React.ComponentProps<typeof VehicleMesh>['vehicle'][]
  selectedId: number | null
  onSelect: (id: number) => void
  onAdd: (x: number, y: number, z: number) => void
  onRemoveNearest: (x: number, z: number) => void
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
      {vehicles.map((v) => (
        <VehicleMesh
          key={v.id}
          vehicle={v}
          selected={v.id === selectedId}
          onSelect={onSelect}
        />
      ))}
      <CameraRig target={[0, 0, 0]} />
    </>
  )
}

/**
 * Advances the evolution world and closes a generation when one is due.
 *
 * The generation boundary lives here rather than inside `step()` because
 * `stepGeneration()` drives the same `step()` from the headless tests and must
 * decide for itself when to stop.
 */
function EvolutionDriver({
  world,
  playing,
  speed,
  onSample,
}: {
  world: EvolutionWorld
  playing: boolean
  speed: number
  onSample: () => void
}) {
  const acc = useRef(0)
  useFrame((_, delta) => {
    if (!playing) return
    world.step(Math.min(delta, 0.05) * speed)
    if (world.genTime >= world.params.generationLength) world.endGeneration()
    acc.current += delta
    if (acc.current >= 0.1) {
      acc.current = 0
      onSample()
    }
  })
  return null
}

/** Advances a plain observation world — the Lineages tab, where nothing breeds. */
function ObservationDriver({
  world,
  playing,
  speed,
  onSample,
}: {
  world: VehicleWorld
  playing: boolean
  speed: number
  onSample: () => void
}) {
  const acc = useRef(0)
  useFrame((_, delta) => {
    if (!playing) return
    world.step(Math.min(delta, 0.05) * speed)
    acc.current += delta
    if (acc.current >= 0.1) {
      acc.current = 0
      onSample()
    }
  })
  return null
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

// ---------------------------------------------------------------- Evolve tab

interface TabSlots {
  world: React.ReactNode
  left: React.ReactNode
  right: React.ReactNode
  bottom: React.ReactNode
}

function useEvolveTab(
  active: boolean,
  tab: 'evolve' | 'lineages',
  setTab: (t: 'evolve' | 'lineages') => void,
): TabSlots {
  const bump = useBump()
  const [seed, setSeed] = useState(() => randomSeed())
  const [founders, setFounders] = useState<FounderSetting>('diverse')
  const [mutationScale, setMutationScale] = useState(1)
  const [inheritance, setInheritance] = useState(true)
  const [selection, setSelection] = useState(true)
  const [populationSize, setPopulationSize] = useState(24)
  const [regime, setRegime] = useState<LightRegime>('food')
  const [sensorNoise, setSensorNoise] = useState(0)

  const build = (withSeed: number) =>
    new EvolutionWorld(
      withSeed,
      {
        ...DEFAULT_EVOLUTION_PARAMS,
        populationSize,
        mutationScale,
        inheritance,
        selection,
        regime,
        sensorNoise,
        food: { ...DEFAULT_EVOLUTION_PARAMS.food, count: STARTING_LIGHTS },
      },
      founders,
    )

  const worldRef = useRef<EvolutionWorld | null>(null)
  if (!worldRef.current) worldRef.current = build(seed)
  const world = worldRef.current

  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(4)
  const [selectedId, setSelectedId] = useState<number | null>(null)

  // Controls that can change under a living population do so; the rest need a
  // reset, which is what the lab asks for anyway ("Reset (same seed) first").
  const applyLive = (patch: Partial<typeof world.params>) => {
    Object.assign(world.params, patch)
    if (patch.sensorNoise !== undefined) world.setSensorNoise(patch.sensorNoise)
    bump()
  }

  const reset = (newSeed: number) => {
    setSeed(newSeed)
    worldRef.current = build(newSeed)
    setSelectedId(null)
    bump()
  }

  const selected = world.population.find((p) => p.vehicle.id === selectedId) ?? null

  return {
    world: (
      <>
        <Arena
          bounds={world.params.bounds}
          sources={world.world.sources}
          vehicles={world.world.vehicles}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onAdd={(x, groundY, z) => {
            world.addLight(x, groundY + ORB_HOVER, z)
            bump()
          }}
          onRemoveNearest={(x, z) => {
            if (world.removeLightNearest(x, z, REMOVE_RADIUS)) bump()
          }}
        />
        <EvolutionDriver
          world={world}
          playing={playing && active}
          speed={speed}
          onSample={bump}
        />
      </>
    ),
    left: (
        <Panel title="Evolving vehicles" style={{ width: 286, maxHeight: '82vh', overflowY: 'auto' }}>
          <TabBar tab={tab} onChange={setTab} />

          <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 600 }}>
              gen {world.generation}
            </span>
            <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
              {world.population.length} vehicles
            </span>
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            <Button onClick={() => { world.stepGeneration(); bump() }}>Step generation</Button>
            <Button onClick={() => { world.clearLights(); bump() }}>Clear lights</Button>
          </div>

          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.45 }}>
            The pit starts with two lights. <b>Left-click the floor to add more</b> —
            the lab asks for two or three. Right-click removes the nearest. Click a
            vehicle to open its wiring.
          </p>

          <FitnessPanel history={world.history} />
          <PopulationPlane genomes={world.population.map((p) => p.genome)} />
          <ColourPanel genomes={world.population.map((p) => p.genome)} />
          <GeneHistograms genomes={world.population.map((p) => p.genome)} />
        </Panel>
    ),
    right: selected ? (
          <IndividualPanel
            vehicle={selected.vehicle}
            genome={selected.genome}
            individualId={selected.id}
            energy={selected.energy}
            lineage={world.lineage}
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
              onChange={(v) => { setMutationScale(v); applyLive({ mutationScale: v }) }}
            />
            <Toggle
              label="Inheritance"
              checked={inheritance}
              onChange={(v) => { setInheritance(v); applyLive({ inheritance: v }) }}
            />
            <Toggle
              label="Selection"
              checked={selection}
              onChange={(v) => { setSelection(v); applyLive({ selection: v }) }}
            />
            <Slider
              label="Population size"
              value={populationSize}
              min={6}
              max={60}
              step={2}
              format={(v) => v.toFixed(0)}
              onChange={setPopulationSize}
            />
            <SelectControl
              label="Light regime"
              value={regime}
              options={[
                { value: 'food', label: 'Food' },
                { value: 'neutral', label: 'Neutral' },
                { value: 'poison', label: 'Poison' },
              ]}
              onChange={(v) => { setRegime(v); world.setRegime(v); bump() }}
            />
            <SelectControl
              label="Founders"
              value={founders}
              options={[
                { value: 'diverse', label: 'Diverse mix' },
                { value: 'all-2a', label: 'All 2a' },
                { value: 'all-2b', label: 'All 2b' },
                { value: 'all-3a', label: 'All 3a' },
                { value: 'all-3c', label: 'All 3c' },
              ]}
              onChange={setFounders}
            />
            <Slider
              label="Sensor noise"
              value={sensorNoise}
              min={0}
              max={0.6}
              step={0.05}
              onChange={(v) => { setSensorNoise(v); applyLive({ sensorNoise: v }) }}
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
              <b>Reset (same seed)</b> redraws the identical founding population, so
              you can change exactly one switch and be sure nothing else moved.
              Population size and founders take effect on the next reset; the rest
          apply immediately.
        </p>
      </Panel>
    ),
    bottom: (
      <StepControls
        playing={playing}
        onPlayPause={() => setPlaying((p) => !p)}
        onStep={() => { world.step(FIXED_STEP); bump() }}
        onReset={() => reset(seed)}
        speed={speed}
        onSpeedChange={setSpeed}
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
  const [regime, setRegime] = useState<LightRegime>('food')
  const [sensorNoise, setSensorNoise] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(2)
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const fixture = LINEAGE_DATA.find((f) => f.id === which)!

  /**
   * A plain observation world: no energy, no breeding, and lights that do not
   * deplete. In this tab a light is an instrument rather than a resource, and
   * one that quietly emptied and moved partway through would make a student's
   * comparison unrepeatable — which is the one thing Part 3 cannot afford.
   */
  const build = () => {
    const w = new VehicleWorld({ ...DEFAULT_WORLD_PARAMS, sensorNoise })
    w.addSource(0, ORB_HOVER, 0, 4)
    const n = fixture.genomes.length
    fixture.genomes.forEach((g, i) => {
      const angle = (i / n) * Math.PI * 2
      const r = DEFAULT_WORLD_PARAMS.bounds * 0.3
      w.addWeightedVehicle(genomeToWeights(g), hueToCss(g.hue), {
        x: Math.cos(angle) * r,
        z: Math.sin(angle) * r,
        heading: angle + Math.PI / 2,
      })
    })
    return w
  }

  const worldRef = useRef<VehicleWorld | null>(null)
  const builtFor = useRef<string>('')
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

  const selectedIndex = world.vehicles.findIndex((v) => v.id === selectedId)
  const selectedVehicle = selectedIndex >= 0 ? world.vehicles[selectedIndex] : null

  return {
    world: (
      <>
        <Arena
          bounds={world.params.bounds}
          sources={world.sources}
          vehicles={world.vehicles}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onAdd={(x, groundY, z) => {
            world.addSource(x, groundY + ORB_HOVER, z, 4)
            bump()
          }}
          onRemoveNearest={(x, z) => {
            let best: number | null = null
            let bestD = Infinity
            for (const s of world.sources) {
              const d = Math.hypot(s.x - x, s.z - z)
              if (d < bestD) { bestD = d; best = s.id }
            }
            if (best !== null && bestD <= REMOVE_RADIUS) { world.removeSource(best); bump() }
          }}
        />
        <ObservationDriver world={world} playing={playing && active} speed={speed} onSample={bump} />
      </>
    ),
    left: (
        <Panel title="Four populations" style={{ width: 286, maxHeight: '82vh', overflowY: 'auto' }}>
          <TabBar tab={tab} onChange={setTab} />

          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.45 }}>
            Four populations someone else evolved. Run them, put lights wherever
            you like, and work out which ones behave alike — <b>before</b> you
            reveal anything.
          </p>

          <div style={{ display: 'flex', gap: 6 }}>
            {LINEAGE_DATA.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => { setWhich(f.id); setSelectedId(null) }}
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

          <SelectControl
            label="Light regime"
            value={regime}
            options={[
              { value: 'food', label: 'Food' },
              { value: 'neutral', label: 'Neutral' },
              { value: 'poison', label: 'Poison' },
            ]}
            onChange={setRegime}
          />
          <Slider
            label="Sensor noise"
            value={sensorNoise}
            min={0}
            max={0.6}
            step={0.05}
            onChange={(v) => { setSensorNoise(v); world.params.sensorNoise = v; bump() }}
          />
          <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
            Nothing breeds in this tab, so the light regime only changes what a
            light is worth — it is here for Q18, where you put one population into
            the other's world.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Toggle label="Reveal wiring" checked={revealWiring} onChange={setRevealWiring} />
            <Toggle label="Reveal tree" checked={revealTree} onChange={setRevealTree} />
            <Toggle
              label="True history — all four"
              checked={trueHistory}
              onChange={(v) => { setTrueHistory(v); if (v) setRevealTree(true) }}
            />
          </div>

          {revealTree && !trueHistory && (
            <LineageTree
              lineage={fixture.lineage}
              memberIds={fixture.memberIds}
              label={`Ancestry of population ${fixture.id}`}
            />
          )}
        {trueHistory && <TrueHistory fixtures={LINEAGE_DATA} />}
      </Panel>
    ),
    right: selectedVehicle ? (
          revealWiring ? (
            <IndividualPanel
              vehicle={selectedVehicle}
              genome={fixture.genomes[selectedIndex]}
              individualId={fixture.memberIds[selectedIndex]}
              lineage={fixture.lineage}
              treeRevealed={revealTree}
              onClose={() => setSelectedId(null)}
            />
          ) : (
            <Panel title="Individual" onClose={() => setSelectedId(null)} style={{ width: 300 }}>
              <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                This vehicle's wiring is hidden. Watch what the population does
                first, group the four by behaviour, and commit to an answer — then
                press <b>Reveal wiring</b>.
              </p>
        </Panel>
      )
    ) : undefined,
    bottom: (
      <StepControls
        playing={playing}
        onPlayPause={() => setPlaying((p) => !p)}
        onStep={() => { world.step(FIXED_STEP); bump() }}
        onReset={restart}
        speed={speed}
        onSpeedChange={setSpeed}
      />
    ),
  }
}

/**
 * Module 2's scene: a breeding population of Module 1 vehicles, and the four
 * saved lineages Part 3 is about.
 *
 * Two tabs rather than two scenes, because they are the same world with the
 * same creatures and the same instruments — what differs is whether anything is
 * evolving while you watch.
 */
export default function EvolutionScene() {
  const [tab, setTab] = useState<'evolve' | 'lineages'>('evolve')
  const evolve = useEvolveTab(tab === 'evolve', tab, setTab)
  const lineages = useLineagesTab(tab === 'lineages', tab, setTab)
  const slots = tab === 'evolve' ? evolve : lineages

  // One <Canvas> for both tabs, and it has to be one. Mounting a second canvas
  // when the tab changes tears down the first WebGL context, and the browser
  // reports "Context Lost" and renders the new tab black -- observed, not
  // guessed. Each tab's world is kept alive across the switch, so coming back
  // to a run in progress finds it where it was.
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
