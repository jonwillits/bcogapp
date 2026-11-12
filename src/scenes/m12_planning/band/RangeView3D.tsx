import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { PLACE_XZ, PLACES, type Item, type Place } from '../../../sim/planning/range/places'
import type { Cue, Need } from '../../../sim/planning/range/needs'
import { NEED_TABLE } from '../../../sim/planning/range/needs'
import type { GroundItem, Obstacle } from '../../../sim/planning/studentDay'
import { placeName } from './screens'

/**
 * The range in 3D (spec §7.1, §7.2): grassland with scattered trees, a
 * stream, a low ridge, the places with what they hold, the morning's cue,
 * the need at midday, and the hominins as stylized figures built from
 * simple shapes: an upright body with long legs, a plain head with no
 * facial detail, hands that visibly carry up to two items, one neutral body
 * color for every hominin, and a colored ring at the feet with a label.
 * The figures are read through a function once a frame and placed in the
 * frame loop, not through React's render, so a walking body moves every
 * frame and not every panel update (Jon's walk, 2026-11-11: the self view
 * jumped a step at a time). Drawing only; nothing here reaches the sim. The world's (x, z) maps to
 * three.js (x, −z) as Lab 9's `toThree` does, so the range's north is away
 * from a camera that looks along −z.
 */

export interface Figure {
  id: string
  label: string
  ring: string
  x: number
  z: number
  heading: number
  moving: boolean
  /** What each hand holds, left then right; null for an empty hand. */
  hands: readonly (Item | null)[]
  /** A word on what it is doing, shown under the label when set. */
  doing?: string
}

export interface RangeViewProps {
  obstacles: Obstacle[]
  cue: Cue
  need: Need
  needPresent: boolean
  elderAway: boolean
  /** The figures now; read once a frame in the frame loop, and once a render for what React draws (hands, labels). */
  figures: () => Figure[]
  /** Items lying in the range. */
  ground?: GroundItem[]
  /** Seconds, for the animation. */
  clock: () => number
  lowDetail: boolean
  /** The figure the camera follows, hidden in the eye view. */
  hideId?: string | null
  labels: boolean
}

const BODY = '#a88a6a'
const GROUND = '#5f7a3a'
const DRY = '#b8a070'

/** The figures as sampled once per frame: every hominin reads the same list. */
type Sample = (key: number) => Figure[]

export function RangeView3D({ obstacles, cue, need, needPresent, elderAway, figures, ground, clock, lowDetail, hideId, labels }: RangeViewProps) {
  const figuresRef = useRef(figures)
  figuresRef.current = figures
  const latest = useRef<{ key: number; list: Figure[] }>({ key: -1, list: [] })
  const sample: Sample = (key) => {
    if (latest.current.key !== key) latest.current = { key, list: figuresRef.current() }
    return latest.current.list
  }
  const figs = figures()
  // Labels of figures standing within a few meters of one another are stacked, each a line above the last, so the band at camp reads as a list from above instead of a heap (Jon, 2026-11-11).
  const lift = new Map<string, number>()
  for (const f of [...figs].sort((a, b) => a.id.localeCompare(b.id))) {
    let n = 0
    for (const [id, l] of lift) {
      const g = figs.find((x) => x.id === id)!
      if (Math.hypot(f.x - g.x, f.z - g.z) < LABEL_STACK_METERS) n = Math.max(n, l + 1)
    }
    lift.set(f.id, n)
  }
  const sky = cue === 'rain' ? '#6f7f93' : cue === 'dry' ? '#c9c0a6' : '#9fc4ea'
  const fogColor = cue === 'rain' ? '#7a8798' : cue === 'dry' ? '#cfc7ae' : '#b7d3ee'
  return (
    <>
      <color attach="background" args={[sky]} />
      <fogExp2 attach="fog" args={[fogColor, lowDetail ? 0.006 : 0.0045]} />
      <hemisphereLight args={[sky, '#4a5a2a', cue === 'rain' ? 0.9 : 1.3]} />
      <directionalLight position={[60, 90, 40]} intensity={cue === 'rain' ? 0.6 : 1.1} color="#fff2d8" />
      <Ground />
      <Stream />
      <Ridge />
      {obstacles.map((o, i) => (o.kind === 'stone' ? null : o.kind === 'tree' || o.kind === 'bigTree' ? <Tree key={i} o={o} lowDetail={lowDetail} /> : o.kind === 'rock' ? <Rock key={i} o={o} /> : <Mound key={i} o={o} />))}
      <PlaceMarkers labels={labels} />
      <Cues cue={cue} clock={clock} elderAway={elderAway} />
      {needPresent && <NeedObject need={need} />}
      {ground?.map((g) => <GroundMesh key={g.id} g={g} />)}
      {figs.map((f) => (hideId === f.id ? null : <Hominin key={f.id} f={f} sample={sample} clock={clock} labels={labels} lift={lift.get(f.id) ?? 0} />))}
    </>
  )
}

function Ground() {
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <circleGeometry args={[320, 48]} />
        <meshStandardMaterial color={GROUND} />
      </mesh>
      {/* The grassland, a little paler, and the tuber flats, dry and cracked. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[PLACE_XZ.grassland.x, 0, -PLACE_XZ.grassland.z]}>
        <circleGeometry args={[22, 32]} />
        <meshStandardMaterial color="#8da55a" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[PLACE_XZ.flats.x, 0.005, -PLACE_XZ.flats.z]}>
        <circleGeometry args={[14, 32]} />
        <meshStandardMaterial color={DRY} />
      </mesh>
      {Array.from({ length: 8 }, (_, i) => (
        <mesh key={i} position={[PLACE_XZ.flats.x + Math.cos(i * 0.8) * (3 + i), 0.15, -(PLACE_XZ.flats.z + Math.sin(i * 0.8) * (3 + i))]} rotation={[0, i, 0.4]}>
          <cylinderGeometry args={[0.04, 0.04, 1.2, 4]} />
          <meshStandardMaterial color="#7a6a3a" />
        </mesh>
      ))}
    </>
  )
}

function Stream() {
  const x = PLACE_XZ.riverbank.x + 2
  return (
    <>
      <mesh position={[x, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[4, 320]} />
        <meshStandardMaterial color="#4d86b5" />
      </mesh>
      <mesh position={[x - 3, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.5, 320]} />
        <meshStandardMaterial color="#8f8a78" />
      </mesh>
    </>
  )
}

function Ridge() {
  return (
    <mesh position={[90, -4, 80]} scale={[70, 10, 22]}>
      <sphereGeometry args={[1, 16, 10]} />
      <meshStandardMaterial color="#6c7a4d" />
    </mesh>
  )
}

function Tree({ o, lowDetail }: { o: Obstacle; lowDetail: boolean }) {
  const h = o.kind === 'bigTree' ? 14 : 5 + o.r * 3
  const crown = o.kind === 'bigTree' ? 7 : 2.2 + o.r * 1.5
  return (
    <group position={[o.x, 0, -o.z]}>
      <mesh position={[0, h / 2, 0]}>
        <cylinderGeometry args={[o.r * 0.5, o.r * 0.7, h, lowDetail ? 5 : 7]} />
        <meshStandardMaterial color="#6b4e2e" />
      </mesh>
      <mesh position={[0, h, 0]}>
        <sphereGeometry args={[crown, lowDetail ? 6 : 10, lowDetail ? 5 : 8]} />
        <meshStandardMaterial color={o.kind === 'bigTree' ? '#3f6b2a' : '#4e7d35'} />
      </mesh>
    </group>
  )
}

function Rock({ o }: { o: Obstacle }) {
  return (
    <mesh position={[o.x, o.r * 0.5, -o.z]} rotation={[0.2, 0.5, 0.1]}>
      <boxGeometry args={[o.r * 2, o.r, o.r * 1.6]} />
      <meshStandardMaterial color="#8a8a86" />
    </mesh>
  )
}

function Mound({ o }: { o: Obstacle }) {
  return (
    <mesh position={[o.x, 0.9, -o.z]}>
      <coneGeometry args={[o.r, 1.8, 8]} />
      <meshStandardMaterial color="#8b6b3e" />
    </mesh>
  )
}

/** What each place holds, drawn simply, with a label. */
function PlaceMarkers({ labels }: { labels: boolean }) {
  return (
    <>
      {PLACES.map((p) => {
        const q = PLACE_XZ[p]
        return (
          <group key={p} position={[q.x, 0, -q.z]}>
            <PlaceStuff place={p} />
            {labels && (
              <Html position={[0, 3.2, 0]} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
                <div style={{ fontSize: 11, color: '#fff', background: 'rgba(0,0,0,0.45)', padding: '1px 6px', borderRadius: 6, whiteSpace: 'nowrap' }}>{placeName(p)}</div>
              </Html>
            )}
          </group>
        )
      })}
    </>
  )
}

function PlaceStuff({ place }: { place: Place }) {
  switch (place) {
    case 'camp':
      return (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
          <circleGeometry args={[4, 24]} />
          <meshStandardMaterial color="#7a6a4a" />
        </mesh>
      )
    case 'riverbank':
      return (
        <group>
          {Array.from({ length: 7 }, (_, i) => (
            <mesh key={i} position={[Math.cos(i * 2.1) * 1.6, 0.2, Math.sin(i * 2.1) * 1.6]}>
              <sphereGeometry args={[0.25, 8, 6]} />
              <meshStandardMaterial color="#9a9a94" />
            </mesh>
          ))}
        </group>
      )
    case 'outcrop':
      return (
        <group>
          <mesh position={[0, 0.6, 0]} rotation={[0.1, 0.3, 0]}>
            <boxGeometry args={[4, 1.2, 3]} />
            <meshStandardMaterial color="#6f6f6a" />
          </mesh>
          <mesh position={[-2.5, 0.3, 1]}>
            <boxGeometry args={[1.5, 0.6, 1.2]} />
            <meshStandardMaterial color="#7d7d78" />
          </mesh>
        </group>
      )
    case 'woodland':
      return (
        <group>
          {Array.from({ length: 9 }, (_, i) => (
            <mesh key={i} position={[Math.cos(i * 0.7) * (1.5 + (i % 3)), 1.6, Math.sin(i * 0.7) * (1.5 + (i % 3))]}>
              <cylinderGeometry args={[0.05, 0.08, 3.2, 5]} />
              <meshStandardMaterial color="#8a9a4a" />
            </mesh>
          ))}
        </group>
      )
    case 'grassland':
      return null
    case 'oldKill':
      return (
        <group>
          {Array.from({ length: 6 }, (_, i) => (
            <mesh key={i} position={[Math.cos(i * 1.3) * 1.8, 0.12, Math.sin(i * 1.3) * 1.8]} rotation={[0, i * 0.9, Math.PI / 2]}>
              <cylinderGeometry args={[0.1, 0.12, 1.6, 6]} />
              <meshStandardMaterial color="#e8e4d8" />
            </mesh>
          ))}
        </group>
      )
    case 'mounds':
      return (
        <mesh position={[0, 1.1, 0]}>
          <coneGeometry args={[1.3, 2.2, 8]} />
          <meshStandardMaterial color="#8b6b3e" />
        </mesh>
      )
    case 'flats':
      return null
  }
}

/** The morning's cue, as it looks: vultures circling, hyenas near the old kill, winged termites after rain, the dry flats (always drawn; the cue is the dryness). */
function Cues({ cue, clock, elderAway }: { cue: Cue; clock: () => number; elderAway: boolean }) {
  const group = useRef<THREE.Group>(null)
  useFrame(() => {
    if (group.current) group.current.rotation.y = clock() * 0.25
  })
  void elderAway
  if (cue === 'vultures')
    return (
      <group ref={group} position={[PLACE_XZ.grassland.x, 0, -PLACE_XZ.grassland.z]}>
        {[0, 1, 2].map((i) => (
          <group key={i} rotation={[0, (i * Math.PI * 2) / 3, 0]}>
            <mesh position={[14, 24 + i * 3, 0]} rotation={[0, 0, 0.2]}>
              <boxGeometry args={[2.6, 0.08, 0.5]} />
              <meshStandardMaterial color="#1c1c1c" />
            </mesh>
          </group>
        ))}
      </group>
    )
  if (cue === 'hyenas')
    return (
      <group position={[PLACE_XZ.oldKill.x - 6, 0, -(PLACE_XZ.oldKill.z - 6)]}>
        {[0, 1].map((i) => (
          <mesh key={i} position={[i * 2.5, 0.6, i * 1.2]}>
            <boxGeometry args={[1.4, 0.8, 0.6]} />
            <meshStandardMaterial color="#5a4a3a" />
          </mesh>
        ))}
      </group>
    )
  if (cue === 'rain') return <Termites clock={clock} />
  return null
}

function Termites({ clock }: { clock: () => number }) {
  const ref = useRef<THREE.Points>(null)
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const n = 60
    const pos = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      pos[i * 3] = PLACE_XZ.mounds.x + (Math.random() - 0.5) * 6
      pos[i * 3 + 1] = 1 + Math.random() * 6
      pos[i * 3 + 2] = -PLACE_XZ.mounds.z + (Math.random() - 0.5) * 6
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    return g
  }, [])
  useFrame(() => {
    if (ref.current) ref.current.position.y = (clock() * 0.7) % 4
  })
  return (
    <points ref={ref} geometry={geometry}>
      <pointsMaterial color="#f4f1e6" size={0.25} />
    </points>
  )
}

/** The need at midday: a carcass, bones, termites (drawn with the cue), tubers. */
function NeedObject({ need }: { need: Need }) {
  const p = PLACE_XZ[NEED_TABLE[need].place]
  if (need === 'carcass')
    // A low rounded body with four legs out to one side, about 0.9 m high (Jon, 2026-11-11: less tall, less boxy).
    return (
      <group position={[p.x, 0, -p.z]} rotation={[0, 0.4, 0]}>
        <mesh position={[0, 0.42, 0]} scale={[1.7, 0.42, 0.8]}>
          <sphereGeometry args={[1, 14, 10]} />
          <meshStandardMaterial color="#7a3b2e" />
        </mesh>
        {[-1.0, -0.4, 0.4, 1.0].map((x, i) => (
          <mesh key={i} position={[x, 0.22, 0.85]} rotation={[1.25, 0, i % 2 ? 0.25 : -0.25]}>
            <cylinderGeometry args={[0.06, 0.09, 0.9, 6]} />
            <meshStandardMaterial color="#5a2a20" />
          </mesh>
        ))}
      </group>
    )
  if (need === 'marrow')
    return (
      <mesh position={[p.x, 0.25, -p.z]} rotation={[0, 0.8, Math.PI / 2]}>
        <cylinderGeometry args={[0.2, 0.25, 2.2, 6]} />
        <meshStandardMaterial color="#f1ecdf" />
      </mesh>
    )
  if (need === 'tubers')
    return (
      <group position={[p.x, 0, -p.z]}>
        {[0, 1, 2].map((i) => (
          <mesh key={i} position={[i - 1, 0.1, 0]}>
            <sphereGeometry args={[0.35, 8, 6]} />
            <meshStandardMaterial color="#9c7a4a" />
          </mesh>
        ))}
      </group>
    )
  return null
}

const ITEM_COLOR: Record<Item, string> = { cobble: '#8d8d88', flake: '#c9c9c4', sapling: '#8a9a4a', probe: '#a89a5a', diggingStick: '#7a5a2e' }

function ItemMesh({ item }: { item: Item }) {
  switch (item) {
    case 'cobble':
      return (
        <mesh>
          <sphereGeometry args={[0.12, 8, 6]} />
          <meshStandardMaterial color={ITEM_COLOR.cobble} />
        </mesh>
      )
    case 'flake':
      return (
        <mesh rotation={[0, 0, 0.6]}>
          <coneGeometry args={[0.08, 0.2, 3]} />
          <meshStandardMaterial color={ITEM_COLOR.flake} />
        </mesh>
      )
    default:
      return (
        <mesh rotation={[0, 0, 0.3]}>
          <cylinderGeometry args={[0.025, 0.03, item === 'sapling' ? 1.6 : 1.3, 5]} />
          <meshStandardMaterial color={ITEM_COLOR[item]} />
        </mesh>
      )
  }
}

/** An item lying in the range, drawn larger than in a hand so it can be seen from the follow camera. */
function GroundMesh({ g }: { g: GroundItem }) {
  const lying = g.item === 'sapling' || g.item === 'probe' || g.item === 'diggingStick'
  return (
    <group position={[g.x, lying ? 0.06 : 0.2, -g.z]} rotation={lying ? [0, g.id * 0.9, Math.PI / 2 - 0.3] : [0, g.id * 0.9, 0]} scale={lying ? 1.2 : 1.8}>
      <ItemMesh item={g.item} />
    </group>
  )
}

/** A stylized hominin: no face, one neutral color, long legs that swing when it moves, hands that carry up to two items, a ring and a label at its feet. Its place and heading are set every frame from the sample; React draws only what changes slowly. */
const LABEL_STACK_METERS = 4
const LABEL_LINE_PX = 20

function Hominin({ f, sample, clock, labels, lift }: { f: Figure; sample: Sample; clock: () => number; labels: boolean; lift: number }) {
  const group = useRef<THREE.Group>(null)
  const legL = useRef<THREE.Mesh>(null)
  const legR = useRef<THREE.Mesh>(null)
  useFrame((state) => {
    const cur = sample(state.clock.elapsedTime).find((x) => x.id === f.id) ?? f
    if (group.current) {
      group.current.position.set(cur.x, 0, -cur.z)
      group.current.rotation.y = cur.heading - Math.PI / 2
    }
    const t = clock()
    const swing = cur.moving ? Math.sin(t * 7) * 0.5 : 0
    if (legL.current) legL.current.rotation.x = swing
    if (legR.current) legR.current.rotation.x = -swing
  })
  return (
    <group ref={group}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[0.55, 0.75, 24]} />
        <meshBasicMaterial color={f.ring} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={legL} position={[-0.14, 0.85, 0]}>
        <cylinderGeometry args={[0.07, 0.08, 0.85, 6]} />
        <meshStandardMaterial color={BODY} />
      </mesh>
      <mesh ref={legR} position={[0.14, 0.85, 0]}>
        <cylinderGeometry args={[0.07, 0.08, 0.85, 6]} />
        <meshStandardMaterial color={BODY} />
      </mesh>
      <mesh position={[0, 1.4, 0]}>
        <capsuleGeometry args={[0.2, 0.5, 4, 8]} />
        <meshStandardMaterial color={BODY} />
      </mesh>
      <mesh position={[0, 1.95, 0]}>
        <sphereGeometry args={[0.14, 10, 8]} />
        <meshStandardMaterial color={BODY} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 0.3, 1.25, 0.15]}>
          <mesh rotation={[0.9, 0, 0]}>
            <cylinderGeometry args={[0.05, 0.05, 0.6, 6]} />
            <meshStandardMaterial color={BODY} />
          </mesh>
          {f.hands[side === -1 ? 0 : 1] && (
            <group position={[0, -0.2, 0.3]}>
              <ItemMesh item={f.hands[side === -1 ? 0 : 1]!} />
            </group>
          )}
        </group>
      ))}
      {labels && (
        <Html position={[0, 2.5, 0]} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: f.ring, background: 'rgba(0,0,0,0.5)', padding: '1px 6px', borderRadius: 6, whiteSpace: 'nowrap', textAlign: 'center', transform: `translateY(${-lift * LABEL_LINE_PX}px)` }}>
            {f.label}
            {f.doing && <div style={{ fontSize: 9, fontWeight: 400, color: '#fff' }}>{f.doing}</div>}
          </div>
        </Html>
      )}
    </group>
  )
}

/** A camera above the range, looking down at an angle, for watching a run. */
export function AboveCamera({ fov }: { fov: number }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  useFrame(() => {
    camera.position.set(0, 150, 170)
    camera.lookAt(0, 0, -10)
    camera.up.set(0, 1, 0)
    if (camera.fov !== fov) {
      camera.fov = fov
      camera.updateProjectionMatrix()
    }
    camera.far = 600
  })
  return null
}

export const HOMININ_CAMERA = { eye: 1.6, behind: 4.5, above: 2.4, ahead: 2 }
