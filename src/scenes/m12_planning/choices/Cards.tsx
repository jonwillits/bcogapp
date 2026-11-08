import { useEffect, useState } from 'react'
import { expectedValue, isSure, type Option } from '../../../sim/planning/choices/options'
import { Btn, GroupLabel, Note } from '../ui'

/**
 * How a choice is shown (spec §5.1): two option cards side by side, labeled
 * Option A and Option B, each stating its outcomes and their probabilities
 * in words and as a bar divided by probability. No card shows an expected
 * value before the step's reveal. The student chooses with a click or the
 * keys 1 and 2; a chosen card cannot be changed; there is no time limit.
 */
export function OptionCards({ a, b, onChoose, question = 'Which would you choose?', revealEv = false }: { a: Option; b: Option; onChoose: (side: 0 | 1) => void; question?: string; revealEv?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (el && ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) return
      if (e.key === '1') onChoose(0)
      if (e.key === '2') onChoose(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onChoose])
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} data-cards>
      <div style={{ fontSize: 13 }}>{question}</div>
      <div style={{ display: 'flex', gap: 12 }}>
        <Card label="Option A" keyName="1" option={a} onChoose={() => onChoose(0)} revealEv={revealEv} />
        <Card label="Option B" keyName="2" option={b} onChoose={() => onChoose(1)} revealEv={revealEv} />
      </div>
      <Note>Click a card, or press the key 1 for Option A or the key 2 for Option B. There is no time limit. A choice cannot be changed.</Note>
    </div>
  )
}

function Card({ label, keyName, option, onChoose, revealEv }: { label: string; keyName: string; option: Option; onChoose: () => void; revealEv: boolean }) {
  return (
    <button type="button" onClick={onChoose} data-card={label} style={{ flex: 1, textAlign: 'left', padding: '12px 14px', borderRadius: 10, border: '2px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 8, minHeight: 120 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
        <span style={{ fontWeight: 600, color: 'var(--text)' }}>{label}</span>
        <span>key {keyName}</span>
      </div>
      <div style={{ fontSize: 14, lineHeight: 1.45 }}>{capital(option.text)}</div>
      <ProbabilityBar option={option} />
      {revealEv && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Expected value: {expectedValue(option) < 0 ? '−' : ''}${Math.abs(expectedValue(option)).toLocaleString('en-US')}</div>}
    </button>
  )
}

/** The outcomes as lengths: each outcome's share of the bar is its probability. */
function ProbabilityBar({ option }: { option: Option }) {
  if (isSure(option)) return <div style={{ height: 10, borderRadius: 5, background: option.outcomes[0].amount >= 0 ? 'var(--actuator)' : 'var(--avoid)', opacity: 0.8 }} aria-hidden />
  return (
    <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', border: '1px solid var(--border)' }} aria-hidden>
      {option.outcomes.map((o, i) => (
        <div key={i} style={{ width: `${Math.max(0.4, o.p * 100)}%`, background: o.amount > 0 ? 'var(--actuator)' : o.amount < 0 ? 'var(--avoid)' : 'var(--surface)', opacity: 0.85 }} title={`${Math.round(o.p * 1000) / 10}%: ${o.amount}`} />
      ))}
    </div>
  )
}

export function capital(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/**
 * The wheel of fortune (spec §5.2 E): the student spins it with a button,
 * it turns for about two and a half seconds and stops at the number the
 * seed set, 10 or 65, and looks random. Then two questions: whether the
 * quantity is higher or lower than that number, and an estimate.
 */
export function Wheel({ stopsAt, state, onSpin }: { stopsAt: number; state: 'ready' | 'spinning' | 'stopped'; onSpin: () => void }) {
  // The pointer is at the top; the wheel turns so that `stopsAt` ends under it after several turns.
  const finalAngle = 360 * 5 + (360 - stopsAt * 3.6)
  const rotation = state === 'ready' ? 0 : finalAngle
  const ticks = Array.from({ length: 20 }, (_, i) => i * 5)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }} data-wheel={state}>
      <div style={{ position: 'relative', width: 220, height: 220 }}>
        <div style={{ position: 'absolute', left: 104, top: -4, width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: '14px solid var(--sensor)', zIndex: 2 }} aria-hidden />
        <svg width={220} height={220} viewBox="-110 -110 220 220" style={{ transform: `rotate(${rotation}deg)`, transition: state === 'spinning' ? 'transform 2.5s cubic-bezier(0.15, 0.6, 0.25, 1)' : 'none' }} role="img" aria-label="a wheel of fortune numbered 0 to 99">
          <circle r={105} fill="var(--surface-2)" stroke="var(--border)" strokeWidth={2} />
          {ticks.map((t, i) => {
            const a = (t * 3.6 * Math.PI) / 180
            return (
              <g key={t} transform={`rotate(${t * 3.6})`}>
                <line x1={0} y1={-105} x2={0} y2={-92} stroke="var(--text-muted)" />
                <text x={0} y={-76} fontSize={11} textAnchor="middle" fill={i % 2 ? 'var(--text)' : 'var(--accent)'} transform={`rotate(${-t * 3.6} 0 -80)`}>
                  {t}
                </text>
                <g aria-hidden>{a > 0 ? null : null}</g>
              </g>
            )
          })}
          <circle r={6} fill="var(--text-muted)" />
        </svg>
      </div>
      {state === 'ready' && (
        <Btn primary onClick={onSpin}>
          Spin the wheel
        </Btn>
      )}
      {state === 'spinning' && <Note>The wheel is turning.</Note>}
      {state === 'stopped' && <div style={{ fontSize: 15, fontWeight: 600 }} data-wheel-stopped>The wheel stopped at {stopsAt}.</div>}
    </div>
  )
}

export function HigherLower({ quantity, stopsAt, onAnswer }: { quantity: string; stopsAt: number; onAnswer: (higher: boolean) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-higher-lower>
      <div style={{ fontSize: 13 }}>
        Is {quantity} higher or lower than {stopsAt}?
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <Btn primary onClick={() => onAnswer(true)}>
          Higher than {stopsAt}
        </Btn>
        <Btn primary onClick={() => onAnswer(false)}>
          Lower than {stopsAt}
        </Btn>
      </div>
    </div>
  )
}

export function Estimate({ quantity, onSubmit }: { quantity: string; onSubmit: (estimate: number) => void }) {
  const [text, setText] = useState('')
  const value = Number(text)
  const ok = text.trim() !== '' && Number.isFinite(value) && value >= 0 && value <= 100
  const submit = () => {
    if (ok) onSubmit(value)
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-estimate>
      <div style={{ fontSize: 13 }}>What is your estimate of {quantity}? Type a number from 0 to 100.</div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          type="number"
          min={0}
          max={100}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit()
          }}
          aria-label="your estimate, 0 to 100"
          autoComplete="off"
          style={{ width: 90, fontSize: 14, padding: 6, background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6 }}
        />
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>percent</span>
        <Btn primary onClick={submit} disabled={!ok}>
          Submit my estimate
        </Btn>
      </div>
      {!ok && text !== '' && <Note>The estimate must be a number from 0 to 100.</Note>}
    </div>
  )
}

/** The framing problem (spec §5.2 D): one version only, read as written. The programs are the two cards. */
export function DiseaseProblem({ intro, programs, question, onChoose }: { intro: string; programs: readonly [string, string]; question: string; onChoose: (side: 0 | 1) => void }) {
  const a: Option = { outcomes: [{ amount: 0, p: 1 }], text: programs[0] }
  const b: Option = { outcomes: [{ amount: 0, p: 1 }], text: programs[1] }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} data-disease>
      <GroupLabel>A question that is not about money</GroupLabel>
      <div style={{ fontSize: 13, lineHeight: 1.55 }}>{intro}</div>
      <OptionCardsPlain a={a} b={b} onChoose={onChoose} question={question} />
    </div>
  )
}

/** Cards without probability bars, for the framing problem, whose outcomes are in its sentences. */
function OptionCardsPlain({ a, b, onChoose, question }: { a: Option; b: Option; onChoose: (side: 0 | 1) => void; question: string }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (el && ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) return
      if (e.key === '1') onChoose(0)
      if (e.key === '2') onChoose(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onChoose])
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} data-cards>
      <div style={{ fontSize: 13 }}>{question}</div>
      <div style={{ display: 'flex', gap: 12 }}>
        {[a, b].map((o, i) => (
          <button key={i} type="button" onClick={() => onChoose(i as 0 | 1)} data-card={i === 0 ? 'Option A' : 'Option B'} style={{ flex: 1, textAlign: 'left', padding: '12px 14px', borderRadius: 10, border: '2px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 8, minHeight: 90 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
              <span style={{ fontWeight: 600, color: 'var(--text)' }}>{i === 0 ? 'Option A' : 'Option B'}</span>
              <span>key {i + 1}</span>
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.45 }}>{o.text}</div>
          </button>
        ))}
      </div>
      <Note>Click a card, or press the key 1 for Option A or the key 2 for Option B. There is no time limit. A choice cannot be changed.</Note>
    </div>
  )
}
