import { Panel } from '../../components/Panel'
import { Note, PANEL_STYLE, PART_TITLES } from './ui'
import type { PartContext, PartModule, PartStore } from './contract'

/** Part 4 — Two Trays. Built in a later step of the order of work (spec §13). */
class CornStore implements PartStore {
  version = 0
  private listeners = new Set<() => void>()
  subscribe(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
}

function Left({ ctx }: { ctx: PartContext<CornStore> }) {
  return (
    <>
      {ctx.header}
      <Panel title={PART_TITLES.corn} style={PANEL_STYLE}>
        <Note>This part is being built.</Note>
      </Panel>
    </>
  )
}

export const corn: PartModule<CornStore> = {
  createStore: () => new CornStore(),
  Left,
  Stage: () => null,
  Right: () => null,
}
