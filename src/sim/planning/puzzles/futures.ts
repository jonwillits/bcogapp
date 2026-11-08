/**
 * The futures panel (spec §6.3): the number of possible sequences of
 * `steps` choices with `options` at each, and how long it would take to
 * examine them all at about ten states a minute, the rate the chapter gives
 * for people thinking aloud (§12.2.2). Two presets reproduce the chapter's
 * numbers: 2 options and 3 steps (8 sequences); 30 options and 3 steps
 * (27,000 sequences, about 45 hours).
 */

export const STATES_PER_MINUTE = 10

export function sequences(options: number, steps: number): number {
  return options ** steps
}

/** Minutes to examine every sequence at ten states a minute. */
export function minutesToExamine(options: number, steps: number): number {
  return sequences(options, steps) / STATES_PER_MINUTE
}

/** A length of time in words: minutes, hours, days or years, rounded. */
export function timeInWords(minutes: number): string {
  if (minutes < 1) return 'less than a minute'
  if (minutes < 90) return `about ${Math.round(minutes)} minute${Math.round(minutes) === 1 ? '' : 's'}`
  const hours = minutes / 60
  if (hours < 48) return `about ${Math.round(hours)} hours`
  const days = hours / 24
  if (days < 730) return `about ${Math.round(days).toLocaleString('en-US')} days`
  const years = days / 365.25
  if (years < 1e6) return `about ${Math.round(years).toLocaleString('en-US')} years`
  return `about ${years.toExponential(1)} years`
}

export const FUTURES_PRESETS = [
  { label: '2 options, 3 steps', options: 2, steps: 3 },
  { label: '30 options, 3 steps', options: 30, steps: 3 },
] as const
