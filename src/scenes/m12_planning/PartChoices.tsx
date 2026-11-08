import { Panel } from '../../components/Panel'
import { Note, PANEL_STYLE, PART_TITLES } from './ui'
import type { PartContext, PartModule, PartStore } from './contract'

/** Part 1 — Choices. Built in a later step of the order of work (spec §13). */
class ChoicesStore implements PartStore {
  version = 0
  private listeners = new Set<() => void>()
  subscribe(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
}

function Left({ ctx }: { ctx: PartContext<ChoicesStore> }) {
  return (
    <>
      {ctx.header}
      <Panel title={PART_TITLES.choices} style={PANEL_STYLE}>
        <Note>This part is being built.</Note>
      </Panel>
    </>
  )
}

export const choices: PartModule<ChoicesStore> = {
  createStore: () => new ChoicesStore(),
  Left,
  Stage: () => null,
  Right: () => null,
}
