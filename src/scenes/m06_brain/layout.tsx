import type { ReactNode } from 'react'

/**
 * Three columns: the tab bar and controls, a scrolling stage, an inspector.
 * No canvas, so the shared `SceneCanvasLayout` (a full-bleed canvas with
 * floating panels) is not the right frame: a gallery of thirteen
 * photographs needs its own space.
 */
export function BrainLayout({ header, left, stage, right }: { header?: ReactNode; left: ReactNode; stage: ReactNode; right: ReactNode }) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', gap: 12, padding: 12, overflow: 'hidden' }}>
      <div style={{ flex: '0 0 auto', maxHeight: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {header}
        {left}
      </div>
      <div style={{ flex: '1 1 auto', minWidth: 0, maxHeight: '100%', overflowY: 'auto', padding: '4px 6px' }}>{stage}</div>
      <div style={{ flex: '0 0 auto', maxHeight: '100%', overflowY: 'auto' }}>{right}</div>
    </div>
  )
}
