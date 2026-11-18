import type { ReactNode } from 'react'
import styles from './ColumnsLayout.module.css'

/**
 * Lab 13's layout (Jon, 2026-11-18): a full-bleed field with two panels over
 * it. The navigation panel is the column on the left: the header, the part
 * tabs, the step buttons, Begin and Go on. The main panel takes the rest of
 * the window: a tab strip at its top edge (the current part, all results)
 * and the panel under it, which is the one scroll container for everything
 * a part shows. The columns never stack (the shared SceneCanvasLayout stacks
 * them under 720 px, which a zoomed window reaches); past 0.3 of the window
 * the navigation panel's panels scroll sideways inside themselves instead.
 */
export function ColumnsLayout({ canvas, nav, main }: { canvas: ReactNode; nav: ReactNode; main: ReactNode }) {
  return (
    <div className={styles.wrap}>
      <div className={styles.canvas}>{canvas}</div>
      <div className={styles.overlay}>
        <div className={styles.nav}>{nav}</div>
        <div className={styles.main}>{main}</div>
      </div>
    </div>
  )
}
