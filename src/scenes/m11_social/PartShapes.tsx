import { Panel } from '../../components/Panel'
import type { PartModule } from './contract'
import { registerResults } from './Part0'
import { ShapesStore } from './shapes/shapesStore'
import { ShapesLeft, ShapesStage } from './shapes/screens'
import { CompactResults, ShapesReveal, ShapesRight } from './shapes/Reveal'
import { Note, RIGHT_STYLE, useStore } from './ui'

/**
 * Part 3, Shapes and Paths (spec §7): the store, the screens before the
 * reveal, and the reveal, mounted only once the store is `'revealed'`.
 */

function Stage({ ctx }: { ctx: { store: ShapesStore; progress: ShapesStore['progress'] } }) {
  const s = useStore(ctx.store)
  if (s.state === 'revealed') return <ShapesReveal progress={ctx.progress} />
  return <ShapesStage ctx={ctx as never} />
}

function Right({ ctx }: { ctx: { store: ShapesStore; progress: ShapesStore['progress'] } }) {
  const s = useStore(ctx.store)
  if (s.state === 'revealed') return <ShapesRight progress={ctx.progress} />
  return (
    <Panel title="My results" style={RIGHT_STYLE}>
      <Note>The results of both steps appear here once Step 2 is finished and your prediction about the two procedures is committed.</Note>
    </Panel>
  )
}

export { ShapesStore }

export const shapes: PartModule<ShapesStore> = {
  createStore: (seed, progress) => {
    registerResults(3, (p) => <CompactResults progress={p} />)
    return new ShapesStore(seed, progress)
  },
  Left: ShapesLeft,
  Stage,
  Right,
  Results: ({ ctx }) => <CompactResults progress={ctx.progress} />,
}
