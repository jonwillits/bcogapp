import { useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Panel } from '../../components/Panel'
import { SceneCanvasLayout } from '../../components/SceneCanvasLayout'
import { makeRng } from '../../sim/random'
import { ProgressStore } from '../../sim/memory/progress/store'
import { FOV_NARROW, FOV_NORMAL, type View } from '../m09_rat/AnimalCamera'
import { commandOf, useDriveKeys } from '../m09_rat/keys'
import { Btn, Choice, Content, Note, TabBar, LockedPanel, PART_TITLES, type Tab } from './ui'
import { useStore } from './ui'
import { DT, type PartContext, type PartModule, type PartStore } from './contract'
import { StorageLine } from './progress/StorageLine'
import { open } from './Part0'
import { lists } from './PartLists'
import { study } from './PartStudy'
import { room } from './PartRoom'
import { logs } from './PartLogs'
import { learners } from './PartLearners'

/**
 * Module 10's scene: Lab 10, What Happened Last Night. The student is the
 * subject of memory experiments in Parts 1 to 3 (lists of words, two ways
 * to study, a room), the mammal in Part 4 (six nights at the logs, in Lab
 * 9's range with Lab 9's rat and cameras), and the experimenter in Part 5
 * (programmed foragers on the student's own nights, a fast store, a slow
 * learner, and two kinds of damage). The fifth instalment of the creature
 * spine: the same rat as Lab 9, with a new capacity.
 *
 * Progress is saved on the student's own device under one storage key
 * (`progress/`), and every experiment is made of units with reserve
 * materials: a completed unit is never redone, an interrupted one restarts
 * with fresh materials. Commit, then reveal, on every tested surface.
 */

const TAB_PART: Record<Tab, 0 | 1 | 2 | 3 | 4 | 5> = { open: 0, lists: 1, study: 2, room: 3, logs: 4, learners: 5 }

// Each module is typed to its own store; the shell holds them as the base type.
const MODULES: Record<Tab, PartModule<PartStore>> = {
  open: open as unknown as PartModule<PartStore>,
  lists: lists as unknown as PartModule<PartStore>,
  study: study as unknown as PartModule<PartStore>,
  room: room as unknown as PartModule<PartStore>,
  logs: logs as unknown as PartModule<PartStore>,
  learners: learners as unknown as PartModule<PartStore>,
}

const MAX_STEPS_PER_FRAME = 6

/** The frame loop: fixed steps of the active part's store, with the keys held, capped so a tab returning from the background does not try to catch up. */
function Stepper({ store, held, onTick }: { store: PartStore; held: () => { forward: -1 | 0 | 1; turn: -1 | 0 | 1; dig: boolean }; onTick: () => void }) {
  const carry = useRef(0)
  useFrame((_, delta) => {
    if (!store.tick) return
    carry.current += Math.min(delta, 0.05)
    let steps = 0
    let any = false
    while (carry.current >= DT && steps < MAX_STEPS_PER_FRAME) {
      carry.current -= DT
      steps++
      any = true
      store.tick(DT, held())
    }
    if (any) onTick()
  })
  return null
}

export default function MemoryScene() {
  const [tab, setTab] = useState<Tab>('open')
  const [view, setView] = useState<View>('eye')
  const [narrow, setNarrow] = useState(false)
  const [lowDetail, setLowDetail] = useState(false)
  const [, bump] = useReducer((x: number) => x + 1, 0)
  const progressRef = useRef<ProgressStore | null>(null)
  if (!progressRef.current) progressRef.current = new ProgressStore()
  const progress = useStore(progressRef.current)
  const seed = progress.seed
  const storesRef = useRef<{ seed: number; stores: Partial<Record<Tab, PartStore>> } | null>(null)
  if (!storesRef.current || storesRef.current.seed !== seed) storesRef.current = { seed, stores: {} }
  const storeFor = (t: Tab): PartStore => {
    const s = storesRef.current!.stores
    if (!s[t]) s[t] = MODULES[t].createStore(seed, progress)
    return s[t]!
  }
  const anim = useMemo(() => makeRng(seed ^ 0xa11ce), [seed])
  const clockRef = useRef(0)
  const t0 = useRef(performance.now())
  const clock = () => clockRef.current
  const store = storeFor(tab)
  const digRef = useRef(false)
  const drivingTab = tab === 'logs'
  const { held, press } = useDriveKeys(drivingTab, () => {
    digRef.current = true
  })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!drivingTab) return
      const el = e.target as HTMLElement | null
      if (el && ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) return
      if (e.code === 'Space') {
        digRef.current = true
        e.preventDefault()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [drivingTab])
  const lastPanel = useRef(0)
  const onTick = () => {
    clockRef.current = (performance.now() - t0.current) / 1000
    const now = performance.now()
    if (now - lastPanel.current > 120) {
      lastPanel.current = now
      bump()
    }
  }
  const heldNow = () => {
    const c = commandOf(held.current)
    const dig = digRef.current
    digRef.current = false
    return { ...c, dig }
  }
  const fov = view === 'follow' || narrow ? FOV_NARROW : FOV_NORMAL
  const locked: Partial<Record<Tab, string | null>> = {}
  for (const t of Object.keys(TAB_PART) as Tab[]) locked[t] = progress.lockReason(TAB_PART[t])

  const header = (
    <Panel title="Lab 10: What Happened Last Night" style={{ width: 310 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <TabBar tab={tab} onChange={setTab} locked={locked} />
        <StorageLine available={progress.storageAvailable} />
        <Note>
          Run seed <span style={{ fontFamily: 'var(--font-mono)' }}>{seed}</span>. It fixes every list, order, arrangement, log and night. A new seed comes with “Clear my saved results” on the Open tab.
        </Note>
        {(tab === 'logs' || tab === 'room') && (
          <>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>View</span>
              <Choice value={view} options={[{ id: 'eye', label: 'Eye view' }, { id: 'follow', label: 'Follow view' }]} onChange={(v) => setView(v as View)} disabledIds={tab === 'room' ? ['eye', 'follow'] : []} />
            </div>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <label style={{ fontSize: 12, display: 'flex', gap: 6, alignItems: 'center' }}>
                <input type="checkbox" checked={narrow} onChange={(e) => setNarrow(e.target.checked)} /> Narrower view
              </label>
              <label style={{ fontSize: 12, display: 'flex', gap: 6, alignItems: 'center' }}>
                <input type="checkbox" checked={lowDetail} onChange={(e) => setLowDetail(e.target.checked)} /> Low detail
              </label>
            </div>
          </>
        )}
      </div>
    </Panel>
  )

  const ctx: PartContext = { seed, progress, store, view, fov, lowDetail, anim, clock, header }
  const mod = MODULES[tab]
  const lockedReason = locked[tab]
  const CanvasPart = mod.Canvas
  const Bottom = mod.Bottom
  const stage: ReactNode = lockedReason ? <LockedPanel title={PART_TITLES[tab]} reason={lockedReason} /> : <mod.Stage ctx={ctx} />
  return (
    <SceneCanvasLayout
      canvas={
        <>
          <Canvas camera={{ position: [0, 4, 6], fov: 45, near: 0.01, far: 200 }} onContextMenu={(e) => e.preventDefault()} dpr={lowDetail ? 1 : [1, 1.5]} shadows={false}>
            {!lockedReason && CanvasPart ? <CanvasPart ctx={ctx} /> : <color attach="background" args={['#0b1020']} />}
            <Stepper store={store} held={heldNow} onTick={onTick} />
          </Canvas>
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>{stage}</div>
        </>
      }
      left={
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {lockedReason ? (
            <>
              {header}
              <Panel title={PART_TITLES[tab]} style={{ width: 310 }}>
                <Note>{lockedReason}</Note>
              </Panel>
            </>
          ) : (
            <mod.Left ctx={ctx} />
          )}
        </div>
      }
      right={lockedReason ? null : <mod.Right ctx={ctx} />}
      bottom={!lockedReason && Bottom ? <Bottom ctx={ctx} /> : drivingTab ? <DriveBar press={press} /> : undefined}
    />
  )
}

/** The drive pad for Part 4, with a Dig button beside it. */
function DriveBar({ press }: { press: (k: 'forward' | 'back' | 'left' | 'right', down: boolean) => void }) {
  return (
    <div style={{ display: 'flex', gap: 14, alignItems: 'center', pointerEvents: 'auto' }}>
      <DrivePadWithDig press={press} />
      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Arrow keys or WASD drive the animal · “Enter” or the space bar digs</div>
    </div>
  )
}

function DrivePadWithDig({ press }: { press: (k: 'forward' | 'back' | 'left' | 'right', down: boolean) => void }) {
  const key = (k: 'forward' | 'back' | 'left' | 'right', label: string) => (
    <button
      type="button"
      aria-label={k}
      onPointerDown={(e) => {
        e.preventDefault()
        press(k, true)
      }}
      onPointerUp={() => press(k, false)}
      onPointerLeave={() => press(k, false)}
      onPointerCancel={() => press(k, false)}
      style={{ width: 40, height: 34, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 14, fontWeight: 600, cursor: 'pointer', touchAction: 'none' }}
    >
      {label}
    </button>
  )
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 40px)', gap: 4, justifyContent: 'center' }} data-drivepad>
        <span />
        {key('forward', '▲')}
        <span />
        {key('left', '◀')}
        {key('back', '▼')}
        {key('right', '▶')}
      </div>
      <Btn
        primary
        onClick={() => {
          window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter' }))
        }}
      >
        Dig
      </Btn>
    </div>
  )
}

export { Content }
