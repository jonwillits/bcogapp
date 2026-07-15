import styles from './StepControls.module.css'

export interface StepControlsProps {
  playing: boolean
  onPlayPause: () => void
  /** Advance one fixed step while paused. */
  onStep: () => void
  onReset: () => void
  /** Simulation speed multiplier. */
  speed: number
  onSpeedChange: (v: number) => void
  minSpeed?: number
  maxSpeed?: number
}

/**
 * Transport bar for any time-stepped scene: play/pause, single-step, reset,
 * and a speed multiplier. Fully controlled — the scene owns the state.
 */
export function StepControls({
  playing,
  onPlayPause,
  onStep,
  onReset,
  speed,
  onSpeedChange,
  minSpeed = 0.25,
  maxSpeed = 3,
}: StepControlsProps) {
  return (
    <div className={styles.bar}>
      <button
        type="button"
        className={`${styles.btn} ${styles.play}`}
        onClick={onPlayPause}
        aria-label={playing ? 'Pause' : 'Play'}
        title={playing ? 'Pause' : 'Play'}
      >
        {playing ? '❚❚' : '▶'}
      </button>
      <button
        type="button"
        className={styles.btn}
        onClick={onStep}
        disabled={playing}
        aria-label="Step once"
        title="Step once (while paused)"
      >
        ⇥
      </button>
      <button
        type="button"
        className={styles.btn}
        onClick={onReset}
        aria-label="Reset"
        title="Reset"
      >
        ↺
      </button>
      <label className={styles.speed}>
        speed
        <input
          type="range"
          min={minSpeed}
          max={maxSpeed}
          step={0.25}
          value={speed}
          onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
        />
        <span className={styles.speedVal}>{speed.toFixed(2)}×</span>
      </label>
    </div>
  )
}
