import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { makeRng, type Rng } from '../../../sim/random'
import type { Pose } from '../../../sim/rodent/body'
import { RangeView } from '../../m09_rat/RangeView'
import { RatMesh } from '../../m09_rat/RatMesh'
import { AnimalCamera, RANGE_SCALE, type View } from '../../m09_rat/AnimalCamera'
import { CLEARING, type Clearing, type ClearingLandmark, type Log } from '../../../sim/memory/logs/clearings'
import type { NightFeatures } from '../../../sim/memory/logs/features'
import type { NightSim } from '../../../sim/memory/logs/night'

/**
 * Part 4's view: Lab 9's range by moonlight, with a clearing's logs and
 * landmarks, the night's features (the moon, the weather, the thing on the
 * ground; the sound is `sound.ts`), the rat, and Lab 9's cameras. **A log
 * never shows whether it has beetles**: a log's mesh is a function of its
 * kind, place and angle and nothing else (`reveal.test.tsx` scans this
 * file for any read of the sim's outcome), and no minimap, mark or trail
 * is drawn. The kind of log is visible when near: loose bark is dark and
 * broken, with flakes standing off it; a smooth log is pale and even.
 */

/** The moon's light level and the fog, by moon and weather. */
function lighting(f: NightFeatures, dawn: number): { hemi: number; sun: number; fog: number; fogColor: string; sky: string } {
  const moon = f.moon === 'new moon' ? 0.35 : f.moon === 'half moon' ? 0.7 : 1.0
  const fog = f.weather === 'fog' ? 0.26 : f.weather === 'light rain' ? 0.17 : 0.13
  const fogColor = f.weather === 'fog' ? '#1a2030' : f.weather === 'light rain' ? '#0d1322' : '#0b1020'
  const k = 1 - dawn
  return { hemi: (0.3 + 0.35 * moon) * k + 1.2 * dawn, sun: (0.15 + 0.4 * moon) * k + 1.0 * dawn, fog: fog * k + 0.05 * dawn, fogColor: dawn > 0.5 ? '#6a7a9a' : fogColor, sky: dawn > 0.5 ? '#6a7a9a' : fogColor }
}

function LogMesh({ l, origin }: { l: Log; origin: { x: number; y: number } }) {
  const x = l.x
  const z = -l.y
  void origin
  const loose = l.kind === 'loose'
  const flakes = useMemo(() => {
    if (!loose) return []
    const rng = makeRng(1000 + l.id * 13 + Math.round(l.x * 10))
    return Array.from({ length: 14 }, () => ({ t: rng.range(-0.55, 0.55), a: rng.range(0, Math.PI * 2), s: rng.range(0.06, 0.13), tilt: rng.range(0.2, 0.7) }))
  }, [loose, l.id, l.x])
  return (
    <group position={[x, 0, z]} rotation={[0, -l.angle, 0]} data-log={l.id}>
      <mesh position={[0, CLEARING.logRadius - 0.03, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[CLEARING.logRadius, CLEARING.logRadius * 1.1, CLEARING.logLength, loose ? 9 : 14]} />
        <meshStandardMaterial color={loose ? '#3e2f20' : '#8a7f6a'} roughness={loose ? 1 : 0.55} flatShading={loose} />
      </mesh>
      {flakes.map((f, i) => (
        <mesh key={i} position={[f.t, CLEARING.logRadius - 0.03 + Math.sin(f.a) * CLEARING.logRadius * 0.9, Math.cos(f.a) * CLEARING.logRadius * 0.9]} rotation={[f.a, 0, f.tilt]}>
          <boxGeometry args={[f.s, 0.012, f.s * 0.7]} />
          <meshStandardMaterial color="#2a1d12" roughness={1} />
        </mesh>
      ))}
      {!loose && (
        <mesh position={[CLEARING.logLength / 2, CLEARING.logRadius - 0.03, 0]} rotation={[0, 0, Math.PI / 2]}>
          <circleGeometry args={[CLEARING.logRadius * 0.98, 14]} />
          <meshStandardMaterial color="#b9ad90" roughness={0.5} />
        </mesh>
      )}
    </group>
  )
}

function ClearingLandmarkMesh({ l }: { l: ClearingLandmark }) {
  const x = l.x
  const z = -l.y
  if (l.kind === 'tree')
    return (
      <group position={[x, 0, z]}>
        <mesh position={[0, l.size * 0.35, 0]}>
          <cylinderGeometry args={[0.28, 0.5, l.size * 0.7, 8]} />
          <meshStandardMaterial color="#2a2220" />
        </mesh>
        <mesh position={[0, l.size * 0.85, 0]}>
          <coneGeometry args={[2.6, l.size * 0.6, 8]} />
          <meshStandardMaterial color="#0f1a14" />
        </mesh>
      </group>
    )
  if (l.kind === 'stump')
    return (
      <mesh position={[x, 0.22, z]}>
        <cylinderGeometry args={[0.28, 0.34, 0.5, 9]} />
        <meshStandardMaterial color="#5c4a36" roughness={1} />
      </mesh>
    )
  if (l.kind === 'fern bank')
    return (
      <group position={[x, 0, z]}>
        {[0, 1, 2, 3, 4].map((k) => (
          <mesh key={k} position={[Math.cos(k * 1.3) * 0.7, 0.35, Math.sin(k * 1.3) * 0.7]} rotation={[0.3, k, 0]}>
            <coneGeometry args={[0.35, 0.9, 5]} />
            <meshStandardMaterial color="#1e3a22" roughness={1} side={THREE.DoubleSide} />
          </mesh>
        ))}
      </group>
    )
  return (
    <mesh position={[x, l.size * 0.18, z]} rotation={[0.15, 0.7, 0]} scale={[1.2, 0.8, 1]}>
      <dodecahedronGeometry args={[l.size * 0.5, 0]} />
      <meshStandardMaterial color="#55585e" roughness={1} />
    </mesh>
  )
}

/** The nest of a clearing other than Lab 9's: a root arched over a hole, as Lab 9 draws it, at the clearing's nest. */
function ClearingNest({ at }: { at: { x: number; y: number } }) {
  return (
    <group position={[at.x, 0, -at.y]}>
      <mesh position={[0, 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.35, 16]} />
        <meshStandardMaterial color="#060504" />
      </mesh>
      <mesh position={[0, -0.03, 0]} rotation={[0, 0.4, 0]}>
        <torusGeometry args={[0.45, 0.1, 8, 14, Math.PI]} />
        <meshStandardMaterial color="#3d2f22" roughness={1} />
      </mesh>
    </group>
  )
}

/** The thing on the ground tonight, a few meters from the nest, placed by the night's features and nothing else. */
function GroundThing({ f, nest }: { f: NightFeatures; nest: { x: number; y: number } }) {
  const x = nest.x + 2.2
  const z = -(nest.y - 1.6)
  if (f.ground === 'a fallen branch across the path')
    return (
      <mesh position={[x, 0.06, z]} rotation={[0, 0.9, 0]}>
        <cylinderGeometry args={[0.05, 0.08, 2.6, 6]} />
        <meshStandardMaterial color="#3a2d1e" roughness={1} />
      </mesh>
    )
  if (f.ground === 'a ring of mushrooms')
    return (
      <group position={[x, 0, z]}>
        {Array.from({ length: 9 }, (_, k) => (
          <group key={k} position={[Math.cos((k / 9) * Math.PI * 2) * 0.7, 0, Math.sin((k / 9) * Math.PI * 2) * 0.7]}>
            <mesh position={[0, 0.05, 0]}>
              <cylinderGeometry args={[0.02, 0.025, 0.1, 6]} />
              <meshStandardMaterial color="#d8d0b8" />
            </mesh>
            <mesh position={[0, 0.11, 0]}>
              <sphereGeometry args={[0.07, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
              <meshStandardMaterial color="#b89a6a" />
            </mesh>
          </group>
        ))}
      </group>
    )
  if (f.ground === 'scattered fresh leaves')
    return (
      <group position={[x, 0.015, z]}>
        {Array.from({ length: 40 }, (_, k) => (
          <mesh key={k} position={[Math.cos(k * 2.4) * (0.3 + (k % 7) * 0.25), 0, Math.sin(k * 2.4) * (0.3 + (k % 5) * 0.3)]} rotation={[-Math.PI / 2, 0, k]}>
            <planeGeometry args={[0.16, 0.09]} />
            <meshStandardMaterial color="#6fae4a" side={THREE.DoubleSide} />
          </mesh>
        ))}
      </group>
    )
  return null
}

/** Rain: a few hundred streaks falling near the camera, recycled; drawing only. */
function Rain({ pose, on }: { pose: () => Pose; on: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const n = 300
  const drops = useMemo(() => {
    const rng = makeRng(33)
    return Array.from({ length: n }, () => ({ x: rng.range(-6, 6), y: rng.range(0, 5), z: rng.range(-6, 6), v: rng.range(3, 5) }))
  }, [])
  const d = useMemo(() => new THREE.Object3D(), [])
  useFrame((_, delta) => {
    const m = ref.current
    if (!m || !on) return
    const p = pose()
    drops.forEach((dr, i) => {
      dr.y -= dr.v * Math.min(delta, 0.05)
      if (dr.y < 0) dr.y = 5
      d.position.set(p.x + dr.x, dr.y, -p.y + dr.z)
      d.updateMatrix()
      m.setMatrixAt(i, d.matrix)
    })
    m.instanceMatrix.needsUpdate = true
  })
  if (!on) return null
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, n]} frustumCulled={false}>
      <boxGeometry args={[0.006, 0.18, 0.006]} />
      <meshBasicMaterial color="#9fb0d8" transparent opacity={0.55} />
    </instancedMesh>
  )
}

/** The moon in the sky, as the night's feature says. */
function Moon({ f }: { f: NightFeatures }) {
  if (f.moon === 'new moon') return null
  return (
    <group position={[-40, 38, -60]}>
      <mesh>
        <sphereGeometry args={[3.2, 16, 12]} />
        <meshBasicMaterial color="#e8ecf5" />
      </mesh>
      {f.moon === 'half moon' && (
        <mesh position={[1.7, 0, 1.2]}>
          <sphereGeometry args={[3.3, 16, 12]} />
          <meshBasicMaterial color="#0b1020" />
        </mesh>
      )}
    </group>
  )
}

/** The dig: a small spray of litter at the log being dug, while the sim says a dig is on. Reads the phase and the log, never the outcome. */
function DigSpray({ at, clock }: { at: () => { x: number; y: number } | null; clock: () => number }) {
  const ref = useRef<THREE.Group>(null)
  useFrame(() => {
    const p = at()
    if (!ref.current) return
    ref.current.visible = !!p
    if (p) {
      ref.current.position.set(p.x, 0.1, -p.y)
      ref.current.rotation.y = clock() * 9
    }
  })
  return (
    <group ref={ref} visible={false}>
      {[0, 1, 2, 3].map((k) => (
        <mesh key={k} position={[Math.cos(k * 1.6) * 0.18, 0.1 + 0.08 * k, Math.sin(k * 1.6) * 0.18]}>
          <boxGeometry args={[0.05, 0.02, 0.05]} />
          <meshStandardMaterial color="#5a4a2e" />
        </mesh>
      ))}
    </group>
  )
}

export interface LogsViewProps {
  clearing: Clearing
  features: NightFeatures
  sim: () => NightSim | null
  /** 0 at night, 1 at full dawn. */
  dawn: () => number
  view: View
  fov: number
  lowDetail: boolean
  anim: Rng
  clock: () => number
}

export function LogsView({ clearing, features, sim, dawn, view, fov, lowDetail, anim, clock }: LogsViewProps) {
  const pose = (): Pose => sim()?.pose ?? { x: clearing.nest.x, y: clearing.nest.y, heading: Math.PI / 2 }
  const hemi = useRef<THREE.HemisphereLight>(null)
  const sun = useRef<THREE.DirectionalLight>(null)
  const fogRef = useRef<THREE.FogExp2>(null)
  const init = lighting(features, 0)
  useFrame(({ scene }) => {
    const l = lighting(features, dawn())
    if (hemi.current) hemi.current.intensity = l.hemi
    if (sun.current) sun.current.intensity = l.sun
    if (fogRef.current) {
      fogRef.current.density = l.fog * (lowDetail ? 1.3 : 1)
      fogRef.current.color.set(l.fogColor)
    }
    if (scene.background instanceof THREE.Color) scene.background.set(l.sky)
  })
  useEffect(() => void 0, [])
  const digging = (): { x: number; y: number } | null => {
    const s = sim()
    return s && (s.phase === 'digging' || s.phase === 'eating') && s.at ? { x: s.at.x, y: s.at.y } : null
  }
  const beetle = (): { x: number; y: number } | null => {
    const s = sim()
    return s && s.phase === 'eating' && s.at ? { x: s.at.x + 0.2, y: s.at.y } : null
  }
  return (
    <>
      <color attach="background" args={[init.sky]} />
      <fogExp2 ref={fogRef} attach="fog" args={[init.fogColor, init.fog]} />
      <hemisphereLight ref={hemi} args={['#2c3a6a', '#0a0806', init.hemi]} />
      <directionalLight ref={sun} position={[20, 40, -10]} intensity={init.sun} color="#b9c6ff" />
      <RangeView light="moonlight" lowDetail={lowDetail} pose={pose} showNest={clearing.id === 'practice'} liveBeetle={beetle} clock={clock} />
      {clearing.id !== 'practice' && <ClearingNest at={clearing.nest} />}
      {clearing.logs.map((l) => (
        <LogMesh key={l.id} l={l} origin={clearing.nest} />
      ))}
      {clearing.landmarks.map((l) => (
        <ClearingLandmarkMesh key={l.id} l={l} />
      ))}
      <GroundThing f={features} nest={clearing.nest} />
      <Moon f={features} />
      <Rain pose={pose} on={features.weather === 'light rain'} />
      <DigSpray at={digging} clock={clock} />
      <RatMesh pose={pose} anim={anim} moving={() => { const s = sim(); return !!s && (s.body.lastStep !== 0 || s.body.lastTurn !== 0) && s.phase !== 'digging' && s.phase !== 'nursing' }} visible={view === 'follow'} />
      <AnimalCamera pose={pose} view={view} fov={fov} scale={RANGE_SCALE} />
    </>
  )
}
