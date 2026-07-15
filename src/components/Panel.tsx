import type { ReactNode } from 'react'
import styles from './Panel.module.css'

interface PanelProps {
  title: ReactNode
  children: ReactNode
  /** Show a close button and call this when clicked. */
  onClose?: () => void
  /** Optional element rendered at the right of the header (e.g. a badge). */
  headerAccessory?: ReactNode
  style?: React.CSSProperties
}

/** A floating, frosted panel used for control and inspector overlays. */
export function Panel({
  title,
  children,
  onClose,
  headerAccessory,
  style,
}: PanelProps) {
  return (
    <div className={styles.panel} style={style}>
      <div className={styles.header}>
        <span className={styles.title}>{title}</span>
        <span className={styles.spacer} />
        {headerAccessory}
        {onClose && (
          <button
            type="button"
            className={styles.close}
            onClick={onClose}
            aria-label="Close panel"
          >
            ×
          </button>
        )}
      </div>
      <div className={styles.body}>{children}</div>
    </div>
  )
}
