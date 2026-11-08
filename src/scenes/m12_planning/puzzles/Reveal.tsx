import type { ProgressStore } from '../../../sim/planning/progress/store'
import { stateGraph, arrangementOf, PEG_LABEL } from '../../../sim/planning/puzzles/hanoi'
import { shortestMoves } from '../../../sim/planning/puzzles/procedures'
import { bestPath, bestThrough, LARGE_LOSS, stepOf, type Tree } from '../../../sim/planning/puzzles/trees'
import { lookedBelowAfter, LOOKER_IDS, LOOKER_LABEL, LOOKER_RULE } from '../../../sim/planning/puzzles/lookers'
import { reference } from '../../../sim/planning/references'
import { ReferencePanel } from '../ReferencePanel'
import { LONG_PAUSE_LINE, NOT_OPTIMAL_LINE, DIFFERENT_TASK_LINE, RESTARTED_LINE } from '../lines'
import { Content, FixedLines, GroupLabel, Note, Para, Section } from '../ui'
import { TOWER_UNIT, TREES_UNIT, type TowerResult, type TreesResult, type TreeRecord } from './store'
import { StateGraphView, GRAPH_LEGEND } from './Views'

/**
 * Part 2's reveals (spec §6.2, §6.4): the tower's reveal once both puzzles
 * are solved, the trees' reveal once the last path is taken. Each says what
 * every mark and number is and how it was computed. Nothing before the
 * trees' reveal names what Step 3 tests (`naming.test.ts`).
 */

/** A long pause: a time before a move of more than twice the student's median time between moves (spec §6.2). */
export function longPauses(r: TowerResult): number[] {
  const gaps = r.times.map((t, i) => (i === 0 ? t : t - r.times[i - 1]))
  const sorted = [...gaps].sort((a, b) => a - b)
  const median = sorted.length ? (sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2) : 0
  // The pause before move i happened at the node before it: path[i].
  return gaps.map((g, i) => (g > 2 * median && median > 0 ? r.path[i] : -1)).filter((id) => id >= 0)
}

export function TowerReveal({ progress }: { progress: ProgressStore }) {
  const three = progress.isComplete(TOWER_UNIT(3)) ? (progress.result(TOWER_UNIT(3)) as TowerResult) : null
  const four = progress.isComplete(TOWER_UNIT(4)) ? (progress.result(TOWER_UNIT(4)) as TowerResult) : null
  if (!three || !four) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }} data-reveal="tower">
      {(three.restarts > 0 || four.restarts > 0) && <Content>{RESTARTED_LINE}</Content>}
      <Section n={1} title="The state graph of each puzzle, with your own path drawn over it">
        <Para>{GRAPH_LEGEND}</Para>
        <Content>{LONG_PAUSE_LINE}</Content>
        {[three, four].map((r) => (
          <div key={r.disks} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <GroupLabel>
              {r.disks} disks: {3 ** r.disks} arrangements, {shortestMoves(r.disks)} moves in the shortest solution
            </GroupLabel>
            <StateGraphView disks={r.disks} path={r.path} pauses={longPauses(r)} width={r.disks === 3 ? 340 : 420} />
          </div>
        ))}
      </Section>
      <Section n={2} title="The counts">
        <Para>Moves is how many legal moves you made, against the shortest solution’s count. Nodes visited is how many different arrangements your path passed through. Moves off the shortest path is how many of your moves took you to an arrangement that is not on the shortest solution. Attempted moves that were not legal were refused and did not change the disks. Time is in seconds from “Begin” on that puzzle.</Para>
        <FixedLines
          lines={[`${''.padEnd(34)}${'3 disks'.padStart(10)}${'4 disks'.padStart(10)}`, ...countRows(three, four)]}
          testId="tower-counts"
        />
      </Section>
      <Section n={3} title="The halfway node of the four-disk puzzle">
        <Para>
          The halfway node is the arrangement with the three smaller disks stacked on the middle peg and the largest disk still on the left. Every shortest solution of four disks passes through it, because the largest disk can move from the left peg to the right only when the other three are all out of its way on the middle peg. Your path {four.path.includes(stateGraph(4).halfway!) ? 'passed through it' : 'did not pass through it'}. The graph of four disks is three smaller triangles of 27 arrangements each, one for each peg the largest disk can be on: your path spent {trianglesSpent(four)} of its moves in the triangle where the largest disk is on the left, the middle, and the right, in that order.
        </Para>
      </Section>
      <Section n={4} title="The problem space, named">
        <Para>
          A problem space is the set of states a problem can be in, as the solver represents them, with a starting state, a goal, and moves that lead from one state to another (§12.2.2). For this puzzle the states are the arrangements of the disks, the start is every disk on the left peg, the goal is every disk on the right peg, and a move is moving the top disk of one peg to another. With n disks there are 3ⁿ arrangements, because each disk can be on any of three pegs, and the shortest solution takes 2ⁿ − 1 moves (Simon, 1975, p. 269): 27 arrangements and 7 moves for three disks, 81 and 15 for four. Search is trying sequences of moves in a problem space to find one that reaches the goal; the graph above is the whole space, and your path is one search through it.
        </Para>
        <ReferencePanel reference={reference('hanoi-counts')} />
      </Section>
    </div>
  )
}

function countRows(a: TowerResult, b: TowerResult): string[] {
  const off = (r: TowerResult) => {
    const sp = new Set(stateGraph(r.disks).shortest)
    return r.path.slice(1).filter((id) => !sp.has(id)).length
  }
  const row = (label: string, f: (r: TowerResult) => string) => `${label.padEnd(34)}${f(a).padStart(10)}${f(b).padStart(10)}`
  return [
    row('moves', (r) => String(r.moves.length)),
    row('shortest solution', (r) => String(shortestMoves(r.disks))),
    row('nodes visited', (r) => String(new Set(r.path).size)),
    row('moves off the shortest path', (r) => String(off(r))),
    row('attempted moves not legal', (r) => String(r.illegalAttempts)),
    row('seconds before the first move', (r) => r.firstMoveSeconds.toFixed(1)),
    row('total seconds', (r) => r.totalSeconds.toFixed(1)),
  ]
}

function trianglesSpent(r: TowerResult): string {
  const counts = [0, 0, 0]
  for (const id of r.path.slice(1)) counts[arrangementOf(id, 4)[3]]++
  return `${counts[0]}, ${counts[1]} and ${counts[2]}`
}

export function TreesReveal({ progress }: { progress: ProgressStore }) {
  if (!progress.isComplete(TREES_UNIT)) return null
  const r = progress.result(TREES_UNIT) as TreesResult
  const scored = r.records.filter((x) => x.scored)
  const total = scored.reduce((s, x) => s + x.net, 0)
  const lookerTotal = (id: (typeof LOOKER_IDS)[number]) => r.lookers[id].reduce((s, x) => s + x.net, 0)
  const clicksPer = (recs: { looks: number[] }[]) => (recs.length ? recs.reduce((s, x) => s + x.looks.length, 0) / recs.length : 0)
  const loss = scored.filter((x) => x.tree.lossNode !== null)
  const regular = scored.filter((x) => x.tree.lossNode === null)
  const belowAfterLoss = shareBelow(loss, (rec) => rec.tree.lossNode!)
  const smallLossAt1 = (rec: TreeRecord) => rec.looks.find((n) => stepOf(n) === 1 && (rec.tree.values[n] === -10 || rec.tree.values[n] === -5))
  const belowAfterSmall = shareBelow(regular.filter((rec) => smallLossAt1(rec) !== undefined), (rec) => smallLossAt1(rec)!)
  const lossBest = scored.filter((x) => x.tree.kind === 'lossBest')
  const missed = lossBest.reduce((s, x) => s + (bestPath(x.tree).value - x.path.reduce((a, n) => a + x.tree.values[n], 0)), 0)
  const myopicOnLossBest = r.lookers.oneMore.filter((_, i) => scored[i].tree.kind === 'lossBest')
  const myopicMissed = myopicOnLossBest.reduce((s, run, k) => s + (bestPath(lossBest[k].tree).value - run.path.reduce((a, n) => a + lossBest[k].tree.values[n], 0)), 0)
  const myopicBelow = shareBelow(
    r.lookers.oneMore.map((run, i) => ({ tree: scored[i].tree, looks: run.looks, path: run.path, net: run.net, scored: true })).filter((x) => x.tree.lossNode !== null),
    (rec) => rec.tree.lossNode!,
  )
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }} data-reveal="trees">
      {r.restarts > 0 && <Content>{RESTARTED_LINE}</Content>}
      <Section n={1} title="Every scored tree">
        <Para>Each row is one of your 16 scored trees, in the order you saw them: its kind (regular, or with a large loss of {LARGE_LOSS} at a first-step node), the nodes you uncovered in the order you clicked them (numbered 1 and 2 at the first step, 3 to 6 at the second, 7 to 14 at the third), the path you took as its three node numbers, the points you earned (the path’s sum minus the clicks), and the best path’s sum. Where the best path ran through the large loss, the kind says so.</Para>
        <FixedLines lines={[`${'tree'.padEnd(5)}${'kind'.padEnd(22)}${'uncovered, in order'.padEnd(30)}${'path'.padEnd(12)}${'points'.padStart(7)}${'best'.padStart(6)}`, ...scored.map((x, i) => `${String(i + 1).padEnd(5)}${kindLabel(x.tree).padEnd(22)}${(x.looks.map((n) => n + 1).join(' ') || 'none').slice(0, 29).padEnd(30)}${x.path.map((n) => n + 1).join('-').padEnd(12)}${String(x.net).padStart(7)}${String(bestPath(x.tree).value).padStart(6)}`)]} testId="every-tree" />
      </Section>
      <Section n={2} title="Net points, beside three programmed lookers on the same trees">
        <Para>The three lookers are programs run on your own 16 scored trees after your last choice. {LOOKER_IDS.map((id) => `${LOOKER_LABEL[id]}: ${LOOKER_RULE[id]}`).join(' ')} Net points are the sum over the 16 trees of each path’s numbers minus the clicks; clicks per tree is the mean number of nodes uncovered on a tree.</Para>
        <FixedLines lines={[`${''.padEnd(38)}${'net points'.padStart(11)}${'clicks per tree'.padStart(17)}`, `${'You'.padEnd(38)}${String(total).padStart(11)}${clicksPer(scored).toFixed(1).padStart(17)}`, ...LOOKER_IDS.map((id) => `${LOOKER_LABEL[id].padEnd(38)}${String(lookerTotal(id)).padStart(11)}${clicksPer(r.lookers[id]).toFixed(1).padStart(17)}`)]} testId="net-points" />
        <Content>{NOT_OPTIMAL_LINE}</Content>
      </Section>
      <Section n={3} title="After a large loss">
        <Para>
          On the 6 trees with a large loss of {LARGE_LOSS} at a first-step node, this counts the trees on which you uncovered that node and then uncovered at least one node below it: {belowAfterLoss.below} of {belowAfterLoss.saw} trees on which you uncovered the loss, a share of {share(belowAfterLoss)}. Beside it, on the regular trees on which you uncovered a small loss (−10 or −5) at a first-step node, the share on which you then uncovered a node below it: {belowAfterSmall.below} of {belowAfterSmall.saw}, a share of {share(belowAfterSmall)}. The third looker, One more look when it is worth it, looked below the large loss on {myopicBelow.below} of {myopicBelow.saw} of its trees.
        </Para>
        <Para>
          On the 3 trees whose best path ran through the large loss, the points you did not earn, the best path’s sum minus your path’s sum, come to {missed}; the third looker’s came to {myopicMissed}.
        </Para>
        <Para>The reading reports that in Huys and colleagues’ task a large loss roughly doubled the chance that a person stopped looking further down that branch, even when a larger gain lay beyond it (§12.2.4).</Para>
        <Content>{DIFFERENT_TASK_LINE}</Content>
        <ReferencePanel reference={reference('huys-2012')} />
      </Section>
      <Section n={4} title="When you stopped">
        <Para>
          On the 10 regular trees you uncovered {clicksPer(regular).toFixed(1)} nodes per tree, against {clicksPer(r.lookers.oneMore.filter((_, i) => scored[i].tree.lossNode === null)).toFixed(1)} for the third looker. The reading describes an account on which a searcher weighs what further thinking would gain against the time or points that each step of thinking uses up, and chooses how far to search and when to stop (§12.2.4). The third looker is a simple version of such a rule: it stops when no single further look is expected to raise the best path’s value by more than a look costs.
        </Para>
        <ReferencePanel reference={reference('callaway-2022')} />
      </Section>
    </div>
  )
}

function kindLabel(t: Tree): string {
  return t.kind === 'regular' ? 'regular' : t.kind === 'lossBest' ? 'large loss; best through it' : 'large loss; best elsewhere'
}

function shareBelow(recs: TreeRecord[], nodeOf: (rec: TreeRecord) => number): { saw: number; below: number } {
  let saw = 0
  let below = 0
  for (const rec of recs) {
    const b = lookedBelowAfter(rec.looks, nodeOf(rec))
    if (b === null) continue
    saw++
    if (b) below++
  }
  return { saw, below }
}

const share = (x: { saw: number; below: number }) => (x.saw ? `${Math.round((100 * x.below) / x.saw)}%` : 'not measured (the node was never uncovered)')

/** Part 2's My results. */
export function PuzzlesResults({ progress }: { progress: ProgressStore }) {
  const tower = progress.isComplete(TOWER_UNIT(3)) && progress.isComplete(TOWER_UNIT(4))
  const trees = progress.isComplete(TREES_UNIT)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }} data-results="puzzles">
      <GroupLabel>Step 1 — The tower</GroupLabel>
      {tower ? <TowerReveal progress={progress} /> : <Note>Step 1 is not finished. Its results appear here once both puzzles are solved.</Note>}
      <GroupLabel>Step 3 — Looking costs</GroupLabel>
      {trees ? <TreesReveal progress={progress} /> : <Note>Step 3 is not finished. Its results appear here once the last path is taken.</Note>}
      <Note>Step 2 is an exploration; its table is on its own screen, and nothing is saved from it except your predictions.</Note>
    </div>
  )
}

export { PEG_LABEL, bestThrough }
