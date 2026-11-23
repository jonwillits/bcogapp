import { Children, useEffect, useRef, useState, type CSSProperties, type HTMLAttributes, type ReactNode, type RefObject } from 'react'
import { Btn, GroupLabel as BaseGroupLabel, Choice } from '../m06_brain/ui'
import { Content as BaseContent, FixedLines as BaseFixedLines, OrientingPanel, DotPlot, statusStyle } from '../m09_rat/ui'
import { Para as BasePara } from '../m12_planning/ui'

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
export { Btn, Choice, OrientingPanel, DotPlot, statusStyle }

/**
 * Examples in italics (Jon, 2026-11-23; LAB_COMMON_FEATURES §7, §8). A
 * sound, a syllable, a word, a sentence, a token or a prompt named in a text
 * is written ‹so› in the source, and every text component here renders the
 * span in italics. A button's, key's, tab's, screen's or column's name, and
 * a term being defined, stay in curly quotation marks. `naming.test.ts`
 * holds the examples that may no longer be quoted and checks that every
 * marker is paired.
 */
export const ITALIC_OPEN = '‹'
export const ITALIC_CLOSE = '›'

export function rich(text: string): ReactNode {
  if (!text.includes(ITALIC_OPEN)) return text
  const parts = text.split(/‹([^›]*)›/)
  return parts.map((part, i) => (i % 2 ? <i key={i}>{part}</i> : part))
}

/** The same over a component's children: each string child is formatted, anything else passes through. */
export function richChildren(children: ReactNode): ReactNode {
  return Children.map(children, (c) => (typeof c === 'string' ? rich(c) : c))
}

export function Content({ children }: { children: ReactNode }) {
  return <BaseContent>{richChildren(children)}</BaseContent>
}

export function Para({ children }: { children: ReactNode }) {
  return <BasePara>{richChildren(children)}</BasePara>
}

export function FixedLines(props: Parameters<typeof BaseFixedLines>[0]) {
  return <BaseFixedLines {...props} format={rich} />
}

/** Lab 6's Note, with any data attribute passed through, so that a line's presence can be tested on rendered markup. */
export function Note({ children, style, ...rest }: { children: ReactNode; style?: CSSProperties } & HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p {...rest} style={{ margin: 0, fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.45, ...style }}>
      {richChildren(children)}
    </p>
  )
}
export { useStore, useThrottledStore } from '../m09_rat/useStore'
export { row, Countdown, useCountdown } from '../m10_memory/ui'
export { BigChoice, rgbOf } from '../m12_planning/ui'

/** A header over a block of the main panel, with room above it so that it stands off from whatever is above (Jon, 2026-11-19: a line's worth of space before every header). */
/**
 * The loading line (Jon, 2026-11-20): larger than a Note, placed where the
 * content will appear, with a mark that moves while the files come in, so
 * that a slow load reads as working, not frozen. With `done` and `total`
 * a bar fills under the line (Part 1 Step 4's 540 patches). The mark
 * stands still under prefers-reduced-motion.
 */
export function LoadingLine({ text, done, total, testId }: { text: string; done?: number; total?: number; testId?: string }) {
  const bar = done !== undefined && total !== undefined && total > 0
  return (
    <div data-loading data-loading-for={testId} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '6px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: 'var(--text)' }}>
        <span aria-hidden style={{ position: 'relative', width: 44, height: 8, borderRadius: 4, background: 'var(--border)', overflow: 'hidden', flex: 'none' }}>
          <span className="m13-loading-mark" style={{ position: 'absolute', top: 0, left: 0, width: 14, height: 8, borderRadius: 4, background: 'var(--accent)' }} />
        </span>
        <span>{text}</span>
      </div>
      {bar && (
        <div style={{ height: 6, borderRadius: 3, background: 'var(--border)', overflow: 'hidden', maxWidth: 360 }}>
          <div data-loading-bar style={{ width: `${((100 * done) / total).toFixed(1)}%`, height: '100%', background: 'var(--accent)', transition: 'width 120ms linear' }} />
        </div>
      )}
      <style>{'@keyframes m13-loading-mark{from{transform:translateX(0)}to{transform:translateX(30px)}}.m13-loading-mark{animation:m13-loading-mark .8s ease-in-out infinite alternate}@media (prefers-reduced-motion:reduce){.m13-loading-mark{animation:none;left:15px}}'}</style>
    </div>
  )
}

export function GroupLabel({ children }: { children: ReactNode }) {
  return (
    <div style={{ marginTop: 8 }} data-header>
      <BaseGroupLabel>{richChildren(children)}</BaseGroupLabel>
    </div>
  )
}

/** A numbered section of a reveal: its header, then its sentence and its rows. The header carries the room above it. */
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

export interface Column {
  key: string
  label: ReactNode
  align?: 'left' | 'right' | 'center'
  /** The column's cells in the monospace face: numbers, labels, words. */
  mono?: boolean
}

/**
 * A table with labeled rows and columns (Jon, 2026-11-19: every block of
 * results is a table with headers, not a block of aligned text). `columns`
 * name the columns; each row is a record keyed by column. `topHeader` is a
 * header spanning the data columns (the network's label), and `leftHeader`
 * one spanning the rows (the right label), for a table whose two axes have
 * names of their own. `footer` is a line under the table, in the table's
 * face. The first column is the row's own label when `rowHeader` is set.
 */
export function DataTable({ columns, rows, testId, topHeader, leftHeader, rowHeader, footer, style }: { columns: Column[]; rows: Record<string, ReactNode>[]; testId?: string; topHeader?: ReactNode; leftHeader?: ReactNode; rowHeader?: boolean; footer?: ReactNode; style?: CSSProperties }) {
  const cell: CSSProperties = { padding: '2px 8px', fontSize: 11.5, lineHeight: 1.45, whiteSpace: 'nowrap', verticalAlign: 'top' }
  const head: CSSProperties = { ...cell, fontWeight: 400, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }
  const first = leftHeader ? 1 : 0
  return (
    <div style={{ overflowX: 'auto', maxWidth: '100%', alignSelf: 'flex-start', ...style }} data-table={testId ?? true}>
      <table style={{ borderCollapse: 'collapse', color: 'var(--text)' }}>
        <thead>
          {topHeader && (
            <tr>
              {leftHeader ? <th style={{ ...cell, borderBottom: 'none' }} /> : null}
              {rowHeader ? <th style={{ ...cell, borderBottom: 'none' }} /> : null}
              <th colSpan={columns.length - (rowHeader ? 1 : 0)} style={{ ...head, textAlign: 'center', borderBottom: 'none', paddingBottom: 0 }}>
                {topHeader}
              </th>
            </tr>
          )}
          <tr>
            {leftHeader ? <th style={{ ...head, borderBottom: 'none' }} /> : null}
            {columns.map((c) => (
              <th key={c.key} scope="col" style={{ ...head, textAlign: c.align ?? (c.mono ? 'right' : 'left') }}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} data-row={i}>
              {leftHeader && i === 0 ? (
                <th scope="rowgroup" rowSpan={rows.length} style={{ ...head, borderBottom: 'none', textAlign: 'right', verticalAlign: 'middle' }}>
                  {leftHeader}
                </th>
              ) : null}
              {columns.map((c, k) =>
                rowHeader && k === 0 ? (
                  <th key={c.key} scope="row" style={{ ...cell, fontWeight: 400, textAlign: c.align ?? 'left', fontFamily: c.mono ? 'var(--font-mono)' : undefined }}>
                    {r[c.key]}
                  </th>
                ) : (
                  <td key={c.key} style={{ ...cell, textAlign: c.align ?? (c.mono ? 'right' : 'left'), fontFamily: c.mono ? 'var(--font-mono)' : undefined }}>
                    {r[c.key]}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
        {footer && (
          <tfoot>
            <tr>
              <td colSpan={columns.length + first} style={{ ...cell, paddingTop: 6, color: 'var(--text)' }} data-table-footer>
                {footer}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}

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
 * The navigation panel's width (Jon, 2026-11-16, LAB_COMMON_FEATURES §1):
 * its design width, 310 px, but never more than 0.3 of the window; past
 * that, zoomed in, its panels scroll sideways inside themselves rather
 * than growing. The column itself is the one scroll container (no
 * `maxHeight` here), so there is one vertical scrollbar, not one inside
 * another. The main panel takes the rest of the window (Jon, 2026-11-18).
 */
export const LEFT_WIDTH = 'min(310px, 30vw)'
export const PANEL_STYLE: CSSProperties = { width: LEFT_WIDTH, maxWidth: LEFT_WIDTH, overflowX: 'auto' }

/**
 * A step's content in the main panel: a plain column of blocks. The panel
 * itself is the scroll container and draws the border (`MainPanel.tsx`);
 * this is only the column, so a flex column with a capped height never
 * shrinks a child whose overflow is hidden to nothing (Jon, 2026-11-17:
 * Part 4's count table appeared and then vanished). `wide` is kept for the
 * callers; every stage has the panel's whole width now.
 */
export function StagePanel({ children, wide, testId }: { children: ReactNode; wide?: boolean; testId?: string }) {
  return (
    <div data-stage={testId ?? true} data-wide={wide || undefined} style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
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
    // An element on its way out of the layout reports 0; keep the last real width (Jon, 2026-11-20: Step 3's columns shrank to a word after a screen switch).
    const read = () => {
      if (el.clientWidth > 0) setW(Math.floor(el.clientWidth))
    }
    read()
    const ro = new ResizeObserver(read)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return w
}
export { useRef }

/**
 * Scroll the main panel to its top whenever `key` changes: a step opened,
 * Begin pressed, a step finished, the instructions shown again, a tab
 * switched (Jon, 2026-11-21: after Begin on a long instruction screen the
 * step opened scrolled to the bottom, where the button had been). The main
 * panel is the one scroll container (`MainPanel.module.css`).
 */
export function useScrollToTop(key: string): void {
  useEffect(() => {
    const panel = document.querySelector<HTMLElement>('[data-main-panel]')
    if (panel) panel.scrollTop = 0
  }, [key])
}

/** A one-line notice on a results screen or a panel: what is missing, and what fills it in. */
export function Missing({ children, testId }: { children: ReactNode; testId?: string }) {
  return (
    <p data-missing={testId ?? true} style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: 'var(--text-muted)', borderLeft: '2px solid var(--border)', paddingLeft: 8 }}>
      {children}
    </p>
  )
}
