import { useState } from 'react'
import { Panel } from '../../components/Panel'
import type { ProgressStore } from '../../sim/memory/progress/store'
import { UNIT_IDS, partOf } from '../../sim/memory/parts'
import { Btn, Content, GroupLabel, Note, OrientingPanel, PANEL_STYLE, RIGHT_STYLE, StagePanel, FixedLines, useStore, PART_TITLES } from './ui'
import { COMMIT_RULE_LINE, SECOND_RUN_LINE } from './lines'
import { ExportLoad } from './progress/ExportLoad'
import type { PartModule, PartStore } from './contract'

/**
 * Part 0 (spec §0, §4.2, §4.4): opening the lab. The tour, the order of the
 * parts, saved progress with Export and Load, Clear my saved results
 * behind an in-page confirmation, and My results, all parts.
 */

export class OpenStore implements PartStore {
  version = 0
  started = false
  confirmingClear = false
  private listeners = new Set<() => void>()
  readonly seed: number
  readonly progress: ProgressStore
  constructor(seed: number, progress: ProgressStore) {
    this.seed = seed
    this.progress = progress
  }
  subscribe(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
  private changed(): void {
    this.version++
    for (const fn of this.listeners) fn()
  }
  begin(): void {
    this.started = true
    this.changed()
  }
  askClear(on: boolean): void {
    this.confirmingClear = on
    this.changed()
  }
  clear(): void {
    this.confirmingClear = false
    this.progress.clear()
    this.changed()
  }
}

export const OPEN_INTRO = {
  title: 'Part 0 — Opening the lab',
  lines: [
    'This lab has five parts. In the first three you are the subject of memory experiments: lists of words, two ways to study, and a room. In the fourth you are a small mammal, foraging at logs over six nights. In the fifth you look inside programs that forage on your own nights.',
    'Every part, and every step within a part, opens on a screen like this one that says what you will do, how long it takes, and whether you can leave partway. Experiments are done in one sitting; explorations can be left and returned to.',
    'Your progress is saved in this browser on this computer only. A part you have finished is never redone. A part you leave partway is started again with new materials. “Export my results” and “Load my results” carry your saved results to another computer, and the Open tab says how.',
    'Part 1 must be finished before Parts 2 and 3 open. Part 4 can be done at any time. Part 5 opens once Part 4 is finished.',
    'The Open tab also gathers every part’s results under “My results, all parts”, worded as the report asks for them.',
  ],
  content: [COMMIT_RULE_LINE],
  time: 'About 3 minutes.',
}

function Left({ ctx }: { ctx: { store: PartStore; header: React.ReactNode; progress: ProgressStore } }) {
  const s = useStore(ctx.store as OpenStore)
  const p = useStore(ctx.progress)
  return (
    <>
      {ctx.header}
      <Panel title={PART_TITLES.open} style={PANEL_STYLE}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {!s.started && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-intro>
              <Note>What will happen is described over the view.</Note>
              <Content>{OPEN_INTRO.time}</Content>
              <div>
                <Btn primary onClick={() => s.begin()}>
                  Begin
                </Btn>
              </div>
            </div>
          )}
          <GroupLabel>Saved progress</GroupLabel>
          <FixedLines lines={[1, 2, 3, 4].map((part) => `${`Part ${part}`.padEnd(8)}${p.partComplete(part as 1 | 2 | 3 | 4) ? 'finished' : 'not finished'}`)} testId="parts-done" />
          <ExportLoad store={ctx.progress} />
          <GroupLabel>Start over</GroupLabel>
          <Note>“Clear my saved results” erases everything saved here and draws a new seed.</Note>
          {!s.confirmingClear ? (
            <div>
              <Btn onClick={() => s.askClear(true)}>Clear my saved results</Btn>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 8, border: '1px solid var(--avoid)', borderRadius: 8 }} data-confirm-clear>
              <Note>This erases every result saved in this browser for this lab and draws a new seed. It cannot be undone.</Note>
              <Content>{SECOND_RUN_LINE}</Content>
              <div style={{ display: 'flex', gap: 6 }}>
                <Btn primary onClick={() => s.clear()}>
                  Erase and start over
                </Btn>
                <Btn onClick={() => s.askClear(false)}>Keep my results</Btn>
              </div>
            </div>
          )}
        </div>
      </Panel>
    </>
  )
}

function Stage({ ctx }: { ctx: { store: PartStore } }) {
  const s = useStore(ctx.store as OpenStore)
  if (!s.started) return <OrientingPanel title={OPEN_INTRO.title} lines={OPEN_INTRO.lines} content={OPEN_INTRO.content} footer={`${OPEN_INTRO.time} Press “Begin” on the left.`} />
  return (
    <StagePanel testId="open">
      <div style={{ fontSize: 14, fontWeight: 600 }}>The parts, in order</div>
      <Note>Lists (Part 1), then Study and Room (Parts 2 and 3, in either order), Logs (Part 4, at any time), and Learners (Part 5, after Logs). Each part’s tab says why it cannot open yet, when it cannot.</Note>
      <Content>{COMMIT_RULE_LINE}</Content>
    </StagePanel>
  )
}

function Right({ ctx }: { ctx: { progress: ProgressStore } }) {
  const p = useStore(ctx.progress)
  const [show, setShow] = useState(false)
  const done = UNIT_IDS.filter((u) => p.isComplete(u))
  return (
    <Panel title="My results, all parts" style={RIGHT_STYLE}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Note>Each part’s My results screen is on its own tab once the part is finished. This screen gathers them.</Note>
        <FixedLines lines={([1, 2, 3, 4] as const).map((part) => `${`Part ${part}`.padEnd(8)}${p.partComplete(part) ? 'finished' : `${done.filter((u) => partOf(u) === part).length} of ${UNIT_IDS.filter((u) => partOf(u) === part).length} units done`}`)} testId="results-all" />
        {done.length > 0 && (
          <div>
            <Btn small onClick={() => setShow(!show)}>
              {show ? 'Hide the results' : 'Show every finished part’s results'}
            </Btn>
          </div>
        )}
        {show && <AllResults progress={p} />}
      </div>
    </Panel>
  )
}

/** The gathered results: each part's own Results screen, mounted here once the part is finished. Filled in by the parts' modules through `registerResults`. */
const resultsRenderers: Partial<Record<1 | 2 | 3 | 4, (progress: ProgressStore) => React.ReactNode>> = {}
export function registerResults(part: 1 | 2 | 3 | 4, render: (progress: ProgressStore) => React.ReactNode): void {
  resultsRenderers[part] = render
}
function AllResults({ progress }: { progress: ProgressStore }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }} data-all-results>
      {([1, 2, 3, 4] as const).map((part) =>
        progress.partComplete(part) && resultsRenderers[part] ? (
          <div key={part}>
            <GroupLabel>Part {part}</GroupLabel>
            {resultsRenderers[part]!(progress)}
          </div>
        ) : null,
      )}
    </div>
  )
}

export const open: PartModule<OpenStore> = {
  createStore: (seed, progress) => new OpenStore(seed, progress),
  Left,
  Stage,
  Right,
}
