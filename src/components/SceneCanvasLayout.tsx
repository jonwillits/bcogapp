import type { ReactNode } from 'react'
import styles from './SceneCanvasLayout.module.css'

interface SceneCanvasLayoutProps {
  /** The r3f <Canvas> (fills the whole area). */
  canvas: ReactNode
  /** Floating panel on the left (usually controls). */
  left?: ReactNode
  /** Floating panel on the right (usually the inspector). */
  right?: ReactNode
  /** Centered bar along the bottom (usually StepControls). */
  bottom?: ReactNode
}

/**
 * Standard scene layout: a full-bleed 3D canvas with floating overlay panels.
 * The overlay layer is click-through except over its panels, so camera drags
 * work everywhere else. Reused by every 3D scene.
 */
export function SceneCanvasLayout({
  canvas,
  left,
  right,
  bottom,
}: SceneCanvasLayoutProps) {
  return (
    <div className={styles.wrap}>
      <div className={styles.canvas}>{canvas}</div>
      <div className={styles.overlay}>
        {left ? <div className={styles.left}>{left}</div> : null}
        {right ? <div className={styles.right}>{right}</div> : null}
        {bottom ? <div className={styles.bottom}>{bottom}</div> : null}
      </div>
    </div>
  )
}
