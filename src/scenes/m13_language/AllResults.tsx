import type { ProgressStore } from '../../sim/language/progress/store'
import { Btn, FixedLines, GroupLabel, Note, PART_TITLES, StagePanel, useStore, type Tab } from './ui'
import { MAIN_TABS } from './params'
import { progressRows } from './Part0'
import { stepResults } from './results'

const PART_TABS: Record<1 | 2 | 3 | 4, Tab> = { 1: 'sounds', 2: 'stream', 3: 'words', 4: 'predictors' }

/**
 * The All Results tab (Jon, 2026-11-18): every finished step's results
 * without the explanations, for the report, grouped by part and step, each
 * with a button back to the step on the current-part tab, where the same
 * results are explained. Nothing is shown for a step that is not done, and
 * nothing of Part 4, whose explorations save nothing.
 */
export function AllResults({ progress, go }: { progress: ProgressStore; go: (tab: Tab, step: number) => void }) {
  useStore(progress)
  const entries = stepResults()
  return (
    <StagePanel testId="all-results">
      <div style={{ fontSize: 14, fontWeight: 600 }}>{MAIN_TABS.results}</div>
      <Note style={{ color: 'var(--text)', fontSize: 12.5 }}>{`Every finished experiment’s results, without the explanations, for your report. Under each one, “Show this step with its explanation” opens the step on the “${MAIN_TABS.current}” tab, where the same results are explained. A step appears here once it is done.`}</Note>
      <FixedLines lines={progressRows(progress)} testId="results-all" />
      {([1, 2, 3, 4] as const).map((part) => {
        const tab = PART_TABS[part]
        const finished = entries.filter((e) => e.part === part && e.done(progress))
        return (
          <div key={part} style={{ display: 'flex', flexDirection: 'column', gap: 10 }} data-results-part={part}>
            <GroupLabel>{PART_TITLES[tab]}</GroupLabel>
            {part === 4 ? (
              <Note>Part 4 is an exploration. Nothing in it is saved, so it has no results here; its screens are on its own tab.</Note>
            ) : finished.length === 0 ? (
              <Note>{`No experiment of Part ${part} is finished yet.`}</Note>
            ) : (
              finished.map((e) => (
                <div key={e.step} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8 }} data-step-results={`${part}-${e.step}`}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{e.title}</div>
                  {e.render(progress)}
                  <div>
                    <Btn small onClick={() => go(tab, e.step)}>
                      Show this step with its explanation
                    </Btn>
                  </div>
                </div>
              ))
            )}
          </div>
        )
      })}
    </StagePanel>
  )
}
