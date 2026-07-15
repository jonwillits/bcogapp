import type { ReactNode } from 'react'
import styles from './AppShell.module.css'

interface AppShellProps {
  children: ReactNode
  /** Title of the active scene, if any (shown in the top bar). */
  sceneTitle?: string
  /** Whether a scene (not the home picker) is showing. */
  inScene: boolean
}

/**
 * The persistent app frame: a top bar with brand + current-scene context and a
 * "back to scenes" link, and a flexible main region the routed content fills.
 * Kept deliberately thin — reusable scene chrome (panels, camera, controls)
 * lands in src/components/ during Phase 2.
 */
export function AppShell({ children, sceneTitle, inScene }: AppShellProps) {
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
        <span className={styles.spacer} />
        {inScene && (
          <a className={styles.back} href="#/">
            ← All scenes
          </a>
        )}
      </header>
      <main className={styles.main}>{children}</main>
    </div>
  )
}
