import { useEffect, useRef, useState, type CSSProperties, type HTMLAttributes, type ReactNode, type RefObject } from 'react'
import { Btn, GroupLabel, Choice } from '../m06_brain/ui'
import { Content, FixedLines, OrientingPanel, DotPlot, statusStyle } from '../m09_rat/ui'

/**
 * Small shared pieces for the five tabs. Lab 6's rule holds: selection
 * changes a control's color and never its size (`layout.test.ts`). Lab 7's
 * rule holds: live text never wraps or changes length, a live number that
 * can go negative keeps its sign's place, and a status readout is a block
 * of fixed lines, one fact to a line. Lab 9's conventions hold: a button's
 * or key's name in running text is in quotes, and a block of numbers is a
 * block of aligned rows. Every text is selectable. A large timer and a
 * large line saying what is happening now on every timed screen (Lab 10).
 */
export { Btn, GroupLabel, Choice, Content, FixedLines, OrientingPanel, DotPlot, statusStyle }

/** Lab 6's Note, with any data attribute passed through, so that a line's presence can be tested on rendered markup. */
export function Note({ children, style, ...rest }: { children: ReactNode; style?: CSSProperties } & HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p {...rest} style={{ margin: 0, fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.45, ...style }}>
      {children}
    </p>
  )
}
export { useStore, useThrottledStore } from '../m09_rat/useStore'
export { row, Countdown, useCountdown } from '../m10_memory/ui'
export { BigChoice, Section, Para, rgbOf } from '../m12_planning/ui'

export type Tab = 'open' | 'sounds' | 'stream' | 'words' | 'predictors'

/** The tabs: neutral names that say nothing about what any experiment tests (spec §11, items 2 to 4). */
export const TABS: { id: Tab; title: string; part: string }[] = [
  { id: 'open', title: 'Open', part: 'Part 0' },
  { id: 'sounds', title: 'Sounds', part: 'Part 1' },
  { id: 'stream', title: 'Stream', part: 'Part 2' },
  { id: 'words', title: 'Words', part: 'Part 3' },
  { id: 'predictors', title: 'Predictors', part: 'Part 4' },
]

export const PART_TITLES: Record<Tab, string> = {
  open: 'Part 0 — General Lab Instructions',
  sounds: 'Part 1 — Sounds',
  stream: 'Part 2 — Stream',
  words: 'Part 3 — Words',
  predictors: 'Part 4 — Predictors',
}

/** The tab that follows each part, for “Go on to Part n”. */
export const NEXT_TAB: Record<Tab, Tab | null> = { open: 'sounds', sounds: 'stream', stream: 'words', words: 'predictors', predictors: null }

export function TabBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <div style={{ display: 'flex', gap: 3 }} role="tablist">
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={tab === t.id}
          onClick={() => onChange(t.id)}
          style={{
            flex: 1,
            padding: '5px 1px',
            fontSize: 11,
            lineHeight: 1.15,
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)',
            cursor: 'pointer',
            background: tab === t.id ? 'var(--accent)' : 'transparent',
            color: tab === t.id ? '#0b111c' : 'var(--text)',
            fontWeight: 600,
          }}
        >
          {t.title}
          <div style={{ fontSize: 8.5, fontWeight: 400, opacity: 0.8 }}>{t.part}</div>
        </button>
      ))}
    </div>
  )
}

/**
 * The columns' widths (Jon, 2026-11-16, LAB_COMMON_FEATURES §1): a side
 * column is its design width, 310 px on the left and 440 px on the right,
 * but never more than 0.3 of the window; past that, zoomed in, the panel
 * scrolls sideways inside itself rather than growing. The column itself is
 * the one scroll container (no `maxHeight` here), so there is one vertical
 * scrollbar per column, not one inside another. The center panel sits
 * between the columns, 0.05 of the window from each, and never wider than
 * its design width.
 */
export const LEFT_WIDTH = 'min(310px, 30vw)'
export const RIGHT_WIDTH = 'min(440px, 30vw)'
export const PANEL_STYLE: CSSProperties = { width: LEFT_WIDTH, maxWidth: LEFT_WIDTH, overflowX: 'auto' }
export const RIGHT_STYLE: CSSProperties = { width: RIGHT_WIDTH, maxWidth: RIGHT_WIDTH, overflowX: 'auto' }
/** The gap between a side column and the center panel, as a share of the window. */
const CENTER_GAP = '5vw'
/** The room between the columns' gaps: the window minus the layout's 12 px padding on each side, both columns, a reserved scrollbar gutter on each (16 px), and both gaps. */
export const STAGE_ROOM = `calc(100vw - 24px - 32px - ${LEFT_WIDTH} - ${RIGHT_WIDTH} - 2 * ${CENTER_GAP})`
/** The center panel's width: its design width, or the room when that is less. It never grows past the room; what does not fit scrolls sideways inside the panel. */
export const stageWidth = (max: number) => `min(${max}px, ${STAGE_ROOM})`
/** The center panel's left edge: after the left column and its gap, plus half of whatever room the panel does not use, so that it sits centered between the columns with equal gaps. */
export const stageLeft = (max: number) => `calc(12px + 16px + ${LEFT_WIDTH} + ${CENTER_GAP} + max(0px, (${STAGE_ROOM} - ${max}px) / 2))`

/** The center panel: positioned between the columns, scrolling vertically inside itself when tall, never horizontally for text (text wraps; only a fixed-width block can be wider). */
export function StagePanel({ children, wide, testId }: { children: ReactNode; wide?: boolean; testId?: string }) {
  return (
    <div
      data-stage={testId ?? true}
      style={{ position: 'absolute', left: stageLeft(wide ? 760 : 560), top: 24, width: stageWidth(wide ? 760 : 560), maxHeight: 'calc(100vh - 120px)', overflowY: 'auto', overflowX: 'auto', padding: '16px 20px', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12.5, lineHeight: 1.55, display: 'flex', flexDirection: 'column', gap: 10, pointerEvents: 'auto', boxSizing: 'border-box' }}
    >
      {children}
    </div>
  )
}

/** The width of a container in CSS pixels, read after layout and on resize, so that a row of canvases can share the room; the fallback is used when there is no layout (tests, the first render). */
export function useWidth(ref: RefObject<HTMLElement | null>, fallback: number): number {
  const [w, setW] = useState(fallback)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const read = () => setW(Math.max(1, Math.floor(el.clientWidth)))
    read()
    const ro = new ResizeObserver(read)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return w
}
export { useRef }

/** A one-line notice on a results screen or a panel: what is missing, and what fills it in. */
export function Missing({ children, testId }: { children: ReactNode; testId?: string }) {
  return (
    <p data-missing={testId ?? true} style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: 'var(--text-muted)', borderLeft: '2px solid var(--border)', paddingLeft: 8 }}>
      {children}
    </p>
  )
}
