import type { CSSProperties, HTMLAttributes, ReactNode } from 'react'
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
export { StagePanel, row, Countdown, useCountdown } from '../m10_memory/ui'
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

export const PANEL_STYLE: CSSProperties = { width: 310, maxHeight: 'calc(100vh - 84px)', overflowY: 'auto' }
export const RIGHT_STYLE: CSSProperties = { width: 440, maxHeight: 'calc(100vh - 84px)', overflowY: 'auto' }

/** A one-line notice on a results screen or a panel: what is missing, and what fills it in. */
export function Missing({ children, testId }: { children: ReactNode; testId?: string }) {
  return (
    <p data-missing={testId ?? true} style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: 'var(--text-muted)', borderLeft: '2px solid var(--border)', paddingLeft: 8 }}>
      {children}
    </p>
  )
}
