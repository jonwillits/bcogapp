import styles from './ValueReadout.module.css'

/**
 * A labeled numeric readout — the number a lab handout asks the student to read
 * off the screen. Monospaced, tabular figures so values don't jitter.
 */
export function ValueReadout({
  label,
  value,
  unit,
  digits = 2,
}: {
  label: string
  value: number | string
  unit?: string
  digits?: number
}) {
  const text =
    typeof value === 'number' ? value.toFixed(digits) : value
  return (
    <div className={styles.readout}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>
        {text}
        {unit && <span className={styles.unit}>{unit}</span>}
      </span>
    </div>
  )
}
