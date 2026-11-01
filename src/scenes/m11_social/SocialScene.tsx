import { useMemo, useReducer, useRef, useState, type ReactNode } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Panel } from '../../components/Panel'
import { SceneCanvasLayout } from '../../components/SceneCanvasLayout'
import { makeRng } from '../../sim/random'
import { ProgressStore } from '../../sim/social/progress/store'
import type { Part } from '../../sim/social/parts'
import { Btn, Note, TabBar, LockedPanel, PART_TITLES, type Tab } from './ui'
import { useStore } from './ui'
import { DT, type PartContext, type PartModule, type PartStore } from './contract'
import { StorageLine } from '../m10_memory/progress/StorageLine'
import { open } from './Part0'
import { partners } from './PartPartners'
import { tournament } from './PartTournament'
import { shapes } from './PartShapes'
import { arena } from './PartArena'
import { groups } from './PartGroups'
import { mirror } from './PartMirror'

/**
 * Module 11's scene: Lab 11, Living Among Others. The student is the
 * subject in Parts 1, 3 and 5 (a player against hidden partners, a viewer
 * of moving shapes and paths, a judge of the members of two groups), the
 * experimenter in Parts 2 and 4 (tournaments and populations of rules;
 * hidden chimpanzees in an arena), and the animal in Part 6 (a macaque
 * with two premotor cells on screen). The sixth installment of the
 * creature spine, and the first whose animal has hands.
 *
 * Progress is saved on the student's own device under one storage key
 * (`src/sim/social/progress/`, on Lab 10's layer), and every experiment is
 * made of units: a completed unit is never redone, an interrupted one
 * restarts as its screen says. Commit, then reveal, on every tested
 * surface.
 */

const TAB_PART: Record<Tab, Part> = { open: 0, partners: 1, tournament: 2, shapes: 3, arena: 4, groups: 5, mirror: 6 }

// Each module is typed to its own store; the shell holds them as the base type.
const MODULES: Record<Tab, PartModule<PartStore>> = {
  open: open as unknown as PartModule<PartStore>,
  partners: partners as unknown as PartModule<PartStore>,
  tournament: tournament as unknown as PartModule<PartStore>,
  shapes: shapes as unknown as PartModule<PartStore>,
  arena: arena as unknown as PartModule<PartStore>,
  groups: groups as unknown as PartModule<PartStore>,
  mirror: mirror as unknown as PartModule<PartStore>,
}

const MAX_STEPS_PER_FRAME = 6

/** The frame loop: fixed steps of the active part's store, capped so a tab returning from the background does not try to catch up. */
function Stepper({ store, onTick }: { store: PartStore; onTick: () => void }) {
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
      store.tick(DT)
    }
    if (any) onTick()
  })
  return null
}

export const TITLE = 'Lab 11: Living Among Others'

export default function SocialScene() {
  const [tab, setTab] = useState<Tab>('open')
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
  const anim = useMemo(() => makeRng(seed ^ 0x50c1a1), [seed])
  const clockRef = useRef(0)
  const t0 = useRef(performance.now())
  const clock = () => clockRef.current
  const store = storeFor(tab)
  const lastPanel = useRef(0)
  const onTick = () => {
    clockRef.current = (performance.now() - t0.current) / 1000
    const now = performance.now()
    if (now - lastPanel.current > 120) {
      lastPanel.current = now
      bump()
    }
  }
  // `?dev=1` opens every part, for the walk; students see the locks.
  const dev = typeof location !== 'undefined' && new URLSearchParams(location.search).has('dev')
  const locked: Partial<Record<Tab, string | null>> = {}
  for (const t of Object.keys(TAB_PART) as Tab[]) locked[t] = dev ? null : progress.lockReason(TAB_PART[t])

  const header = (
    <Panel title={TITLE} style={{ width: 310 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <TabBar tab={tab} onChange={setTab} locked={locked} />
        <StorageLine available={progress.storageAvailable} />
        <Note>
          Run seed <span style={{ fontFamily: 'var(--font-mono)' }}>{seed}</span>. It fixes which partner has which rule, every match’s length, every order and every draw. A new seed comes with “Clear my saved results” on the Open tab.
        </Note>
      </div>
    </Panel>
  )

  const ctx: PartContext = { seed, progress, store, anim, clock, header, openTab: setTab }
  const mod = MODULES[tab]
  const lockedReason = locked[tab]
  const CanvasPart = mod.Canvas
  const stage: ReactNode = lockedReason ? (
    <LockedPanel title={PART_TITLES[tab]} reason={lockedReason}>
      {tab === 'tournament' && <SkipPart1 progress={progress} />}
    </LockedPanel>
  ) : (
    <mod.Stage ctx={ctx} />
  )
  return (
    <SceneCanvasLayout
      canvas={
        <>
          <Canvas camera={{ position: [0, 1.6, 2.4], fov: 45, near: 0.01, far: 100 }} onContextMenu={(e) => e.preventDefault()} dpr={[1, 1.5]} shadows={false}>
            {!lockedReason && CanvasPart ? <CanvasPart ctx={ctx} /> : <color attach="background" args={['#0b1020']} />}
            <Stepper store={store} onTick={onTick} />
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
    />
  )
}

/** The way into Part 2 for a student whose Part 1 is lost (§4.2): Part 1 then stays locked for this seed. */
export function SkipPart1({ progress }: { progress: ProgressStore }) {
  const p = useStore(progress)
  const [confirming, setConfirming] = useState(false)
  if (p.partComplete(1) || p.part1Skipped) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }} data-skip-part1>
      <Note>If your Part 1 is lost, or you have been told to skip it: “Skip Part 1” opens Part 2 now. Part 1 then stays closed for this seed, because Part 2 names the rules Part 1 hides.</Note>
      {!confirming ? (
        <div>
          <Btn onClick={() => setConfirming(true)}>Skip Part 1</Btn>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 6 }} data-confirm-skip>
          <Btn primary onClick={() => p.skipPart1()}>
            Skip Part 1 and open Part 2
          </Btn>
          <Btn onClick={() => setConfirming(false)}>Keep Part 1</Btn>
        </div>
      )}
    </div>
  )
}
