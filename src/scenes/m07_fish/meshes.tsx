import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { KINDS, type KindId } from '../../sim/fish/kinds'
import type { FishWorld } from '../../sim/fish/world'
import type { Rng } from '../../sim/random'
import { RECEPTOR_COLORS } from './labels'

/**
 * What is being shown of the encounter in front of the fish. This is the
 * scene's, not the simulation's: the world knows a smell arrived, a verdict
 * was taken and an outcome followed; how long each is held on screen, and
 * where in the water the smell appeared, is drawing.
 */
export interface Show {
  /** Seconds into the present encounter, at 1×. */
  t: number
  /** 0 waiting · 1 the smell is on its way down · 2 the verdict is acted on · 3 the outcome is shown. */
  stage: 0 | 1 | 2 | 3
  /** Where across the stream the smell appeared. */
  lateral: number
  /** Running clock for idle motion, seconds. */
  clock: number
}

export const T_VERDICT = 1.0
export const T_OUTCOME = 1.6
/**
 * The outcome plays out in about a second; the rest of the time to `T_END`
 * is still water, with the fish back in its place, before the next smell.
 * Without it one encounter ran into the next and the stream looked frantic.
 */
export const T_END = 4.0
const OUTCOME_SPAN = 0.9

export function newShow(): Show {
  return { t: 0, stage: 0, lateral: 0, clock: 0 }
}

/** Where the fish holds station. Upstream is −z, away from the camera. */
const HOME = { x: 0, z: 2 }
/** The rock the fish darts behind, and where it ends up: in the rock's lee, whole body clear of it, facing upstream. */
const ROCK = { x: 3.9, z: 1.5 }
const COVER = { x: 3.5, z: 3.1 }
const UPSTREAM_Z = -8

/**
 * How fast the water runs, in units a second at 1×. The smell is carried at
 * exactly this speed, and so are the specks that show the current: a smell
 * that outran the water read as a thing swimming at the fish.
 */
const CURRENT = 7.5
/** The smell reaches the fish's nose as the verdict is taken. */
const NOSE_Z = HOME.z - 0.6
/** Where a fruit comes to rest in front of the fish. */
const FRUIT_Z = HOME.z - 1.4

const ease = (k: number) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k))
/** A fixed number in [0, 1) for speck `i`'s property `n`: where each speck sits is drawing, and draws from no stream. */
const hash = (i: number, n: number) => {
  const v = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453
  return v - Math.floor(v)
}

/** The middle of the smell: carried down on the current, over the fish and on past it. */
function plumeAt(show: Show): { x: number; z: number } {
  const k = Math.min(1, show.t / T_VERDICT)
  return { x: show.lateral * (1 - 0.75 * k), z: NOSE_Z + CURRENT * (show.t - T_VERDICT) }
}

/** A fruit: it falls in upstream and drifts down behind its own smell, to rest in front of the fish as the outcome arrives. */
function fruitAt(show: Show): { x: number; z: number } {
  const k = ease(Math.min(1, show.t / T_OUTCOME))
  return { x: show.lateral * (1 - 0.75 * k), z: NOSE_Z - CURRENT * T_VERDICT + (FRUIT_Z - (NOSE_Z - CURRENT * T_VERDICT)) * k }
}

const MOTES = 80
/** Weed in the rock's lee, either side of where the fish tucks in: across from the rock, downstream of it, height. */
const WEEDS: readonly [number, number, number][] = [
  [-1.5, 1.5, 1.3],
  [-1.2, 2.0, 1.7],
  [-1.0, 1.3, 1.1],
  [0.4, 1.65, 1.8],
  [0.7, 2.1, 1.3],
  [1.0, 1.7, 1.6],
]

/**
 * The stream bed: murky water, a few stones, the weedy rock the fish darts
 * behind, and specks carried downstream on the current. The specks hang in
 * the water at several depths and pass over the stones, so it is the water
 * that reads as moving and not the bed. Flat, bright-enough colors and fog,
 * because the dark theme has hidden correctly drawn geometry before.
 */
export function StreamBed({ show }: { show: Show }) {
  const motes = useRef<THREE.InstancedMesh>(null)
  const weeds = useRef<(THREE.Mesh | null)[]>([])
  const dummy = useMemo(() => new THREE.Object3D(), [])
  useFrame(() => {
    const m = motes.current
    if (m) {
      const span = 24
      for (let i = 0; i < MOTES; i++) {
        const z = ((hash(i, 3) * span + show.clock * CURRENT * (0.85 + 0.3 * hash(i, 4))) % span) - 14
        dummy.position.set(hash(i, 1) * 18 - 9, 0.08 + hash(i, 2) * 1.0, z)
        dummy.scale.set(1, 1, 5 + 4 * hash(i, 5))
        dummy.updateMatrix()
        m.setMatrixAt(i, dummy.matrix)
      }
      m.instanceMatrix.needsUpdate = true
    }
    weeds.current.forEach((w, i) => {
      if (w) w.rotation.x = 0.35 + 0.12 * Math.sin(show.clock * 2.2 + i * 1.3)
    })
  })
  return (
    <group>
      <fog attach="fog" args={['#0d2231', 13, 30]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
        <planeGeometry args={[40, 40]} />
        <meshBasicMaterial color="#16384a" />
      </mesh>
      <instancedMesh ref={motes} args={[undefined, undefined, MOTES]} frustumCulled={false} raycast={() => null}>
        <sphereGeometry args={[0.03, 6, 5]} />
        <meshBasicMaterial color="#8fb7c9" transparent opacity={0.4} depthWrite={false} />
      </instancedMesh>
      {[
        [-5.5, -3, 0.7],
        [-6.4, 4.4, 0.5],
        [6.2, -5.5, 0.9],
        [-7, 1.2, 0.6],
        [2.6, -6.5, 0.45],
      ].map(([x, z, r], i) => (
        <mesh key={i} position={[x, r * 0.35, z]} scale={[1, 0.55, 1]} raycast={() => null}>
          <dodecahedronGeometry args={[r, 0]} />
          <meshStandardMaterial color="#4d6b7a" roughness={0.9} flatShading />
        </mesh>
      ))}
      {/* cover: a larger, paler rock with a smaller one against it, and weed growing in its lee */}
      <mesh position={[ROCK.x, 0.6, ROCK.z]} scale={[1.3, 0.85, 1]} raycast={() => null}>
        <dodecahedronGeometry args={[1.15, 0]} />
        <meshStandardMaterial color="#7d9cab" roughness={0.9} flatShading />
      </mesh>
      <mesh position={[ROCK.x + 1.45, 0.35, ROCK.z + 0.85]} scale={[1, 0.7, 1]} raycast={() => null}>
        <dodecahedronGeometry args={[0.7, 0]} />
        <meshStandardMaterial color="#6f8fa0" roughness={0.9} flatShading />
      </mesh>
      {WEEDS.map(([x, z, h], i) => (
        <mesh key={`w${i}`} ref={(el) => (weeds.current[i] = el)} position={[ROCK.x + x, h / 2, ROCK.z + z]} raycast={() => null}>
          <coneGeometry args={[0.11, h, 5]} />
          <meshStandardMaterial color="#6fc48a" emissive="#3f8f5c" emissiveIntensity={0.5} roughness={0.8} />
        </mesh>
      ))}
    </group>
  )
}

/**
 * The fish. A short chain of beads with a tail beat, as the worm's body
 * was, seen from above and a little behind, holding its place against the
 * current and facing upstream.
 *
 * It is kept lively: a slow tail beat, a wandering heading, fluttering
 * fins, an occasional twitch, a slight drift and correction. **Every draw
 * for that comes from `anim`, the run seed's own animation stream**, so a
 * seed replays the same fish and none of it can reach the network or the
 * stream of encounters.
 *
 * Turning to face a new smell is drawn here and computed nowhere: the
 * network has no part in it, and the World tab says whose job it is.
 */
export function FishMesh({ world, show, anim, playing, speed }: { world: FishWorld; show: Show; anim: Rng; playing: boolean; speed: number }) {
  const SEG = 7
  const group = useRef<THREE.Group>(null)
  const beads = useRef<(THREE.Mesh | null)[]>([])
  const tail = useRef<THREE.Mesh>(null)
  const fins = useRef<(THREE.Mesh | null)[]>([])
  const state = useRef({ x: HOME.x, z: HOME.z, yaw: 0, wander: 0, wanderTo: 0, twitch: 0, driftX: 0, driftTo: 0, nextTwitch: 2, nextWander: 0.5, beat: 0, flutter: 0 })

  useFrame((_, delta) => {
    const s = state.current
    const dt = playing ? Math.min(delta, 0.05) * Math.min(speed, 3) : 0
    const e = world.pending ?? world.last
    s.beat += dt * (5 + (show.stage === 2 ? 9 : 0))
    s.flutter += dt * 11

    // Idle liveliness, from the animation stream.
    s.nextWander -= dt
    if (s.nextWander <= 0) {
      s.wanderTo = (anim.next() - 0.5) * 0.5
      s.driftTo = (anim.next() - 0.5) * 0.5
      s.nextWander = 0.6 + anim.next() * 1.4
    }
    s.nextTwitch -= dt
    if (s.nextTwitch <= 0) {
      s.twitch = (anim.next() < 0.5 ? -1 : 1) * (0.25 + anim.next() * 0.35)
      s.nextTwitch = 2.5 + anim.next() * 5
    }
    s.wander += (s.wanderTo - s.wander) * Math.min(1, dt * 2)
    s.driftX += (s.driftTo - s.driftX) * Math.min(1, dt * 0.8)
    s.twitch *= Math.exp(-dt * 6)

    // Where the encounter puts the fish, and which way it faces.
    let tx = HOME.x + s.driftX
    let tz = HOME.z
    let yawTo = s.wander + s.twitch
    if (e && show.stage >= 1) {
      const aim = (to: { x: number; z: number }) => Math.atan2(to.x - s.x, -(to.z - s.z))
      if (show.stage === 1) {
        yawTo = aim(plumeAt(show)) * ease(show.t / 0.5) + s.twitch
      } else if (world.route === 'dart') {
        if (e.verdict) {
          // Dart to cover; drift back once the outcome has passed.
          const back = show.stage === 3 ? ease((show.t - T_OUTCOME - 0.35) / 0.5) : 0
          tx = COVER.x + (HOME.x - COVER.x) * back
          tz = COVER.z + (HOME.z - COVER.z) * back
          // It turns the way it is going, and straightens to face upstream as it arrives.
          const toGo = Math.min(1, Math.hypot(tx - s.x, tz - s.z) / 2)
          yawTo = (back > 0 ? -0.9 : 1.1) * toGo
        } else {
          // Stay, nosing at drifting food.
          tz = HOME.z - 0.25 + 0.12 * Math.sin(show.clock * 9)
          yawTo = 0.12 * Math.sin(show.clock * 5)
        }
      } else {
        const fruit = fruitAt(show)
        const toward = aim(fruit)
        const reach = show.stage === 2 ? ease((show.t - T_VERDICT) / 0.3) : 1 - ease((show.t - T_OUTCOME) / 0.6)
        if (e.verdict) {
          // Take the fruit.
          tx = HOME.x + (fruit.x - HOME.x) * reach
          tz = HOME.z + (fruit.z + 0.45 - HOME.z) * reach
          yawTo = toward * reach
        } else if (show.stage === 2) {
          // Turn away from it…
          yawTo = toward + (fruit.x >= 0 ? -1 : 1) * 1.2 * reach
        } else {
          // …and it is mouthed briefly anyway, so its taste still arrives.
          const nip = Math.sin(Math.PI * Math.min(1, (show.t - T_OUTCOME) / 0.45))
          tx = HOME.x + (fruit.x - HOME.x) * 0.6 * nip
          tz = HOME.z + (fruit.z + 0.45 - HOME.z) * 0.6 * nip
          yawTo = toward * nip
        }
      }
    }
    const quick = e && show.stage === 2 && world.route === 'dart' && e.verdict ? 14 : 5
    s.x += (tx - s.x) * Math.min(1, dt * quick)
    s.z += (tz - s.z) * Math.min(1, dt * quick)
    s.yaw += (yawTo - s.yaw) * Math.min(1, dt * 7)

    if (group.current) {
      group.current.position.set(s.x, 0.4, s.z)
      group.current.rotation.y = -s.yaw
    }
    const amp = show.stage === 2 ? 0.2 : 0.11
    for (let i = 0; i < SEG; i++) {
      const m = beads.current[i]
      if (!m) continue
      const k = i / (SEG - 1)
      m.position.set(amp * Math.pow(k, 1.4) * Math.sin(s.beat - i * 0.75), 0, i * 0.2)
    }
    if (tail.current) {
      tail.current.position.set(amp * Math.sin(s.beat - SEG * 0.75), 0, SEG * 0.2 + 0.05)
      tail.current.rotation.y = 0.7 * Math.sin(s.beat - SEG * 0.75 + 0.6)
    }
    fins.current.forEach((f, i) => {
      if (f) f.rotation.z = (i === 0 ? 1 : -1) * (0.5 + 0.28 * Math.sin(s.flutter + i * 1.7))
    })
  })

  return (
    <group ref={group} position={[HOME.x, 0.4, HOME.z]} scale={1.5}>
      {Array.from({ length: SEG }, (_, i) => {
        const k = i / (SEG - 1)
        const r = 0.2 * (1 - 0.72 * k) * (i === 0 ? 0.9 : 1)
        return (
          <mesh key={i} ref={(el) => (beads.current[i] = el)} scale={[1, 1.15, 1.25]} raycast={() => null}>
            <sphereGeometry args={[r, 14, 12]} />
            <meshStandardMaterial color={i < 2 ? '#dfe9f5' : '#b9cbe0'} emissive="#6c8fb5" emissiveIntensity={0.45} roughness={0.5} />
          </mesh>
        )
      })}
      <mesh ref={tail} scale={[0.25, 1.5, 1]} raycast={() => null}>
        <coneGeometry args={[0.16, 0.34, 4]} />
        <meshStandardMaterial color="#9fb6d2" emissive="#6c8fb5" emissiveIntensity={0.45} />
      </mesh>
      {[0, 1].map((i) => (
        <mesh key={i} ref={(el) => (fins.current[i] = el)} position={[(i === 0 ? 1 : -1) * 0.2, -0.04, 0.22]} scale={[1.6, 0.18, 0.9]} raycast={() => null}>
          <sphereGeometry args={[0.1, 10, 8]} />
          <meshStandardMaterial color="#9fb6d2" emissive="#6c8fb5" emissiveIntensity={0.5} transparent opacity={0.85} />
        </mesh>
      ))}
      {[0, 1].map((i) => (
        <mesh key={`eye${i}`} position={[(i === 0 ? 1 : -1) * 0.12, 0.07, -0.08]} raycast={() => null}>
          <sphereGeometry args={[0.04, 8, 8]} />
          <meshBasicMaterial color="#0b111c" />
        </mesh>
      ))}
    </group>
  )
}

/**
 * How each animal is drawn: a chain of beads behind its head, as the fish's
 * own body is. The shapes are what tell them apart — an eel long, thin and
 * winding; a pike a straight spear with a broad tail; a sucker and a chub
 * stout — and their colors (`KINDS`) are kept off the feature space's blue
 * and orange, which mean something else.
 */
interface Body {
  /** Each bead's radius, head first. */
  radii: number[]
  gap: number
  /** How far the body swings from side to side, and how much later each bead swings than the one before. */
  wave: number
  lag: number
  beat: number
  /** How deep the body is for its width. */
  tall: number
  /** The tail fin's size, or 0 for none. */
  tail: number
  scale: number
}

const MAX_BEADS = 16
const BODIES: Partial<Record<KindId, Body>> = {
  eel: { radii: Array.from({ length: 16 }, (_, i) => (i === 0 ? 0.23 : 0.2 * (1 - 0.6 * (i / 15)))), gap: 0.27, wave: 0.34, lag: 0.6, beat: 13, tall: 1, tail: 0, scale: 1.6 },
  pike: { radii: [0.11, 0.18, 0.24, 0.27, 0.27, 0.24, 0.18, 0.11], gap: 0.31, wave: 0.05, lag: 0.7, beat: 9, tall: 1.1, tail: 0.42, scale: 1.6 },
  sucker: { radii: [0.22, 0.31, 0.33, 0.28, 0.2, 0.12], gap: 0.27, wave: 0.07, lag: 0.8, beat: 5, tall: 0.9, tail: 0.3, scale: 1.5 },
  chub: { radii: [0.2, 0.31, 0.31, 0.22, 0.13], gap: 0.25, wave: 0.07, lag: 0.8, beat: 6, tall: 1.4, tail: 0.36, scale: 1.5 },
}

/** How long a harmless animal takes to drift from upstream to past the fish: it is carried at about the water's speed, and is gone before the next smell. */
const DRIFT = 1.9
const WISPS = 60
const WISPS_EACH = WISPS / 2

/**
 * The encounter: first a smell, carried down on the current, and then
 * whatever it was — which the fish, in murky water, sees only when it
 * arrives. The outcome is drawn whatever the fish did: an eel lunges at the
 * place the fish was, a sucker drifts past, a fruit is tasted.
 *
 * **The smell is not a thing.** It is a loose cloud of specks with no edge,
 * moving exactly as fast as the water, that washes over the fish and on
 * downstream. Its specks are of two colors, one for each receptor, and the
 * number of each is that receptor's response: the picture of the smell is
 * the pair of numbers the network is given, and nothing about what made it.
 */
export function EncounterMesh({ world, show }: { world: FishWorld; show: Show }) {
  const wisps = useRef<THREE.InstancedMesh>(null)
  const wispMat = useRef<THREE.MeshBasicMaterial>(null)
  const animal = useRef<THREE.Group>(null)
  const beads = useRef<(THREE.Mesh | null)[]>([])
  const tail = useRef<THREE.Mesh>(null)
  const eyes = useRef<(THREE.Mesh | null)[]>([])
  const fruit = useRef<THREE.Group>(null)
  const round = useRef<THREE.Mesh>(null)
  const stick = useRef<THREE.Mesh>(null)
  const ring = useRef<THREE.Mesh>(null)
  const plop = useRef<THREE.Mesh>(null)
  const tools = useMemo(
    () => ({
      dummy: new THREE.Object3D(),
      a: new THREE.Color(RECEPTOR_COLORS.a),
      b: new THREE.Color(RECEPTOR_COLORS.b),
      skin: new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0.3, roughness: 0.6 }),
      rind: new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0.3, roughness: 0.6 }),
    }),
    [],
  )

  useFrame(() => {
    const e = world.pending ?? world.last
    const eating = world.route === 'eat'

    // The smell.
    const w = wisps.current
    if (w && wispMat.current) {
      const on = !!e && !!world.pending && (show.stage === 1 || show.stage === 2)
      w.visible = on
      if (on) {
        const at = plumeAt(show)
        const k = Math.min(1.6, show.t / T_VERDICT)
        const size = eating ? 0.6 : 1
        const wide = (0.45 + 0.75 * k) * size
        const long = (2.2 + 1.4 * k) * size
        wispMat.current.opacity = 0.8 * ease(show.t / 0.15) * (1 - ease((show.t - T_VERDICT - 0.1) / (T_OUTCOME - T_VERDICT - 0.1)))
        for (let i = 0; i < WISPS; i++) {
          const isA = i % 2 === 0
          const shown = Math.floor(i / 2) < Math.round((isA ? e!.x1 : e!.x2) * WISPS_EACH)
          const angle = hash(i, 11) * Math.PI * 2 + 0.6 * Math.sin(show.clock * 1.7 + i)
          const r = Math.sqrt(hash(i, 12)) * wide
          tools.dummy.position.set(
            at.x + r * Math.cos(angle),
            0.3 + 0.7 * hash(i, 13) + 0.08 * Math.sin(show.clock * 3 + i * 2.1),
            at.z + (hash(i, 14) - 0.5) * long + 0.5 * r * Math.sin(angle),
          )
          tools.dummy.scale.setScalar(shown ? 0.07 + 0.07 * hash(i, 15) : 0)
          tools.dummy.updateMatrix()
          w.setMatrixAt(i, tools.dummy.matrix)
          w.setColorAt(i, isA ? tools.a : tools.b)
        }
        w.instanceMatrix.needsUpdate = true
        if (w.instanceColor) w.instanceColor.needsUpdate = true
      }
    }

    // An animal, once the outcome arrives. It comes from where its smell came from.
    const shownAnimal = !eating && show.stage === 3 && !world.pending ? world.last : null
    const since = show.t - T_OUTCOME
    const lateral = show.lateral
    const body = shownAnimal ? BODIES[shownAnimal.kind] : undefined
    if (animal.current) {
      const g = animal.current
      g.visible = !!body && since >= 0 && since < (shownAnimal!.happens ? OUTCOME_SPAN : DRIFT)
      if (g.visible && body) {
        let x: number
        let z: number
        let heading: number
        if (shownAnimal!.happens) {
          // The lunge: fast and straight down the smell's own line to where the fish was, head first, then back away along it and out of sight.
          const k = since / OUTCOME_SPAN
          const reach = ease(k / 0.28) - 1.3 * ease((k - 0.45) / 0.55)
          const from = { x: lateral * 1.25, z: UPSTREAM_Z }
          x = from.x + (HOME.x - from.x) * reach
          z = from.z + (HOME.z - 0.2 - from.z) * reach
          heading = Math.atan2(-(HOME.x - from.x), -(HOME.z - 0.2 - from.z))
        } else {
          // Carried down from where its smell came from, and past the fish on that side.
          const lane = (lateral >= 0 ? 1 : -1) * 1.7
          const across = (t: number) => lateral + (lane - lateral) * ease(t / (0.45 * DRIFT))
          const down = (t: number) => -5.5 + 13 * (t / DRIFT)
          x = across(since)
          z = down(since)
          heading = Math.atan2(-(across(since + 0.05) - x), -(down(since + 0.05) - z))
        }
        g.rotation.y = heading
        g.position.set(x, 0.42, z)
        g.scale.setScalar(body.scale)
        tools.skin.color.set(KINDS[shownAnimal!.kind].color)
        tools.skin.emissive.copy(tools.skin.color)
        const n = body.radii.length
        const swing = show.clock * body.beat
        for (let i = 0; i < MAX_BEADS; i++) {
          const m = beads.current[i]
          if (!m) continue
          m.visible = i < n
          if (i >= n) continue
          const r = body.radii[i]
          m.position.set(body.wave * (0.25 + 0.75 * (i / (n - 1))) * Math.sin(swing - i * body.lag), 0, i * body.gap)
          m.scale.set(r, r * body.tall, r * 1.3)
        }
        if (tail.current) {
          tail.current.visible = body.tail > 0
          tail.current.position.set(body.wave * Math.sin(swing - n * body.lag), 0, (n - 1) * body.gap + 0.7 * body.tail)
          // Laid flat, point toward the body, then swung from side to side.
          tail.current.rotation.set(-Math.PI / 2, 0.5 * Math.sin(swing - n * body.lag + 0.6), 0, 'YXZ')
          tail.current.scale.set(body.tail, body.tail, body.tail * 0.22)
        }
        eyes.current.forEach((eye, i) => {
          const r = body.radii[0]
          if (eye) {
            eye.position.set((i === 0 ? 1 : -1) * 0.62 * r, 0.5 * r, -0.6 * r)
            eye.scale.setScalar(0.24 * r)
          }
        })
      }
    }

    // A fruit: a dim shape in the murk until it is tasted, and then what it was.
    if (fruit.current && round.current && stick.current) {
      const on = eating && !!e && show.stage >= 1
      fruit.current.visible = on
      if (on) {
        const at = fruitAt(show)
        const known = show.stage === 3
        const kind = KINDS[e!.kind]
        const twig = known && e!.kind === 'twig'
        // Eaten, it is gone; left, it stays where it came to rest.
        const gone = known && e!.verdict ? ease((show.t - T_OUTCOME) / 0.3) : 0
        // Left, it rests a moment and is then carried off downstream.
        const off = Math.max(0, show.t - T_OUTCOME - OUTCOME_SPAN)
        fruit.current.position.set(at.x, 0.45 + 0.04 * Math.sin(show.clock * 4), at.z + 0.5 * CURRENT * off * off)
        fruit.current.scale.setScalar((known ? 1 : 0.7) * (1 - gone) * (1 - ease(off / 1.2)))
        round.current.visible = !twig
        stick.current.visible = twig
        round.current.scale.set(1, known && e!.kind === 'rotting' ? 0.7 : 1, 1)
        tools.rind.color.set(known ? kind.color : '#5d7684')
        tools.rind.emissive.copy(tools.rind.color)
      }
    }
    if (plop.current) {
      // The ripple where a fruit fell in.
      const mat = plop.current.material as THREE.MeshBasicMaterial
      const k = show.t / 0.6
      plop.current.visible = eating && !!world.pending && show.stage === 1 && k <= 1
      if (plop.current.visible) {
        mat.opacity = 0.7 * (1 - k)
        const r = 0.3 + 1.2 * k
        plop.current.scale.set(r, r, 1)
        plop.current.position.set(show.lateral, 0.06, NOSE_Z - CURRENT * T_VERDICT)
      }
    }

    if (ring.current) {
      // A ring where something befell the fish: struck, fed, or sickened.
      const mat = ring.current.material as THREE.MeshBasicMaterial
      const k = (show.t - T_OUTCOME) / 0.8
      let color: string | null = null
      if (e && show.stage === 3 && k >= 0 && k <= 1) {
        if (world.route === 'dart') color = !e.verdict && e.happens ? '#ff5a5a' : !e.verdict && !e.happens ? '#7ee6a8' : null
        else color = e.verdict ? (e.happens ? '#7ee6a8' : KINDS[e.kind].harms ? '#c9a0ff' : '#9aa5b1') : null
      }
      ring.current.visible = color !== null
      if (color) {
        mat.color.set(color)
        mat.opacity = 1 - k
        const r = 0.4 + 2 * k
        ring.current.scale.set(r, r, 1)
        ring.current.position.set(HOME.x, 0.06, HOME.z)
      }
    }
  })

  return (
    <group>
      <instancedMesh ref={wisps} args={[undefined, undefined, WISPS]} visible={false} frustumCulled={false} raycast={() => null}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshBasicMaterial ref={wispMat} color="#ffffff" transparent opacity={0} depthWrite={false} toneMapped={false} />
      </instancedMesh>
      {/* Local −z is forward, as for the fish. */}
      <group ref={animal} visible={false}>
        {Array.from({ length: MAX_BEADS }, (_, i) => (
          <mesh key={i} ref={(el) => (beads.current[i] = el)} material={tools.skin} raycast={() => null}>
            <sphereGeometry args={[1, 12, 10]} />
          </mesh>
        ))}
        <mesh ref={tail} material={tools.skin} raycast={() => null}>
          <coneGeometry args={[1, 1.5, 4]} />
        </mesh>
        {[0, 1].map((i) => (
          <mesh key={`eye${i}`} ref={(el) => (eyes.current[i] = el)} raycast={() => null}>
            <sphereGeometry args={[1, 8, 8]} />
            <meshBasicMaterial color="#0b111c" />
          </mesh>
        ))}
      </group>
      <group ref={fruit} visible={false}>
        <mesh ref={round} material={tools.rind} raycast={() => null}>
          <sphereGeometry args={[0.28, 14, 12]} />
        </mesh>
        <mesh ref={stick} material={tools.rind} rotation={[0, 0.5, Math.PI / 2]} visible={false} raycast={() => null}>
          <cylinderGeometry args={[0.05, 0.07, 0.95, 6]} />
        </mesh>
      </group>
      <mesh ref={plop} rotation={[-Math.PI / 2, 0, 0]} visible={false} raycast={() => null}>
        <ringGeometry args={[0.85, 1, 32]} />
        <meshBasicMaterial color="#cfe6f2" transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} visible={false} raycast={() => null}>
        <ringGeometry args={[0.8, 1, 40]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  )
}
