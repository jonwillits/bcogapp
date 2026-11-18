import type { ReactNode } from 'react'
import type { ProgressStore } from '../../sim/language/progress/store'
import type { Part } from '../../sim/language/parts'
import type { Tab } from './ui'

/**
 * The All Results tab's registry (Jon, 2026-11-18): each part registers,
 * at module level, one entry per step that saves results, with a test of
 * whether the step is done and a renderer of its results without the
 * explanations, from the saved progress alone. Registered at module level
 * so that a step finished in an earlier session shows without its part's
 * tab having been opened. The parts never import one another; this module
 * imports none of them.
 */
export interface StepResults {
  part: Part
  tab: Tab
  step: number
  title: string
  done: (progress: ProgressStore) => boolean
  render: (progress: ProgressStore) => ReactNode
}

const registry: StepResults[] = []

export function registerStepResults(entries: StepResults[]): void {
  for (const e of entries) if (!registry.some((r) => r.part === e.part && r.step === e.step)) registry.push(e)
}

/** Every registered step, by part and step. */
export function stepResults(): StepResults[] {
  return [...registry].sort((a, b) => a.part - b.part || a.step - b.step)
}
