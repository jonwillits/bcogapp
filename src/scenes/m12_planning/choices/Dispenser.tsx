import { useEffect } from 'react'
import { BLOCK_SECONDS, DELIVERY_POINTS, DISPENSER_LABEL, TAKE_POINTS, type BlockState } from '../../../sim/planning/choices/dispensers'
import { Btn, Note } from '../ui'
import type { ChoicesStore } from './store'

/**
 * A dispenser block in real time (spec §5.4): a dispenser colored blue or
 * orange, a large points counter, a large block timer, and a large line
 * saying what is happening now. “Take 1 now”, or the key 1, takes a point.
 * If the page is hidden or loses focus, the block stops, is not counted, and
 * restarts from the beginning on return, with a line that says why.
 */
export function DispenserScreen({ s }: { s: ChoicesStore }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (el && ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) return
      if (e.key === '1') s.takeNow()
    }
    const onHide = () => {
      if (document.visibilityState === 'hidden') s.interruptBlock('The page was hidden, so the block stopped and does not count.')
    }
    const onBlur = () => s.interruptBlock('The page lost focus, so the block stopped and does not count.')
    window.addEventListener('keydown', onKey)
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('blur', onBlur)
    }
  }, [s])
  const b = s.block
  if (s.blockStopped)
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} data-block-stopped>
        <div style={{ fontSize: 15, fontWeight: 600 }}>The block stopped.</div>
        <Note>{s.blockStopped} When you are ready, press “Start the block again”. It starts from its beginning, with the full {BLOCK_SECONDS / 60} minutes, and the restart is noted in your record.</Note>
        <div>
          <Btn primary onClick={() => s.restartBlock()}>
            Start the block again
          </Btn>
        </div>
      </div>
    )
  if (!b) return null
  const color = b.dispenser === 'blue' ? '#4f9cff' : '#f0a94b'
  const left = s.blockSecondsLeft()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }} data-block={b.dispenser}>
      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
        Block {s.blockIndex + 1} of 2: {DISPENSER_LABEL[b.dispenser]}
      </div>
      <div style={{ fontSize: 22, fontWeight: 600, minHeight: 30, fontFamily: 'var(--font-mono)', whiteSpace: 'pre' }} data-now>
        {nowLine(b)}
      </div>
      <Dispenser color={color} state={b} />
      <div style={{ display: 'flex', gap: 30 }}>
        <Big label="points" value={String(b.points).padStart(3)} />
        <Big label="seconds left" value={String(Math.ceil(left)).padStart(3)} />
      </div>
      <div style={{ width: 320, height: 8, borderRadius: 4, background: 'var(--surface-2)', border: '1px solid var(--border)', overflow: 'hidden' }} aria-hidden>
        <div style={{ height: '100%', width: `${(100 * left) / BLOCK_SECONDS}%`, background: 'var(--accent)' }} />
      </div>
      <Btn primary onClick={() => s.takeNow()} disabled={b.phase !== 'trial'}>
        Take 1 now
      </Btn>
      <Note>Press “Take {TAKE_POINTS} now” or the key 1 to take {TAKE_POINTS} point and end the trial. Or wait.</Note>
    </div>
  )
}

function nowLine(b: BlockState): string {
  const t = b.trials[b.trials.length - 1]
  if (b.phase === 'done') return 'The block is over.'
  if (b.phase === 'pause') return t.end === 'delivered' ? `${DELIVERY_POINTS} points were delivered.` : `You took ${TAKE_POINTS} point.`
  return `Trial ${b.trials.length}: the dispenser is empty. Waiting.`
}

function Big({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }} data-big={label}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 40, fontWeight: 600, lineHeight: 1, whiteSpace: 'pre' }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</div>
    </div>
  )
}

/** The dispenser, drawn simply: a box in its color, a chute, and the points sitting in the tray when delivered or taken. */
function Dispenser({ color, state }: { color: string; state: BlockState }) {
  const t = state.trials[state.trials.length - 1]
  const inTray = state.phase === 'pause' ? (t.end === 'delivered' ? DELIVERY_POINTS : TAKE_POINTS) : 0
  return (
    <svg width={200} height={150} viewBox="0 0 200 150" role="img" aria-label="the dispenser">
      <rect x={50} y={10} width={100} height={70} rx={10} fill={color} opacity={0.9} />
      <rect x={85} y={80} width={30} height={25} fill="var(--surface-2)" stroke="var(--border)" />
      <rect x={40} y={105} width={120} height={30} rx={6} fill="var(--surface-2)" stroke="var(--border)" />
      {Array.from({ length: inTray }, (_, i) => (
        <circle key={i} cx={60 + i * 20} cy={120} r={7} fill="var(--accent)" />
      ))}
      <text x={100} y={50} fontSize={12} textAnchor="middle" fill="#0b111c" fontWeight={600}>
        {state.dispenser === 'blue' ? 'blue' : 'orange'}
      </text>
    </svg>
  )
}
