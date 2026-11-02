import { useState } from 'react'
import { Panel } from '../../components/Panel'
import type { ProgressStore } from '../../sim/social/progress/store'
import { LAB11_TRANSFER } from '../../sim/social/progress/transfer'
import { UNIT_IDS, partOf, unitsOfPart, type Part } from '../../sim/social/parts'
import { Btn, Content, GroupLabel, Note, OrientingPanel, PANEL_STYLE, RIGHT_STYLE, FixedLines, useStore, PART_TITLES, type Tab } from './ui'
import { COMMIT_RULE_LINE, SECOND_RUN_LINE } from './lines'
import { ExportLoad } from '../m10_memory/progress/ExportLoad'
import type { PartModule, PartStore } from './contract'

/**
 * Part 0 (spec §0, §4): the lab's general instructions, over the view for
 * as long as the Open tab shows (Lab 10's rule: one screen, and Begin
 * Part 1, on the left and under the instructions, opens Part 1), saved progress with Export and Load, Clear my saved
 * results behind an in-page confirmation, and My results, all parts.
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
    'This lab has six parts, each designed to clarify and explore topics and themes in this module.',
    'Every part, and every step within a part, opens on a screen like this one. Each one says what you will do, how long it takes, and whether you can leave partway without needing to start over. Experiments are done in one sitting; explorations can be left and returned to, and their steps reopened or redone.',
    'Your progress is saved in this browser on this computer only. A part you have finished does not need to be redone. A part you leave partway is started over when you return, as its screen says. “Export my results” and “Load my results” can be used to transfer your saved results to another computer or browser.',
    'Part 2 opens once Part 1’s diagnosis is committed, because Part 2 names the rules Part 1 hides. Parts 3, 4, 5, and 6 can be done in any order, before or after Parts 1 and 2. Nothing in one of them tells you what another tests.',
    'The Open tab also gathers every part’s results under “My results, all parts”.',
  ],
  content: [COMMIT_RULE_LINE],
  time: 'About 3 minutes.',
  footer: 'To move on to Part 1, press “Begin Part 1” here or on the left, or choose the Partners tab.',
}

const PARTS_WITH_UNITS: Part[] = [1, 3, 5]
const EXPLORATIONS: Part[] = [2, 4, 6]

function progressRows(p: ProgressStore): string[] {
  const done = UNIT_IDS.filter((u) => p.isComplete(u))
  return [1, 2, 3, 4, 5, 6].map((part) => {
    const label = `Part ${part}`.padEnd(8)
    if (EXPLORATIONS.includes(part as Part)) return `${label}an exploration`
    if (p.partComplete(part as Part)) return `${label}finished`
    return `${label}${done.filter((u) => partOf(u) === part).length} of ${unitsOfPart(part as Part).length} units done`
  })
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
              <Btn primary onClick={() => ctx.openTab('partners')}>
                Begin Part 1
              </Btn>
            </div>
          </div>
          <GroupLabel>Saved progress</GroupLabel>
          <FixedLines lines={progressRows(p)} testId="parts-done" />
          <ExportLoad store={ctx.progress} transfer={LAB11_TRANSFER} />
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

function Stage({ ctx }: { ctx: { openTab: (tab: Tab) => void } }) {
  return (
    <OrientingPanel
      title={OPEN_INTRO.title}
      lines={OPEN_INTRO.lines}
      content={OPEN_INTRO.content}
      footer={OPEN_INTRO.footer}
      action={
        <Btn primary onClick={() => ctx.openTab('partners')}>
          Begin Part 1
        </Btn>
      }
    />
  )
}

function Right({ ctx }: { ctx: { progress: ProgressStore } }) {
  const p = useStore(ctx.progress)
  const [show, setShow] = useState(false)
  const finished = PARTS_WITH_UNITS.filter((part) => p.partComplete(part))
  return (
    <Panel title="My results, all parts" style={RIGHT_STYLE}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Note>Each part’s My results screen is on its own tab once the part is finished. This screen gathers them. Parts 2, 4 and 6 are explorations: what they show is read off their own tabs.</Note>
        <FixedLines lines={progressRows(p)} testId="results-all" />
        {finished.length > 0 && (
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
const resultsRenderers: Partial<Record<Part, (progress: ProgressStore) => React.ReactNode>> = {}
export function registerResults(part: Part, render: (progress: ProgressStore) => React.ReactNode): void {
  resultsRenderers[part] = render
}
function AllResults({ progress }: { progress: ProgressStore }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }} data-all-results>
      {PARTS_WITH_UNITS.map((part) =>
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
