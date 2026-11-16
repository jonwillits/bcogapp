import { useCallback, useMemo } from 'react'
import { Btn, Content, FixedLines, Note, StagePanel } from '../ui'
import { useBlockGuard, useKeys } from '../hooks'
import { MADE_OFFLINE_LINE } from '../lines'
import { STEP3_PANEL } from './texts'
import type { SoundsStore } from './store'

/**
 * Step 3's stage (spec §5.3): block 1's single sound and three buttons,
 * block 2's triad and two buttons, the large line saying what is happening
 * now, the count of trials, the screen between the blocks with Start block
 * 2, and the stopped-block screen with Start again. The keys B, D, G and 1,
 * 2 answer. No feedback; no sound is named.
 */
export function Step3Stage({ s }: { s: SoundsStore }) {
  const b = s.block
  const running = b !== null && !s.blockStopped
  const stop = useCallback((reason: string) => s.stopBlock(reason), [s])
  useBlockGuard(running, stop)
  const keys = useMemo(() => ({ b: () => s.answer('b'), d: () => s.answer('d'), g: () => s.answer('g'), '1': () => s.answer('first'), '2': () => s.answer('second') }), [s])
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
  if (s.betweenBlocks)
    return (
      <StagePanel testId="between-blocks">
        <div style={{ fontSize: 14, fontWeight: 600 }}>Block 1 of 2 is done</div>
        <Note>Block 1, labeling, is done and saved. Block 2, telling apart, has 48 trials, about 3 minutes. On each trial you hear three sounds, one second apart. The first two are different; the third is the same as one of them. Press “X matched the first” or “X matched the second”, or the keys 1 and 2, after the third sound. Block 2 starts only when you press the button below.</Note>
        <div>
          <Btn primary onClick={() => s.startBlock2()}>
            Start block 2
          </Btn>
        </div>
      </StagePanel>
    )
  if (!b)
    return (
      <StagePanel testId="sounds-3">
        <Note data-loading>The sounds are loading.</Note>
      </StagePanel>
    )
  const n = b.trials.length
  const now = b.phase === 'answer' ? (b.kind === 'labeling' ? 'Which consonant did you hear? Press B, D, or G.' : 'Which sound did the third one match? Press 1 or 2.') : b.phase === 'playing' ? (b.kind === 'labeling' ? 'Listen.' : 'Listen: three sounds.') : 'The next trial starts in a moment.'
  return (
    <StagePanel testId={`block-${b.kind}`}>
      <div style={{ fontSize: 14, fontWeight: 600 }}>{b.kind === 'labeling' ? 'Block 1 of 2: labeling' : 'Block 2 of 2: telling apart'}</div>
      <div data-now style={{ fontSize: 22, fontWeight: 600, minHeight: 34 }}>
        {now}
      </div>
      <FixedLines lines={[`Trial ${String(Math.min(b.i + 1, n)).padStart(2)} of ${n}`]} testId="trial-count" />
      {b.kind === 'labeling' ? (
        <div style={{ display: 'flex', gap: 10 }} data-answers="labeling">
          {(['b', 'd', 'g'] as const).map((l) => (
            <button key={l} type="button" disabled={b.phase !== 'answer'} onClick={() => s.answer(l)} style={{ flex: 1, padding: '14px 0', fontSize: 20, fontWeight: 600, borderRadius: 'var(--radius-sm)', border: '2px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', cursor: b.phase === 'answer' ? 'pointer' : 'not-allowed', opacity: b.phase === 'answer' ? 1 : 0.45 }}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 10 }} data-answers="abx">
          {(['first', 'second'] as const).map((w, i) => (
            <button key={w} type="button" disabled={b.phase !== 'answer'} onClick={() => s.answer(w)} style={{ flex: 1, padding: '14px 0', fontSize: 15, fontWeight: 600, borderRadius: 'var(--radius-sm)', border: '2px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', cursor: b.phase === 'answer' ? 'pointer' : 'not-allowed', opacity: b.phase === 'answer' ? 1 : 0.45 }}>
              {i + 1}: X matched the {w}
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
