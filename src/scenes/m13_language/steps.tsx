import type { ReactNode } from 'react'
import { Panel } from '../../components/Panel'
import type { ProgressStore } from '../../sim/language/progress/store'
import { InstructionScreen, type Sitting } from '../m10_memory/progress/InstructionScreen'
import { Btn, Choice, Content, FixedLines, GroupLabel, Note, PANEL_STYLE, PART_TITLES, NEXT_TAB, TABS, StagePanel, stageLeft, stageWidth, useStore, type Tab } from './ui'
import type { PartContext, PartStore } from './contract'

/**
 * What every part's steps share (LAB_COMMON_FEATURES §2 and §3): a step
 * opens on its instruction screen with Begin; Go back, Go to and Go on move
 * between steps; Show the instructions again brings the screen back over a
 * step in progress; a finished step's stage says where its results are and
 * carries the button that comes next. A step that shows how another step's
 * material is divided asks first, in one line, with Open anyway and Go to
 * Step n first (spec §11, item 3). The stores of the four parts extend
 * `StepStore`; their screens use `StepLeft` and `StepStage`.
 */

export type StepState = 'intro' | 'running' | 'done'

export interface StepScreen {
  step: number
  title: string
  kind: 'experiment' | 'exploration'
  willDo: string[]
  minutes: number
  sitting: Sitting
  sittingLine: string
  keys: string[]
  content: string[]
  /** What to press when the step is done, named without ambiguity (LAB_COMMON_FEATURES §2). */
  next: string
  /** What to have ready, where it differs from the default. */
  ready?: string
}

export const READY_LINE = 'Nothing is needed. You will answer in the app. The report is filled in from the results screens afterward.'
export const READY_SOUND_LINE = 'Headphones or earbuds, if you have them. You will answer in the app. The report is filled in from the results screens afterward.'

export const EXPLORATION_SITTING_LINE = 'You can leave and come back at any time. Your predictions stay committed, and nothing else in this step is saved.'

export abstract class StepStore<Step extends number> implements PartStore {
  readonly seed: number
  readonly progress: ProgressStore
  readonly steps: readonly Step[]
  step: Step
  version = 0
  /** The instruction screen is shown again over a step in progress. */
  instructionsShown = false
  private listeners = new Set<() => void>()
  /** Which steps have been begun in this session (past their instruction screen). */
  protected opened = new Set<Step>()
  /** Which steps' one-line notices were answered with Open anyway. */
  protected noticesAccepted = new Set<Step>()

  constructor(seed: number, progress: ProgressStore, steps: readonly Step[]) {
    this.seed = seed
    this.progress = progress
    this.steps = steps
    this.step = steps[0]
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  changed(): void {
    this.version++
    for (const fn of this.listeners) fn()
  }

  /** Whether the step's experiment is saved and done. An exploration never is. */
  abstract isDone(step: Step): boolean

  /** Whether a saved unit of the step is under way, so the step is running when the page is reloaded. */
  protected underWay(_step: Step): boolean {
    return false
  }

  /** The one-line notice a step shows before it opens, or null (spec §11, item 3). */
  notice(_step: Step): { line: string; goTo: Step } | null {
    return null
  }

  noticePending(step: Step): boolean {
    return this.notice(step) !== null && !this.noticesAccepted.has(step)
  }

  acceptNotice(): void {
    this.noticesAccepted.add(this.step)
    this.changed()
  }

  open(step: Step): void {
    this.step = step
    this.instructionsShown = false
    this.onOpen(step)
    this.changed()
  }

  /** Begin: past the instruction screen. A unit that begins here is the part's business, in `onBegin`. */
  begin(): void {
    this.opened.add(this.step)
    this.instructionsShown = false
    this.onBegin(this.step)
    this.changed()
  }

  protected onOpen(_step: Step): void {}
  protected onBegin(_step: Step): void {}

  showInstructions(): void {
    this.instructionsShown = true
    this.changed()
  }

  hideInstructions(): void {
    this.instructionsShown = false
    this.changed()
  }

  stateOf(step: Step): StepState {
    if (this.isDone(step)) return 'done'
    if (this.opened.has(step) || this.underWay(step)) return 'running'
    return 'intro'
  }

  get state(): StepState {
    return this.stateOf(this.step)
  }

  /** The step after this one, or null on the part's last step. */
  nextStep(step: Step): Step | null {
    const i = this.steps.indexOf(step)
    return i >= 0 && i + 1 < this.steps.length ? this.steps[i + 1] : null
  }

  prevStep(step: Step): Step | null {
    const i = this.steps.indexOf(step)
    return i > 0 ? this.steps[i - 1] : null
  }
}

/** The tab's name as the student reads it at the top left, for “choose the Stream tab”. */
export function tabName(tab: Tab): string {
  return TABS.find((t) => t.id === tab)!.title
}

/** The part number of a tab, 1 to 4. */
export function partNumber(tab: Tab): number {
  return TABS.findIndex((t) => t.id === tab)
}

export interface StepLeftProps<Step extends number, S extends StepStore<Step>> {
  ctx: PartContext<S>
  tab: Tab
  screens: Record<Step, StepScreen>
  /** The progress block: one fixed line per step. */
  progressLines: (s: S) => string[]
  /** The part's own controls while a step runs. */
  controls?: (s: S) => ReactNode
  /** Content lines at the top of the panel, on every step. */
  topLines?: string[]
}

export function StepLeft<Step extends number, S extends StepStore<Step>>({ ctx, tab, screens, progressLines, controls, topLines }: StepLeftProps<Step, S>) {
  const s = useStore(ctx.store)
  useStore(ctx.progress)
  const screen = screens[s.step]
  const state = s.state
  const prev = s.prevStep(s.step)
  const next = s.nextStep(s.step)
  const nextTab = NEXT_TAB[tab]
  const nav = (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {prev !== null && <Btn onClick={() => s.open(prev)}>Go back to Step {prev}</Btn>}
      {next !== null && <Btn onClick={() => s.open(next)}>{state === 'done' || (screen.kind === 'exploration' && state === 'running') ? 'Go on to' : 'Go to'} Step {next}</Btn>}
      {next === null && nextTab && state !== 'intro' && <Btn onClick={() => ctx.openTab(nextTab)}>Go on to Part {partNumber(nextTab)}</Btn>}
      {next === null && !nextTab && state !== 'intro' && <Btn onClick={() => ctx.openTab('open')}>Open tab: My results, all parts</Btn>}
    </div>
  )
  return (
    <>
      {ctx.header}
      <Panel title={PART_TITLES[tab]} style={PANEL_STYLE}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {topLines?.map((l) => <Content key={l}>{l}</Content>)}
          <GroupLabel>Step</GroupLabel>
          <Choice value={String(s.step)} options={s.steps.map((st) => ({ id: String(st), label: `Step ${st}`, title: screens[st].title }))} onChange={(v) => s.open(Number(v) as Step)} />
          <Note>{screen.title}</Note>
          <FixedLines lines={progressLines(s)} testId="step-progress" />
          {state === 'intro' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-intro>
              <Note>What you will do is described over the view. Read it, then press “Begin”.</Note>
              <Content>{`About ${screen.minutes} ${screen.minutes === 1 ? 'minute' : 'minutes'}. ${screen.kind === 'experiment' ? 'An experiment, done once.' : 'An exploration: leave and return at any time.'}`}</Content>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <Btn primary onClick={() => s.begin()} disabled={s.noticePending(s.step)}>
                  Begin
                </Btn>
                {prev !== null && <Btn onClick={() => s.open(prev)}>Go back to Step {prev}</Btn>}
                {next !== null && <Btn onClick={() => s.open(next)}>Go to Step {next}</Btn>}
              </div>
            </div>
          )}
          {state === 'running' && controls?.(s)}
          {state === 'running' && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <Btn onClick={() => (s.instructionsShown ? s.hideInstructions() : s.showInstructions())}>{s.instructionsShown ? 'Back to the step' : 'Show the instructions again'}</Btn>
            </div>
          )}
          {state !== 'intro' && nav}
          {state === 'done' && <Note>This step is done and saved. Its results are on the right. An experiment is not redone: someone who knows what it tests is no longer a naive subject.</Note>}
        </div>
      </Panel>
    </>
  )
}

export interface StepStageProps<Step extends number, S extends StepStore<Step>> {
  ctx: PartContext<S>
  tab: Tab
  screens: Record<Step, StepScreen>
  /** What the stage shows while the step runs. */
  running: (s: S) => ReactNode
  /** What the stage shows once the step is done, in place of the default finished-step stage. */
  done?: (s: S) => ReactNode
}

export function StepStage<Step extends number, S extends StepStore<Step>>({ ctx, tab, screens, running, done }: StepStageProps<Step, S>) {
  const s = useStore(ctx.store)
  useStore(ctx.progress)
  const screen = screens[s.step]
  const state = s.state
  if (state === 'intro' && s.noticePending(s.step)) {
    const n = s.notice(s.step)!
    return (
      <StagePanel testId="notice">
        <div style={{ fontSize: 14, fontWeight: 600 }}>{screen.title}</div>
        <Note data-notice-line>{n.line}</Note>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <Btn onClick={() => s.acceptNotice()}>Open anyway</Btn>
          <Btn primary onClick={() => s.open(n.goTo)}>
            Go to Step {n.goTo} first
          </Btn>
        </div>
      </StagePanel>
    )
  }
  if (state === 'intro' || s.instructionsShown)
    return (
      <div data-instruction-frame style={{ position: 'absolute', left: stageLeft(560), top: 24, width: stageWidth(560), maxHeight: 'calc(100vh - 170px)', overflowY: 'auto', overflowX: 'auto', pointerEvents: 'auto', display: 'flex', boxSizing: 'border-box' }}>
      <InstructionScreen
        inline
        title={screen.title}
        willDo={screen.willDo}
        minutes={screen.minutes}
        sitting={screen.sitting}
        sittingLine={screen.sittingLine}
        ready={screen.ready ?? READY_LINE}
        keys={screen.keys}
        content={screen.content}
        next={screen.next}
        onBegin={() => (s.instructionsShown ? s.hideInstructions() : s.begin())}
        beginLabel={s.instructionsShown ? 'Back to the step' : 'Begin'}
      />
      </div>
    )
  if (state === 'done') return done ? <>{done(s)}</> : <DoneStage ctx={ctx} tab={tab} screens={screens} />
  return <>{running(s)}</>
}

/** A finished step's stage: where its results are, and what to press next, with the button itself (Jon, 2026-11-09). */
export function DoneStage<Step extends number, S extends StepStore<Step>>({ ctx, tab, screens }: { ctx: PartContext<S>; tab: Tab; screens: Record<Step, StepScreen> }) {
  const s = ctx.store
  const next = s.nextStep(s.step)
  const nextTab = NEXT_TAB[tab]
  return (
    <StagePanel testId="done">
      <div style={{ fontSize: 14, fontWeight: 600 }}>{screens[s.step].title}</div>
      <Note>This step is done. Its results are on the right, and under “My results, all parts” on the Open tab.</Note>
      <Note data-next>
        {next !== null
          ? `When you are ready to move on, press “Go on to Step ${next}” here or on the left.`
          : nextTab
            ? `When you are ready to move on, press “Go on to Part ${partNumber(nextTab)}” here or on the left, or choose the ${tabName(nextTab)} tab at the top left.`
            : 'This was the lab’s last part. Every part’s results are on the Open tab, under “My results, all parts”.'}
      </Note>
      <div>
        {next !== null ? (
          <Btn primary onClick={() => s.open(next)}>
            Go on to Step {next}
          </Btn>
        ) : nextTab ? (
          <Btn primary onClick={() => ctx.openTab(nextTab)}>
            Go on to Part {partNumber(nextTab)}
          </Btn>
        ) : (
          <Btn primary onClick={() => ctx.openTab('open')}>
            Open tab: My results, all parts
          </Btn>
        )}
      </div>
    </StagePanel>
  )
}

/** The right column before a step's results exist: one line saying what appears and when. */
export function ResultsPending({ children }: { children: ReactNode }) {
  return (
    <Note data-results-pending>{children}</Note>
  )
}
