import { useState, type ReactNode } from 'react'
import { Panel } from '../../components/Panel'
import type { ProgressStore } from '../../sim/language/progress/store'
import { LAB13_TRANSFER } from '../../sim/language/progress/transfer'
import { UNIT_IDS, partOf, unitsOfPart, type Part } from '../../sim/language/parts'
import { Btn, Content, GroupLabel, Note, OrientingPanel, PANEL_STYLE, RIGHT_STYLE, FixedLines, useStore, PART_TITLES, type Tab } from './ui'
import { ANY_ORDER_LINE, COMMIT_RULE_LINE, SECOND_RUN_LINE, HEADPHONES_LINE, MADE_OFFLINE_LINE } from './lines'
import { ExportLoad } from '../m10_memory/progress/ExportLoad'
import { playTestSound } from './testSound'
import type { PartModule, PartStore } from './contract'

/**
 * Part 0 (spec §0, §4): the lab's general instructions, over the view for
 * as long as the Open tab shows; the test sound and the headphones line;
 * saved progress with Export and Load; Clear my saved results behind an
 * in-page confirmation; and My results, all parts. Every part and every
 * step opens at any time.
 */

export class OpenStore implements PartStore {
  version = 0
  confirmingClear = false
  /** The test sound was played at least once this session, or could not be. */
  testSound: 'not yet' | 'played' | 'unavailable' = 'not yet'
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
  playTest(): void {
    this.testSound = playTestSound() ? 'played' : 'unavailable'
    this.changed()
  }
}

export const OPEN_INTRO = {
  title: 'Part 0 — General Lab Instructions',
  lines: [
    'This lab has four parts. Part 1 is about the sounds of speech. You will read pictures of sounds, label syllables by what you hear, and train a small network to label them too. Part 2 is about finding the words in a stream of speech with no pauses. You will hear a made-up language, find its words on a board, and run three programs that find words in their own ways. Part 3 is about learning what new words refer to. You will hear new words with new objects, and click what each word names, and then run two models on your own choices. Part 4 is about predicting the next word. You will look inside three models that learn to predict word sequences, all trained on one small made-up corpus.',
    'Every part, and every step within a part, opens on a screen like this one. Each one says what you will do, how long it takes, what each button does, what is recorded, and whether you can leave partway without starting over. An experiment is done once, in one sitting. An exploration can be opened, left, returned to, and redone.',
    'Your progress is saved in this browser on this computer only. Nothing is sent anywhere. A step you have finished does not need to be redone to reach anything else. A step you leave partway needs to be started over, or goes on from where you stopped, as its screen says. “Export my results” writes your saved results to a file on your computer, and “Load my results” reads such a file back, so you can move your results to another computer or browser.',
    'We suggest you do them in order. Part 1, then Part 2, then Part 3, then Part 4. The app does not enforce it. A step that depends on another step’s results says so on its results screen, and shows everything else. Four steps in Parts 2 and 3 show how another step’s material is divided. Before each of those steps opens, you will see one line and two buttons: 1) open anyway, or 2) go to the step it depends on.',
    'Parts 1, 2, and 3 play sound. Press “Play a test sound” on the left to hear a short tone and set a comfortable volume once.',
    'Every part’s results are also gathered on the Open tab, under “My results, all parts”.',
  ],
  content: [ANY_ORDER_LINE, COMMIT_RULE_LINE, HEADPHONES_LINE, MADE_OFFLINE_LINE],
  time: 'About 3 minutes.',
  footer: 'To move on to Part 1, press “Begin Part 1” here or on the left, or choose the Sounds tab.',
}

const PARTS_WITH_UNITS: Part[] = [1, 2, 3]
const EXPLORATIONS: Part[] = [4]

export function progressRows(p: ProgressStore): string[] {
  const done = UNIT_IDS.filter((u) => p.isComplete(u))
  return [1, 2, 3, 4].map((part) => {
    const label = `Part ${part}`.padEnd(8)
    if (EXPLORATIONS.includes(part as Part)) return `${label}an exploration`
    const n = unitsOfPart(part as Part).length
    const k = done.filter((u) => partOf(u) === part).length
    if (k === n) return `${label}every experiment done`
    return `${label}${k} of ${n} ${n === 1 ? 'experiment' : 'experiments'} done`
  })
}

function Left({ ctx }: { ctx: { store: PartStore; header: ReactNode; progress: ProgressStore; openTab: (tab: Tab) => void } }) {
  const s = useStore(ctx.store as OpenStore)
  const p = useStore(ctx.progress)
  return (
    <>
      {ctx.header}
      <Panel title={PART_TITLES.open} style={PANEL_STYLE}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-intro>
            <Note>The general lab instructions are shown in the center panel. Please read them before beginning.</Note>
            <Content>{OPEN_INTRO.time}</Content>
            <div>
              <Btn primary onClick={() => ctx.openTab('sounds')}>
                Begin Part 1
              </Btn>
            </div>
          </div>
          <GroupLabel>Sound</GroupLabel>
          <Content>{HEADPHONES_LINE}</Content>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <Btn onClick={() => s.playTest()}>Play a test sound</Btn>
            <Note data-test-sound={s.testSound}>{s.testSound === 'played' ? 'A short tone played. Set your volume so that it is comfortable.' : s.testSound === 'unavailable' ? 'This browser cannot play sound here.' : 'A short tone, about half a second long.'}</Note>
          </div>
          <GroupLabel>Saved progress</GroupLabel>
          <Note>Each experiment is done once, in one sitting. This shows your progress. The explorations in Parts 1 to 4 are not counted, because they can be redone at any time.</Note>
          <FixedLines lines={progressRows(p)} testId="parts-done" />
          <ExportLoad store={ctx.progress} transfer={LAB13_TRANSFER} />
          <GroupLabel>Start over</GroupLabel>
          <Note>“Clear my saved results” erases everything saved here for this lab and draws a new seed.</Note>
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
        <Btn primary onClick={() => ctx.openTab('sounds')}>
          Begin Part 1
        </Btn>
      }
    />
  )
}

function Right({ ctx }: { ctx: { progress: ProgressStore } }) {
  const p = useStore(ctx.progress)
  const [show, setShow] = useState(false)
  const any = PARTS_WITH_UNITS.some((part) => unitsOfPart(part).some((u) => p.isComplete(u)))
  return (
    <Panel title="My results, all parts" style={RIGHT_STYLE}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Note>Each part’s My results screen is on its own tab. The results of every experiment you have finished are gathered here. Part 4 is an exploration, and its results are on its own tab.</Note>
        <FixedLines lines={progressRows(p)} testId="results-all" />
        {any && (
          <div>
            <Btn small onClick={() => setShow(!show)}>
              {show ? 'Hide the results' : 'Show every finished experiment’s results'}
            </Btn>
          </div>
        )}
        {show && <AllResults progress={p} />}
      </div>
    </Panel>
  )
}

/** The gathered results: each part's own Results screen, mounted here. Filled in by the parts' modules through `registerResults`, at module level, so a part finished in an earlier session shows without its tab having been opened. */
const resultsRenderers: Partial<Record<Part, (progress: ProgressStore) => ReactNode>> = {}
export function registerResults(part: Part, render: (progress: ProgressStore) => ReactNode): void {
  resultsRenderers[part] = render
}
function AllResults({ progress }: { progress: ProgressStore }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }} data-all-results>
      {PARTS_WITH_UNITS.map((part) =>
        unitsOfPart(part).some((u) => progress.isComplete(u)) && resultsRenderers[part] ? (
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
