/**
 * Palette tokens mirrored from theme.css for use inside Three.js / r3f, where
 * CSS variables aren't available (materials need concrete color strings).
 * Keep in sync with theme.css — that file is the source of truth for the DOM.
 */
export const palette = {
  bg: '#0e1420',
  surface: '#161d2b',
  surface2: '#1e2738',
  border: '#2a3446',
  text: '#e7ecf3',
  textMuted: '#9aa6b8',
  accent: '#4f9cff',
  accentStrong: '#2f7de0',
  sensor: '#f0a94b',
  actuator: '#34d399',
  approach: '#34d399',
  avoid: '#f87171',
} as const

export type Palette = typeof palette
