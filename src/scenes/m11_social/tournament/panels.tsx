import { useEffect, useRef } from 'react'
import { RULES, GENEROSITY, GENEROSITY_LABELS, RULE_NAMES, type Chips, type Move, type Outcome, OUTCOMES, cooperates, ruleById, type Generosity } from '../../../sim/social/game/rules'
import { TWO_RULES_ROUNDS } from '../../../sim/social/game/tworules'
import { entryId, entryLabel, type RoundRobin, type PredictorVersus } from '../../../sim/social/game/tournament'
import { MEMORY_COSTS, memoryUnits, type GenerationsRun } from '../../../sim/social/game/generations'
import { type Grid, type GridRule, type Change } from '../../../sim/social/game/grid'
import { estimates, freshCounts, firstEstimate } from '../../../sim/social/game/predictor'
import { outcomeOf } from '../../../sim/social/game/rules'
import { referenceById } from '../../../sim/social/references'
import { Choice, Content, ENTRY_COLORS, FixedLines, GroupLabel, LinePlot, Note, ReferencePanel, moveWord, rgbOf } from '../ui'
import { ENOUGH_COOPERATORS_LINE, FINDING_OUT_LINE, NEVER_AHEAD_LINE, PREDICTING_LINE, STAND_IN_COST_LINE, THE_FIELD_LINE, THE_GRID_LINE } from '../lines'
import type { StudentVersus, TournamentStore } from './store'

/**
 * Part 2's panels (spec §6): every number is the engine's own, read from
 * the store. A panel says what its rows, columns, bars and cells are, and
 * never what to conclude.
 */

const f2 = (x: number) => x.toFixed(2)
/** An entry's label cut to the table's column. */
const shortLabel = (label: string) => label.replace('Defect forever after one defection', 'Defect forever').replace('Suspicious tit-for-tat', 'Susp. tit-for-tat').replace('Win-stay, lose-shift', 'Win-stay').slice(0, 18)

// --------------------------------------------------------------- Step 1

export function TwoRulesPanel({ s }: { s: TournamentStore }) {
  const t = s.twoRules()
  const R = s.rounds
  const marks: { x: number; label: string; color?: string; at?: 'top' | 'bottom' }[] = [{ x: s.share * 50, label: `x = ${s.share.toFixed(2)}`, color: 'var(--accent)', at: 'bottom' }]
  if (t.threshold !== null) marks.push({ x: t.threshold * 50, label: `Tit-for-tat does better from ${t.threshold.toFixed(3)}` })
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} data-panel="two-rules">
      <GroupLabel>Run 1 — one round</GroupLabel>
      <FixedLines lines={[`${'Always defect'.padEnd(16)}${moveWord('D').padEnd(11)}${String(t.one.alld).padStart(4)} points`, `${'Tit-for-tat'.padEnd(16)}${moveWord('C').padEnd(11)}${String(t.one.tft).padStart(4)} points`]} testId="run1" />
      <GroupLabel>Run 2 — a match of R rounds</GroupLabel>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>R</span>
        <Choice value={String(R)} options={TWO_RULES_ROUNDS.map((r) => ({ id: String(r), label: String(r) }))} onChange={(v) => s.setRounds(Number(v))} />
      </div>
      <FixedLines lines={[`${'Always defect'.padEnd(16)}${String(t.match.alld).padStart(5)} points   moves ${t.match.moves.alld.length > 40 ? t.match.moves.alld.slice(0, 40) + '…' : t.match.moves.alld}`, `${'Tit-for-tat'.padEnd(16)}${String(t.match.tft).padStart(5)} points   moves ${t.match.moves.tft.length > 40 ? t.match.moves.tft.slice(0, 40) + '…' : t.match.moves.tft}`, `${'Margin'.padEnd(16)}${String(t.match.alld - t.match.tft).padStart(5)} points to Always defect`]} testId="run2" />
      <Content>{NEVER_AHEAD_LINE}</Content>
      <GroupLabel>Run 3 — a round-robin of the two, each also playing a copy of itself, R rounds a match</GroupLabel>
      <FixedLines lines={[`${''.padEnd(16)}${'vs itself'.padStart(10)}${'vs other'.padStart(10)}${'total'.padStart(8)}`, `${'Tit-for-tat'.padEnd(16)}${f2(t.rr.tft.vsTft).padStart(10)}${f2(t.rr.tft.vsAlld).padStart(10)}${f2(t.rr.tft.total).padStart(8)}`, `${'Always defect'.padEnd(16)}${f2(t.rr.alld.vsAlld).padStart(10)}${f2(t.rr.alld.vsTft).padStart(10)}${f2(t.rr.alld.total).padStart(8)}`]} testId="run3" />
      <Note>The match against the other is the same match counted from each side: Tit-for-tat’s points in it are the row’s “vs other”. The total is the sum of the row’s two matches.</Note>
      <GroupLabel>Run 4 — a population: a share x plays Tit-for-tat, the rest Always defect</GroupLabel>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>x</span>
        <input type="range" min={0} max={1} step={0.01} value={s.share} onChange={(e) => s.setShare(Number(e.target.value))} aria-label="share of tit-for-tat in the population" style={{ width: 200 }} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{s.share.toFixed(2)}</span>
      </div>
      <LinePlot series={[{ label: 'Tit-for-tat', color: ENTRY_COLORS.tft, data: t.curve.map((p) => p.tft) }, { label: 'Always defect', color: ENTRY_COLORS.alld, data: t.curve.map((p) => p.alld) }]} yMax={Math.max(1, ...t.curve.map((p) => Math.max(p.tft, p.alld))) * 1.05} xLabel="share of the population playing tit-for-tat, 0 to 1 (50 steps)" yLabel="average points per encounter" width={420} height={190} marks={marks} />
      <Note>The blue dashed line is the slider’s x; the orange one, where there is one, is the share above which Tit-for-tat’s average passes Always defect’s.</Note>
      <FixedLines lines={[`${`At x = ${s.share.toFixed(2)}, R = ${R}:`.padEnd(24)}${'Tit-for-tat'.padEnd(16)}${f2(t.at.tft).padStart(8)}`, `${''.padEnd(24)}${'Always defect'.padEnd(16)}${f2(t.at.alld).padStart(8)}`, `${'Tit-for-tat does better once x >'.padEnd(34)}${t.threshold === null ? 'never, at this R' : t.threshold.toFixed(4)}`]} testId="run4" />
      <Content>{ENOUGH_COOPERATORS_LINE}</Content>
    </div>
  )
}

// --------------------------------------------------------------- Step 2

const CHIP_ROWS: { key: keyof Omit<Chips, 'generosity'>; label: string }[] = [
  { key: 'first', label: 'First move' },
  { key: 'CC', label: 'After a round in which both cooperated' },
  { key: 'CD', label: 'After a round in which I cooperated and the partner defected' },
  { key: 'DC', label: 'After a round in which I defected and the partner cooperated' },
  { key: 'DD', label: 'After a round in which both defected' },
]

export function RuleBuilder({ s }: { s: TournamentStore }) {
  const match = s.matches()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} data-panel="rule-builder">
      {CHIP_ROWS.map((r) => (
        <div key={r.key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }} data-chip={r.key}>
          <Note>{r.label}</Note>
          <Choice value={s.chips[r.key]} options={[{ id: 'C', label: 'Cooperate' }, { id: 'D', label: 'Defect' }]} onChange={(v) => s.setChip(r.key, v as Move)} />
        </div>
      ))}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }} data-chip="generosity">
        <Note>Generosity: after the partner defects, cooperate anyway</Note>
        <Choice value={String(s.chips.generosity)} options={GENEROSITY.map((g) => ({ id: String(g), label: GENEROSITY_LABELS[String(g)] }))} onChange={(v) => s.setChip('generosity', GENEROSITY.find((g) => String(g) === v) as Generosity)} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <Note>Its name in the tournaments</Note>
        <Choice value={s.ruleName} options={RULE_NAMES.map((n) => ({ id: n, label: n }))} onChange={(v) => s.setRuleName(v as (typeof RULE_NAMES)[number])} />
      </div>
      <FixedLines lines={[`${'Matches a Part 1 rule:'.padEnd(24)}${match ?? 'none of the six'}`]} testId="rule-match" />
      <Note>The rule as a table: first {moveWord(s.chips.first)}; after CC {moveWord(s.chips.CC)}, after CD {moveWord(s.chips.CD)}, after DC {moveWord(s.chips.DC)}, after DD {moveWord(s.chips.DD)}; generosity {GENEROSITY_LABELS[String(s.chips.generosity)]}.</Note>
    </div>
  )
}

// --------------------------------------------------------------- Steps 3 and 5

export function RoundRobinTable({ rr, against, testId }: { rr: RoundRobin; against?: RoundRobin | null; testId: string }) {
  const short = (i: number) => shortLabel(entryLabel(rr.entries[i]))
  const head = `${''.padEnd(19)}${rr.entries.map((_, j) => short(j).slice(0, 6).padStart(7)).join('')}${'total'.padStart(8)}`
  const rows = rr.entries.map((_, i) => `${short(i).padEnd(19)}${rr.table[i].map((c) => f2(c.mean).padStart(7)).join('')}${f2(rr.totals[i]).padStart(8)}`)
  const ranking = rr.ranking.map((i, k) => {
    const delta = against ? rr.totals[i] - against.totals[against.entries.findIndex((e) => entryId(e) === entryId(rr.entries[i]))] : null
    return `${String(k + 1).padEnd(3)}${entryLabel(rr.entries[i]).padEnd(36)}${f2(rr.totals[i]).padStart(6)}${delta !== null ? `${(delta >= 0 ? '+' : '') + f2(delta)}`.padStart(8) : ''}${rr.table[i].some((c) => c.played) ? '  ±' + f2(Math.max(...rr.table[i].filter((c) => c.played).map((c) => c.sd))) : ''}`
  })
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-panel={testId}>
      <GroupLabel>Average points per round, row against column ({rr.rounds} rounds a match, noise {Math.round(rr.noise * 100)}%)</GroupLabel>
      <div style={{ overflowX: 'auto' }}>
        <FixedLines lines={[head, ...rows]} testId={`${testId}-table`} />
      </div>
      <GroupLabel>Ranking by total (the mean over every entry, itself included){against ? ', with the change from no mistakes' : ''}</GroupLabel>
      <FixedLines lines={ranking} testId={`${testId}-ranking`} />
      {rr.entries.some((e) => e.kind === 'predictor') && <Note>Predictor’s pairs are played, 50 seeds each; ± is the largest spread among its pairs. Every other pair is the exact expected value.</Note>}
      <Content>{THE_FIELD_LINE}</Content>
    </div>
  )
}

/** Steps 3 and 5: one entry's record against every entry, round by round, with its running points (Jon, 2026-11-02); Step 5's at its noise (2026-11-08, for the handout's Q14). */
export function EntryRecords({ s, step = 3 }: { s: TournamentStore; step?: 3 | 5 }) {
  const rr = step === 3 ? s.rr3 : s.rr5
  if (!rr) return null
  const i = s.recordEntry
  const records = i === null ? [] : s.recordsFor(i, step)
  const chunk = 50
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-panel={`rr${step}-records`}>
      <GroupLabel>{rr.noise > 0 ? `The record of one entry against every entry, round by round, with mistakes at ${Math.round(rr.noise * 100)}%` : 'The record of one entry against every entry, round by round'}</GroupLabel>
      <Choice value={i === null ? null : String(i)} options={rr.entries.map((e, k) => ({ id: String(k), label: entryLabel(e) }))} onChange={(v) => s.setRecordEntry(Number(v))} />
      {i !== null && records.length > 0 && (
        <>
          <LinePlot series={records.map((r) => ({ label: r.against, color: ENTRY_COLORS[entryId(rr.entries[records.indexOf(r)])] ?? 'var(--text)', data: r.rounds.reduce<number[]>((acc, round) => [...acc, (acc[acc.length - 1] ?? 0) + round.pointsA], [0]) }))} yMax={Math.max(1, ...records.map((r) => r.mine)) * 1.05} xLabel="round" yLabel={`${shortLabel(entryLabel(rr.entries[i]))}’s running points`} width={420} height={200} />
          <Note>Each line is {entryLabel(rr.entries[i])}’s running total in its match against the named entry. Under it, every match’s moves in rows of {chunk} rounds: the entry’s moves, then the other’s. C is cooperate, D defect.</Note>
          <div style={{ overflowX: 'auto' }}>
            <FixedLines
              lines={records.flatMap((r, j) => {
                const me = shortLabel(entryLabel(rr.entries[i]))
                const them = shortLabel(r.against)
                const lines: string[] = [`vs ${r.against.padEnd(36)}${String(r.mine).padStart(5)} to ${String(r.theirs).padEnd(5)} (${f2(r.tableMean)} a round in the table)`]
                for (let k = 0; k < r.rounds.length; k += chunk) {
                  const part = r.rounds.slice(k, k + chunk)
                  lines.push(`${`${k + 1}–${k + part.length}`.padStart(9)}  ${me.padEnd(17)}${part.map((x) => x.a).join('')}`)
                  lines.push(`${''.padStart(9)}  ${them.padEnd(17)}${part.map((x) => x.b).join('')}`)
                }
                if (j < records.length - 1) lines.push('')
                return lines
              })}
              testId={`rr${step}-record-lines`}
            />
          </div>
          {rr.noise > 0 ? <Note>With mistakes, every match is one of the many the table’s value averages, played on the run seed: another seed would give another record, with the same shape.</Note> : rr.entries.some((e) => e.kind === 'rule' && [e.rule.first, ...OUTCOMES.map((o) => e.rule.after[o])].some((p) => p !== 0 && p !== 1)) && <Note>A rule with generosity draws some of its moves, so its match here is one of the many the table’s exact value averages.</Note>}
        </>
      )}
    </div>
  )
}

// --------------------------------------------------------------- Step 4

/** Predictor's estimates for a partner, replayed from the sample match's record, as four rows against the partner's true table. */
export function estimatesTable(v: PredictorVersus): { rows: string[]; at: { round: number; estimates: Record<Outcome, number> }[] } {
  const rule = ruleById(v.partner as never)
  const counts = freshCounts()
  let previous: Outcome | null = null
  const at: { round: number; estimates: Record<Outcome, number> }[] = []
  v.sample.rounds.forEach((r, k) => {
    if (previous === null) counts.first[r.b === 'C' ? 0 : 1]++
    else counts.after[previous][r.b === 'C' ? 0 : 1]++
    previous = outcomeOf(r.a, r.b)
    if ([10, 50, 200].includes(k + 1)) at.push({ round: k + 1, estimates: estimates(counts) })
  })
  const est = estimates(counts)
  const label: Record<Outcome, string> = { CC: 'after both cooperated', CD: 'after it cooperated and I defected', DC: 'after I cooperated and it defected', DD: 'after both defected' }
  const rows = [`${''.padEnd(36)}${'estimate'.padStart(9)}${'true'.padStart(6)}${'seen'.padStart(6)}`, `${'first move'.padEnd(36)}${f2(firstEstimate(counts)).padStart(9)}${f2(rule.first).padStart(6)}${String(counts.first[0] + counts.first[1] - 2).padStart(6)}`]
  for (const o of OUTCOMES) {
    // From Predictor's side the outcome is (its move, the partner's); the partner's table is read from the partner's side.
    const truth = cooperates(rule, `${o[1]}${o[0]}` as Outcome)
    rows.push(`${label[o === 'CD' ? 'DC' : o === 'DC' ? 'CD' : o].padEnd(36)}${f2(est[o]).padStart(9)}${f2(truth).padStart(6)}${String(counts.after[o][0] + counts.after[o][1] - 2).padStart(6)}`)
  }
  return { rows, at }
}

export function PredictorPanel({ s }: { s: TournamentStore }) {
  const rr = s.rr4
  if (!rr) return null
  const pi = rr.entries.length - 1
  const rank = rr.ranking.indexOf(pi) + 1
  const v = s.versus
  const grim = v.find((x) => x.partner === 'grim')
  const chosen = v[s.estimatesFor]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} data-panel="predictor">
      <RoundRobinTable rr={rr} testId="rr4" />
      <FixedLines lines={[`${'Predictor ranks'.padEnd(20)}${String(rank)} of ${rr.entries.length}`, `${'Run'.padEnd(20)}${String(s.runs4)} (each run plays new matches)`]} testId="predictor-rank" />
      <Content>{PREDICTING_LINE}</Content>
      <GroupLabel>Predictor against each partner, 200 rounds, no mistakes, 50 seeds</GroupLabel>
      <FixedLines lines={[`${'partner'.padEnd(36)}${'points'.padStart(8)}${'±'.padStart(5)}${'best'.padStart(6)}${'share'.padStart(7)}${'predicted'.padStart(11)}${'probes'.padStart(8)}${'lost'.padStart(7)}`, ...v.map((x) => `${ruleById(x.partner as never).label.padEnd(36)}${x.points.mean.toFixed(0).padStart(8)}${x.points.sd.toFixed(0).padStart(5)}${String(x.best).padStart(6)}${f2(x.shareOfBest).padStart(7)}${f2(x.predictionsShare).padStart(11)}${x.probes.mean.toFixed(1).padStart(8)}${x.lostToProbing.toFixed(0).padStart(7)}`)]} testId="predictor-versus" />
      <Note>“lost” is the mean total without probes minus the mean total with them, on the same seeds: points the probes cost, or, where negative, gained.</Note>
      <Content>{FINDING_OUT_LINE}</Content>
      {grim && (
        <>
          <GroupLabel>A replay against Defect forever after one defection, the first probe marked *</GroupLabel>
          <FixedLines lines={[`Predictor: ${grim.sample.rounds.map((r) => (r.probeA ? `*${r.a}` : r.a)).join('').slice(0, 70)}`, `partner:   ${grim.sample.rounds.map((r) => (r.probeA ? ` ${r.b}` : r.b)).join('').slice(0, 70)}`]} testId="grim-replay" />
          <Note>The first 60 or so rounds of the first seed’s match. After the probe the partner defects for the rest of the match, and Predictor’s estimates follow.</Note>
        </>
      )}
      <GroupLabel>Predictor’s estimates for a partner, against the partner’s true table</GroupLabel>
      <Choice value={String(s.estimatesFor)} options={v.map((x, i) => ({ id: String(i), label: ruleById(x.partner as never).label }))} onChange={(i) => s.setEstimatesFor(Number(i))} />
      {chosen && <EstimatesView v={chosen} />}
      <GroupLabel>Beside you: your Part 1 results and Predictor’s, over matches of the same lengths</GroupLabel>
      <StudentTable rows={s.studentVersus} />
    </div>
  )
}

function EstimatesView({ v }: { v: PredictorVersus }) {
  const { rows, at } = estimatesTable(v)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }} data-estimates={v.partner}>
      <FixedLines lines={rows} />
      <Note>“seen”: how many times that outcome came up in the match. An outcome the partner never produces leaves its estimate at 0.50, where the counts began. {at.length > 0 && `How the estimates stood: ${at.map((a) => `round ${a.round}: ${OUTCOMES.map((o) => f2(a.estimates[o])).join(' ')}`).join('; ')}.`}</Note>
    </div>
  )
}

export function StudentTable({ rows }: { rows: StudentVersus[] }) {
  const lines = [`${'partner'.padEnd(36)}${'rounds'.padStart(7)}${'you: right'.padStart(11)}${'of best'.padStart(9)}${'Predictor: right'.padStart(18)}${'of best'.padStart(9)}`, ...rows.map((r) => `${r.partner.padEnd(36)}${String(r.rounds).padStart(7)}${(r.student ? f2(r.student.share) : 'not played').padStart(11)}${(r.student ? f2(r.student.shareOfBest) : '').padStart(9)}${f2(r.predictor.share).padStart(18)}${f2(r.predictor.shareOfBest).padStart(9)}`)]
  return <FixedLines lines={lines} testId="student-versus" />
}

// --------------------------------------------------------------- Step 6

export function GenerationsPanel({ s }: { s: TournamentStore }) {
  const g = s.gen
  if (!g) return null
  const series = (run: GenerationsRun, rr: RoundRobin) => rr.entries.map((e, i) => ({ label: entryLabel(e), color: ENTRY_COLORS[entryId(e)] ?? 'var(--text)', data: run.shares.map((sh) => sh[i]) }))
  const pi = g.cleanRR.entries.findIndex((e) => e.kind === 'predictor')
  const ti = g.cleanRR.entries.findIndex((e) => entryId(e) === 'tft')
  const endLines = (run: GenerationsRun, rr: RoundRobin) => {
    const last = run.shares[run.shares.length - 1]
    return rr.entries.map((e, i) => `${entryLabel(e).padEnd(36)}${(100 * last[i]).toFixed(1).padStart(7)}%`)
  }
  const stopText = (c: number | null | undefined) => (c === null ? 'none of the five' : c === undefined ? '' : String(c))
  const share = (run: GenerationsRun, i: number) => `${(100 * run.shares[run.shares.length - 1][i]).toFixed(1).padStart(6)}%`
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} data-panel="generations">
      <GroupLabel>Memory, and its cost per stored number, per round</GroupLabel>
      <Choice value={String(s.cost)} options={MEMORY_COSTS.map((c) => ({ id: String(c), label: String(c) }))} onChange={(v) => s.setCost(Number(v) as (typeof MEMORY_COSTS)[number])} />
      <FixedLines lines={[`${'entry'.padEnd(36)}${'numbers stored'.padStart(15)}${'cost a round'.padStart(14)}`, ...g.cleanRR.entries.map((e) => `${entryLabel(e).padEnd(36)}${String(memoryUnits(e)).padStart(15)}${(memoryUnits(e) * s.cost).toFixed(2).padStart(14)}`)]} testId="memory-table" />
      <Note>Numbers stored from one round to the next: nothing for a rule that makes the same move whatever happened; the previous round for a rule that reads it; Predictor’s ten counts and the previous round. The cost is subtracted from the entry’s average points before each generation’s update.</Note>
      <GroupLabel>No mistakes: each entry’s share over 300 generations, at this cost</GroupLabel>
      <LinePlot series={series(g.clean, g.cleanRR)} yMax={1} height={300} xLabel="generation" yLabel="share of the population" />
      <FixedLines lines={[`${'At generation 300'.padEnd(36)}`, ...endLines(g.clean, g.cleanRR), `${'Vanished (under 1%)'.padEnd(36)}${g.clean.vanished.map((i) => entryLabel(g.cleanRR.entries[i])).join(', ') || 'none'}`]} testId="gen-clean" />
      <GroupLabel>With mistakes at {Math.round(g.noisyRR.noise * 100)}%, at this cost</GroupLabel>
      <LinePlot series={series(g.noisy, g.noisyRR)} yMax={1} height={300} xLabel="generation" yLabel="share of the population" />
      <FixedLines lines={[`${'At generation 300'.padEnd(36)}`, ...endLines(g.noisy, g.noisyRR), `${'Vanished (under 1%)'.padEnd(36)}${g.noisy.vanished.map((i) => entryLabel(g.noisyRR.entries[i])).join(', ') || 'none'}`]} testId="gen-noisy" />
      <GroupLabel>Where the cost stops an entry spreading</GroupLabel>
      <FixedLines
        lines={[
          `${'Every entry’s starting share'.padEnd(70)}${(100 / g.cleanRR.entries.length).toFixed(1).padStart(6)}%`,
          `${'Predictor’s share at generation 300, no mistakes'.padEnd(70)}${share(g.clean, pi)}`,
          `${'Predictor’s share at generation 300, with mistakes'.padEnd(70)}${share(g.noisy, pi)}`,
          `${'Lowest cost at which Predictor ends below its start, no mistakes'.padEnd(70)}${stopText(s.costStop?.predictor.clean)}`,
          `${'The same, with mistakes'.padEnd(70)}${stopText(s.costStop?.predictor.noisy)}`,
          `${'Tit-for-tat’s share at generation 300, no mistakes'.padEnd(70)}${share(g.clean, ti)}`,
          `${'Tit-for-tat’s share at generation 300, with mistakes'.padEnd(70)}${share(g.noisy, ti)}`,
          `${'Lowest cost at which Tit-for-tat ends below its start, no mistakes'.padEnd(70)}${stopText(s.costStop?.tft.clean)}`,
          `${'The same, with mistakes'.padEnd(70)}${stopText(s.costStop?.tft.noisy)}`,
        ]}
        testId="cost-lines"
      />
      <Content>{STAND_IN_COST_LINE}</Content>
    </div>
  )
}

// --------------------------------------------------------------- Step 7

/** An entry's color in the grid: the tournament's colors, so that a rule looks the same in every step. */
export const gridColor = (grid: Grid, r: GridRule): string => ENTRY_COLORS[entryId(grid.entries[r])] ?? '#e7ecf3'

export function GridCanvas({ grid, size = 400 }: { grid: Grid | null; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const version = grid?.generation ?? -1
  useEffect(() => {
    const c = ref.current
    if (!c || !grid) return
    const ctx = c.getContext('2d')
    if (!ctx) return
    const { width, height } = grid.settings
    const img = ctx.createImageData(width, height)
    const rgb = grid.entries.map((_, r) => rgbOf(gridColor(grid, r)))
    for (let i = 0; i < grid.cells.length; i++) {
      const [r, g, b] = rgb[grid.cells[i]]
      img.data[4 * i] = r
      img.data[4 * i + 1] = g
      img.data[4 * i + 2] = b
      img.data[4 * i + 3] = 255
    }
    ctx.putImageData(img, 0, 0)
  }, [grid, version])
  const w = grid?.settings.width ?? 40
  const h = grid?.settings.height ?? 40
  return <canvas ref={ref} width={w} height={h} style={{ width: size, height: (size * h) / w, imageRendering: 'pixelated', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)' }} role="img" aria-label="the grid of cells, each colored by its rule" data-grid-canvas />
}

/** The band of the most common rule at each generation. */
export function CommonBand({ history, colors, width = 420 }: { history: number[][]; colors: string[]; width?: number }) {
  const n = history.length
  return (
    <svg width={width} height={16} viewBox={`0 0 ${width} 16`} style={{ display: 'block', borderRadius: 4 }} role="img" aria-label="the most common rule at each generation" data-band>
      {history.map((s, i) => {
        let best = 0
        for (let r = 1; r < s.length; r++) if (s[r] > s[best]) best = r
        return <rect key={i} x={(i / Math.max(1, n)) * width} y={0} width={Math.max(1, width / Math.max(1, n))} height={16} fill={colors[best] ?? '#e7ecf3'} />
      })}
    </svg>
  )
}

export function GridPanel({ s }: { s: TournamentStore }) {
  const g = s.grid
  const entries = s.gridEntries()
  const labels = entries.map((e) => entryLabel(e))
  const colors = entries.map((e) => ENTRY_COLORS[entryId(e)] ?? '#e7ecf3')
  const table = s.encounterTable()
  const changes: Change[] = s.changes()
  const shares = g ? g.shares() : entries.map(() => 0)
  const hasPredictor = entries.some((e) => e.kind === 'predictor')
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} data-panel="grid">
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <GridCanvas grid={g} size={320} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <GroupLabel>Key</GroupLabel>
          {entries.map((e, r) => (
            <div key={entryId(e)} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12 }} data-key={r}>
              <span style={{ width: 14, height: 14, background: colors[r], borderRadius: 3, display: 'inline-block' }} />
              {labels[r]}
            </div>
          ))}
          <FixedLines lines={[`${'Generation'.padEnd(22)}${String(g?.generation ?? 0).padStart(6)}`, ...entries.map((_, r) => `${shortLabel(labels[r]).padEnd(22)}${(100 * shares[r]).toFixed(1).padStart(5)}%`), `${'Most common'.padEnd(22)}${g ? shortLabel(labels[g.commonest()]) : ''}`, `${'Changes of the rule'.padEnd(22)}${String(changes.length).padStart(6)}`, `${'  in the cycle’s order'.padEnd(22)}${String(changes.filter((c) => c.inOrder).length).padStart(6)}`]} testId="grid-status" />
          <Note>A change is counted when a rule passes half the grid after another held it. The cycle’s order is tit-for-tat → always-cooperate → always-defect → tit-for-tat. The edges {s.boundary === 'wrap' ? 'wrap: the far left touches the far right, the top the bottom' : 'stop: a cell on an edge has five neighbors, in a corner three'}.</Note>
        </div>
      </div>
      <GroupLabel>Each rule’s share over the generations, and the most common rule at each (the band)</GroupLabel>
      <LinePlot series={entries.map((_, r) => ({ label: labels[r], color: colors[r], data: s.history.map((h) => h[r]) }))} yMax={1} xLabel={`generation (last ${s.history.length})`} yLabel="share of the grid" />
      <CommonBand history={s.history} colors={colors} />
      {changes.length > 0 && <FixedLines lines={changes.slice(-8).map((c) => `${String(c.generation).padStart(5)}: ${shortLabel(labels[c.from])} → ${shortLabel(labels[c.to])}${c.inOrder ? '  (the cycle’s order)' : ''}`)} testId="grid-changes" />}
      <GroupLabel>Points per encounter at {Math.round(s.noise * 100)}% noise, 10 rounds, row against column</GroupLabel>
      <div style={{ overflowX: 'auto' }}>
        <FixedLines lines={[`${''.padEnd(18)}${labels.map((l) => shortLabel(l).slice(0, 9).padStart(10)).join('')}`, ...table.map((row, i) => `${shortLabel(labels[i]).padEnd(18)}${row.map((v) => f2(v).padStart(10)).join('')}`)]} testId="grid-table" />
      </div>
      {hasPredictor && <Note>Predictor’s row and column are means over 50 played encounters of 10 rounds; every other cell is the exact expected value.</Note>}
      <Content>{THE_GRID_LINE}</Content>
      <GroupLabel>What you see: pockets, fronts, and what each combination of rules does</GroupLabel>
      <textarea value={s.gridNotes} onChange={(e) => s.setGridNotes(e.target.value)} maxLength={1500} rows={5} placeholder="What happens locally, in pockets of cells, and what happens with each combination of rules you try." autoComplete="off" autoCorrect="off" spellCheck={false} aria-label="your notes on the grid" data-grid-notes style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit', fontSize: 12.5, lineHeight: 1.5, padding: 8, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }} />
      <Note>Saved as you type, with your results.</Note>
    </div>
  )
}

export function ReferenceForStep3() {
  return <ReferencePanel reference={referenceById('axelrod1981-rounds')} />
}

export function ReferenceForStep4() {
  return <ReferencePanel reference={referenceById('axelrod1980-elaborate')} />
}

export function ReferenceForStep7() {
  return <ReferencePanel reference={referenceById('cycle-sources')} />
}

export { RULES }
