import { Panel } from '../../components/Panel'
import type { PartModule, PartStore } from './contract'
import { Note, PANEL_STYLE, PART_TITLES, StagePanel } from './ui'

/** Placeholder while Part Mirror is built. */
class Store implements PartStore {
  version = 0
  subscribe(): () => void {
    return () => {}
  }
}
export const mirror: PartModule<Store> = {
  createStore: () => new Store(),
  Left: ({ ctx }) => (
    <>
      {ctx.header}
      <Panel title={PART_TITLES.mirror} style={PANEL_STYLE}>
        <Note>Being built.</Note>
      </Panel>
    </>
  ),
  Stage: () => <StagePanel>Being built.</StagePanel>,
  Right: () => null,
}
