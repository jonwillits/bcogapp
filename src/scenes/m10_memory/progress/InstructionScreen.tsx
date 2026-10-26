import type { ReactNode } from 'react'
import { Btn, GroupLabel, Note } from '../../m06_brain/ui'
import { Content } from '../../m09_rat/ui'

/**
 * The instruction screen every part and every step opens on (spec §4.1):
 * a large panel front and center, with Begin. It says, in this order, in
 * short sentences: what the student will do, concretely; how long it
 * takes; whether it can be paused; what to have ready; and the keys or
 * buttons, where there are any. It never says what an experiment is
 * testing where knowing it would change the result; the caller's `willDo`
 * lines carry that discipline (and `naming.test.ts` the string tests).
 */

export type Sitting = 'one sitting' | 'leave any time'

export const SITTING_LINES: Record<Sitting, string> = {
  'one sitting': 'Once you press “Begin”, finish this part in one sitting. If you leave partway, you will start this part again with new materials.',
  'leave any time': 'You can leave and come back at any time.',
}

export const READY_DEFAULT = 'Nothing to have on hand: you type into the app. The report is filled in from the results screens afterward.'

export function minutesLine(minutes: number): string {
  return minutes === 1 ? 'About 1 minute.' : `About ${minutes} minutes.`
}

export interface InstructionScreenProps {
  title: string
  /** What the student will do, concretely, one short sentence or two per line. Lines starting with "- " are bullets. */
  willDo: string[]
  minutes: number
  sitting: Sitting
  /** What to have ready. */
  ready?: string
  /** The keys or buttons, one per line. */
  keys?: string[]
  /** Content lines (spec §11), each on its own accent bar. */
  content?: string[]
  onBegin: () => void
  beginLabel?: 'Begin'
  disabled?: boolean
  /** Other buttons beside Begin: Go back, Go to, Redo. */
  extra?: ReactNode
  /** Centered over a view (the default) or inline in a column. */
  inline?: boolean
}

function groupBullets(lines: string[]): (string | string[])[] {
  const out: (string | string[])[] = []
  for (const l of lines) {
    if (l.startsWith('- ')) {
      const last = out[out.length - 1]
      if (Array.isArray(last)) last.push(l.slice(2))
      else out.push([l.slice(2)])
    } else out.push(l)
  }
  return out
}

export function InstructionScreen({ title, willDo, minutes, sitting, ready = READY_DEFAULT, keys, content, onBegin, beginLabel = 'Begin', disabled, extra, inline }: InstructionScreenProps) {
  const style = inline
    ? { width: '100%', maxWidth: 560 }
    : { position: 'absolute' as const, left: '50%', top: 24, transform: 'translateX(-50%)', width: 'min(560px, calc(100vw - 780px))', minWidth: 360, maxHeight: 'calc(100vh - 170px)', overflowY: 'auto' as const }
  return (
    <div
      data-instruction
      style={{ ...style, padding: '16px 20px', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12.5, lineHeight: 1.55, display: 'flex', flexDirection: 'column', gap: 10, pointerEvents: 'auto' }}
    >
      <div style={{ fontSize: 14, fontWeight: 600 }}>{title}</div>
      <GroupLabel>What you will do</GroupLabel>
      {groupBullets(willDo).map((block, i) =>
        typeof block === 'string' ? (
          <p key={i} style={{ margin: 0 }} data-will-do>
            {block}
          </p>
        ) : (
          <ul key={i} style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }} data-will-do>
            {block.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ),
      )}
      <GroupLabel>How long</GroupLabel>
      <p style={{ margin: 0 }} data-minutes>
        {minutesLine(minutes)}
      </p>
      <GroupLabel>Pausing</GroupLabel>
      <p style={{ margin: 0 }} data-sitting={sitting}>
        {SITTING_LINES[sitting]}
      </p>
      <GroupLabel>What to have on hand</GroupLabel>
      <p style={{ margin: 0 }} data-ready>
        {ready}
      </p>
      {keys && keys.length > 0 && (
        <>
          <GroupLabel>The keys and buttons</GroupLabel>
          <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }} data-keys>
            {keys.map((k) => (
              <li key={k}>{k}</li>
            ))}
          </ul>
        </>
      )}
      {content?.map((l) => (
        <Content key={l}>{l}</Content>
      ))}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <Btn primary onClick={onBegin} disabled={disabled}>
          {beginLabel}
        </Btn>
        {extra}
      </div>
      {disabled && <Note>The button is available once the lab has loaded.</Note>}
    </div>
  )
}
