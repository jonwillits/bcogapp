import { Panel } from '../../../components/Panel'
import { RULES, PAYOFF, type Move, type RuleId } from '../../../sim/social/game/rules'
import { InstructionScreen } from '../../m10_memory/progress/InstructionScreen'
import { BigChoice, Btn, Choice, Content, FixedLines, GroupLabel, Note, PANEL_STYLE, PART_TITLES, StagePanel, moveWord, useStore } from '../ui'
import { LENGTH_LINE } from '../lines'
import type { PartContext } from '../contract'
import { LETTERS, MAX_NOTES_CHARS, type PartnersStore } from './partnersStore'

/**
 * Part 1's screens before the reveal (spec §5). None of them names a rule,
 * shows a partner's move before the round's commit, or says what a partner
 * is; `partners.test.tsx` holds every one of them to that. The diagnosis
 * screen holds the six behavioral descriptions without the rules' names,
 * since matching is the task.
 */

export const PARTNERS_MINUTES = 18

export const PARTNERS_WILL_DO = [
  'You will play a repeated game against six partners, Partner A to Partner F, one match each, in any order you like. Each partner follows a rule of its own that you cannot see. Your job is to find out, from its moves alone, what each one does.',
  'The game is the prisoner’s dilemma, with the payoff matrix from the reading (§11.1.7). On every round, both of you choose Cooperate or Defect at the same time. If both cooperate, 3 points each. If both defect, 1 point each. If one defects while the other cooperates, the defector gets 5 and the cooperator 0.',
  'On every round you make two choices and commit them together: what you think the partner will play this round, and what you will play. Only then is the round shown: both moves, both points, and the running totals. The partner’s move is computed from the rounds before, never from your choice this round.',
  'A notes box beside the record is for your own hypotheses about the partner. It is saved with your results and is not scored.',
  'After all six matches, you will match each partner to a description of how it plays, and commit. Nothing about any partner is shown until then.',
]

export const PARTNERS_KEYS = ['“Cooperate” and “Defect” under “What Partner X will play” are your prediction; the pair under “What I will play” is your move.', '“Commit this round” shows the round.', 'Each match is done in one sitting: a match you leave partway starts again from round 1 with the same partner.']

export const MATCH_SITTING_LINE = 'Once you press “Begin”, finish each match in one sitting. A match you leave partway starts again with the same partner from round 1, with a new length; a match you have finished is saved and not played again.'

export const DIAGNOSIS_WILL_DO = [
  'All six matches are done. Now match each partner to one of the six descriptions below. Each description says what a partner does, and nothing more; the same description may be chosen for more than one partner if you think they play alike.',
  'Your record of every match is on the right, and your notes with it. Choose a description for every partner, then press “Commit my diagnosis”. The partners’ rules are shown only after that.',
]

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

export function PartnerDisc({ letter, size = 28, muted }: { letter: string; size?: number; muted?: boolean }) {
  const hues: Record<string, string> = { A: '#4f9cff', B: '#f0a94b', C: '#34d399', D: '#c084fc', E: '#f87171', F: '#67e8f9' }
  return (
    <span data-partner={letter} style={{ display: 'inline-grid', placeItems: 'center', width: size, height: size, borderRadius: '50%', background: hues[letter] ?? 'var(--border)', color: '#0b111c', fontWeight: 700, fontSize: size * 0.5, opacity: muted ? 0.45 : 1 }}>
      {letter}
    </span>
  )
}

/** The record of every round, as aligned rows (§5.3). */
export function recordLines(rounds: { predicted: Move; partner: Move; student: Move; studentPoints: number; partnerPoints: number }[], marks?: boolean[]): string[] {
  const head = `${'round'.padEnd(7)}${'predicted'.padEnd(11)}${'partner'.padEnd(11)}${'me'.padEnd(11)}${'my pts'.padStart(7)}${'its pts'.padStart(8)}`
  return [head, ...rounds.map((r, i) => `${String(i + 1).padEnd(7)}${moveWord(r.predicted).padEnd(11)}${moveWord(r.partner).padEnd(11)}${moveWord(r.student).padEnd(11)}${String(r.studentPoints).padStart(7)}${String(r.partnerPoints).padStart(8)}${marks?.[i] ? '  *' : ''}`)]
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
          {s.state === 'revealed' && <Note>The results are over the view, with the rows for the report on the right.</Note>}
        </div>
      </Panel>
    </>
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
          <Note>Each partner is one match of at least 15 rounds. Press a letter to begin its match. The matches can be played in any order.</Note>
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
    case 'match-over': {
      const L = LETTERS[s.partner]
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
              <FixedLines lines={[`${'Rounds'.padEnd(14)}${String(s.rounds.length).padStart(4)}`, `${'My points'.padEnd(14)}${String(s.studentTotal).padStart(4)}`, `${`Partner ${L}`.padEnd(14)}${String(s.partnerTotal).padStart(4)}`, `${'Predicted right'.padEnd(14)}${String(s.rounds.filter((r) => r.predicted === r.partner).length).padStart(4)}`]} />
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
            {s.lastRound && s.state === 'match' && (
              <FixedLines lines={[`Last round: Partner ${L} ${moveWord(s.lastRound.partner).toLowerCase().padEnd(10)} I ${moveWord(s.lastRound.student).toLowerCase().padEnd(10)} ${String(s.lastRound.studentPoints)} to me, ${String(s.lastRound.partnerPoints)} to it`]} testId="last-round" />
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: 14 }}>
            <div>
              <GroupLabel>The record</GroupLabel>
              <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                <FixedLines lines={recordLines(s.rounds)} testId="record" />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <GroupLabel>Notes</GroupLabel>
              <textarea value={s.notes} onChange={(e) => s.setNotes(e.target.value)} maxLength={MAX_NOTES_CHARS} aria-label="notes on this partner" autoComplete="off" autoCorrect="off" spellCheck={false} placeholder="Your own hypotheses about this partner. Saved, not scored." style={{ width: '100%', minHeight: 150, resize: 'vertical', fontSize: 12, padding: 6, background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-sans)' }} />
            </div>
          </div>
        </StagePanel>
      )
    }
    case 'diagnosis-intro':
      return <InstructionScreen title="The diagnosis" willDo={DIAGNOSIS_WILL_DO} minutes={3} sitting="one sitting" sittingLine="Once you press “Begin”, finish the diagnosis in one sitting. If you leave partway, it starts again with the same list, unanswered." onBegin={() => s.beginDiagnosis()} />
    case 'diagnosis':
      return (
        <StagePanel wide testId="diagnosis">
          <div style={{ fontSize: 14, fontWeight: 600 }}>Match each partner to a description</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {LETTERS.map((L, i) => (
              <div key={L} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }} data-diagnosis-row={L}>
                <PartnerDisc letter={L} />
                <Choice value={s.draftDiagnosis[i]} options={RULES.map((r) => ({ id: r.id, label: r.description }))} onChange={(id) => s.diagnose(i, id as RuleId)} />
              </div>
            ))}
          </div>
          <div>
            <Btn primary onClick={() => s.commitDiagnosis()} disabled={!s.canCommitDiagnosis}>
              Commit my diagnosis
            </Btn>
          </div>
          {!s.canCommitDiagnosis && <Note>“Commit my diagnosis” is available once every partner has a description.</Note>}
        </StagePanel>
      )
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
              <FixedLines lines={[`${r.rounds.length} rounds   me ${String(r.rounds.reduce((a, x) => a + x.studentPoints, 0)).padStart(3)}   it ${String(r.rounds.reduce((a, x) => a + x.partnerPoints, 0)).padStart(3)}   predicted right ${String(r.rounds.filter((x) => x.predicted === x.partner).length).padStart(2)}`]} />
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
