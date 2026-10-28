import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { makeRng, type Rng } from '../../../sim/random'
import type { Pose } from '../../../sim/rodent/body'
import { RangeView } from '../../m09_rat/RangeView'
import { RatMesh, type RatAction } from '../../m09_rat/RatMesh'
import { AnimalCamera, RANGE_SCALE, type View } from '../../m09_rat/AnimalCamera'
import { BRANCH, CLEARING, GROUND_THING_OFFSET, NEST_ARCH, type Clearing, type ClearingLandmark, type Log } from '../../../sim/memory/logs/clearings'
import { MOONS, type NightFeatures } from '../../../sim/memory/logs/features'
import type { NightSim } from '../../../sim/memory/logs/night'

/**
 * Part 4's view: Lab 9's range by moonlight, with a clearing's logs and
 * landmarks, the night's features (the moon, the weather, the thing on the
 * ground; the sound is `sound.ts`), the rat, and Lab 9's cameras. **A log
 * never shows whether it has beetles**: a log's mesh is a function of its
 * kind, place, angle and look and nothing else (`logs.test.tsx` scans this
 * file for any read of the sim's outcome), and no minimap, mark or trail
 * is drawn. The kind of log is visible when near: loose bark is dark and
 * broken, with flakes standing off it; a smooth log is pale and even. Each
 * log also has its own look (spec §8.2): its length, thickness, branch
 * stubs, moss and shade, fixed for the week, nameable by nothing.
 */

/**
 * The fog's density (exp² fog, per meter) by weather, and the light. Jon,
 * 2026-10-28, after his first week: *students need to be able to see all
 * the objects in the deep distance; the goal should be remembering which
 * ones they've been to before, not remembering where they are in the first
 * place.* So every log in the clearing (11 m out at most) is in view from
 * the nest on every night: through the thickest fog a log 11 m off keeps
 * about half its own color, and on a clear night most of it; the weather
 * and the moon still differ to the eye (the fog's glow and color, the
 * moon in the sky, the light level), but never hide a log. Until then the
 * densities were 0.26, 0.17 and 0.13 (0.18, 0.14, 0.11 for a day), and the
 * range's own moonlight fog of 0.13 was in force under them (RangeView
 * attached its fog after this view's), so the eased values never showed.
 */
export const FOG_DENSITY = { fog: 0.08, 'light rain': 0.06, clear: 0.04 } as const
/** The practice night's fog: lighter than any scored night's. */
export const PRACTICE_FOG_DENSITY = 0.03
/** The moon's share of the light, in MOONS' order (new, half, and the brightest moon). A new moon is dark to the eye beside a full moon, but every log is still plain. */
export const MOON_LIGHT = [0.85, 1.0, 1.15] as const
/** The practice night's share of the light, above the brightest moon's (Jon, 2026-10-28). */
export const PRACTICE_MOON_LIGHT = 1.3

/** The light and the fog, by moon and weather; the practice night brighter and clearer than any scored night. The view supplies the whole atmosphere (RangeView's own lights and fog are off here). */
function lighting(f: NightFeatures, dawn: number, practice = false): { hemi: number; sun: number; fog: number; fogColor: string; sky: string } {
  const moon = practice ? PRACTICE_MOON_LIGHT : MOON_LIGHT[MOONS.indexOf(f.moon)]
  const fog = practice ? PRACTICE_FOG_DENSITY : FOG_DENSITY[f.weather]
  const fogColor = f.weather === 'fog' ? '#232a3a' : f.weather === 'light rain' ? '#111827' : '#0b1020'
  const k = 1 - dawn
  return { hemi: (0.75 + 0.6 * moon) * k + 1.8 * dawn, sun: (0.55 + 0.5 * moon) * k + 1.5 * dawn, fog: fog * k + 0.03 * dawn, fogColor: dawn > 0.5 ? '#6a7a9a' : fogColor, sky: dawn > 0.5 ? '#6a7a9a' : fogColor }
}

/** The clearing's edge: a ring of low undergrowth just beyond where the forager can go (`CLEARING.bound`), so the bound is seen and never felt as an unseen wall (Jon, 2026-10-28). Drawing only; the sim's bound is the clamp. */
function ClearingEdge({ nest, lowDetail }: { nest: { x: number; y: number }; lowDetail: boolean }) {
  const n = lowDetail ? 40 : 64
  const r = CLEARING.bound + 0.8
  return (
    <group position={[nest.x, 0, -nest.y]}>
      {Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2
        const h = 0.9 + 0.5 * Math.abs(Math.sin(i * 2.3))
        return (
          <mesh key={i} position={[Math.cos(a) * r, h / 2, Math.sin(a) * r]} rotation={[0, i * 0.7, 0]}>
            <coneGeometry args={[1.1, h, 5]} />
            <meshStandardMaterial color="#13201a" roughness={1} />
          </mesh>
        )
      })}
    </group>
  )
}

function LogMesh({ l }: { l: Log }) {
  const x = l.x
  const z = -l.y
  const loose = l.kind === 'loose'
  const k = l.look
  const r = k.radius
  const cy = r - 0.03
  const flakes = useMemo(() => {
    if (!loose) return []
    const rng = makeRng(1000 + l.id * 13 + Math.round(l.x * 10))
    return Array.from({ length: Math.round(10 * k.length) }, () => ({ t: rng.range(-0.45, 0.45) * k.length, a: rng.range(0, Math.PI * 2), s: rng.range(0.06, 0.13), tilt: rng.range(0.2, 0.7) }))
  }, [loose, l.id, l.x, k.length])
  // One color a kind (Jon, 2026-10-28: a shade within the kind made the kinds hard to tell apart): dark for loose bark, pale for smooth.
  const bark = loose ? '#3e2f20' : '#8a7f6a'
  // The world's (x, y) is three's (x, −z), so a log lying at `angle` in the world is turned by +angle about three's y: the same line `logFootprint` uses.
  // (Until 2026-10-27 the sign was wrong and the drawn log was the footprint's mirror image, so the body was stopped by a log that was not there and could not reach the one it saw.)
  return (
    <group position={[x, 0, z]} rotation={[0, l.angle, 0]} data-log={l.id}>
      <mesh position={[0, cy, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[r, r * 1.1, k.length, loose ? 9 : 14]} />
        <meshStandardMaterial color={bark} roughness={loose ? 1 : 0.55} flatShading={loose} />
      </mesh>
      {flakes.map((f, i) => (
        <mesh key={i} position={[f.t, cy + Math.sin(f.a) * r * 0.9, Math.cos(f.a) * r * 0.9]} rotation={[f.a, 0, f.tilt]}>
          <boxGeometry args={[f.s, 0.012, f.s * 0.7]} />
          <meshStandardMaterial color="#2a1d12" roughness={1} />
        </mesh>
      ))}
      {k.stubs.map((st, i) => (
        // A branch stub: out of the log's side, tilted from upright by its `around`, never below the ground.
        <group key={`s${i}`} position={[st.along * k.length, cy, 0]} rotation={[st.around - Math.PI / 2, 0, 0]}>
          <mesh position={[0, r * 0.6 + st.length / 2, 0]}>
            <cylinderGeometry args={[r * 0.22, r * 0.34, st.length, 6]} />
            <meshStandardMaterial color={bark} roughness={1} />
          </mesh>
        </group>
      ))}
      {k.moss > 0 && (
        <mesh position={[0, cy + r * 0.92, 0]}>
          <boxGeometry args={[k.length * 0.85 * k.moss, 0.03, r * 1.3]} />
          <meshStandardMaterial color="#3f7a3a" roughness={1} />
        </mesh>
      )}
      {!loose && (
        <mesh position={[k.length / 2, cy, 0]} rotation={[0, 0, Math.PI / 2]}>
          <circleGeometry args={[r * 0.98, 14]} />
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

/** The nest of a clearing other than Lab 9's: a root arched over a hole, as Lab 9 draws it, at the clearing's nest; the root's footprint is `nestFootprint`. */
function ClearingNest({ at }: { at: { x: number; y: number } }) {
  return (
    <group position={[at.x, 0, -at.y]}>
      <mesh position={[0, 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.35, 16]} />
        <meshStandardMaterial color="#060504" />
      </mesh>
      <mesh position={[0, -0.03, 0]} rotation={[0, NEST_ARCH.turn, 0]}>
        <torusGeometry args={[NEST_ARCH.radius, NEST_ARCH.thickness, 8, 14, Math.PI]} />
        <meshStandardMaterial color="#3d2f22" roughness={1} />
      </mesh>
    </group>
  )
}

/** The young in the nest: three pups huddled in the hole, breathing; they squirm while they are nursed. Reads the phase and nothing else. */
function NestYoung({ at, nursing, clock }: { at: { x: number; y: number }; nursing: () => boolean; clock: () => number }) {
  const pups = useRef<(THREE.Group | null)[]>([null, null, null])
  const places = useMemo(() => [0, 1, 2].map((k) => ({ x: Math.cos(k * 2.1 + 0.5) * 0.09, z: Math.sin(k * 2.1 + 0.5) * 0.09, a: k * 2.1 + 1.2 })), [])
  useFrame(() => {
    const t = clock()
    const busy = nursing()
    pups.current.forEach((g, k) => {
      if (!g) return
      const breath = 1 + 0.06 * Math.sin(t * (busy ? 6 : 1.6) + k * 2)
      g.scale.set(1, breath, 1)
      g.rotation.y = places[k].a + (busy ? 0.25 * Math.sin(t * 4 + k) : 0.04 * Math.sin(t * 0.8 + k))
    })
  })
  return (
    <group position={[at.x, 0, -at.y]} data-nest-young>
      {places.map((p, k) => (
        <group key={k} ref={(g) => void (pups.current[k] = g)} position={[p.x, 0.012, p.z]} rotation={[0, p.a, 0]}>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <capsuleGeometry args={[0.016, 0.035, 3, 8]} />
            <meshStandardMaterial color="#d9b3a6" roughness={0.9} />
          </mesh>
          <mesh position={[0.03, 0.004, 0]} rotation={[0, 0, -Math.PI / 2]}>
            <coneGeometry args={[0.012, 0.028, 8]} />
            <meshStandardMaterial color="#d9b3a6" roughness={0.9} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/** The thing on the ground tonight, a few meters from the nest, placed by the night's features and nothing else; the branch lies along `branchFootprint`. */
function GroundThing({ f, nest }: { f: NightFeatures; nest: { x: number; y: number } }) {
  const x = nest.x + GROUND_THING_OFFSET.x
  const z = -(nest.y + GROUND_THING_OFFSET.y)
  if (f.ground === 'a fallen branch across the path')
    return (
      <mesh position={[x, BRANCH.radius * 0.8, z]} rotation={[0, BRANCH.turn, Math.PI / 2]}>
        <cylinderGeometry args={[BRANCH.radius * 0.7, BRANCH.radius, BRANCH.length, 6]} />
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

/** The dig: a spray of litter thrown up from where the forager stands, while the sim says a dig is on. Reads the phase and the pose, never the outcome. */
function DigSpray({ at, clock }: { at: () => { x: number; y: number } | null; clock: () => number }) {
  const ref = useRef<THREE.Group>(null)
  const bits = useRef<(THREE.Mesh | null)[]>([])
  useFrame(() => {
    const p = at()
    if (!ref.current) return
    ref.current.visible = !!p
    if (!p) return
    ref.current.position.set(p.x, 0, -p.y)
    const t = clock()
    // Each bit flies up and out on its own short arc, over and over, out of step with the others.
    bits.current.forEach((m, k) => {
      if (!m) return
      const u = (t * 2.2 + k * 0.37) % 1
      const a = k * 1.9
      const r = 0.05 + 0.3 * u
      m.position.set(Math.cos(a) * r, 0.03 + 0.7 * u * (1 - u), Math.sin(a) * r)
      m.rotation.set(t * 5 + k, t * 3, 0)
    })
  })
  return (
    <group ref={ref} visible={false}>
      {Array.from({ length: 8 }, (_, k) => (
        <mesh key={k} ref={(m) => void (bits.current[k] = m)}>
          <boxGeometry args={[0.04, 0.015, 0.04]} />
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
  /** The practice night, or the screens before the week: the clearing in its brightest, clearest light. */
  practice: boolean
}

export function LogsView({ clearing, features, sim, dawn, view, fov, lowDetail, anim, clock, practice }: LogsViewProps) {
  const pose = (): Pose => sim()?.pose ?? { x: clearing.nest.x, y: clearing.nest.y, heading: Math.PI / 2 }
  const hemi = useRef<THREE.HemisphereLight>(null)
  const sun = useRef<THREE.DirectionalLight>(null)
  const fogRef = useRef<THREE.FogExp2>(null)
  const init = lighting(features, 0, practice)
  useFrame(({ scene }) => {
    const l = lighting(features, dawn(), practice)
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
    if (!s || s.phase !== 'digging') return null
    // The spray rises at the forager's forefeet.
    const p = s.pose
    return { x: p.x + 0.12 * Math.cos(p.heading), y: p.y + 0.12 * Math.sin(p.heading) }
  }
  const action = (): RatAction | null => {
    const s = sim()
    return s?.phase === 'digging' ? 'dig' : s?.phase === 'eating' ? 'eat' : s?.phase === 'nursing' ? 'nurse' : null
  }
  // The beetles being eaten are drawn just in front of the snout (Jon, 2026-10-27: drawn at the log they were often inside it).
  const beetle = (): { x: number; y: number } | null => {
    const s = sim()
    if (!s || s.phase !== 'eating') return null
    const p = s.pose
    return { x: p.x + 0.22 * Math.cos(p.heading), y: p.y + 0.22 * Math.sin(p.heading) }
  }
  return (
    <>
      <color attach="background" args={[init.sky]} />
      <fogExp2 ref={fogRef} attach="fog" args={[init.fogColor, init.fog]} />
      <hemisphereLight ref={hemi} args={['#2c3a6a', '#0a0806', init.hemi]} />
      <directionalLight ref={sun} position={[20, 40, -10]} intensity={init.sun} color="#b9c6ff" />
      {/* The range bare: its ground and clutter, none of Lab 9's landmarks or its stream bank (a log of Lab 9's was seen from the clearing and could not be reached, Jon, 2026-10-28), and none of its lights or fog. */}
      <RangeView light="moonlight" lowDetail={lowDetail} pose={pose} showNest={false} bare atmosphere={false} liveBeetle={beetle} clock={clock} />
      <ClearingEdge nest={clearing.nest} lowDetail={lowDetail} />
      <ClearingNest at={clearing.nest} />
      <NestYoung at={clearing.nest} nursing={() => sim()?.phase === 'nursing'} clock={clock} />
      {clearing.logs.map((l) => (
        <LogMesh key={l.id} l={l} />
      ))}
      {clearing.landmarks.map((l) => (
        <ClearingLandmarkMesh key={l.id} l={l} />
      ))}
      <GroundThing f={features} nest={clearing.nest} />
      <Moon f={features} />
      <Rain pose={pose} on={features.weather === 'light rain'} />
      <DigSpray at={digging} clock={clock} />
      <RatMesh pose={pose} anim={anim} moving={() => { const s = sim(); return !!s && (s.body.lastStep !== 0 || s.body.lastTurn !== 0) && s.phase !== 'digging' && s.phase !== 'nursing' }} action={action} visible={view === 'follow'} />
      <AnimalCamera pose={pose} view={view} fov={fov} scale={RANGE_SCALE} />
    </>
  )
}
