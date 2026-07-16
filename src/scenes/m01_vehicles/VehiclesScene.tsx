import { useReducer, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Grid } from '@react-three/drei'
import { SceneCanvasLayout } from '../../components/SceneCanvasLayout'
import { Panel } from '../../components/Panel'
import { Button } from '../../components/controls'
import { StepControls } from '../../components/StepControls'
import { CameraRig } from '../../components/CameraRig'
import { VehicleMesh } from './VehicleMesh'
import { SourceMesh } from './SourceMesh'
import { VehicleInspector } from './VehicleInspector'
import { Terrain } from './Terrain'
import { VehicleWorld, DEFAULT_WORLD_PARAMS } from '../../sim/world/world'
import { VEHICLE_PRESETS } from '../../sim/creature/vehiclePresets'
import { palette } from '../../theme/theme'

// One vehicle per phenotype, so every behavior is on screen at once and
// distinguishable by color. Poses roughly spread across the arena; there is one
// per entry in VEHICLE_PRESETS.
const START_POSES = [
  { x: -6, z: -2 },
  { x: 6, z: 2 },
  { x: -3, z: 5 },
  { x: 3, z: -5 },
  { x: -6, z: 4 },
  { x: 6, z: -4 },
]
const FIXED_STEP = 1 / 30
const REMOVE_RADIUS = 2.2

function buildWorld(): VehicleWorld {
  const world = new VehicleWorld({ ...DEFAULT_WORLD_PARAMS })
  VEHICLE_PRESETS.forEach((preset, i) => {
    const p = START_POSES[i % START_POSES.length]
    world.addVehicle(preset.id, preset.color, {
      x: p.x,
      z: p.z,
      heading: (i / VEHICLE_PRESETS.length) * Math.PI * 2,
    })
  })
  world.addSource(5, -4, 1)
  world.addSource(-5, 4, 1)
  return world
}

const NOOP = () => {}

/**
 * In-canvas driver: advances the sim each frame while playing, and pumps a
 * throttled re-render (~12 Hz) so the inspector's live values/plot update. The
 * pump only fires while playing, so a paused inspector is frozen; single-step
 * and reset re-render via their own state updates.
 */
function Simulation({
  world,
  playing,
  speed,
  onSample = NOOP,
}: {
  world: VehicleWorld
  playing: boolean
  speed: number
  onSample?: () => void
}) {
  const acc = useRef(0)
  useFrame((_, delta) => {
    if (!playing) return
    world.step(Math.min(delta, 0.05) * speed)
    acc.current += delta
    if (acc.current >= 0.08) {
      acc.current = 0
      onSample()
    }
  })
  return null
}

export default function VehiclesScene() {
  const worldRef = useRef<VehicleWorld | null>(null)
  if (!worldRef.current) worldRef.current = buildWorld()
  const world = worldRef.current

  const [playing, setPlaying] = useState(true)
  const [speed, setSpeed] = useState(1)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  // `bump()` forces a re-render after we mutate the (externally-owned) world —
  // adding/removing lights, resetting. The render then reads world.* live.
  const [, bump] = useReducer((x: number) => x + 1, 0)

  const sources = world.sources
  const vehicles = world.vehicles
  const selectedVehicle = vehicles.find((v) => v.id === selectedId) ?? null

  const tuneSelected = (patch: { strength?: number; bias?: number }) => {
    if (selectedId === null) return
    world.setVehicleTuning(selectedId, patch)
    bump()
  }
  const addSource = (x: number, z: number) => {
    // Ignore clicks on the valley walls: a light out there would be buried in
    // the hillside, and no vehicle can reach it anyway.
    if (Math.max(Math.abs(x), Math.abs(z)) > world.params.bounds) return
    world.addSource(x, z, 1)
    bump()
  }
  const removeNearest = (x: number, z: number) => {
    let best: number | null = null
    let bestD = Infinity
    for (const s of world.sources) {
      const d = Math.hypot(s.x - x, s.z - z)
      if (d < bestD) {
        bestD = d
        best = s.id
      }
    }
    if (best !== null && bestD <= REMOVE_RADIUS) {
      world.removeSource(best)
      bump()
    }
  }
  const clearLights = () => {
    world.sources = []
    bump()
  }
  const reset = () => {
    worldRef.current = buildWorld()
    setSelectedId(null)
    setPlaying(true)
    bump()
  }
  const stepOnce = () => {
    world.step(FIXED_STEP)
    bump()
  }

  const controls = (
    <Panel title="Braitenberg vehicles">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {VEHICLE_PRESETS.map((p) => (
          <div
            key={p.id}
            style={{ display: 'flex', alignItems: 'center', gap: 9 }}
          >
            <span
              style={{
                width: 14,
                height: 14,
                borderRadius: 4,
                background: p.color,
                flex: 'none',
              }}
            />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>
              {p.label}
            </span>
          </div>
        ))}
      </div>
      <Button onClick={clearLights}>Clear lights</Button>
      <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.45 }}>
        Left-click the ground to add a light · right-click to remove the nearest
        one · click a vehicle to inspect its wiring and tune it.
      </p>
    </Panel>
  )

  return (
    <SceneCanvasLayout
      canvas={
        <Canvas
          camera={{ position: [0, 14, 16], fov: 45 }}
          onContextMenu={(e) => e.preventDefault()}
        >
          <color attach="background" args={[palette.bg]} />
          <ambientLight intensity={0.55} />
          <directionalLight position={[6, 12, 6]} intensity={0.7} />
          <Simulation
            world={world}
            playing={playing}
            speed={speed}
            // Only pump re-renders while an inspector is open and reading values.
            onSample={selectedId !== null ? bump : NOOP}
          />
          <Terrain
            bounds={world.params.bounds}
            onAdd={addSource}
            onRemoveNearest={removeNearest}
          />
          {/* Grid is sized to the arena exactly, so where it stops is where
              the vehicles bounce — a second, unambiguous read on the boundary. */}
          <Grid
            args={[world.params.bounds * 2, world.params.bounds * 2]}
            cellSize={1}
            cellThickness={0.5}
            cellColor="#1b2740"
            sectionSize={5}
            sectionThickness={1}
            sectionColor="#2a3d63"
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
              onSelect={setSelectedId}
            />
          ))}
          <CameraRig target={[0, 0, 0]} />
        </Canvas>
      }
      left={controls}
      right={
        selectedVehicle ? (
          <VehicleInspector
            vehicle={selectedVehicle}
            onClose={() => setSelectedId(null)}
            onTune={tuneSelected}
          />
        ) : undefined
      }
      bottom={
        <StepControls
          playing={playing}
          onPlayPause={() => setPlaying((p) => !p)}
          onStep={stepOnce}
          onReset={reset}
          speed={speed}
          onSpeedChange={setSpeed}
        />
      }
    />
  )
}
