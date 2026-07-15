import { useReducer, useRef, useState } from 'react'
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber'
import { Grid } from '@react-three/drei'
import { SceneCanvasLayout } from '../../components/SceneCanvasLayout'
import { Panel } from '../../components/Panel'
import { Slider, SelectControl, Button } from '../../components/controls'
import { StepControls } from '../../components/StepControls'
import { CameraRig } from '../../components/CameraRig'
import { VehicleMesh } from './VehicleMesh'
import { SourceMesh } from './SourceMesh'
import { VehicleInspector } from './VehicleInspector'
import { VehicleWorld, DEFAULT_WORLD_PARAMS } from '../../sim/world/world'
import {
  VEHICLE_PRESETS,
  DEFAULT_PRESET_ID,
} from '../../sim/creature/vehiclePresets'
import { palette } from '../../theme/theme'

const VEHICLE_COLORS = ['#4f9cff', '#c084fc', '#2dd4bf']
const START_POSES = [
  { x: -4, z: -2 },
  { x: 0, z: 3 },
  { x: 4, z: -1 },
]
const FIXED_STEP = 1 / 30

function buildWorld(presetId: string, gain: number, base: number): VehicleWorld {
  const world = new VehicleWorld({ ...DEFAULT_WORLD_PARAMS, gain, base })
  START_POSES.forEach((p, i) => {
    world.addVehicle(presetId, VEHICLE_COLORS[i % VEHICLE_COLORS.length], {
      x: p.x,
      z: p.z,
      heading: (i / START_POSES.length) * Math.PI * 2,
    })
  })
  world.addSource(5, -4, 1)
  world.addSource(-5, 4, 1)
  return world
}

/** In-canvas driver: advances the sim each frame while playing. */
function Simulation({
  world,
  playing,
  speed,
}: {
  world: VehicleWorld
  playing: boolean
  speed: number
}) {
  useFrame((_, delta) => {
    if (!playing) return
    world.step(Math.min(delta, 0.05) * speed)
  })
  return null
}

/** Ground plane that adds a light where you click (ignoring camera drags). */
function Floor({ onAdd }: { onAdd: (x: number, z: number) => void }) {
  const down = useRef<{ x: number; y: number } | null>(null)
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      onPointerDown={(e: ThreeEvent<PointerEvent>) => {
        down.current = { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY }
      }}
      onPointerUp={(e: ThreeEvent<PointerEvent>) => {
        const d = down.current
        down.current = null
        if (!d) return
        const moved = Math.hypot(
          e.nativeEvent.clientX - d.x,
          e.nativeEvent.clientY - d.y,
        )
        if (moved < 5) onAdd(e.point.x, e.point.z)
      }}
    >
      <planeGeometry args={[80, 80]} />
      <meshStandardMaterial color="#0b111c" roughness={1} />
    </mesh>
  )
}

export default function VehiclesScene() {
  const worldRef = useRef<VehicleWorld | null>(null)
  const [presetId, setPresetId] = useState(DEFAULT_PRESET_ID)
  const [gain, setGain] = useState(DEFAULT_WORLD_PARAMS.gain)
  const [base, setBase] = useState(DEFAULT_WORLD_PARAMS.base)
  if (!worldRef.current) worldRef.current = buildWorld(presetId, gain, base)
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

  const changePreset = (id: string) => {
    setPresetId(id)
    world.vehicles.forEach((v) => world.setVehiclePreset(v.id, id))
  }
  const changeGain = (g: number) => {
    setGain(g)
    world.params.gain = g
    world.reweight()
  }
  const changeBase = (b: number) => {
    setBase(b)
    world.params.base = b
    world.reweight()
  }
  const addSource = (x: number, z: number) => {
    world.addSource(x, z, 1)
    bump()
  }
  const removeSource = (id: number) => {
    world.removeSource(id)
    bump()
  }
  const clearLights = () => {
    world.sources = []
    bump()
  }
  const reset = () => {
    worldRef.current = buildWorld(presetId, gain, base)
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
      <SelectControl
        label="Wiring (all vehicles)"
        value={presetId}
        onChange={changePreset}
        options={VEHICLE_PRESETS.map((p) => ({
          value: p.id,
          label: `${p.name} (${p.label})`,
        }))}
      />
      <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.45 }}>
        {VEHICLE_PRESETS.find((p) => p.id === presetId)?.description}
      </p>
      <Slider
        label="Sensor gain"
        value={gain}
        min={0}
        max={5}
        step={0.1}
        onChange={changeGain}
      />
      <Slider
        label="Base drive"
        value={base}
        min={-1}
        max={2}
        step={0.1}
        onChange={changeBase}
      />
      <Button onClick={clearLights}>Clear lights</Button>
      <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>
        Click the ground to add a light · click a vehicle to inspect its wiring ·
        click a light to remove it.
      </p>
    </Panel>
  )

  return (
    <SceneCanvasLayout
      canvas={
        <Canvas camera={{ position: [0, 14, 16], fov: 45 }}>
          <color attach="background" args={[palette.bg]} />
          <ambientLight intensity={0.55} />
          <directionalLight position={[6, 12, 6]} intensity={0.7} />
          <Simulation world={world} playing={playing} speed={speed} />
          <Floor onAdd={addSource} />
          <Grid
            args={[80, 80]}
            cellSize={1}
            cellThickness={0.5}
            cellColor="#1b2740"
            sectionSize={5}
            sectionThickness={1}
            sectionColor="#2a3d63"
            fadeDistance={45}
            fadeStrength={1}
            position={[0, 0.001, 0]}
          />
          {sources.map((s) => (
            <SourceMesh key={s.id} source={s} onRemove={removeSource} />
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
