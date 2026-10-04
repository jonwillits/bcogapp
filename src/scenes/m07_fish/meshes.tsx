import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { KINDS } from '../../sim/fish/kinds'
import type { FishWorld } from '../../sim/fish/world'
import type { Rng } from '../../sim/random'

/**
 * What is being shown of the encounter in front of the fish. This is the
 * scene's, not the simulation's: the world knows a smell arrived, a verdict
 * was taken and an outcome followed; how long each is held on screen, and
 * where in the water the smell appeared, is drawing.
 */
export interface Show {
  /** Seconds into the present encounter, at 1×. */
  t: number
  /** 0 waiting · 1 the smell is arriving · 2 the verdict is acted on · 3 the outcome is shown. */
  stage: 0 | 1 | 2 | 3
  /** Where across the stream the smell appeared. */
  lateral: number
  /** Running clock for idle motion, seconds. */
  clock: number
}

export const T_VERDICT = 1.0
export const T_OUTCOME = 1.6
export const T_END = 2.5

export function newShow(): Show {
  return { t: 0, stage: 0, lateral: 0, clock: 0 }
}

/** Where the fish holds station, and where it darts to. Upstream is −z, away from the camera. */
const HOME = { x: 0, z: 2 }
const COVER = { x: 4.3, z: 3.6 }
const UPSTREAM_Z = -8

const ease = (k: number) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k))

/** Where the smell is now: drifting down from upstream toward the fish. */
function smellAt(show: Show): { x: number; z: number } {
  const k = Math.min(1, show.t / T_VERDICT)
  return { x: show.lateral * (1 - 0.75 * k), z: UPSTREAM_Z + (HOME.z - 1.4 - UPSTREAM_Z) * k }
}

/**
 * The stream bed: murky water, a few stones, the rock the fish darts behind,
 * and streaks of current running downstream. Flat, bright-enough colors and
 * fog, because the dark theme has hidden correctly drawn geometry before.
 */
export function StreamBed({ show }: { show: Show }) {
  const streaks = useRef<(THREE.Mesh | null)[]>([])
  const COUNT = 16
  useFrame(() => {
    streaks.current.forEach((m, i) => {
      if (!m) return
      const span = 22
      const z = ((i * 7.3 + show.clock * 1.6) % span) - span / 2
      m.position.set(((i * 37) % 17) - 8, 0.03, z)
    })
  })
  return (
    <group>
      <fog attach="fog" args={['#0d2231', 13, 30]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
        <planeGeometry args={[40, 40]} />
        <meshBasicMaterial color="#16384a" />
      </mesh>
      {Array.from({ length: COUNT }, (_, i) => (
        <mesh key={i} ref={(el) => (streaks.current[i] = el)} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
          <planeGeometry args={[0.05, 1.4]} />
          <meshBasicMaterial color="#5f9bb5" transparent opacity={0.35} />
        </mesh>
      ))}
      {[
        [-5.5, -3, 0.7],
        [-3.8, 4.6, 0.5],
        [6.2, -5.5, 0.9],
        [-7, 1.2, 0.6],
        [2.6, -6.5, 0.45],
      ].map(([x, z, r], i) => (
        <mesh key={i} position={[x, r * 0.35, z]} scale={[1, 0.55, 1]} raycast={() => null}>
          <dodecahedronGeometry args={[r, 0]} />
          <meshStandardMaterial color="#4d6b7a" roughness={0.9} flatShading />
        </mesh>
      ))}
      {/* cover */}
      <mesh position={[COVER.x + 1, 0.5, COVER.z - 0.3]} scale={[1.25, 0.7, 1]} raycast={() => null}>
        <dodecahedronGeometry args={[1.05, 0]} />
        <meshStandardMaterial color="#6f8fa0" roughness={0.9} flatShading />
      </mesh>
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
      const smell = smellAt(show)
      const toward = Math.atan2(smell.x - s.x, -(smell.z - s.z))
      if (show.stage === 1) {
        yawTo = toward * ease(show.t / 0.5) + s.twitch
      } else if (world.route === 'dart') {
        if (e.verdict) {
          // Dart to cover; drift back once the outcome has passed.
          const back = show.stage === 3 ? ease((show.t - T_OUTCOME - 0.35) / 0.5) : 0
          tx = COVER.x + (HOME.x - COVER.x) * back
          tz = COVER.z + (HOME.z - COVER.z) * back
          yawTo = back < 1 ? 1.1 * (1 - back) : 0
        } else {
          // Stay, nosing at drifting food.
          tz = HOME.z - 0.25 + 0.12 * Math.sin(show.clock * 9)
          yawTo = 0.12 * Math.sin(show.clock * 5)
        }
      } else {
        const reach = show.stage === 2 ? ease((show.t - T_VERDICT) / 0.3) : 1 - ease((show.t - T_OUTCOME) / 0.6)
        if (e.verdict) {
          // Take the fruit.
          tx = HOME.x + (smell.x - HOME.x) * reach
          tz = HOME.z + (smell.z + 0.3 - HOME.z) * reach
          yawTo = toward * reach
        } else if (show.stage === 2) {
          // Turn away from it…
          yawTo = toward + (smell.x >= 0 ? -1 : 1) * 1.2 * reach
        } else {
          // …and it is mouthed briefly anyway, so its taste still arrives.
          const nip = Math.sin(Math.PI * Math.min(1, (show.t - T_OUTCOME) / 0.45))
          tx = HOME.x + (smell.x - HOME.x) * 0.6 * nip
          tz = HOME.z + (smell.z + 0.3 - HOME.z) * 0.6 * nip
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
 * The encounter: a puff of smell drifting down from upstream, and then
 * whatever it was — which the fish, in murky water, sees only when it
 * arrives. The outcome is drawn whatever the fish did: an eel lunges at the
 * place the fish was, a sucker drifts past, a fruit is tasted.
 */
export function EncounterMesh({ world, show }: { world: FishWorld; show: Show }) {
  const puff = useRef<THREE.Mesh>(null)
  const thing = useRef<THREE.Group>(null)
  const ring = useRef<THREE.Mesh>(null)
  const body = useRef<THREE.MeshStandardMaterial>(null)
  const colors = useMemo(() => ({ c: new THREE.Color() }), [])

  useFrame(() => {
    const e = world.pending ?? world.last
    const smell = smellAt(show)
    const fruit = world.route === 'eat'
    if (puff.current) {
      const visible = !!e && show.stage >= 1 && (show.stage < 3 || fruit)
      puff.current.visible = visible && !(fruit && show.stage === 3)
      const pulse = 1 + 0.15 * Math.sin(show.clock * 6)
      puff.current.position.set(smell.x, 0.45, smell.z)
      puff.current.scale.setScalar((fruit ? 0.55 : 0.9) * pulse)
    }
    if (thing.current && body.current) {
      const shown = !!e && show.stage === 3
      thing.current.visible = shown
      if (shown) {
        const kind = KINDS[e!.kind]
        const k = Math.min(1, (show.t - T_OUTCOME) / (T_END - T_OUTCOME))
        colors.c.set(kind.color)
        body.current.color.copy(colors.c)
        body.current.emissive.copy(colors.c)
        if (fruit) {
          // The fruit itself, now that it has been tasted.
          thing.current.position.set(smell.x, 0.45, smell.z)
          thing.current.scale.set(0.5, 0.5, 0.5)
          thing.current.rotation.y = 0
        } else if (e!.happens) {
          // The lunge: fast in to where the fish was, then away upstream.
          const into = ease(k / 0.28)
          const away = ease((k - 0.45) / 0.55)
          const z = UPSTREAM_Z + (HOME.z - UPSTREAM_Z) * into - (HOME.z - UPSTREAM_Z) * 0.8 * away
          thing.current.position.set(show.lateral * (1 - into) * 0.6, 0.42, z)
          thing.current.scale.set(0.55, 0.55, 3.2)
          thing.current.rotation.y = 0
        } else {
          // Drifting past, to one side.
          thing.current.position.set(show.lateral * 0.5 - 1.8, 0.42, -5 + 12 * k)
          thing.current.scale.set(0.7, 0.6, 1.5)
          thing.current.rotation.y = 0.15 * Math.sin(show.clock * 3)
        }
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
      <mesh ref={puff} visible={false} raycast={() => null}>
        <sphereGeometry args={[0.6, 16, 12]} />
        <meshBasicMaterial color="#d7ecff" transparent opacity={0.4} depthWrite={false} />
      </mesh>
      <group ref={thing} visible={false}>
        <mesh raycast={() => null}>
          <sphereGeometry args={[0.5, 16, 12]} />
          <meshStandardMaterial ref={body} color="#ffffff" emissive="#ffffff" emissiveIntensity={0.55} roughness={0.6} />
        </mesh>
      </group>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} visible={false} raycast={() => null}>
        <ringGeometry args={[0.8, 1, 40]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  )
}
