import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { CameraRig } from '../../components/CameraRig'
import { PLUS, WATER, PATHS, RICH_ROOM, foodBox, lampPosition, type Apparatus, type RoomKind, type TestSettings } from '../../sim/rodent/lab'
import type { PathPoint } from '../../sim/rodent/rats'
import { RatMesh } from './RatMesh'
import type { Rng } from '../../sim/random'

/**
 * Part 2's laboratory (spec §5.2, §8.2), seen from outside through
 * `CameraRig`, whose keys stay as they are here. The room is rich (a rack
 * of cages, a window, a door, a lamp, a poster) or a plain cloth
 * enclosure; the apparatus sits in the middle; a trial's rat moves along
 * its path, and earlier trials' paths lie faintly on the floor.
 */

const FLOOR = '#3b3732'
const WALL = '#5b574f'
const CURTAIN = '#6a6a66'
const MAZE = '#8a7a64'
const WATER_COLOR = '#6f8aa0'
/** The plus maze's side walls: height above the runway, and their color. */
const WALL_H = 0.14
const MAZE_WALL = '#6a6058'
/** Where the rat's feet stand: on the plus maze's and the paths' runways (6 cm high), or in the pool with its back above the water (surface at 0.17 m; the body is about 7 cm tall). */
const FLOOR_Y: Record<Apparatus, number> = { plus: 0.06, paths: 0.06, water: 0.13 }

function Room({ kind, dark, rotated }: { kind: RoomKind; dark: boolean; rotated: boolean }) {
  const h = 2.2
  const half = 2.6
  const rot = rotated ? Math.PI / 2 : 0
  return (
    <group rotation={[0, -rot, 0]}>
      {[
        [half, 0, Math.PI / 2],
        [-half, 0, Math.PI / 2],
        [0, half, 0],
        [0, -half, 0],
      ].map(([x, y, a], i) => (
        <mesh key={i} position={[x, h / 2, -y]} rotation={[0, a, 0]}>
          <planeGeometry args={[half * 2, h]} />
          <meshStandardMaterial color={kind === 'rich' ? WALL : CURTAIN} side={THREE.DoubleSide} roughness={1} />
        </mesh>
      ))}
      {kind === 'rich' && !dark && (
        <>
          {/* the rack of cages behind the east arm */}
          <group position={[RICH_ROOM.features[0].x, 0, -RICH_ROOM.features[0].y]}>
            {[0, 1, 2].map((row) =>
              [0, 1, 2].map((col) => (
                <mesh key={`${row}-${col}`} position={[0, 0.3 + row * 0.42, (col - 1) * 0.5]}>
                  <boxGeometry args={[0.35, 0.36, 0.44]} />
                  <meshStandardMaterial color="#c9c3b7" roughness={0.7} metalness={0.2} />
                </mesh>
              )),
            )}
          </group>
          {/* window */}
          <mesh position={[RICH_ROOM.features[1].x, 1.4, -(half - 0.02)]}>
            <planeGeometry args={[1.0, 0.8]} />
            <meshStandardMaterial color="#9fb7d8" emissive="#9fb7d8" emissiveIntensity={0.6} />
          </mesh>
          {/* door */}
          <mesh position={[-(half - 0.02), 0.95, -RICH_ROOM.features[2].y]} rotation={[0, Math.PI / 2, 0]}>
            <planeGeometry args={[0.8, 1.9]} />
            <meshStandardMaterial color="#7a4e2e" />
          </mesh>
          {/* poster */}
          <mesh position={[RICH_ROOM.features[3].x, 1.3, half - 0.02]} rotation={[0, Math.PI, 0]}>
            <planeGeometry args={[0.6, 0.8]} />
            <meshStandardMaterial color="#d8c25c" />
          </mesh>
        </>
      )}
    </group>
  )
}

function PlusMaze() {
  return (
    <group>
      {Object.values(PLUS.arms).map((a, i) => (
        <group key={i} position={[(PLUS.armLength / 2) * Math.cos(a), 0, -(PLUS.armLength / 2) * Math.sin(a)]} rotation={[0, a, 0]}>
          <mesh position={[0, 0.03, 0]}>
            <boxGeometry args={[PLUS.armLength, 0.06, PLUS.armWidth]} />
            <meshStandardMaterial color={MAZE} roughness={0.9} />
          </mesh>
          {/* side walls, so the arms read as alleys and not as a flat cross (Jon's walk, 2026-10-20) */}
          {[1, -1].map((side) => (
            <mesh key={side} position={[PLUS.armWidth / 4, 0.06 + WALL_H / 2, (side * (PLUS.armWidth + 0.012)) / 2]}>
              {/* from the edge of the center square to the arm's end, so the junction stays open */}
              <boxGeometry args={[PLUS.armLength - PLUS.armWidth / 2, WALL_H, 0.012]} />
              <meshStandardMaterial color={MAZE_WALL} roughness={0.9} />
            </mesh>
          ))}
        </group>
      ))}
      <mesh position={[0, 0.03, 0]}>
        <boxGeometry args={[PLUS.armWidth, 0.06, PLUS.armWidth]} />
        <meshStandardMaterial color={MAZE} />
      </mesh>
      {/* the food, at the end of the east arm */}
      <mesh position={[PLUS.armLength - 0.05, 0.08, 0]}>
        <sphereGeometry args={[0.02, 8, 8]} />
        <meshStandardMaterial color="#d8b25c" />
      </mesh>
    </group>
  )
}

function WaterMaze({ visible }: { visible: boolean }) {
  return (
    <group>
      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[WATER.radius + 0.05, WATER.radius + 0.05, 0.2, 48, 1, true]} />
        <meshStandardMaterial color="#8d8d8a" side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.17, 0]}>
        <circleGeometry args={[WATER.radius, 48]} />
        <meshStandardMaterial color={WATER_COLOR} transparent opacity={0.92} roughness={0.3} />
      </mesh>
      {visible && (
        <group position={[WATER.platform.x, 0, -WATER.platform.y]}>
          <mesh position={[0, 0.17, 0]}>
            <cylinderGeometry args={[WATER.platform.radius, WATER.platform.radius, 0.04, 16]} />
            <meshStandardMaterial color="#d8d8d0" />
          </mesh>
          <mesh position={[0, 0.35, 0]}>
            <boxGeometry args={[0.01, 0.3, 0.01]} />
            <meshStandardMaterial color="#eee" />
          </mesh>
          <mesh position={[0.05, 0.45, 0]}>
            <planeGeometry args={[0.1, 0.07]} />
            <meshStandardMaterial color="#e05050" side={THREE.DoubleSide} />
          </mesh>
        </group>
      )}
    </group>
  )
}

function RadiatingPaths({ lamp, testing }: { lamp: TestSettings['lamp']; testing: boolean }) {
  const food = foodBox()
  const lampAt = lampPosition(lamp)
  const route = useMemo(() => {
    const segs: { x: number; y: number; angle: number; length: number }[] = []
    let x = 0
    let y = PATHS.tableRadius
    for (const seg of PATHS.route) {
      const nx = x + seg.length * Math.cos(seg.heading)
      const ny = y + seg.length * Math.sin(seg.heading)
      segs.push({ x: (x + nx) / 2, y: (y + ny) / 2, angle: seg.heading, length: seg.length })
      x = nx
      y = ny
    }
    return segs
  }, [])
  return (
    <group>
      <mesh position={[0, 0.03, 0]}>
        <cylinderGeometry args={[PATHS.tableRadius, PATHS.tableRadius, 0.06, 24]} />
        <meshStandardMaterial color={MAZE} />
      </mesh>
      <mesh position={[0, 0.03, PATHS.tableRadius + 0.4]}>
        <boxGeometry args={[0.1, 0.06, 0.8]} />
        <meshStandardMaterial color={MAZE} />
      </mesh>
      {route.map((s, i) => (
        <mesh key={i} position={[s.x, 0.03, -s.y]} rotation={[0, s.angle, 0]}>
          <boxGeometry args={[s.length, 0.06, 0.1]} />
          <meshStandardMaterial color={testing && i === 0 ? '#4a4038' : MAZE} />
        </mesh>
      ))}
      {testing && (
        <mesh position={[0, 0.1, -(PATHS.tableRadius + 0.05)]}>
          <boxGeometry args={[0.14, 0.2, 0.04]} />
          <meshStandardMaterial color="#3a2a22" />
        </mesh>
      )}
      {testing &&
        PATHS.fan.map((h, i) => (
          <mesh key={i} position={[(PATHS.pathLength / 2) * Math.cos(h) + PATHS.tableRadius * Math.cos(h), 0.03, -((PATHS.pathLength / 2) * Math.sin(h) + PATHS.tableRadius * Math.sin(h))]} rotation={[0, h, 0]}>
            <boxGeometry args={[PATHS.pathLength, 0.06, 0.08]} />
            <meshStandardMaterial color={i === 5 ? '#a08c6a' : MAZE} />
          </mesh>
        ))}
      <mesh position={[food.x, 0.08, -food.y]}>
        <boxGeometry args={[0.14, 0.1, 0.14]} />
        <meshStandardMaterial color={testing ? '#4a4038' : '#d8b25c'} />
      </mesh>
      {lampAt && (
        <group position={[lampAt.x, 0, -lampAt.y]}>
          <mesh position={[0, 0.4, 0]}>
            <cylinderGeometry args={[0.012, 0.012, 0.8, 6]} />
            <meshStandardMaterial color="#444" />
          </mesh>
          <mesh position={[0, 0.85, 0]}>
            <coneGeometry args={[0.12, 0.14, 12, 1, true]} />
            <meshStandardMaterial color="#e8d8a0" emissive="#ffe9a8" emissiveIntensity={1.4} side={THREE.DoubleSide} />
          </mesh>
          <pointLight position={[0, 0.8, 0]} intensity={2.5} distance={4} decay={1.5} color="#ffe2a0" />
        </group>
      )}
    </group>
  )
}

/** A rat moving along a trial's path by the clock. */
function PathRat({ path, clock, anim, floorY }: { path: PathPoint[]; clock: () => number; anim: Rng; floorY: number }) {
  const pose = useRef({ x: path[0]?.x ?? 0, y: path[0]?.y ?? 0, heading: 0 })
  useFrame(() => {
    const t = clock()
    const p = poseAt(path, t)
    if (p) pose.current = p
  })
  return <RatMesh pose={() => pose.current} anim={anim} moving={() => true} floorY={floorY} />
}

/** Where along a path the rat is at time `t`, facing along it. */
export function poseAt(path: PathPoint[], t: number): { x: number; y: number; heading: number } | null {
  if (!path.length) return null
  if (t <= path[0].t) return { x: path[0].x, y: path[0].y, heading: path.length > 1 ? Math.atan2(path[1].y - path[0].y, path[1].x - path[0].x) : 0 }
  for (let i = 1; i < path.length; i++) {
    if (t <= path[i].t) {
      const a = path[i - 1]
      const b = path[i]
      const k = (t - a.t) / Math.max(1e-6, b.t - a.t)
      return { x: a.x + k * (b.x - a.x), y: a.y + k * (b.y - a.y), heading: Math.atan2(b.y - a.y, b.x - a.x) }
    }
  }
  const a = path[path.length - 2] ?? path[0]
  const b = path[path.length - 1]
  return { x: b.x, y: b.y, heading: Math.atan2(b.y - a.y, b.x - a.x) }
}

function PathLine({ path, color, opacity }: { path: PathPoint[]; color: string; opacity: number }) {
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const arr = new Float32Array(path.length * 3)
    path.forEach((p, i) => {
      arr[3 * i] = p.x
      arr[3 * i + 1] = 0.075
      arr[3 * i + 2] = -p.y
    })
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3))
    return g
  }, [path])
  return (
    <line>
      <primitive object={geom} attach="geometry" />
      <lineBasicMaterial color={color} transparent opacity={opacity} />
    </line>
  )
}

export function LabView({ settings, apparatus, dark, testing, currentPath, pastPaths, clock, anim }: { settings: TestSettings; apparatus: Apparatus; dark: boolean; testing: boolean; currentPath: PathPoint[] | null; pastPaths: PathPoint[][]; clock: () => number; anim: Rng }) {
  return (
    <>
      <color attach="background" args={[dark ? '#06070a' : '#15181f']} />
      <ambientLight intensity={dark ? 0.12 : 0.7} />
      <directionalLight position={[3, 6, 4]} intensity={dark ? 0.05 : 0.8} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[5.2, 5.2]} />
        <meshStandardMaterial color={FLOOR} roughness={1} />
      </mesh>
      <Room kind={settings.room} dark={dark || settings.removeCues} rotated={settings.rotateCues} />
      {apparatus === 'plus' && <PlusMaze />}
      {apparatus === 'water' && <WaterMaze visible={settings.platform === 'visible'} />}
      {apparatus === 'paths' && <RadiatingPaths lamp={settings.lamp} testing={testing} />}
      {pastPaths.map((p, i) => (
        <PathLine key={i} path={p} color="#f0a94b" opacity={0.35} />
      ))}
      {currentPath && <PathLine path={currentPath} color="#4f9cff" opacity={0.9} />}
      {currentPath && <PathRat path={currentPath} clock={clock} anim={anim} floorY={FLOOR_Y[apparatus]} />}
      <CameraRig target={[0, 0, 0]} minDistance={1.5} maxDistance={12} panLimit={3} />
    </>
  )
}
