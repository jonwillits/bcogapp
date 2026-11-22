import type { ReactNode } from 'react'
import styles from './MainPanel.module.css'
import { MAIN_TABS } from './params'
import { Btn, useScrollToTop } from './ui'
import type { SwitchDialog } from './switching'

export type MainTab = 'current' | 'results'

/**
 * The main panel (Jon, 2026-11-18): the tab strip, the panel, and the dialog
 * that asks before a switch. The current part stays mounted while the All
 * Results tab shows: it is hidden, not unmounted, so a run or a paused
 * step keeps its state and its canvases. The results tab is mounted only
 * while it shows. The two tab names come from `params.yaml`. A tab switch
 * opens the panel at its top (`useScrollToTop`; the steps do the same).
 */
export function MainPanel({ tab, onTab, current, results, dialog }: { tab: MainTab; onTab: (t: MainTab) => void; current: ReactNode; results: ReactNode; dialog: (SwitchDialog & { onConfirm: () => void; onCancel: () => void }) | null }) {
  useScrollToTop(tab)
  return (
    <>
      <div className={styles.tabs} role="tablist" data-main-tabs>
        {(['current', 'results'] as const).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} data-main-tab={t} className={tab === t ? styles.tabOn : styles.tab} onClick={() => onTab(t)}>
            {MAIN_TABS[t]}
          </button>
        ))}
      </div>
      <div className={styles.panel} data-main-panel={tab}>
        <div style={{ display: tab === 'current' ? 'block' : 'none' }} data-current-part>
          {current}
        </div>
        {tab === 'results' && <div data-all-results-tab>{results}</div>}
      </div>
      {dialog && (
        <div className={styles.overlay} data-switch-dialog>
          <div className={styles.dialog} role="dialog" aria-label={dialog.title}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{dialog.title}</div>
            {dialog.lines.map((l) => (
              <p key={l} style={{ margin: 0 }}>
                {l}
              </p>
            ))}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <Btn primary onClick={dialog.onConfirm}>
                {dialog.confirm}
              </Btn>
              <Btn onClick={dialog.onCancel}>{dialog.cancel}</Btn>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
