import type { PartModule } from './contract'
import { registerResults } from './Part0'
import { PartnersStore } from './partners/partnersStore'
import { PartnersLeft, PartnersRightBefore, PartnersStage } from './partners/screens'
import { CompactResults, PartnersReveal, PartnersRight } from './partners/Reveal'
import { useStore } from './ui'

/**
 * Part 1, Six Partners (spec §5): the store, the screens before the
 * reveal, and the reveal. The reveal is mounted only once the store is
 * `'revealed'`, so none of its strings is in the markup before then.
 */

function Stage({ ctx }: { ctx: { store: PartnersStore; progress: PartnersStore['progress']; seed: number } }) {
  const s = useStore(ctx.store)
  if (s.state === 'revealed') return <PartnersReveal progress={ctx.progress} seed={ctx.seed} />
  return <PartnersStage ctx={ctx as never} />
}

function Right({ ctx }: { ctx: { store: PartnersStore; progress: PartnersStore['progress']; seed: number } }) {
  const s = useStore(ctx.store)
  if (s.state === 'revealed') return <PartnersRight progress={ctx.progress} seed={ctx.seed} />
  return <PartnersRightBefore store={ctx.store} />
}

export { PartnersStore }

export const partners: PartModule<PartnersStore> = {
  createStore: (seed, progress) => {
    registerResults(1, (p) => <CompactResults progress={p} seed={p.seed} />)
    return new PartnersStore(seed, progress)
  },
  Left: PartnersLeft,
  Stage,
  Right,
  Results: ({ ctx }) => <CompactResults progress={ctx.progress} seed={ctx.seed} />,
}
