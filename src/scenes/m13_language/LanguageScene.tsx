import { useMemo, useRef, useState } from 'react'
import { Panel } from '../../components/Panel'
import { ProgressStore } from '../../sim/language/progress/store'
import { makeRng } from '../../sim/random'
import { StorageLine } from '../m10_memory/progress/StorageLine'
import { Note, PANEL_STYLE, TabBar, type Tab } from './ui'
import { ColumnsLayout } from './ColumnsLayout'
import { MainPanel, type MainTab } from './MainPanel'
import { AllResults } from './AllResults'
import { StepStore } from './steps'
import { switchDialog, type Busy, type SwitchTarget } from './switching'
import { useStore } from '../m09_rat/useStore'
import type { PartContext, PartModule, PartStore } from './contract'
import { open } from './Part0'
import { sounds } from './PartSounds'
import { stream } from './PartStream'
import { words } from './PartWords'
import { predictors } from './PartPredictors'

/**
 * Module 13's scene: Lab 13, Sounds, Words, and Predictions. The student is
 * the listener in Part 1, the learner in Parts 2 and 3, and the experimenter
 * on models in Parts 1 to 4. No creature, no 3D world (decision 2): the
 * view behind the two panels is a plain dark field. Progress is saved on
 * the student's own device under one storage key
 * (`src/sim/language/progress/`, on Lab 10's layer). Every part, and every
 * step within a part, opens at any time: there are no locks. Commit, then
 * reveal, on every tested surface.
 *
 * Five tabs over one field: Part 0 (Open), then four parts. The shell owns the progress store, the seed, one
 * store per part (kept across tab changes, so a run keeps going), the
 * navigation panel and the main panel with its two tabs (Jon, 2026-11-18),
 * and the switch guard: a press that would leave a step with something
 * under way (the All Results tab, another part's tab, another step) asks
 * first, in an in-page dialog, and applies the consequence `params.yaml`
 * gives before it goes. The parts are modules with the contract in
 * `contract.ts`; the shell never reaches into a part's store.
 */

/** The lab's title, in one place: Jon has not chosen it finally (spec §15, question 1). */
export const LAB_NUMBER = 13
export const LAB_TITLE_WORDS = 'Sounds, Words, and Predictions'
export const TITLE = `Lab ${LAB_NUMBER}: ${LAB_TITLE_WORDS}`

// Each module is typed to its own store; the shell holds them as the base type.

const MODULES: Record<Tab, PartModule<PartStore>> = {
  open: open as unknown as PartModule<PartStore>,
  sounds: sounds as unknown as PartModule<PartStore>,
  stream: stream as unknown as PartModule<PartStore>,
  words: words as unknown as PartModule<PartStore>,
  predictors: predictors as unknown as PartModule<PartStore>,
}

export default function LanguageScene() {
  const [tab, setTab] = useState<Tab>('open')
  const [mainTab, setMainTab] = useState<MainTab>('current')
  const [pending, setPending] = useState<{ target: SwitchTarget; busy: Busy } | null>(null)
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
  const anim = useMemo(() => makeRng(seed ^ 0x13a0c3), [seed])
  const store = storeFor(tab)

  // ------------------------------------------------------ the switch guard
  const perform = (target: SwitchTarget) => {
    if (target.kind === 'results') setMainTab('results')
    else if (target.kind === 'tab') {
      setTab(target.tab)
      setMainTab('current')
    } else {
      if (store instanceof StepStore) store.open(target.step)
      setMainTab('current')
    }
  }
  /** A press that leaves the current step: free when nothing is under way or the step is not on view; otherwise the dialog first. */
  const request = (target: SwitchTarget) => {
    const busy = mainTab === 'current' && store instanceof StepStore ? store.busy() : null
    if (!busy) perform(target)
    else setPending({ target, busy })
  }
  const confirm = () => {
    if (!pending) return
    if (store instanceof StepStore) store.leave(pending.busy)
    setPending(null)
    perform(pending.target)
  }
  /** From the All Results tab: open a part's step on the current-part tab. Nothing is on view to leave. */
  const goFromResults = (t: Tab, step: number) => {
    const st = storeFor(t)
    if (st instanceof StepStore) st.open(step)
    setTab(t)
    setMainTab('current')
  }

  const header = (
    <Panel title={TITLE} style={PANEL_STYLE}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <TabBar tab={tab} onChange={(t) => (t === tab ? setMainTab('current') : request({ kind: 'tab', tab: t }))} />
        <StorageLine available={progress.storageAvailable} />
        <Note>
          Run seed <span style={{ fontFamily: 'var(--font-mono)' }}>{seed}</span>. It fixes every order, stream, pairing, draw, and tie in this lab. A new seed comes only with “Clear my saved results” on the Open tab.
        </Note>
      </div>
    </Panel>
  )

  const ctx: PartContext = { seed, progress, store, anim, header, openTab: (t) => request({ kind: 'tab', tab: t }), openStep: (step) => request({ kind: 'step', step }) }
  const mod = MODULES[tab]
  return (
    <ColumnsLayout
      canvas={<div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 40%, #121a2a 0%, #0b1020 70%)' }} />}
      nav={
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <mod.Nav ctx={ctx} />
        </div>
      }
      main={
        <MainPanel
          tab={mainTab}
          onTab={(t) => (t === 'results' ? request({ kind: 'results' }) : setMainTab('current'))}
          current={<mod.Stage ctx={ctx} />}
          results={<AllResults progress={progress} go={goFromResults} />}
          dialog={pending ? { ...switchDialog(pending.target, pending.busy), onConfirm: confirm, onCancel: () => setPending(null) } : null}
        />
      }
    />
  )
}
