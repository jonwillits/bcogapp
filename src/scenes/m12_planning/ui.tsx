import type { CSSProperties, ReactNode } from 'react'
import { Btn, Note, GroupLabel, Choice } from '../m06_brain/ui'
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
export { Btn, Note, GroupLabel, Choice, Content, FixedLines, OrientingPanel, DotPlot, statusStyle }
export { useStore, useThrottledStore } from '../m09_rat/useStore'
export { StagePanel, row } from '../m10_memory/ui'

export type Tab = 'open' | 'choices' | 'puzzles' | 'band' | 'corn'

/** The tabs: neutral names that hint at nothing Part 1's choices or Part 2's looking task test (spec §11, items 2 and 3). */
export const TABS: { id: Tab; title: string; part: string }[] = [
  { id: 'open', title: 'Open', part: 'Part 0' },
  { id: 'choices', title: 'Choices', part: 'Part 1' },
  { id: 'puzzles', title: 'Puzzles', part: 'Part 2' },
  { id: 'band', title: 'Band', part: 'Part 3' },
  { id: 'corn', title: 'Corn', part: 'Part 4' },
]

export const PART_TITLES: Record<Tab, string> = {
  open: 'Part 0 — General Lab Instructions',
  choices: 'Part 1 — Choices',
  puzzles: 'Part 2 — Puzzles',
  band: 'Part 3 — What They Carried',
  corn: 'Part 4 — Two Trays',
}

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

/** Two or more choices as a row of large buttons, the chosen one colored: Option A or Option B, Take this path, and the like. */
export function BigChoice<T extends string>({ value, options, onChange, testId, disabled }: { value: T | null; options: { id: T; label: string }[]; onChange: (v: T) => void; testId?: string; disabled?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 8 }} data-choice={testId}>
      {options.map((o) => {
        const on = value === o.id
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={on}
            disabled={disabled}
            onClick={() => onChange(o.id)}
            style={{ flex: 1, padding: '10px 0', fontSize: 14, fontWeight: 600, borderRadius: 'var(--radius-sm)', border: '2px solid var(--border)', background: on ? 'var(--accent)' : 'var(--surface-2)', color: on ? '#0b111c' : 'var(--text)', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1 }}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/** A step's buttons in a column: Begin on the instruction screen; Go back, Go to, Go on and Redo on every step (Lab 9's orienting panel). */
export function StepButtons({ step, steps, state, onBack, onGo, onRedo, labels }: { step: number; steps: number; state: 'intro' | 'open' | 'done'; onBack: () => void; onGo: (s: number) => void; onRedo: () => void; labels?: string[] }) {
  const name = (s: number) => labels?.[s - 1] ?? `Step ${s}`
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }} data-step-buttons>
      {step > 1 && <Btn small onClick={onBack}>Go back to {name(step - 1)}</Btn>}
      {step < steps && (
        <Btn small onClick={() => onGo(step + 1)}>
          {state === 'done' ? 'Go on to' : 'Go to'} {name(step + 1)}
        </Btn>
      )}
      {state !== 'intro' && (
        <Btn small onClick={onRedo}>
          Redo {name(step)}
        </Btn>
      )}
    </div>
  )
}

/** A heading with a short explanation under it, on a results screen. */
export function Section({ n, title, children }: { n?: number; title: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }} data-section={n ?? title}>
      <GroupLabel>
        {n !== undefined ? `${n}. ` : ''}
        {title}
      </GroupLabel>
      {children}
    </div>
  )
}

/** A sentence of explanation, in the body color. */
export function Para({ children }: { children: ReactNode }) {
  return <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: 'var(--text)' }}>{children}</p>
}

/** A hex color as its three channels, for a canvas. */
export function rgbOf(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}
