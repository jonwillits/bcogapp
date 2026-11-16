import type { ReactNode } from 'react'
import styles from './ColumnsLayout.module.css'

/**
 * Lab 13's layout: a full-bleed field with a left and a right column over
 * it and the center panel positioned between them by `ui.tsx`'s stageLeft
 * and `stageWidth`. The columns never stack (the shared SceneCanvasLayout
 * stacks them under 720 px, which a zoomed window reaches); past 0.3 of the
 * window a column's panels scroll sideways inside themselves instead. The
 * middle grid cell is left empty on purpose: a child there would take the
 * overlay's pointer events and sit over the center panel (Jon, 2026-11-16).
 */
export function ColumnsLayout({ canvas, left, right }: { canvas: ReactNode; left: ReactNode; right: ReactNode }) {
  return (
    <div className={styles.wrap}>
      <div className={styles.canvas}>{canvas}</div>
      <div className={styles.overlay}>
        <div className={styles.left}>{left}</div>
        <div className={styles.right}>{right}</div>
      </div>
    </div>
  )
}
