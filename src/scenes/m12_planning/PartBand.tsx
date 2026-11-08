import { Panel } from '../../components/Panel'
import { Note, PANEL_STYLE, PART_TITLES } from './ui'
import type { PartContext, PartModule, PartStore } from './contract'

/** Part 3 — What They Carried. Built in a later step of the order of work (spec §13). */
class BandStore implements PartStore {
  version = 0
  private listeners = new Set<() => void>()
  subscribe(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
}

function Left({ ctx }: { ctx: PartContext<BandStore> }) {
  return (
    <>
      {ctx.header}
      <Panel title={PART_TITLES.band} style={PANEL_STYLE}>
        <Note>This part is being built.</Note>
      </Panel>
    </>
  )
}

export const band: PartModule<BandStore> = {
  createStore: () => new BandStore(),
  Left,
  Stage: () => null,
  Right: () => null,
}
