/**
 * The ranges the Unit tab's sliders span, and the top of the input–output
 * plot. Kept in the sim layer because the acceptance tests reason about them:
 * the healthy cell's measured ceiling has to fall *inside* the plotted range
 * (so the flat top is visible) and the instant-recovery ceiling *outside* it
 * (so the flat top is gone), and both are measured, not set.
 */

/** Total arriving input, b₀ + Σ bᵢxᵢ, along the plot's horizontal axis. */
export const UNIT_INPUT_RANGE = { min: -50, max: 260 } as const

/** Baseline b₀, spikes per second. */
export const BASELINE_RANGE = { min: -10, max: 20, step: 1 } as const
/** Connection strengths bᵢ. */
export const STRENGTH_RANGE = { min: -3, max: 3, step: 0.1 } as const
/** Input rates xᵢ, spikes per second. */
export const RATE_RANGE = { min: 0, max: 30, step: 1 } as const

/**
 * The top of the "sodium inactivation recovery" control — what the panel
 * labels *instant*. A multiplier on the recovery rate, applied only below
 * about −45 mV (see `GateTables`). Measured: at 30 the ceiling is unchanged,
 * at 40–50 it doubles and spikes reflect off the far end of the axon, at 70
 * the cell stalls. Forty-five sits in the working band.
 */
export const INSTANT_RECOVERY = 45
