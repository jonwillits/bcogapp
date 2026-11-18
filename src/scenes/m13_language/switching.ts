import { MAIN_TABS, type Consequence, type UnderWay } from './params'
import { TABS, type Tab } from './ui'

/**
 * Leaving a step while something is under way (Jon, 2026-11-18): the
 * policy comes from `params.yaml` (what can be under way on each step and
 * its consequence: pause, restart, or continue), the stores report what is
 * under way now, and this module gives the words: the in-page dialog that
 * asks before a switch, the pause screen, and the phrases the instruction
 * screens build their pausing lines from. Every line here is built from
 * the file's values, so a change there changes what the student reads.
 */

/** What a store reports is under way on its current step, with the file's consequence for it. */
export interface Busy {
  what: UnderWay
  consequence: Consequence
  /** Minutes a pause may last; null for no limit; undefined when the step does not pause. */
  limitMinutes: number | null | undefined
}

/** Where a switch goes: the All Results tab, another part's tab, or another step of this part. */
export type SwitchTarget = { kind: 'results' } | { kind: 'tab'; tab: Tab } | { kind: 'step'; step: number }

export const UNDER_WAY_LINE: Record<UnderWay, string> = {
  labels: 'Your six labels are under way and not yet committed.',
  block: 'A block of trials is running.',
  minute: 'The minute is under way and your answer is not yet committed.',
  trials: 'The learning trials are under way.',
  test: 'The test is under way.',
  run: 'A run is going.',
}

/** What starts again, for each thing that can be under way, as the clause after “when you come back,”. */
export const RESTART_PHRASE: Record<UnderWay, string> = {
  labels: 'the same six syllables appear again from the start, in a new order',
  block: 'the block starts again from its first trial',
  minute: 'the minute plays again from the start',
  trials: 'the 60 trials and the test start again from the first trial, with a new set of words and objects',
  test: 'the 60 trials and the test start again from the first trial, with a new set of words and objects',
  run: 'the run starts again',
}

/** The three ways to leave a step, named as the instruction screens name them. */
export const LEAVING_PHRASE = `going to another step, another part, or the ${MAIN_TABS.results} tab`

export function targetName(t: SwitchTarget): string {
  if (t.kind === 'results') return `the ${MAIN_TABS.results} tab`
  if (t.kind === 'tab') return `Part ${TABS.findIndex((x) => x.id === t.tab)}`
  return `Step ${t.step}`
}

function targetShort(t: SwitchTarget): string {
  if (t.kind === 'results') return MAIN_TABS.results
  if (t.kind === 'tab') return `Part ${TABS.findIndex((x) => x.id === t.tab)}`
  return `Step ${t.step}`
}

export interface SwitchDialog {
  title: string
  lines: string[]
  confirm: string
  cancel: string
}

/** The in-page dialog before a switch: what is under way, what the switch does to it, and the two buttons. */
export function switchDialog(target: SwitchTarget, busy: Busy): SwitchDialog {
  const t = targetName(target)
  const restart = RESTART_PHRASE[busy.what]
  let line: string
  if (busy.consequence === 'pause') {
    const L = busy.limitMinutes ?? null
    line =
      L === null
        ? `If you go to ${t} now, this step pauses where it is, for as long as you like, and goes on from there when you come back.`
        : `If you go to ${t} now, this step pauses where it is, for up to ${L} minutes. Come back within that time and it goes on from where it stopped. Later, ${restart}, and the restart is noted on the results screen.`
  } else if (busy.consequence === 'restart') line = `If you go to ${t} now, ${restart} when you come back, and the restart is noted on the results screen.`
  else line = `If you go to ${t} now, it keeps going while you are away, and its plots and tables are here when you come back. Nothing is lost.`
  return { title: 'Before you go', lines: [UNDER_WAY_LINE[busy.what], line], confirm: `Go to ${targetShort(target)}`, cancel: 'Stay here' }
}

/** The pause screen's lines, under its timer. */
export function pauseLines(what: UnderWay, limitMinutes: number | null): string[] {
  const restart = RESTART_PHRASE[what]
  if (limitMinutes === null) return ['This step is paused. It goes on from where it stopped when you press “Resume”, however long you wait.', `If you close or reload the page instead, ${restart}, and the restart is noted on the results screen.`]
  return [`This step is paused. Press “Resume” within ${limitMinutes} minutes and it goes on from where it stopped.`, `After ${limitMinutes} minutes, or if you close or reload the page, ${restart}, and the restart is noted on the results screen.`]
}

/** The line on the step after a pause ran past its limit. */
export function pauseExpiredLine(what: UnderWay, limitMinutes: number): string {
  return `The pause ran past ${limitMinutes} minutes, so ${RESTART_PHRASE[what]}.`
}

/** For an instruction screen's Pausing section: what Pause and a switch do on a step that pauses. */
export function pauseClause(limit: number | null): string {
  return limit === null
    ? `“Pause” pauses the step for as long as you like, and ${LEAVING_PHRASE} pauses it too; it goes on from where it stopped when you come back.`
    : `“Pause” pauses the step for up to ${limit} minutes, and ${LEAVING_PHRASE} pauses it too; come back within that time and it goes on from where it stopped.`
}

/** For the same section: when what was under way starts again, on a step that pauses. */
export function restartClause(limit: number | null, restart: string): string {
  return limit === null ? `If you close or reload the page partway, ${restart}, and the restart is noted on the results screen.` : `Past ${limit} minutes, or if you close or reload the page, ${restart}, and the restart is noted on the results screen.`
}

/** The minutes and seconds of a pause, as the pause screen's timer prints them. */
export function pausedFor(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
