import type { CSSProperties, ReactNode } from 'react'
import { KIND_LABEL, type Kind } from '../../sim/brain/bench'

/**
 * Small shared pieces for the four tabs.
 *
 * One rule for every control here: **selection changes a control's color and
 * never its size.** A selected chip used to go bold, bold is wider, and a row
 * of chips that just fit then wrapped onto a second line the moment one was
 * chosen (Jon, 2026-09-27, on the Plan tab's view choices). So font weight,
 * padding and border width are constants, and `layout.test.ts` checks that
 * no control in this scene keys any of them on its state.
 */

export type Tab = 'specimens' | 'plan' | 'tree' | 'bench'

export const TABS: { id: Tab; title: string; part: string }[] = [
  { id: 'specimens', title: 'Specimens', part: 'Part 1' },
  { id: 'plan', title: 'Plan', part: 'Part 1' },
  { id: 'tree', title: 'Tree', part: 'Part 1' },
  { id: 'bench', title: 'Bench', part: 'Part 2' },
]

export function TabBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <div style={{ display: 'flex', gap: 4 }} role="tablist">
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={tab === t.id}
          onClick={() => onChange(t.id)}
          style={{
            flex: 1,
            padding: '5px 4px',
            fontSize: 11.5,
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

export function GroupLabel({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', paddingBottom: 3, marginTop: 2 }}>
      {children}
    </div>
  )
}

export function Note({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <p style={{ margin: 0, fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.45, ...style }}>{children}</p>
}

export function Btn({ children, onClick, primary, disabled, title, small }: { children: ReactNode; onClick: () => void; primary?: boolean; disabled?: boolean; title?: string; small?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        padding: small ? '3px 8px' : '6px 10px',
        fontSize: small ? 11 : 12.5,
        borderRadius: 'var(--radius-sm)',
        border: `1px solid ${primary ? 'var(--accent)' : 'var(--border)'}`,
        background: primary ? 'var(--accent)' : 'var(--surface-2)',
        color: primary ? '#0b111c' : 'var(--text)',
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
      }}
    >
      {children}
    </button>
  )
}

/** A row of exclusive choices. */
export function Choice<T extends string>({ value, options, onChange, disabledIds }: { value: T | null; options: { id: T; label: string; title?: string }[]; onChange: (v: T) => void; disabledIds?: T[] }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {options.map((o) => {
        const on = value === o.id
        const off = disabledIds?.includes(o.id)
        return (
          <button
            key={o.id}
            type="button"
            title={o.title}
            disabled={off}
            aria-pressed={on}
            onClick={() => onChange(o.id)}
            style={{
              padding: '4px 9px',
              fontSize: 11.5,
              borderRadius: 999,
              border: '1px solid var(--border)',
              cursor: off ? 'not-allowed' : 'pointer',
              background: on ? 'var(--accent)' : 'var(--surface-2)',
              color: on ? '#0b111c' : 'var(--text)',
              fontWeight: 500,
              opacity: off ? 0.4 : 1,
            }}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/** The three result kinds, styled so that none can be mistaken for another. */
export function KindBadge({ kind, claims }: { kind: Kind; claims?: string[] }) {
  const style: CSSProperties =
    kind === 'reported'
      ? { background: '#34d399', color: '#0b111c', border: '1px solid #34d399' }
      : kind === 'follows'
        ? { background: 'transparent', color: '#4f9cff', border: '1px dashed #4f9cff' }
        : { background: '#2a3446', color: '#9aa6b8', border: '1px solid #2a3446' }
  const text = kind === 'follows' && claims?.length ? `follows from ${claims.join(', ')}` : KIND_LABEL[kind]
  return (
    <span data-kind={kind} style={{ ...style, display: 'inline-block', fontSize: 10.5, fontWeight: 600, padding: '1px 7px', borderRadius: 999, whiteSpace: 'nowrap', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }} title={text}>
      {text}
    </span>
  )
}

export function Claims({ ids }: { ids: string[] }) {
  if (!ids.length) return null
  return (
    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--text-muted)' }}>{ids.join(' · ')}</span>
  )
}

/** A stage title over the middle column. */
export function StageTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 15, fontWeight: 700 }}>{children}</div>
      {sub && <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{sub}</div>}
    </div>
  )
}

export const PANEL_STYLE: CSSProperties = { width: 300, maxHeight: 'calc(100vh - 80px)', overflowY: 'auto' }
export const RIGHT_STYLE: CSSProperties = { width: 340, maxHeight: 'calc(100vh - 80px)', overflowY: 'auto' }
