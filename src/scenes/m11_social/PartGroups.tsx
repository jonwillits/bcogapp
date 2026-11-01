import { Panel } from '../../components/Panel'
import type { PartModule } from './contract'
import { registerResults } from './Part0'
import { GroupsStore } from './groups/groupsStore'
import { GroupsLeft, GroupsStage } from './groups/screens'
import { CompactResults, GroupsReveal, GroupsRight } from './groups/Reveal'
import { Note, RIGHT_STYLE, useStore } from './ui'

/**
 * Part 5, Two Groups (spec §9): the store, the screens before the reveal,
 * and the reveal, mounted only once the unit is complete.
 */

function Stage({ ctx }: { ctx: { store: GroupsStore; progress: GroupsStore['progress']; seed: number } }) {
  const s = useStore(ctx.store)
  if (s.state === 'revealed') return <GroupsReveal progress={ctx.progress} seed={ctx.seed} />
  return <GroupsStage ctx={ctx as never} />
}

function Right({ ctx }: { ctx: { store: GroupsStore; progress: GroupsStore['progress']; seed: number } }) {
  const s = useStore(ctx.store)
  if (s.state === 'revealed') return <GroupsRight progress={ctx.progress} seed={ctx.seed} />
  return (
    <Panel title="My results" style={RIGHT_STYLE}>
      <Note>The results appear here once both groups are judged.</Note>
    </Panel>
  )
}

export { GroupsStore }

export const groups: PartModule<GroupsStore> = {
  createStore: (seed, progress) => {
    registerResults(5, (p) => <CompactResults progress={p} seed={p.seed} />)
    return new GroupsStore(seed, progress)
  },
  Left: GroupsLeft,
  Stage,
  Right,
  Results: ({ ctx }) => <CompactResults progress={ctx.progress} seed={ctx.seed} />,
}
