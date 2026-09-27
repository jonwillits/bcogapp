import { useReducer, useRef, useState } from 'react'
import { Panel } from '../../components/Panel'
import { Bench } from '../../sim/brain/bench'
import { randomSeed } from '../../sim/random'
import { TabBar, Note, type Tab } from './ui'
import { BenchTab } from './BenchTab'
import { PlanTab } from './PlanTab'
import { TreeTab } from './TreeTab'
import { SpecimensTab } from './SpecimensTab'

/**
 * Module 6's scene: Lab 6, One Plan, Many Brains. A satellite scene with no
 * creature in it — nothing from `src/sim/bilaterian/` is imported, and no
 * `<Canvas>`: everything is DOM and SVG, so nothing here needs motion to be
 * verified. Four tabs, one per activity: Specimens, Plan and Tree are Part 1,
 * the Bench is Part 2. Each tab is its own component and keeps its own state
 * while it is showing; the bench object and the seed live here.
 */

export const ABOUT_LINE =
  'About this scene: the brain model is schematic, drawn by one rule for every species. The photographs are real, and credited. Every bench result is labeled with where it comes from.'

export default function BrainScene() {
  const [tab, setTab] = useState<Tab>('specimens')
  const [seed, setSeed] = useState(() => randomSeed())
  const [, bump] = useReducer((x: number) => x + 1, 0)
  const benchRef = useRef<Bench | null>(null)
  if (!benchRef.current || benchRef.current.seed !== seed) benchRef.current = new Bench(seed)
  const bench = benchRef.current

  const header = (
    <Panel title="Lab 6: One Plan, Many Brains" style={{ width: 300 }}>
      <TabBar tab={tab} onChange={setTab} />
      <Note>{ABOUT_LINE}</Note>
      <Note>
        Run seed <span style={{ fontFamily: 'var(--font-mono)' }}>{seed}</span>. It fixes the specimen order and the bench’s numbers.
      </Note>
    </Panel>
  )

  if (tab === 'bench') return <BenchTab bench={bench} bump={bump} header={header} />
  if (tab === 'plan') return <PlanTab header={header} />
  if (tab === 'tree') return <TreeTab header={header} />
  return <SpecimensTab seed={seed} onNewSeed={() => setSeed(randomSeed())} header={header} />
}
