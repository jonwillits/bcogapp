import { useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Panel } from '../../components/Panel'
import { SceneCanvasLayout } from '../../components/SceneCanvasLayout'
import { makeRng } from '../../sim/random'
import { ProgressStore } from '../../sim/planning/progress/store'
import { FOV_NARROW, FOV_NORMAL, type View } from '../m09_rat/AnimalCamera'
import { commandOf, useDriveKeys } from '../m09_rat/keys'
import { Choice, Note, TabBar, type Tab } from './ui'
import { useStore } from './ui'
import { DT, type DriveCommand, type PartContext, type PartModule, type PartStore } from './contract'
import { StorageLine } from '../m10_memory/progress/StorageLine'
import { open } from './Part0'
import { choices } from './PartChoices'
import { puzzles } from './PartPuzzles'
import { band } from './PartBand'
import { corn } from './PartCorn'

/**
 * Module 12's scene: Lab 12, Intelligence and Thinking Ahead. The student is
 * the subject in Parts 1 and 2 (a chooser among gambles and delays, a
 * waiter at two dispensers, a solver of puzzles who pays to look ahead), and
 * the experimenter in Parts 2, 3 and 4 (procedures on the puzzle, five
 * hidden hominins on a range, corn in two trays). The seventh installment of
 * the creature spine: Homo erectus, in Lab 9's range by day.
 *
 * Progress is saved on the student's own device under one storage key
 * (`src/sim/planning/progress/`, on Lab 10's layer). Every part, and every
 * step within a part, opens at any time (decision 7): there are no locks.
 * Commit, then reveal, on every tested surface.
 */

export const TITLE = 'Lab 12: Intelligence and Thinking Ahead'

// Each module is typed to its own store; the shell holds them as the base type.
const MODULES: Record<Tab, PartModule<PartStore>> = {
  open: open as unknown as PartModule<PartStore>,
  choices: choices as unknown as PartModule<PartStore>,
  puzzles: puzzles as unknown as PartModule<PartStore>,
  band: band as unknown as PartModule<PartStore>,
  corn: corn as unknown as PartModule<PartStore>,
}

const MAX_STEPS_PER_FRAME = 6

/** The frame loop: fixed steps of the active part's store, with the keys held, capped so a tab returning from the background does not try to catch up. */
function Stepper({ store, held, onTick }: { store: PartStore; held: () => DriveCommand; onTick: () => void }) {
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
    store.frame?.(carry.current / DT)
  })
  return null
}

export default function PlanningScene() {
  const [tab, setTab] = useState<Tab>('open')
  const [view, setView] = useState<View>('follow')
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
  const anim = useMemo(() => makeRng(seed ^ 0x12a0c3), [seed])
  const clockRef = useRef(0)
  const t0 = useRef(performance.now())
  const clock = () => clockRef.current
  const store = storeFor(tab)
  const actRef = useRef(false)
  const leftRef = useRef(false)
  const rightRef = useRef(false)
  const drivingTab = tab === 'band'
  const handKeys = useMemo(
    () => ({
      KeyJ: () => {
        leftRef.current = true
      },
      KeyK: () => {
        rightRef.current = true
      },
    }),
    [],
  )
  const { held, press } = useDriveKeys(
    drivingTab,
    () => {
      actRef.current = true
    },
    handKeys,
  )
  useEffect(() => {
    // Nothing else is bound while driving; the keys are the arrows, WASD, Enter, J and K (`useDriveKeys`).
  }, [drivingTab, store])
  const lastPanel = useRef(0)
  const onTick = () => {
    clockRef.current = (performance.now() - t0.current) / 1000
    const now = performance.now()
    if (now - lastPanel.current > 120) {
      lastPanel.current = now
      bump()
    }
  }
  const heldNow = (): DriveCommand => {
    const c = commandOf(held.current)
    const act = actRef.current
    const left = leftRef.current
    const right = rightRef.current
    actRef.current = false
    leftRef.current = false
    rightRef.current = false
    return { ...c, act, left, right }
  }
  const fov = view === 'follow' || narrow ? FOV_NARROW : FOV_NORMAL

  const header = (
    <Panel title={TITLE} style={{ width: 310 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <TabBar tab={tab} onChange={setTab} />
        <StorageLine available={progress.storageAvailable} />
        <Note>
          Run seed <span style={{ fontFamily: 'var(--font-mono)' }}>{seed}</span>. It fixes every order, side, draw, history and arrangement in this lab. A new seed comes only with “Clear my saved results” on the Open tab.
        </Note>
        {drivingTab && (
          <>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>View</span>
              <Choice value={view} options={[{ id: 'eye', label: 'Eye view' }, { id: 'follow', label: 'Follow view' }]} onChange={(v) => setView(v as View)} />
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

  const ctx: PartContext = { seed, progress, store, view, fov, lowDetail, anim, clock, header, openTab: setTab }
  const mod = MODULES[tab]
  const CanvasPart = mod.Canvas
  const Bottom = mod.Bottom
  const stage: ReactNode = <mod.Stage ctx={ctx} />
  return (
    <SceneCanvasLayout
      canvas={
        <>
          <Canvas camera={{ position: [0, 4, 6], fov: 45, near: 0.01, far: 400 }} onContextMenu={(e) => e.preventDefault()} dpr={lowDetail ? 1 : [1, 1.5]} shadows={false}>
            {CanvasPart ? <CanvasPart ctx={ctx} /> : <color attach="background" args={['#0b1020']} />}
            <Stepper store={store} held={heldNow} onTick={onTick} />
          </Canvas>
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>{stage}</div>
        </>
      }
      left={
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <mod.Left ctx={ctx} />
        </div>
      }
      right={<mod.Right ctx={ctx} />}
      bottom={
        Bottom ? (
          <Bottom
            ctx={ctx}
            press={press}
            act={() => {
              actRef.current = true
            }}
            hand={(side) => {
              if (side === 0) leftRef.current = true
              else rightRef.current = true
            }}
          />
        ) : undefined
      }
    />
  )
}
