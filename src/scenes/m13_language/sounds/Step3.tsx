import { useCallback, useMemo } from 'react'
import { Btn, Content, FixedLines, LoadingLine, Note, StagePanel } from '../ui'
import { loadingText } from '../loading'
import { useBlockGuard, useKeys } from '../hooks'
import { MADE_OFFLINE_LINE } from '../lines'
import { BLOCK1_SCREEN, BLOCK2_SCREEN, STEP3_PANEL } from './texts'
import type { SoundsStore } from './store'

/**
 * Step 3's stage (spec §5.3; Jon, 2026-11-16): a screen before each block
 * with that block's instructions and its Start button; block 1's single
 * sound, played three times, and two buttons, B and D; block 2's triad and
 * two buttons, 3rd sounds like the 1st / 2nd (Jon, 2026-11-20); the large
 * line saying what is happening now; the count of trials; and the
 * stopped-block screen with Start again. The keys B, D and 1, 2 answer. No
 * feedback; no sound is named; the series is the first 9 of the shipped 14.
 */
/** Block 2's two buttons, in Jon's words (2026-11-20), with the key under each. */
const ABX_BUTTONS = [
  { answer: 'first', label: '3rd sounds like the 1st' },
  { answer: 'second', label: '3rd sounds like the 2nd' },
] as const

function BlockScreen({ title, lines, button, onStart, testId }: { title: string; lines: readonly string[]; button: string; onStart: () => void; testId: string }) {
  return (
    <StagePanel testId={testId}>
      <div style={{ fontSize: 14, fontWeight: 600 }}>{title}</div>
      {lines.map((l) => (
        <Note key={l.slice(0, 24)} style={{ color: 'var(--text)' }}>
          {l}
        </Note>
      ))}
      <div>
        <Btn primary onClick={onStart}>
          {button}
        </Btn>
      </div>
    </StagePanel>
  )
}

export function Step3Stage({ s }: { s: SoundsStore }) {
  const b = s.block
  const running = b !== null && !s.blockStopped
  const stop = useCallback((reason: string) => s.stopBlock(reason), [s])
  useBlockGuard(running, stop)
  const keys = useMemo(() => ({ b: () => s.answer('b'), d: () => s.answer('d'), '1': () => s.answer('first'), '2': () => s.answer('second') }), [s])
  useKeys(running, keys)
  if (s.blockStopped)
    return (
      <StagePanel testId="block-stopped">
        <div style={{ fontSize: 14, fontWeight: 600 }}>The block stopped</div>
        <Note data-stop-reason>{s.blockStopped}</Note>
        <Note>A block runs in real time and does not count unless it is done in one sitting. When you press “Start again”, the block starts from its first trial, and the restart is noted on the results screen.</Note>
        <div>
          <Btn primary onClick={() => s.startAgain()}>
            Start again
          </Btn>
        </div>
      </StagePanel>
    )
  if (s.beforeBlock1) return <BlockScreen title="Block 1 of 2: labeling" lines={BLOCK1_SCREEN} button="Start block 1" onStart={() => s.startBlock1()} testId="before-block-1" />
  if (s.betweenBlocks) return <BlockScreen title="Block 1 of 2 is done. Block 2 of 2: telling apart" lines={BLOCK2_SCREEN} button="Start block 2" onStart={() => s.startBlock2()} testId="between-blocks" />
  if (!b)
    return (
      <StagePanel testId="sounds-3">
        <LoadingLine text={loadingText('the sounds', s.loadProgress)} testId="sounds-3" />
      </StagePanel>
    )
  const n = b.trials.length
  const now = b.phase === 'answer' ? (b.kind === 'labeling' ? 'Which consonant did you hear? Press B or D.' : 'Did the 3rd sound like the 1st or the 2nd? Press 1 or 2.') : b.phase === 'playing' ? (b.kind === 'labeling' ? 'Listen: one sound, three times.' : 'Listen: three sounds, three times.') : 'The next trial starts in a moment.'
  const buttonStyle = (enabled: boolean, fontSize: number) => ({ flex: 1, padding: '14px 0', fontSize, fontWeight: 600, borderRadius: 'var(--radius-sm)', border: '2px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', cursor: enabled ? 'pointer' : 'not-allowed', opacity: enabled ? 1 : 0.45 }) as const
  return (
    <StagePanel testId={`block-${b.kind}`}>
      <div style={{ fontSize: 14, fontWeight: 600 }}>{b.kind === 'labeling' ? 'Block 1 of 2: labeling' : 'Block 2 of 2: telling apart'}</div>
      <div data-now style={{ fontSize: 22, fontWeight: 600, minHeight: 34 }}>
        {now}
      </div>
      <FixedLines lines={[`Trial ${String(Math.min(b.i + 1, n)).padStart(2)} of ${n}`]} testId="trial-count" />
      {b.kind === 'labeling' ? (
        <div style={{ display: 'flex', gap: 10 }} data-answers="labeling">
          {(['b', 'd'] as const).map((l) => (
            <button key={l} type="button" disabled={b.phase !== 'answer'} onClick={() => s.answer(l)} style={buttonStyle(b.phase === 'answer', 20)}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 10 }} data-answers="abx">
          {ABX_BUTTONS.map(({ answer, label }, i) => (
            <button key={answer} type="button" disabled={b.phase !== 'answer'} onClick={() => s.answer(answer)} style={buttonStyle(b.phase === 'answer', 15)}>
              <span style={{ display: 'block' }}>{label}</span>
              <span style={{ display: 'block', fontSize: 11, fontWeight: 500, opacity: 0.75 }}>{`key ${i + 1}`}</span>
            </button>
          ))}
        </div>
      )}
      {STEP3_PANEL.map((p) => (
        <Note key={p.slice(0, 16)}>{p}</Note>
      ))}
      <Content>{MADE_OFFLINE_LINE}</Content>
    </StagePanel>
  )
}
