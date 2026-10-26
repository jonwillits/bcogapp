import { Panel } from '../../components/Panel'
import type { ProgressStore } from '../../sim/memory/progress/store'
import { Note, PANEL_STYLE, PART_TITLES, StagePanel } from './ui'
import type { PartModule, PartStore } from './contract'

/** Placeholder: Part Study is being built. */
export class StudyStore implements PartStore {
  version = 0
  private listeners = new Set<() => void>()
  readonly seed: number
  readonly progress: ProgressStore
  constructor(seed: number, progress: ProgressStore) {
    this.seed = seed
    this.progress = progress
  }
  subscribe(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
}

export const study: PartModule<StudyStore> = {
  createStore: (seed, progress) => new StudyStore(seed, progress),
  Left: ({ ctx }) => (
    <>
      {ctx.header}
      <Panel title={PART_TITLES.study} style={PANEL_STYLE}>
        <Note>Being built.</Note>
      </Panel>
    </>
  ),
  Stage: () => <StagePanel>Being built.</StagePanel>,
  Right: () => null,
}
