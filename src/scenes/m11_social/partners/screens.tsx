import { useEffect, useState, type CSSProperties, type DragEvent } from 'react'
import { Panel } from '../../../components/Panel'
import { RULES, PAYOFF, type Move, type RuleId } from '../../../sim/social/game/rules'
import { InstructionScreen } from '../../m10_memory/progress/InstructionScreen'
import { BigChoice, Btn, Content, FixedLines, GroupLabel, Note, PANEL_STYLE, PART_TITLES, StagePanel, moveWord, useStore } from '../ui'
import { LENGTH_LINE } from '../lines'
import type { PartContext } from '../contract'
import { LETTERS, MAX_NOTES_CHARS, MIN_ROUNDS, type PartnersStore, type RoundRecord } from './partnersStore'

/**
 * Part 1's screens before the reveal (spec §5). None of them names a rule,
 * shows a partner's move before the round's commit, or says what a partner
 * is; `partners.test.tsx` holds every one of them to that. The diagnosis
 * screen is a matching task: the six behavioral descriptions once each,
 * numbered and without the rules' names, and the six letters placed on
 * them by dragging or by pressing (Jon, 2026-11-02).
 */

export const PARTNERS_MINUTES = 14

export const PARTNERS_WILL_DO = [
  'You will play a repeated game against six partners, Partner A to Partner F. You must play one match with each, in any order you like. Each partner follows a rule of its own that you cannot see. Your job is to find out, from its moves alone, what each one does.',
  'The game is the prisoner’s dilemma, with the payoff matrix from the reading (§11.1.7). On every round, both of you choose Cooperate or Defect at the same time. If both cooperate, 3 points each. If both defect, 1 point each. If one defects while the other cooperates, the defector gets 5 and the cooperator 0.',
  'On every round you make two choices and commit them together: 1) what you think the partner will play this round, and 2) what you will play. Only then is the round shown: both moves, both points, and the running totals. The partner’s move is computed from the rounds before. It is never given what you choose on the round being played.',
  'After round 1, both choices start out set to what you chose the round before. Press the other button to change either one.',
  'A notes box beside the record is for your own hypotheses about the partner. It is saved with your results and is not scored.',
  'Which rule each partner has is drawn from your run seed, so your Partner A is not another student’s Partner A. If you are working in a group, each of you must play the six matches yourself; the letters will not match across the group.',
  'After all six matches, you will match each partner to a description of how it plays, and commit. Nothing about any partner is shown until then.',
]

export const PARTNERS_KEYS = ['“Cooperate” and “Defect” under “What Partner X will play” are your prediction; the pair under “What I will play” is your move.', '“Commit this round” shows the round. The Enter key does the same, unless you are typing in the notes box.', 'Each match is done in one sitting: a match you leave partway starts again from round 1 with the same partner.']

export const MATCH_SITTING_LINE = 'Once you press “Begin”, finish each match in one sitting. A match you leave partway starts again with the same partner from round 1, with a new length; a match you have finished is saved and not played again.'

export const DIAGNOSIS_WILL_DO = [
  'All six matches are done. Now match each partner to one of six descriptions. Each description says what a partner does, and nothing more. The same description may be chosen for more than one partner if you think they play alike.',
  'Drag each partner’s letter onto a description, or press the letter and then the description. A letter can be moved again the same way. Your record of every match is on the right, and your notes with it. Once every letter is placed, press “Commit my diagnosis”. The partners’ rules are shown only after that.',
]

/** The colors of the round feedback (Jon, 2026-11-02): light blue for a prediction that was right and for a round that scored 3 or 5; orange for a prediction that was wrong and for a round that scored 0 or 1. */
export const RIGHT_COLOR = 'var(--accent)'
export const WRONG_COLOR = 'var(--sensor)'
export const predictedRight = (r: RoundRecord): boolean => r.predicted === r.partner
export const roundWon = (r: RoundRecord): boolean => r.studentPoints >= PAYOFF.R

/** The payoff matrix, the chapter's layout (`t-prisoners-dilemma`), with the last round's cell lit. */
export function PayoffMatrix({ lit }: { lit: { student: Move; partner: Move } | null }) {
  const cell = (s: Move, p: Move) => {
    const on = lit !== null && lit.student === s && lit.partner === p
    const mine = s === 'C' ? (p === 'C' ? PAYOFF.R : PAYOFF.S) : p === 'C' ? PAYOFF.T : PAYOFF.P
    const theirs = p === 'C' ? (s === 'C' ? PAYOFF.R : PAYOFF.S) : s === 'C' ? PAYOFF.T : PAYOFF.P
    return (
      <td key={`${s}${p}`} data-cell={`${s}${p}`} data-lit={on ? true : undefined} style={{ padding: '6px 10px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 13, border: '1px solid var(--border)', background: on ? 'var(--accent)' : 'transparent', color: on ? '#0b111c' : 'var(--text)' }}>
        {mine}, {theirs}
      </td>
    )
  }
  return (
    <table style={{ borderCollapse: 'collapse', fontSize: 11.5 }} data-payoff-matrix>
      <thead>
        <tr>
          <th style={{ padding: 4 }} />
          <th style={{ padding: 4, fontWeight: 500, color: 'var(--text-muted)' }}>Partner cooperates</th>
          <th style={{ padding: 4, fontWeight: 500, color: 'var(--text-muted)' }}>Partner defects</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <th style={{ padding: 4, fontWeight: 500, color: 'var(--text-muted)', textAlign: 'left' }}>I cooperate</th>
          {cell('C', 'C')}
          {cell('C', 'D')}
        </tr>
        <tr>
          <th style={{ padding: 4, fontWeight: 500, color: 'var(--text-muted)', textAlign: 'left' }}>I defect</th>
          {cell('D', 'C')}
          {cell('D', 'D')}
        </tr>
      </tbody>
    </table>
  )
}

const HUES: Record<string, string> = { A: '#4f9cff', B: '#f0a94b', C: '#34d399', D: '#c084fc', E: '#f87171', F: '#67e8f9' }

export function PartnerDisc({ letter, size = 28, muted }: { letter: string; size?: number; muted?: boolean }) {
  return (
    <span data-partner={letter} style={{ display: 'inline-grid', placeItems: 'center', width: size, height: size, borderRadius: '50%', background: HUES[letter] ?? 'var(--border)', color: '#0b111c', fontWeight: 700, fontSize: size * 0.5, opacity: muted ? 0.45 : 1 }}>
      {letter}
    </span>
  )
}

/** The past tense for the line that reports the round just played. */
const pastMove = (m: Move): string => (m === 'C' ? 'cooperated' : 'defected')

const RECORD_HEAD = `${'round'.padEnd(7)}${'predicted'.padEnd(11)}${'partner'.padEnd(11)}${'me'.padEnd(11)}${'my pts'.padStart(7)}${'its pts'.padStart(8)}`

/** The record of every round, as aligned rows (§5.3), as plain strings for the reveal and the tests. */
export function recordLines(rounds: RoundRecord[], marks?: boolean[]): string[] {
  return [RECORD_HEAD, ...rounds.map((r, i) => `${String(i + 1).padEnd(7)}${moveWord(r.predicted).padEnd(11)}${moveWord(r.partner).padEnd(11)}${moveWord(r.student).padEnd(11)}${String(r.studentPoints).padStart(7)}${String(r.partnerPoints).padStart(8)}${marks?.[i] ? '  *' : ''}`)]
}

const MONO_BLOCK: CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 11.5, whiteSpace: 'pre', lineHeight: 1.5, overflow: 'hidden' }

/** The record during a match: the same rows, with the prediction colored by whether it was right and the points by whether the round scored 3 or 5. */
export function RecordRows({ rounds }: { rounds: RoundRecord[] }) {
  return (
    <div data-lines="record" style={MONO_BLOCK}>
      <div data-line={0}>{RECORD_HEAD}</div>
      {rounds.map((r, i) => (
        <div key={i} data-line={i + 1} data-right={predictedRight(r)} data-won={roundWon(r)}>
          {String(i + 1).padEnd(7)}
          <span style={{ color: predictedRight(r) ? RIGHT_COLOR : WRONG_COLOR }}>{moveWord(r.predicted).padEnd(11)}</span>
          {moveWord(r.partner).padEnd(11)}
          {moveWord(r.student).padEnd(11)}
          <span style={{ color: roundWon(r) ? RIGHT_COLOR : WRONG_COLOR }}>{`${String(r.studentPoints).padStart(7)}${String(r.partnerPoints).padStart(8)}`}</span>
        </div>
      ))}
    </div>
  )
}

/** The line after a commit: the round in the past tense, colored by its points, and the prediction's verdict, colored by it. */
function LastRoundLine({ letter, round }: { letter: string; round: RoundRecord }) {
  const won = roundWon(round)
  const right = predictedRight(round)
  return (
    <div data-lines="last-round" style={MONO_BLOCK}>
      <div data-line={0} data-right={right} data-won={won}>
        {'Last round: '}
        <span style={{ color: won ? RIGHT_COLOR : WRONG_COLOR }}>{`Partner ${letter} ${`${pastMove(round.partner)},`.padEnd(12)}${`I ${pastMove(round.student)}:`.padEnd(15)}${String(round.studentPoints)} to me, ${String(round.partnerPoints)} to it.`}</span>
        {'  '}
        <span style={{ color: right ? RIGHT_COLOR : WRONG_COLOR }}>{right ? 'Predicted right.' : 'Predicted wrong.'}</span>
      </div>
    </div>
  )
}

export function PartnersLeft({ ctx }: { ctx: PartContext<PartnersStore> }) {
  const s = useStore(ctx.store)
  const done = s.matchesDone()
  return (
    <>
      {ctx.header}
      <Panel title={PART_TITLES.partners} style={PANEL_STYLE}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {s.state === 'intro' && <Note>What will happen is described over the view. Press “Begin” there.</Note>}
          <FixedLines lines={[`Matches finished ${String(done).padStart(2)} of 6`, s.state === 'match' || s.state === 'match-over' ? `Partner ${LETTERS[s.partner]}  round ${String(s.rounds.length).padStart(2)}` : s.state === 'revealed' ? 'Finished' : s.state.startsWith('diagnosis') ? 'The diagnosis' : ' ']} testId="partners-status" />
          {(s.state === 'match' || s.state === 'match-over') && (
            <>
              <GroupLabel>Totals so far</GroupLabel>
              <FixedLines lines={[`${'Me'.padEnd(12)}${String(s.studentTotal).padStart(4)}`, `${`Partner ${LETTERS[s.partner]}`.padEnd(12)}${String(s.partnerTotal).padStart(4)}`]} testId="totals" />
              <GroupLabel>The payoff matrix</GroupLabel>
              <PayoffMatrix lit={s.lastRound ? { student: s.lastRound.student, partner: s.lastRound.partner } : null} />
              <Content>{LENGTH_LINE}</Content>
              {s.state === 'match' && <Note>This match is in progress. Leaving now would mean starting it again from round 1.</Note>}
            </>
          )}
          {s.state === 'choose' && <Note>Choose a partner over the view. A finished match is saved and not played again.</Note>}
          {s.state === 'revealed' && (
            <>
              <Note>The results are over the view, with the rows for the report on the right.</Note>
              <div>
                <Btn primary onClick={() => ctx.openTab('tournament')}>
                  Continue to Part 2
                </Btn>
              </div>
            </>
          )}
        </div>
      </Panel>
    </>
  )
}

/** A match: the two choices, the commit (a button, or the Enter key outside the notes box), the colored record and the notes. */
function MatchScreen({ s }: { s: PartnersStore }) {
  const L = LETTERS[s.partner]
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.repeat) return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT')) return
      // The key commits once, even with a button focused (its own activation is cancelled).
      e.preventDefault()
      s.commitRound()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [s])
  return (
    <StagePanel wide testId="match">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <PartnerDisc letter={L} size={34} />
        <div style={{ fontSize: 14, fontWeight: 600 }}>{`Partner ${L}`}</div>
        <FixedLines lines={[`Round ${String(s.rounds.length + (s.state === 'match' ? 1 : 0)).padStart(2)}`]} />
      </div>
      {s.state === 'match' ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }} data-round-choices>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <GroupLabel>{`What Partner ${L} will play`}</GroupLabel>
            <BigChoice value={s.draftPredicted} options={[{ id: 'C', label: 'Cooperate' }, { id: 'D', label: 'Defect' }]} onChange={(m) => s.choosePredicted(m as Move)} testId="predicted" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <GroupLabel>What I will play</GroupLabel>
            <BigChoice value={s.draftMine} options={[{ id: 'C', label: 'Cooperate' }, { id: 'D', label: 'Defect' }]} onChange={(m) => s.chooseMine(m as Move)} testId="mine" />
          </div>
        </div>
      ) : (
        <div data-match-over style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>The match is over.</div>
          <FixedLines lines={[`${'Rounds'.padEnd(16)}${String(s.rounds.length).padStart(4)}`, `${'My points'.padEnd(16)}${String(s.studentTotal).padStart(4)}`, `${`Partner ${L}`.padEnd(16)}${String(s.partnerTotal).padStart(4)}`, `${'Predicted right'.padEnd(16)}${String(s.rounds.filter(predictedRight).length).padStart(4)}`]} />
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {s.state === 'match' ? (
          <Btn primary onClick={() => s.commitRound()} disabled={!s.canCommitRound}>
            Commit this round
          </Btn>
        ) : (
          <Btn primary onClick={() => s.saveMatch()}>
            Save this match and go on
          </Btn>
        )}
        {s.lastRound && s.state === 'match' && <LastRoundLine letter={L} round={s.lastRound} />}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: 14 }}>
        <div>
          <GroupLabel>The record</GroupLabel>
          {/* Grows with the window (Jon, 2026-11-02), and scrolls only when the window is short. */}
          <div style={{ maxHeight: 'max(220px, calc(100vh - 360px))', overflowY: 'auto' }}>
            <RecordRows rounds={s.rounds} />
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <GroupLabel>Notes</GroupLabel>
          <textarea value={s.notes} onChange={(e) => s.setNotes(e.target.value)} maxLength={MAX_NOTES_CHARS} aria-label="notes on this partner" autoComplete="off" autoCorrect="off" spellCheck={false} placeholder="Your own hypotheses about this partner. Saved, not scored." style={{ width: '100%', flex: 1, minHeight: 150, resize: 'vertical', fontSize: 12, padding: 6, background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-sans)' }} />
        </div>
      </div>
    </StagePanel>
  )
}

/** A letter on the matching screen: a button that can be picked (color only) or dragged. */
function LetterButton({ i, picked, onPick, placed }: { i: number; picked: boolean; onPick: () => void; placed: boolean }) {
  const L = LETTERS[i]
  const onDragStart = (e: DragEvent<HTMLButtonElement>) => {
    e.dataTransfer.setData('text/plain', String(i))
    e.dataTransfer.effectAllowed = 'move'
    onPick()
  }
  return (
    <button type="button" draggable onDragStart={onDragStart} onClick={onPick} aria-pressed={picked} aria-label={`Partner ${L}${placed ? ', placed' : ''}${picked ? ', picked up' : ''}`} data-letter={L} data-picked={picked ? true : undefined} style={{ padding: 2, border: '2px solid', borderColor: picked ? 'var(--text)' : 'transparent', borderRadius: '50%', background: 'transparent', cursor: 'grab', lineHeight: 0 }}>
      <PartnerDisc letter={L} />
    </button>
  )
}

/** The diagnosis as a matching task: the tray of letters, the six numbered descriptions as targets. */
function DiagnosisScreen({ s }: { s: PartnersStore }) {
  const [picked, setPicked] = useState<number | null>(null)
  const draggedIndex = (e: DragEvent): number | null => {
    const t = e.dataTransfer.getData('text/plain')
    if (t === '') return picked
    const i = Number(t)
    return Number.isInteger(i) && i >= 0 && i < LETTERS.length ? i : picked
  }
  const place = (i: number | null, rule: RuleId) => {
    if (i === null) return
    s.diagnose(i, rule)
    setPicked(null)
  }
  const takeBack = (i: number | null) => {
    if (i === null) return
    s.undiagnose(i)
    setPicked(null)
  }
  const pick = (i: number) => setPicked(picked === i ? null : i)
  const allow = (e: DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }
  const unplaced = LETTERS.map((_, i) => i).filter((i) => s.draftDiagnosis[i] === null)
  return (
    <StagePanel wide testId="diagnosis">
      <div style={{ fontSize: 14, fontWeight: 600 }}>Match each partner to a description</div>
      <Note>Drag a letter onto the description of how that partner played, or press the letter and then the description. A placed letter can be moved the same way, or dragged back to the tray. The same description may take more than one letter.</Note>
      <GroupLabel>Partners still to place</GroupLabel>
      <div onDragOver={allow} onDrop={(e) => {
          e.preventDefault()
          takeBack(draggedIndex(e))
        }} style={{ display: 'flex', gap: 6, alignItems: 'center', minHeight: 40, padding: '2px 6px', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--border)' }} data-tray>
        {LETTERS.map((L, i) => (unplaced.includes(i) ? <LetterButton key={L} i={i} picked={picked === i} onPick={() => pick(i)} placed={false} /> : <span key={L} aria-hidden style={{ display: 'inline-block', width: 32, height: 32, margin: 2, borderRadius: '50%', border: '1px dashed var(--border)' }} />))}
        {unplaced.length === 0 && <Note>Every letter is placed.</Note>}
      </div>
      <GroupLabel>The descriptions</GroupLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }} data-descriptions>
        {RULES.map((r, k) => {
          const here = LETTERS.map((_, i) => i).filter((i) => s.draftDiagnosis[i] === r.id)
          const target = picked !== null
          return (
            <div
              key={r.id}
              role="button"
              tabIndex={0}
              aria-label={`Description ${k + 1}: ${r.description}${here.length ? `. Placed here: ${here.map((i) => LETTERS[i]).join(', ')}` : ''}`}
              data-description={r.id}
              data-placed={here.map((i) => LETTERS[i]).join('') || undefined}
              onClick={() => place(picked, r.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  place(picked, r.id)
                }
              }}
              onDragOver={allow}
              onDrop={(e) => {
                e.preventDefault()
                place(draggedIndex(e), r.id)
              }}
              style={{ display: 'grid', gridTemplateColumns: '26px 1fr 210px', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid', borderColor: target ? 'var(--accent)' : 'var(--border)', background: 'var(--surface-2)', cursor: target ? 'pointer' : 'default', minHeight: 44 }}
            >
              <span style={{ display: 'inline-grid', placeItems: 'center', width: 22, height: 22, borderRadius: 6, background: 'var(--surface)', border: '1px solid var(--border)', fontFamily: 'var(--font-mono)', fontSize: 11.5 }}>{k + 1}</span>
              <span style={{ fontSize: 12.5 }}>{r.description}</span>
              <span style={{ display: 'flex', gap: 2, justifyContent: 'flex-end', flexWrap: 'wrap' }} onClick={(e) => e.stopPropagation()}>
                {here.map((i) => (
                  <LetterButton key={LETTERS[i]} i={i} picked={picked === i} onPick={() => pick(i)} placed />
                ))}
              </span>
            </div>
          )
        })}
      </div>
      <div>
        <Btn primary onClick={() => s.commitDiagnosis()} disabled={!s.canCommitDiagnosis}>
          Commit my diagnosis
        </Btn>
      </div>
      {!s.canCommitDiagnosis && <Note>“Commit my diagnosis” is available once every letter is placed on a description.</Note>}
    </StagePanel>
  )
}

export function PartnersStage({ ctx }: { ctx: PartContext<PartnersStore> }) {
  const s = useStore(ctx.store)
  switch (s.state) {
    case 'intro':
      return <InstructionScreen title={PART_TITLES.partners} willDo={PARTNERS_WILL_DO} minutes={PARTNERS_MINUTES} sitting="one sitting" sittingLine={MATCH_SITTING_LINE} keys={PARTNERS_KEYS} content={[LENGTH_LINE]} onBegin={() => s.begin()} />
    case 'choose':
      return (
        <StagePanel testId="choose">
          <div style={{ fontSize: 14, fontWeight: 600 }}>Choose a partner</div>
          <Note>{`Each partner is one match of at least ${MIN_ROUNDS} rounds. Press a letter to begin its match. The matches can be played in any order.`}</Note>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }} data-partner-buttons>
            {LETTERS.map((L, i) => (
              <button key={L} type="button" disabled={s.matchDone(i)} onClick={() => s.startMatch(i)} aria-label={`Partner ${L}${s.matchDone(i) ? ', finished' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', cursor: s.matchDone(i) ? 'default' : 'pointer', fontSize: 12.5 }}>
                <PartnerDisc letter={L} muted={s.matchDone(i)} />
                <span>{s.matchDone(i) ? 'finished' : 'play'}</span>
              </button>
            ))}
          </div>
        </StagePanel>
      )
    case 'match':
    case 'match-over':
      return <MatchScreen s={s} />
    case 'diagnosis-intro':
      return <InstructionScreen title="The diagnosis" willDo={DIAGNOSIS_WILL_DO} minutes={3} sitting="one sitting" sittingLine="Once you press “Begin”, finish the diagnosis in one sitting. If you leave partway, it starts again with every letter back in the tray." onBegin={() => s.beginDiagnosis()} />
    case 'diagnosis':
      return <DiagnosisScreen s={s} />
    case 'revealed':
      return null
  }
}

/** The right column before the reveal: the records of the finished matches, with the notes, so the diagnosis can be made from them. */
export function PartnersRightBefore({ store }: { store: PartnersStore }) {
  const s = useStore(store)
  const done = LETTERS.map((_, i) => s.result(i)).filter((r): r is NonNullable<typeof r> => r !== null)
  if (s.state === 'revealed') return null
  return (
    <Panel title="My matches so far" style={{ width: 440, maxHeight: 'calc(100vh - 84px)', overflowY: 'auto' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {done.length === 0 && <Note>Each finished match’s record appears here, with your notes, so you can compare the partners before the diagnosis.</Note>}
        {done.map((r) => (
          <div key={r.letter} style={{ display: 'flex', flexDirection: 'column', gap: 4 }} data-match-record={r.letter}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <PartnerDisc letter={r.letter} size={22} />
              <FixedLines lines={[`${r.rounds.length} rounds   me ${String(r.rounds.reduce((a, x) => a + x.studentPoints, 0)).padStart(3)}   it ${String(r.rounds.reduce((a, x) => a + x.partnerPoints, 0)).padStart(3)}   predicted right ${String(r.rounds.filter(predictedRight).length).padStart(2)}`]} />
            </div>
            <FixedLines lines={[`${'me:   '}${r.rounds.map((x) => x.student).join('')}`, `${'it:   '}${r.rounds.map((x) => x.partner).join('')}`]} />
            {r.notes && <Note style={{ whiteSpace: 'pre-wrap' }}>{r.notes}</Note>}
            {r.restarts > 0 && <Note>This match was interrupted and played again.</Note>}
          </div>
        ))}
      </div>
    </Panel>
  )
}
