import { Panel } from '../../components/Panel'
import type { PartModule, PartStore } from './contract'
import { Note, PANEL_STYLE, PART_TITLES, StagePanel } from './ui'

/** Placeholder while Part Shapes is built. */
class Store implements PartStore {
  version = 0
  subscribe(): () => void {
    return () => {}
  }
}
export const shapes: PartModule<Store> = {
  createStore: () => new Store(),
  Left: ({ ctx }) => (
    <>
      {ctx.header}
      <Panel title={PART_TITLES.shapes} style={PANEL_STYLE}>
        <Note>Being built.</Note>
      </Panel>
    </>
  ),
  Stage: () => <StagePanel>Being built.</StagePanel>,
  Right: () => null,
}
