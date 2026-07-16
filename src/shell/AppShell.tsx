import { lazy, Suspense, type ReactNode } from 'react'
import styles from './AppShell.module.css'
import type { LabSource } from '../scenes/registry'

// Lazy so the markdown renderer only loads when a student opens the lab pane —
// it would otherwise sit in the initial bundle that every visit pays for.
const LabPane = lazy(() =>
  import('../components/LabPane').then((m) => ({ default: m.LabPane })),
)

interface AppShellProps {
  children: ReactNode
  /** Title of the active scene, if any (shown in the top bar). */
  sceneTitle?: string
  /** Whether a scene (not the home picker) is showing. */
  inScene: boolean
  /** Lab instructions for the active scene, if it has a lab. */
  lab?: LabSource
  labOpen: boolean
  onToggleLab: () => void
}

/**
 * The persistent app frame: a top bar with brand + current-scene context, a
 * Lab toggle, and a "back to scenes" link. When the lab pane is open it takes
 * its own column and the scene shrinks to fit (rather than being covered), so
 * students can read the instructions while still driving the simulation.
 */
export function AppShell({
  children,
  sceneTitle,
  inScene,
  lab,
  labOpen,
  onToggleLab,
}: AppShellProps) {
  return (
    <div className={styles.shell}>
      <header className={styles.bar}>
        <a className={styles.brand} href="#/">
          <img src="app-icon.svg" alt="" />
          <span>BCOG&nbsp;100</span>
        </a>
        {inScene && sceneTitle && (
          <>
            <span className={styles.sep}>/</span>
            <span className={styles.sceneTitle}>{sceneTitle}</span>
          </>
        )}
        {lab && (
          <button
            type="button"
            className={`${styles.barBtn} ${labOpen ? styles.barBtnOn : ''}`}
            onClick={onToggleLab}
            aria-pressed={labOpen}
            title={labOpen ? 'Hide lab instructions' : 'Show lab instructions'}
          >
            Lab
          </button>
        )}
        <span className={styles.spacer} />
        {inScene && (
          <a className={styles.barBtn} href="#/">
            ← All scenes
          </a>
        )}
      </header>

      <div className={styles.main}>
        {lab && labOpen && (
          <div className={styles.labDrawer}>
            <Suspense fallback={null}>
              <LabPane lab={lab} onClose={onToggleLab} />
            </Suspense>
          </div>
        )}
        <div className={styles.sceneArea}>{children}</div>
      </div>
    </div>
  )
}
