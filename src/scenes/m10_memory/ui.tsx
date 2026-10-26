import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Btn, Note, GroupLabel, Choice } from '../m06_brain/ui'
import { Content, FixedLines, OrientingPanel, DrivePad, DotPlot, statusStyle } from '../m09_rat/ui'
import { countIsRight, nextCount } from '../../sim/memory/words/design'
import { PENDING_LINE, type Reference } from '../../sim/memory/references'
import { REFERENCE_LINE } from './lines'

/**
 * Small shared pieces for the six tabs. Lab 6's rule holds: selection
 * changes a control's color and never its size (`layout.test.ts`). Lab 7's
 * rule holds: live text never wraps or changes length, and a status readout
 * that fills in over time is a block of fixed lines. Lab 9's conventions
 * hold: a button's or key's name in running text is in quotes, and a block
 * of numbers is a block of aligned rows.
 */
export { Btn, Note, GroupLabel, Choice, Content, FixedLines, OrientingPanel, DrivePad, DotPlot, statusStyle }
export { useStore, useThrottledStore } from '../m09_rat/useStore'

export type Tab = 'open' | 'lists' | 'study' | 'room' | 'logs' | 'learners'

/** The tabs: neutral names that hint at nothing Part 1 tests (§12, item 2). */
export const TABS: { id: Tab; title: string; part: string }[] = [
  { id: 'open', title: 'Open', part: 'Part 0' },
  { id: 'lists', title: 'Lists', part: 'Part 1' },
  { id: 'study', title: 'Study', part: 'Part 2' },
  { id: 'room', title: 'Room', part: 'Part 3' },
  { id: 'logs', title: 'Logs', part: 'Part 4' },
  { id: 'learners', title: 'Learners', part: 'Part 5' },
]

export const PART_TITLES: Record<Tab, string> = {
  open: 'Part 0 — General Lab Instructions',
  lists: 'Part 1 — Lists of Words',
  study: 'Part 2 — Two Ways to Study',
  room: 'Part 3 — What Was in the Room?',
  logs: 'Part 4 — Nights at the Logs',
  learners: 'Part 5 — Two Learners',
}

export function TabBar({ tab, onChange, locked }: { tab: Tab; onChange: (t: Tab) => void; locked: Partial<Record<Tab, string | null>> }) {
  return (
    <div style={{ display: 'flex', gap: 3 }} role="tablist">
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={tab === t.id}
          title={locked[t.id] ?? undefined}
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
            color: tab === t.id ? '#0b111c' : locked[t.id] ? 'var(--text-muted)' : 'var(--text)',
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

/**
 * The stage: a panel centered over the view for what a part shows in the
 * middle of the screen (a word, a recall box, a checklist, a results
 * screen). Sized like Lab 9's orienting panel, and wider when asked.
 */
export function StagePanel({ children, wide, testId }: { children: ReactNode; wide?: boolean; testId?: string }) {
  return (
    <div
      data-stage={testId ?? true}
      style={{ position: 'absolute', left: '50%', top: 24, transform: 'translateX(-50%)', width: wide ? 'min(760px, calc(100vw - 800px))' : 'min(560px, calc(100vw - 800px))', minWidth: 380, maxHeight: 'calc(100vh - 120px)', overflowY: 'auto', padding: '16px 20px', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12.5, lineHeight: 1.55, display: 'flex', flexDirection: 'column', gap: 10, pointerEvents: 'auto' }}
    >
      {children}
    </div>
  )
}

/** A big word, centered, as the lists present it. */
export function BigWord({ word }: { word: string | null }) {
  return (
    <div style={{ height: 120, display: 'grid', placeItems: 'center', fontSize: 40, fontWeight: 600, letterSpacing: 0.5 }} data-word={word ?? ''}>
      {word ?? ''}
    </div>
  )
}

/** A countdown that reads *n s left*, fixed width. */
export function Countdown({ left, total }: { left: number; total: number }) {
  return (
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, whiteSpace: 'pre', color: 'var(--text-muted)' }} data-countdown>
      {`${String(Math.max(0, Math.ceil(left))).padStart(3)} s left of ${total}`}
    </div>
  )
}

/** A seconds timer driven by wall-clock time, not animation frames (the in-app browser throttles frames); calls `onDone` once. */
export function useCountdown(running: boolean, seconds: number, onDone: () => void): number {
  const [left, setLeft] = useState(seconds)
  const done = useRef(onDone)
  done.current = onDone
  useEffect(() => {
    if (!running) return
    const t0 = performance.now()
    setLeft(seconds)
    let fired = false
    const id = setInterval(() => {
      const l = seconds - (performance.now() - t0) / 1000
      setLeft(Math.max(0, l))
      if (l <= 0 && !fired) {
        fired = true
        clearInterval(id)
        done.current()
      }
    }, 100)
    return () => clearInterval(id)
  }, [running, seconds])
  return left
}

/**
 * The counting task (spec §5.1): count backward by threes from a number,
 * typing one number at a time; each entry is checked against the correct
 * next number, so that rehearsing instead is not possible. The task runs
 * for `seconds`; a wrong entry is marked and the right one asked for again.
 */
export function CountingTask({ from, seconds, onDone, testId }: { from: number; seconds: number; onDone: (typed: number, wrong: number) => void; testId?: string }) {
  const [typedSoFar, setTyped] = useState(0)
  const [wrong, setWrong] = useState(0)
  const [value, setValue] = useState('')
  const [flash, setFlash] = useState<'right' | 'wrong' | null>(null)
  const counts = useRef({ typed: 0, wrong: 0 })
  const left = useCountdown(true, seconds, () => onDone(counts.current.typed, counts.current.wrong))
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => {
    input.current?.focus()
  }, [])
  const submit = () => {
    if (!value.trim()) return
    if (countIsRight(from, typedSoFar, value)) {
      counts.current.typed++
      setTyped((n) => n + 1)
      setFlash('right')
    } else {
      counts.current.wrong++
      setWrong((n) => n + 1)
      setFlash('wrong')
    }
    setValue('')
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-counting={testId ?? true}>
      <GroupLabel>Count backward</GroupLabel>
      <Note>Count backward by threes from {from}, typing each number and pressing “Enter”. Keep going until the time is up.</Note>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, whiteSpace: 'pre' }}>{`next number  ${String(nextCount(from, typedSoFar)).padStart(4)}   typed ${String(typedSoFar).padStart(3)}   wrong ${String(wrong).padStart(3)}`}</div>
      <input
        ref={input}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit()
        }}
        aria-label="the next number"
        style={{ fontSize: 22, fontFamily: 'var(--font-mono)', padding: '6px 10px', width: 140, background: 'var(--bg)', color: 'var(--text)', border: `2px solid ${flash === 'wrong' ? 'var(--avoid)' : flash === 'right' ? 'var(--actuator)' : 'var(--border)'}`, borderRadius: 'var(--radius-sm)' }}
      />
      <Countdown left={left} total={seconds} />
    </div>
  )
}

/**
 * The typed recall box (spec §5.1): each word is entered with the Enter
 * key and joins a visible list below the box, in the order typed; a
 * countdown runs; *I’m done* ends recall early. The browser is given no
 * way to help: autocomplete, autocorrect, autocapitalize and spellcheck
 * are all off. Nothing typed is scored or compared with anything on this
 * screen.
 */
export function RecallBox({ seconds, onDone, prompt = 'Type every word you remember, one at a time, and press “Enter” after each.', testId }: { seconds: number; onDone: (typed: string[]) => void; prompt?: string; testId?: string }) {
  const [typed, setTyped] = useState<string[]>([])
  const [value, setValue] = useState('')
  const list = useRef<string[]>([])
  const left = useCountdown(true, seconds, () => onDone(list.current))
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => {
    input.current?.focus()
  }, [])
  const add = () => {
    const w = value.trim()
    if (!w) return
    list.current = [...list.current, w]
    setTyped(list.current)
    setValue('')
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-recall={testId ?? true}>
      <GroupLabel>Type the words</GroupLabel>
      <Note>{prompt}</Note>
      <input
        ref={input}
        type="text"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        name="recall-entry"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') add()
        }}
        aria-label="a word you remember"
        style={{ fontSize: 20, padding: '6px 10px', width: 260, background: 'var(--bg)', color: 'var(--text)', border: '2px solid var(--border)', borderRadius: 'var(--radius-sm)' }}
      />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, minHeight: 28 }} data-typed-list>
        {typed.map((w, i) => (
          <span key={i} style={{ padding: '2px 8px', borderRadius: 999, background: 'var(--surface-2)', border: '1px solid var(--border)', fontSize: 12 }}>
            {w}
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <Countdown left={left} total={seconds} />
        <Btn small onClick={() => onDone(list.current)}>
          I’m done
        </Btn>
      </div>
    </div>
  )
}

/** A reference panel (spec §5.4, §6.3, §7.4): the source, the values or the pending line, how the procedure differed, and the reference line. */
export function ReferencePanel({ reference, rows }: { reference: Reference; rows?: string[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 10px', borderRadius: 8, border: '1px dashed var(--border)' }} data-reference={reference.id} data-pending={reference.values ? undefined : true}>
      <GroupLabel>{reference.title}</GroupLabel>
      <Note>{reference.source}; {reference.where}.</Note>
      {reference.values ? (
        <FixedLines lines={rows ?? reference.values.map((v) => `${v.label.padEnd(58)}${typeof v.value === 'number' ? v.value.toFixed(2).padStart(6) : String(v.value).padStart(6)}`)} />
      ) : (
        <Content>{PENDING_LINE}</Content>
      )}
      <Note>How it differed: {reference.differed}</Note>
      <Content>{REFERENCE_LINE}</Content>
    </div>
  )
}

/** A tab that cannot open yet says why, in one line, and names the part that unlocks it (§4.3). */
export function LockedPanel({ title, reason }: { title: string; reason: string }) {
  return (
    <StagePanel testId="locked">
      <div style={{ fontSize: 14, fontWeight: 600 }}>{title}</div>
      <Note>{reason}</Note>
    </StagePanel>
  )
}

/** The row convention of Lab 9: a label padded to one width, the value right-aligned. */
export const row = (label: string, value: string | number, width = 40, digits = 2) => `${label.padEnd(width)}${(typeof value === 'number' ? value.toFixed(digits) : value).padStart(7)}`

/** A per-item shown-duration record, for the walk-through's timing line (as Lab 8's glimpses). */
export interface ShownRecord {
  index: number
  shownMs: number
}

export function shownSummary(records: ShownRecord[]): string | null {
  if (!records.length) return null
  const v = records.map((r) => r.shownMs)
  const mean = v.reduce((a, b) => a + b, 0) / v.length
  return `Words shown: ${v.length}, mean ${Math.round(mean)} ms, from ${Math.round(Math.min(...v))} to ${Math.round(Math.max(...v))} ms.`
}
