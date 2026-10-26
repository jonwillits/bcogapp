import type { ProgressStore } from '../../sim/memory/progress/store'
import type { PartModule } from './contract'
import { registerResults } from './Part0'
import { ListsStore } from './lists/listsStore'
import { ListsLeft, ListsStage } from './lists/screens'
import { CompactResults, ListsReveal, ListsRight } from './lists/Reveal'
import { useStore } from './ui'

/**
 * Part 1, Lists of Words (spec §5): the store, the screens before the
 * reveal, and the reveal. The reveal is mounted only once the store is
 * `'revealed'`, so none of its strings is in the markup before then.
 */

function Stage({ ctx }: { ctx: { store: ListsStore; progress: ProgressStore } }) {
  const s = useStore(ctx.store)
  if (s.state === 'revealed') return <ListsReveal progress={ctx.progress} />
  return <ListsStage ctx={ctx as never} />
}

function Right({ ctx }: { ctx: { store: ListsStore; progress: ProgressStore } }) {
  useStore(ctx.store)
  return <ListsRight progress={ctx.progress} />
}

registerResults(1, (progress) => <CompactResults progress={progress} />)

export { ListsStore }

export const lists: PartModule<ListsStore> = {
  createStore: (seed, progress) => new ListsStore(seed, progress),
  Left: ListsLeft,
  Stage,
  Right,
  Results: ({ ctx }) => <CompactResults progress={ctx.progress} />,
}
