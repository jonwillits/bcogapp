import { useMemo, useRef, useState, type ReactNode } from 'react'
import { Panel } from '../../components/Panel'
import { SceneCanvasLayout } from '../../components/SceneCanvasLayout'
import { makeRng } from '../../sim/random'
import { ProgressStore } from '../../sim/language/progress/store'
import { Note, PANEL_STYLE, TabBar, type Tab } from './ui'
import { useStore } from './ui'
import type { PartContext, PartModule, PartStore } from './contract'
import { StorageLine } from '../m10_memory/progress/StorageLine'
import { open } from './Part0'
import { sounds } from './PartSounds'
import { stream } from './PartStream'
import { words } from './PartWords'
import { predictors } from './PartPredictors'

/**
 * Module 13's scene: Lab 13, Sounds, Words, and Predictions. The student is
 * the listener in Part 1, the learner in Parts 2 and 3, and the experimenter
 * on models in Parts 1 to 4. No creature, no 3D world (decision 2): the
 * view behind the three floating columns is a plain dark field, and the
 * parts draw what they show in the columns and on the stage.
 *
 * Progress is saved on the student's own device under one storage key
 * (`src/sim/language/progress/`, on Lab 10's layer). Every part, and every
 * step within a part, opens at any time: there are no locks. Commit, then
 * reveal, on every tested surface.
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

  const header = (
    <Panel title={TITLE} style={PANEL_STYLE}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <TabBar tab={tab} onChange={setTab} />
        <StorageLine available={progress.storageAvailable} />
        <Note>
          Run seed <span style={{ fontFamily: 'var(--font-mono)' }}>{seed}</span>. It fixes every order, stream, pairing, draw, and tie in this lab. A new seed comes only with “Clear my saved results” on the Open tab.
        </Note>
      </div>
    </Panel>
  )

  const ctx: PartContext = { seed, progress, store, anim, header, openTab: setTab }
  const mod = MODULES[tab]
  const stage: ReactNode = <mod.Stage ctx={ctx} />
  return (
    <SceneCanvasLayout
      canvas={
        <>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 40%, #121a2a 0%, #0b1020 70%)' }} />
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>{stage}</div>
        </>
      }
      left={
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <mod.Left ctx={ctx} />
        </div>
      }
      right={<mod.Right ctx={ctx} />}
    />
  )
}
