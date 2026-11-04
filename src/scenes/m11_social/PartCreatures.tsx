import { useEffect } from 'react'
import { Panel } from '../../components/Panel'
import type { ProgressStore } from '../../sim/social/progress/store'
import type { PartModule } from './contract'
import { registerResults } from './Part0'
import { CreaturesStore } from './creatures/store'
import { MemoryTestScreen, Round1Intro, ROUND1_TRAINING, TrainingScreen } from './creatures/round1'
import { PredictScreen, Round2Intro, SortScreen, SurpriseScreen, round2Training } from './creatures/later'
import { CompactResults, CreaturesReveal, CreaturesRight } from './creatures/Reveal'
import { FixedLines, Note, PANEL_STYLE, PART_TITLES, RIGHT_STYLE, useStore } from './ui'

/**
 * Part 5, Two Rounds (PART5_REDESIGN_2026-11-04.md): the store, the
 * screens, and the reveal. The left panel carries the round and the
 * count; the stage carries the screen; the right panel the results once
 * the predictions are committed. Keys 1 and 2 press the left and the
 * right button of the screen in hand.
 */

type Ctx = { store: CreaturesStore; header: React.ReactNode; progress: ProgressStore; seed: number }

const roundLabel = (s: CreaturesStore) => `Round ${s.round + 1} of 2`

function Left({ ctx }: { ctx: Ctx }) {
  const s = useStore(ctx.store)
  const lines = (() => {
    switch (s.phase) {
      case 'train':
        return [roundLabel(s), `showing ${String(s.trial + 1).padStart(2)} of ${s.materials.training.length}`]
      case 'memory':
        return [roundLabel(s), `question ${String(s.memoryIndex + 1).padStart(2)} of ${s.materials.memoryOrder.length}`]
      case 'surprise':
        return [roundLabel(s), 'one more thing']
      case 'second':
        return [roundLabel(s), `question ${String(s.secondIndex + 1).padStart(2)} of ${s.materials.secondOrder.length}`]
      case 'intro':
        return ['Round 1 of 2', ' ']
      case 'between':
        return ['Round 2 of 2', ' ']
      case 'predict':
        return ['Both rounds finished', 'three predictions']
      case 'revealed':
        return ['Finished', ' ']
    }
  })()
  return (
    <>
      {ctx.header}
      <Panel title={PART_TITLES.creatures} style={PANEL_STYLE}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <FixedLines lines={lines} testId="creatures-status" />
          {(s.phase === 'intro' || s.phase === 'between') && <Note>What will happen is described over the view. Press “Begin” there.</Note>}
          {(s.phase === 'train' || s.phase === 'memory' || s.phase === 'surprise' || s.phase === 'second') && <Note>This round is in progress. Leaving now would mean starting the round again with other members.</Note>}
          {s.phase === 'predict' && <Note>Make your three predictions over the view and commit them. The results follow.</Note>}
          {s.phase === 'revealed' && <Note>The results are over the view, with the rows for the report on the right.</Note>}
        </div>
      </Panel>
    </>
  )
}

function Stage({ ctx }: { ctx: Ctx }) {
  const s = useStore(ctx.store)
  // Keys 1 and 2 press the left and the right button of the screen in hand.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '1' && e.key !== '2') return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT')) return
      const stage = document.querySelector('[data-stage] [data-choice]')
      const buttons = stage ? Array.from(stage.querySelectorAll<HTMLButtonElement>('button')) : []
      const b = buttons[e.key === '1' ? 0 : 1]
      if (b && !b.disabled) {
        e.preventDefault()
        b.click()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  switch (s.phase) {
    case 'intro':
      return <Round1Intro s={s} />
    case 'train':
      return <TrainingScreen store={ctx.store} words={s.round === 0 ? ROUND1_TRAINING : round2Training(s.materials.names)} roundLabel={roundLabel(s)} />
    case 'memory':
      return <MemoryTestScreen store={ctx.store} roundLabel={roundLabel(s)} />
    case 'surprise':
      return <SurpriseScreen s={s} />
    case 'second':
      return <SortScreen store={ctx.store} roundLabel={roundLabel(s)} />
    case 'between':
      return <Round2Intro s={s} />
    case 'predict':
      return <PredictScreen store={ctx.store} />
    case 'revealed':
      return <CreaturesReveal store={ctx.store} />
  }
}

function Right({ ctx }: { ctx: Ctx }) {
  const s = useStore(ctx.store)
  if (s.phase === 'revealed') return <CreaturesRight store={ctx.store} />
  return (
    <Panel title="My results" style={RIGHT_STYLE}>
      <Note>The results of both rounds appear here once both are finished and your three predictions are committed.</Note>
    </Panel>
  )
}

export { CreaturesStore }

const stores = new WeakMap<ProgressStore, CreaturesStore>()

export const creatures: PartModule<CreaturesStore> = {
  createStore: (seed, progress) => {
    const store = new CreaturesStore(seed, progress)
    stores.set(progress, store)
    registerResults(5, (p) => {
      const st = stores.get(p) ?? new CreaturesStore(p.seed, p)
      return <CompactResults store={st} />
    })
    return store
  },
  Left,
  Stage,
  Right,
  Results: ({ ctx }) => <CompactResults store={ctx.store} />,
}
