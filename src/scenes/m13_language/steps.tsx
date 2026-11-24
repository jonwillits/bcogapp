import { useEffect, useState, type ReactNode } from 'react'
import { Panel } from '../../components/Panel'
import type { ProgressStore } from '../../sim/language/progress/store'
import { InstructionScreen, type Sitting } from '../m10_memory/progress/InstructionScreen'
import { Btn, Choice, Content, FixedLines, GroupLabel, Note, PANEL_STYLE, PART_TITLES, NEXT_TAB, TABS, StagePanel, useScrollToTop, useStore, type Tab, rich } from './ui'
import { MAIN_TABS, stepParams, type PartKey, type UnderWay } from './params'
import { pauseExpiredLine, pauseLines, pausedFor, type Busy } from './switching'
import type { PartContext, PartStore } from './contract'

/**
 * What every part's steps share (LAB_COMMON_FEATURES §2 and §3): a step
 * opens on its instruction screen with Begin; Go back, Go to and Go on move
 * between steps; Show the instructions again brings the screen back over a
 * step in progress; a finished step's stage says where its results are,
 * shows them with their explanation, and carries the button that comes
 * next. A step that shows how another step's material is divided asks
 * first, in one line, with Open anyway and Go to Step n first (spec §11,
 * item 3). Leaving a step with something under way goes through the switch
 * guard in `LanguageScene` (Jon, 2026-11-18): the stores say what is under
 * way (`underWayNow`), `params.yaml` says its consequence, and a step that
 * pauses has a Pause button and a pause screen. The stores of the four
 * parts extend `StepStore`; their screens use `StepNav` and `StepStage`.
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
  /** An exploration's stage ends with the button that comes next; false where the stage carries its own (Part 1's tour, on its last screen). */
  bottomNext?: boolean
}

export const READY_LINE = 'Nothing is needed. You will answer in the app. The report is filled in from the results screens afterward.'
export const READY_SOUND_LINE = 'Headphones or earbuds, if you have them. You will answer in the app. The report is filled in from the results screens afterward.'

export const EXPLORATION_SITTING_LINE = 'You can leave and come back at any time. Any prediction you have committed stays committed, and nothing else in this step is saved.'
/** For an exploration that asks no prediction (Part 2's Step 4, Part 4's Steps 1 and 5): the line above would name predictions the step lacks (Jon's walk, 2026-11-17). */
export const EXPLORATION_NO_PREDICTION_LINE = 'You can leave and come back at any time. Nothing in this step is saved.'

/** Where a finished step's results are, for the instruction screens' When you are done sections. */
export const RESULTS_BELOW = `the results of this step appear below, in this panel, with their explanation, and on the ${MAIN_TABS.results} tab at the top of this panel`

export abstract class StepStore<Step extends number> implements PartStore {
  readonly seed: number
  readonly progress: ProgressStore
  readonly steps: readonly Step[]
  readonly partKey: PartKey
  step: Step
  version = 0
  /** The instruction screen is shown again over a step in progress. */
  instructionsShown = false
  /** The step is paused: since when, what was under way, and the limit (Jon, 2026-11-18). */
  paused: { since: number; what: UnderWay; limitMinutes: number | null } | null = null
  /** The line on the step after a pause ran past its limit, until the step is opened again. */
  pauseExpired: string | null = null
  private listeners = new Set<() => void>()
  /** Which steps have been begun in this session (past their instruction screen). */
  protected opened = new Set<Step>()
  /** Which steps' one-line notices were answered with Open anyway. */
  protected noticesAccepted = new Set<Step>()

  constructor(seed: number, progress: ProgressStore, steps: readonly Step[], partKey: PartKey) {
    this.seed = seed
    this.progress = progress
    this.steps = steps
    this.partKey = partKey
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
    this.pauseExpired = null
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
  /** Start loading what a step needs while its instruction screen is read, so that Begin finds it ready (Jon, 2026-11-20). */
  preload(_step: Step): void {}

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

  // ------------------------------------------------ leaving and pausing

  /** What is under way on the current step, or null: the part's business. A paused step reports nothing. */
  protected underWayNow(): UnderWay | null {
    return null
  }

  /** What is under way now, with the file's consequence for leaving it; null when leaving is free. */
  busy(): Busy | null {
    if (this.paused) return null
    const what = this.underWayNow()
    if (!what) return null
    const p = stepParams(this.partKey, this.step)
    const consequence = p.underWay[what]
    if (!consequence) throw new Error(`params.yaml: parts.${this.partKey}.steps.${this.step} has ${what} under way but no consequence for it`)
    return { what, consequence, limitMinutes: p.pauseLimitMinutes }
  }

  /** Whether the step can be paused now: something is under way whose consequence is a pause. */
  get canPause(): boolean {
    const b = this.busy()
    return b !== null && b.consequence === 'pause'
  }

  /** Pause the step: from the Pause button, or from a confirmed switch whose consequence is a pause. */
  pause(): void {
    const b = this.busy()
    if (!b || b.consequence !== 'pause') return
    this.paused = { since: Date.now(), what: b.what, limitMinutes: b.limitMinutes ?? null }
    this.onPause(b.what)
    this.changed()
  }

  /** Resume: within the limit the step goes on from where it stopped; past it, what was under way restarts as a leave would restart it. */
  resume(): void {
    const p = this.paused
    if (!p) return
    this.paused = null
    const over = p.limitMinutes !== null && Date.now() - p.since > p.limitMinutes * 60_000
    if (over) {
      this.pauseExpired = pauseExpiredLine(p.what, p.limitMinutes!)
      this.onInterrupt(p.what)
    } else this.onResume(p.what, Date.now() - p.since)
    this.changed()
  }

  /** A switch confirmed: apply the consequence before the switch. */
  leave(b: Busy): void {
    if (b.consequence === 'pause') this.pause()
    else if (b.consequence === 'restart') {
      this.onInterrupt(b.what)
      this.changed()
    }
  }

  /** Stop what can be stopped for the pause: sounds, timers. */
  protected onPause(_what: UnderWay): void {}
  /** Go on after a pause of `ms` milliseconds: replay the trial, shift the clock. */
  protected onResume(_what: UnderWay, _ms: number): void {}
  /** What was under way starts again, as the instruction screen says it does. */
  protected onInterrupt(_what: UnderWay): void {}
}

/** The tab's name as the student reads it at the top left, for “choose the Stream tab”. */
export function tabName(tab: Tab): string {
  return TABS.find((t) => t.id === tab)!.title
}

/** The part number of a tab, 1 to 4. */
export function partNumber(tab: Tab): number {
  return TABS.findIndex((t) => t.id === tab)
}

export interface StepNavProps<Step extends number, S extends StepStore<Step>> {
  ctx: PartContext<S>
  tab: Tab
  screens: Record<Step, StepScreen>
  /** The progress block: one fixed line per step. */
  progressLines: (s: S) => string[]
  /** Content lines at the top of the panel, on every step. */
  topLines?: string[]
}

/** The navigation panel's part panel: the step buttons, the progress rows, Begin, Go on and Go back, Show the instructions again. No step's content (Jon, 2026-11-16). */
export function StepNav<Step extends number, S extends StepStore<Step>>({ ctx, tab, screens, progressLines, topLines }: StepNavProps<Step, S>) {
  const s = useStore(ctx.store)
  useStore(ctx.progress)
  const screen = screens[s.step]
  const state = s.state
  const prev = s.prevStep(s.step)
  const next = s.nextStep(s.step)
  const nextTab = NEXT_TAB[tab]
  const nav = (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {prev !== null && <Btn onClick={() => ctx.openStep(prev)}>Go back to Step {prev}</Btn>}
      {next !== null && <Btn onClick={() => ctx.openStep(next)}>{state === 'done' || (screen.kind === 'exploration' && state === 'running') ? 'Go on to' : 'Go to'} Step {next}</Btn>}
      {next === null && nextTab && state !== 'intro' && <Btn onClick={() => ctx.openTab(nextTab)}>Go on to Part {partNumber(nextTab)}</Btn>}
    </div>
  )
  return (
    <>
      {ctx.header}
      <Panel title={PART_TITLES[tab]} style={PANEL_STYLE}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {topLines?.map((l) => <Content key={l}>{l}</Content>)}
          <GroupLabel>Step</GroupLabel>
          <Choice value={String(s.step)} options={s.steps.map((st) => ({ id: String(st), label: `Step ${st}`, title: screens[st].title }))} onChange={(v) => ctx.openStep(Number(v))} />
          <Note>{screen.title}</Note>
          <FixedLines lines={progressLines(s)} testId="step-progress" />
          {state === 'intro' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-intro>
              <Note>What you will do is described in the main panel. Read it, then press “Begin”.</Note>
              <Content>{`About ${screen.minutes} ${screen.minutes === 1 ? 'minute' : 'minutes'}. ${screen.kind === 'experiment' ? 'An experiment, done once.' : 'An exploration: leave and return at any time.'}`}</Content>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <Btn primary onClick={() => s.begin()} disabled={s.noticePending(s.step)}>
                  Begin
                </Btn>
                {prev !== null && <Btn onClick={() => ctx.openStep(prev)}>Go back to Step {prev}</Btn>}
                {next !== null && <Btn onClick={() => ctx.openStep(next)}>Go to Step {next}</Btn>}
              </div>
            </div>
          )}
          {state === 'running' && !s.paused && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <Btn onClick={() => (s.instructionsShown ? s.hideInstructions() : s.showInstructions())}>{s.instructionsShown ? 'Back to the step' : 'Show the instructions again'}</Btn>
            </div>
          )}
          {state === 'running' && s.paused && <Note data-paused-note>This step is paused. Press “Resume” in the main panel to go on.</Note>}
          {state !== 'intro' && nav}
          {state === 'done' && <Note>This step is done and saved. Its results are in the main panel, with their explanation, and on the {MAIN_TABS.results} tab. An experiment is not redone: someone who knows what it tests is no longer a naive subject.</Note>}
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
  /** What the stage shows once the step is done: the finished-step header and the results with their explanation. `DoneStage` with children is the usual answer. */
  done?: (s: S) => ReactNode
}

export function StepStage<Step extends number, S extends StepStore<Step>>({ ctx, tab, screens, running, done }: StepStageProps<Step, S>) {
  const s = useStore(ctx.store)
  useStore(ctx.progress)
  const screen = screens[s.step]
  const state = s.state
  const step = s.step
  useEffect(() => {
    if (state === 'intro' || s.instructionsShown) s.preload(step)
  }, [s, state, step, s.instructionsShown])
  // Every change of screen opens the panel at its top: a step opened, Begin, a step finished, the instructions shown again, a pause (Jon, 2026-11-21).
  useScrollToTop(`${tab}/${step}/${state}/${s.instructionsShown}/${s.paused ? 'paused' : ''}`)
  if (state === 'intro' && s.noticePending(s.step)) {
    const n = s.notice(s.step)!
    return (
      <StagePanel testId="notice">
        <div style={{ fontSize: 14, fontWeight: 600 }}>{screen.title}</div>
        <Note data-notice-line>{n.line}</Note>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <Btn onClick={() => s.acceptNotice()}>Open anyway</Btn>
          <Btn primary onClick={() => ctx.openStep(n.goTo)}>
            Go to Step {n.goTo} first
          </Btn>
        </div>
      </StagePanel>
    )
  }
  if (state === 'intro' || s.instructionsShown)
    return (
      <div data-instruction-frame>
        <InstructionScreen
          inline
          bare
          maxWidth="none"
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
          format={rich}
        />
      </div>
    )
  if (state === 'done') return done ? <>{done(s)}</> : <DoneStage ctx={ctx} tab={tab} screens={screens} />
  if (s.paused) return <PauseScreen s={s} title={screen.title} />
  return (
    <>
      {s.pauseExpired && <Note data-pause-expired>{s.pauseExpired}</Note>}
      {running(s)}
      {screen.kind === 'exploration' && screen.bottomNext !== false && <NextRow ctx={ctx} tab={tab} />}
    </>
  )
}

/**
 * The button that comes next, at the end of a stage, after everything the
 * stage shows (Jon, 2026-11-19: at the bottom, not among the first things
 * at the top): Go on to Step n, or Go on to Part n on a part's last step,
 * with the line that names it. On the lab's last step, the line that says
 * where every result is.
 */
export function NextRow<Step extends number, S extends StepStore<Step>>({ ctx, tab }: { ctx: PartContext<S>; tab: Tab }) {
  const s = ctx.store
  const next = s.nextStep(s.step)
  const nextTab = NEXT_TAB[tab]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8, paddingTop: 10, borderTop: '1px solid var(--border)' }} data-next-row>
      <Note data-next>
        {next !== null
          ? `When you are ready to move on, press “Go on to Step ${next}” here or in the navigation panel.`
          : nextTab
            ? `When you are ready to move on, press “Go on to Part ${partNumber(nextTab)}” here or in the navigation panel, or choose the ${tabName(nextTab)} tab at the top left.`
            : `This is the last step of the lab. Every finished experiment’s results are on the ${MAIN_TABS.results} tab at the top of this panel.`}
      </Note>
      <div>
        {next !== null ? (
          <Btn primary onClick={() => ctx.openStep(next)}>
            Go on to Step {next}
          </Btn>
        ) : nextTab ? (
          <Btn primary onClick={() => ctx.openTab(nextTab)}>
            Go on to Part {partNumber(nextTab)}
          </Btn>
        ) : null}
      </div>
    </div>
  )
}

/** The pause screen, in place of the step: a large timer of the pause, the limit and what happens past it, and Resume (Jon, 2026-11-18). */
export function PauseScreen<Step extends number>({ s, title }: { s: StepStore<Step>; title: string }) {
  const p = s.paused!
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(id)
  }, [])
  const ms = now - p.since
  const over = p.limitMinutes !== null && ms > p.limitMinutes * 60_000
  return (
    <StagePanel testId="paused">
      <div style={{ fontSize: 14, fontWeight: 600 }}>{title}</div>
      <div style={{ fontSize: 22, fontWeight: 600 }} data-pause-state>
        Paused
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 28 }} data-pause-timer>
        {pausedFor(ms)}
      </div>
      {pauseLines(p.what, p.limitMinutes).map((l) => (
        <Note key={l} style={{ color: 'var(--text)', fontSize: 12.5 }}>
          {l}
        </Note>
      ))}
      {over && <Note data-pause-over>{`The pause has run past ${p.limitMinutes} minutes.`}</Note>}
      <div>
        <Btn primary onClick={() => s.resume()}>
          Resume
        </Btn>
      </div>
    </StagePanel>
  )
}

/** The Pause button, on a step that can pause now; nothing otherwise (a button appears only while its act is possible, LAB_COMMON_FEATURES §7). */
export function PauseButton<Step extends number>({ s }: { s: StepStore<Step> }) {
  useStore(s)
  if (!s.canPause) return null
  return (
    <span data-pause-button>
      <Btn onClick={() => s.pause()}>Pause</Btn>
    </span>
  )
}

/** A finished step's stage: the step is done and where its results are, then the results with their explanation (Jon, 2026-11-18), then the button that comes next, after everything (Jon, 2026-11-19). */
export function DoneStage<Step extends number, S extends StepStore<Step>>({ ctx, tab, screens, children }: { ctx: PartContext<S>; tab: Tab; screens: Record<Step, StepScreen>; children?: ReactNode }) {
  const s = ctx.store
  return (
    <StagePanel testId="done">
      <div style={{ fontSize: 14, fontWeight: 600 }}>{screens[s.step].title}</div>
      <Note>{`This step is done. Its results are below, with their explanation, and on the ${MAIN_TABS.results} tab at the top of this panel. The button that moves on is at the end.`}</Note>
      {children}
      <NextRow ctx={ctx} tab={tab} />
    </StagePanel>
  )
}
