import { Panel } from '../../components/Panel'
import { Note, PANEL_STYLE, PART_TITLES } from './ui'
import type { PartContext, PartModule, PartStore } from './contract'

/** Part 2 — Puzzles. Built in a later step of the order of work (spec §13). */
class PuzzlesStore implements PartStore {
  version = 0
  private listeners = new Set<() => void>()
  subscribe(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
}

function Left({ ctx }: { ctx: PartContext<PuzzlesStore> }) {
  return (
    <>
      {ctx.header}
      <Panel title={PART_TITLES.puzzles} style={PANEL_STYLE}>
        <Note>This part is being built.</Note>
      </Panel>
    </>
  )
}

export const puzzles: PartModule<PuzzlesStore> = {
  createStore: () => new PuzzlesStore(),
  Left,
  Stage: () => null,
  Right: () => null,
}
