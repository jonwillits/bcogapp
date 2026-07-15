import type { ReactNode } from 'react'
import styles from './controls.module.css'

/** A labeled slider with a live value readout. */
export function Slider({
  label,
  value,
  min,
  max,
  step = 0.01,
  format,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  format?: (v: number) => string
  onChange: (v: number) => void
}) {
  return (
    <div className={styles.field}>
      <div className={styles.fieldRow}>
        <span className={styles.label}>{label}</span>
        <span className={styles.value}>
          {format ? format(value) : value.toFixed(2)}
        </span>
      </div>
      <input
        className={styles.slider}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </div>
  )
}

/** A labeled dropdown. */
export function SelectControl<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label?: string
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className={styles.field}>
      {label && <span className={styles.label}>{label}</span>}
      <select
        className={styles.select}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}

/** A checkbox toggle. */
export function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className={styles.toggle}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  )
}

/** A button; `variant="primary"` for the main action. */
export function Button({
  children,
  onClick,
  variant = 'default',
  title,
}: {
  children: ReactNode
  onClick: () => void
  variant?: 'default' | 'primary'
  title?: string
}) {
  return (
    <button
      type="button"
      title={title}
      className={`${styles.button} ${
        variant === 'primary' ? styles.buttonPrimary : ''
      }`}
      onClick={onClick}
    >
      {children}
    </button>
  )
}
