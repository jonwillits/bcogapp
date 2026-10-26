import { useState } from 'react'
import { Panel } from '../../components/Panel'
import type { ProgressStore } from '../../sim/memory/progress/store'
import { UNIT_IDS, partOf } from '../../sim/memory/parts'
import { Btn, Content, GroupLabel, Note, OrientingPanel, PANEL_STYLE, RIGHT_STYLE, FixedLines, useStore, PART_TITLES, type Tab } from './ui'
import { COMMIT_RULE_LINE, SECOND_RUN_LINE } from './lines'
import { ExportLoad } from './progress/ExportLoad'
import type { PartModule, PartStore } from './contract'

/**
 * Part 0 (spec §0, §4.2, §4.4): the lab's general instructions, over the
 * view for as long as the Open tab shows (Jon, 2026-10-26: one screen, not
 * a tour that Begin dismisses to a second screen; Begin opens Part 1),
 * saved progress with Export and Load, Clear my saved results behind an
 * in-page confirmation, and My results, all parts.
 */

export class OpenStore implements PartStore {
  version = 0
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
  title: 'Part 0 — General Lab Instructions',
  lines: [
    'This lab has five parts. In the first three parts, you will be the subject of memory experiments. You will see lists of words, learn about two ways to study, and test your memory for the objects in a room. In the fourth part, you will be a small mammal, foraging at logs over six nights. In the fifth part, you will look inside simulated animals that forage on your own nights.',
    'Every part, and every step within a part, opens on a screen like this one that says what you will do, how long it takes, and whether you can leave partway without needing to start over. Experiments are done in one sitting; explorations can be left and returned to.',
    'Your progress is saved in this browser on this computer only. A part you have finished does not need to be redone. A part you leave partway will be started over when you return, with new materials. “Export my results” and “Load my results” can be used to transfer your saved results to another computer or browser. The Open tab says how to do this.',
    'Part 1 must be finished before Parts 2 and 3 can be opened. Part 4 can be done at any time. Part 5 can be opened once Part 4 is finished, or with a sample set of nights if your own nights are lost.',
    'The Open tab also gathers every part’s results under “My results, all parts”, worded as the report asks for them.',
  ],
  content: [COMMIT_RULE_LINE],
  time: 'About 3 minutes.',
  footer: 'To move on to Part 1, press “Begin” on the left, or choose the Lists tab.',
}

function Left({ ctx }: { ctx: { store: PartStore; header: React.ReactNode; progress: ProgressStore; openTab: (tab: Tab) => void } }) {
  const s = useStore(ctx.store as OpenStore)
  const p = useStore(ctx.progress)
  return (
    <>
      {ctx.header}
      <Panel title={PART_TITLES.open} style={PANEL_STYLE}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-intro>
            <Note>General lab instructions are shown in the center panel. Please read.</Note>
            <Content>{OPEN_INTRO.time}</Content>
            <div>
              <Btn primary onClick={() => ctx.openTab('lists')}>
                Begin
              </Btn>
            </div>
          </div>
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

function Stage() {
  return <OrientingPanel title={OPEN_INTRO.title} lines={OPEN_INTRO.lines} content={OPEN_INTRO.content} footer={`${OPEN_INTRO.time} ${OPEN_INTRO.footer}`} />
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
