import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { CameraRig } from '../../../components/CameraRig'
import { FURNITURE, type RoomItem } from '../../../sim/memory/room/items'
import { presentIn, typeOf, ITEM_TYPE_LABEL, type Arrangement } from '../../../sim/memory/room/arrangements'
import { FURNITURE_PLACES, ITEM_PLACES, ROOM, type Place } from '../../../sim/memory/room/layout'
import { PATH_FOV, poseCamera } from '../../../sim/memory/room/path'
import { modelFile } from '../../../sim/memory/room/models'

/**
 * The dorm room (spec §7.1), in react-three-fiber from the CC0 kit models
 * in `public/m10/room/`, each scaled to a real size from its own bounding
 * box. Three uses: hidden while the models load behind the instruction
 * screen; on the fixed 30-second path, with the camera posed each frame
 * from the store's clock and no student control; and after the reveal,
 * free to orbit, with each listed item labeled by what it was.
 *
 * Nothing on a model marks its kind. The room is lit warmly; the page
 * around it stays the dark theme.
 */

export function modelUrl(id: string): string {
  return `${import.meta.env.BASE_URL}m10/room/${modelFile(id)}`
}

/** One kit model at a place: scaled uniformly so its height is the place's target height, its base at the place's y. */
function Model({ id, place }: { id: string; place: Place }) {
  const gltf = useGLTF(modelUrl(id))
  const object = useMemo(() => gltf.scene.clone(true), [gltf.scene])
  const box = useMemo(() => new THREE.Box3().setFromObject(gltf.scene), [gltf.scene])
  const h = Math.max(1e-6, box.max.y - box.min.y)
  const k = place.height / h
  // The ceiling fan hangs from its origin; everything else stands on its base.
  const lift = id === 'ceiling-fan' ? 0 : -box.min.y * k
  return (
    <group position={[place.x, place.y + lift, place.z]} rotation={[0, place.turn, 0]} scale={[k, k, k]}>
      <primitive object={object} />
    </group>
  )
}

/** The room's shell: floor, ceiling, and the walls the kit does not supply. */
function Shell() {
  const w = ROOM.width
  const d = ROOM.depth
  const h = ROOM.height
  const t = 0.08
  return (
    <group>
      <mesh position={[0, -0.005, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color="#6b5a46" roughness={0.9} />
      </mesh>
      <mesh position={[0, h, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color="#e8e2d8" roughness={1} />
      </mesh>
      {/* north wall, in two pieces either side of the window piece (2 m wide, centered on the desk at x = 0.8) */}
      <mesh position={[-1.2, h / 2, -d / 2]}>
        <boxGeometry args={[1.6, h, t]} />
        <meshStandardMaterial color="#d9cfc0" roughness={1} />
      </mesh>
      <mesh position={[1.9, h / 2, -d / 2]}>
        <boxGeometry args={[0.2, h, t]} />
        <meshStandardMaterial color="#d9cfc0" roughness={1} />
      </mesh>
      {/* south wall, either side of the door at x = −0.7 (1 m wide) */}
      <mesh position={[-1.6, h / 2, d / 2]}>
        <boxGeometry args={[0.8, h, t]} />
        <meshStandardMaterial color="#d9cfc0" roughness={1} />
      </mesh>
      <mesh position={[0.9, h / 2, d / 2]}>
        <boxGeometry args={[2.2, h, t]} />
        <meshStandardMaterial color="#d9cfc0" roughness={1} />
      </mesh>
      <mesh position={[-0.7, h - 0.25, d / 2]}>
        <boxGeometry args={[1.0, 0.5, t]} />
        <meshStandardMaterial color="#d9cfc0" roughness={1} />
      </mesh>
      {/* east and west walls */}
      <mesh position={[w / 2, h / 2, 0]}>
        <boxGeometry args={[t, h, d]} />
        <meshStandardMaterial color="#cfc4b3" roughness={1} />
      </mesh>
      <mesh position={[-w / 2, h / 2, 0]}>
        <boxGeometry args={[t, h, d]} />
        <meshStandardMaterial color="#cfc4b3" roughness={1} />
      </mesh>
    </group>
  )
}

/** A soft, warm interior: a hemisphere, a ceiling light, and a fill from the window. */
function Lights() {
  return (
    <>
      <hemisphereLight args={['#fff2dc', '#4a3b2b', 0.9]} />
      <pointLight position={[0.1, ROOM.height - 0.3, 0.2]} intensity={14} distance={9} decay={2} color="#ffe6c0" />
      <directionalLight position={[0.8, 2.2, -3.5]} intensity={0.6} color="#dbe6ff" />
      <ambientLight intensity={0.25} />
    </>
  )
}

/** The camera on the fixed path, posed from the store's clock each frame. */
function PathCamera({ t }: { t: () => number }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  useLayoutEffect(() => {
    camera.fov = PATH_FOV
    camera.near = 0.05
    camera.far = 50
    camera.updateProjectionMatrix()
  }, [camera])
  useFrame(() => {
    poseCamera(camera, t())
  })
  return null
}

/** A camera parked outside the room, looking at nothing, while the models load behind the instruction screen. */
function ParkedCamera() {
  const camera = useThree((s) => s.camera)
  useFrame(() => {
    camera.position.set(0, 40, 0)
    camera.lookAt(0, 60, 0)
  })
  return null
}

/** Tells the store when every model of the arrangement has mounted, so Begin can be pressed. */
function Loaded({ onLoaded }: { onLoaded: () => void }) {
  useEffect(() => {
    onLoaded()
  }, [onLoaded])
  return null
}

export interface RoomViewProps {
  arrangement: Arrangement
  /** `hidden`: the room is mounted but invisible and the camera parked; `path`: the fixed path; `orbit`: free to orbit, with labels. */
  mode: 'hidden' | 'path' | 'orbit'
  /** The path's clock, seconds, while on the path. */
  pathT?: () => number
  onLoaded?: () => void
}

export function RoomView({ arrangement, mode, pathT, onLoaded }: RoomViewProps) {
  const items: RoomItem[] = presentIn(arrangement)
  const group = useRef<THREE.Group>(null)
  const onLoadedRef = useRef(onLoaded)
  onLoadedRef.current = onLoaded
  const loaded = useMemo(() => () => onLoadedRef.current?.(), [])
  return (
    <>
      <color attach="background" args={['#0b1020']} />
      {mode === 'path' && pathT && <PathCamera t={pathT} />}
      {mode === 'hidden' && <ParkedCamera />}
      {mode === 'orbit' && <CameraRig target={[0, 0.9, 0]} minDistance={1} maxDistance={7} maxPolarAngle={Math.PI / 2.02} panLimit={2} />}
      <group ref={group} visible={mode !== 'hidden'}>
        <Lights />
        <Shell />
        <Suspense fallback={null}>
          {FURNITURE.map((f) => (
            <Model key={f} id={f} place={FURNITURE_PLACES[f]} />
          ))}
          {items.map((it) => (
            <Model key={it.id} id={it.id} place={ITEM_PLACES[it.id]} />
          ))}
          <Loaded onLoaded={loaded} />
        </Suspense>
        {mode === 'orbit' &&
          items.map((it) => {
            const p = ITEM_PLACES[it.id]
            return (
              <Html key={`label-${it.id}`} position={[p.x, p.y + p.height + 0.12, p.z]} center style={{ pointerEvents: 'none' }} zIndexRange={[5, 0]}>
                <div style={{ fontSize: 10, padding: '2px 6px', borderRadius: 999, background: 'rgba(14,20,32,0.85)', color: '#e7ecf3', border: '1px solid #2a3446', whiteSpace: 'nowrap' }}>
                  {it.name.replace(/^an? /, '')} · {ITEM_TYPE_LABEL[typeOf(arrangement, it.id)]}
                </div>
              </Html>
            )
          })}
      </group>
    </>
  )
}

/** Ask the loader for every model of an arrangement ahead of time (the instruction screen is up meanwhile). */
export function preloadRoom(arrangement: Arrangement): void {
  for (const f of FURNITURE) useGLTF.preload(modelUrl(f))
  for (const it of presentIn(arrangement)) useGLTF.preload(modelUrl(it.id))
}
