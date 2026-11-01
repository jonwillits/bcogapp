import { useEffect, useRef } from 'react'
import { RULES, GENEROSITY, GENEROSITY_LABELS, RULE_NAMES, type Chips, type Move, type Outcome, OUTCOMES, cooperates, ruleById, type Generosity } from '../../../sim/social/game/rules'
import { TWO_RULES_ROUNDS } from '../../../sim/social/game/tworules'
import { entryId, entryLabel, type RoundRobin, type PredictorVersus } from '../../../sim/social/game/tournament'
import { PREDICTOR_COSTS, type GenerationsRun } from '../../../sim/social/game/generations'
import { GRID_RULE_LABELS, type Grid, type GridRule, type Change } from '../../../sim/social/game/grid'
import { estimates, freshCounts, firstEstimate } from '../../../sim/social/game/predictor'
import { outcomeOf } from '../../../sim/social/game/rules'
import { referenceById } from '../../../sim/social/references'
import { Choice, Content, ENTRY_COLORS, FixedLines, GroupLabel, LinePlot, Note, ReferencePanel, moveWord } from '../ui'
import { ENOUGH_COOPERATORS_LINE, FINDING_OUT_LINE, NEVER_AHEAD_LINE, PREDICTING_LINE, STAND_IN_COST_LINE, THE_FIELD_LINE, THE_GRID_LINE } from '../lines'
import type { StudentVersus, TournamentStore } from './store'

/**
 * Part 2's panels (spec §6): every number is the engine's own, read from
 * the store. A panel says what its rows, columns, bars and cells are, and
 * never what to conclude.
 */

const f2 = (x: number) => x.toFixed(2)

// --------------------------------------------------------------- Step 1

export function TwoRulesPanel({ s }: { s: TournamentStore }) {
  const t = s.twoRules()
  const R = s.rounds
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} data-panel="two-rules">
      <GroupLabel>Run 1 — one round</GroupLabel>
      <FixedLines lines={[`${'Always defect'.padEnd(16)}${moveWord('D').padEnd(11)}${String(t.one.alld).padStart(4)} points`, `${'Tit-for-tat'.padEnd(16)}${moveWord('C').padEnd(11)}${String(t.one.tft).padStart(4)} points`]} testId="run1" />
      <GroupLabel>Run 2 — a match of R rounds, head to head</GroupLabel>
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
      <LinePlot series={[{ label: 'Tit-for-tat', color: ENTRY_COLORS.tft, data: t.curve.map((p) => p.tft) }, { label: 'Always defect', color: ENTRY_COLORS.alld, data: t.curve.map((p) => p.alld) }]} yMax={Math.max(1, ...t.curve.map((p) => Math.max(p.tft, p.alld))) * 1.05} xLabel="share of the population playing tit-for-tat, 0 to 1 (50 steps)" yLabel="average points per encounter" width={420} height={170} marks={t.threshold !== null ? [{ x: t.threshold * 50, label: `x = ${t.threshold.toFixed(3)}` }] : undefined} />
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
  const n = rr.entries.length
  const short = (i: number) => entryLabel(rr.entries[i]).replace('Defect forever after one defection', 'Defect forever').replace('Suspicious tit-for-tat', 'Susp. tit-for-tat').replace('Win-stay, lose-shift', 'Win-stay').slice(0, 15)
  const head = `${''.padEnd(16)}${rr.entries.map((_, j) => short(j).slice(0, 6).padStart(7)).join('')}${'total'.padStart(8)}`
  const rows = rr.entries.map((_, i) => `${short(i).padEnd(16)}${rr.table[i].map((c) => f2(c.mean).padStart(7)).join('')}${f2(rr.totals[i]).padStart(8)}`)
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
      <GroupLabel>Ranking by total (the mean over every opponent, itself included){against ? ', with the change from no mistakes' : ''}</GroupLabel>
      <FixedLines lines={ranking} testId={`${testId}-ranking`} />
      {rr.entries.some((e) => e.kind === 'predictor') && <Note>Predictor’s pairs are played, 50 seeds each; ± is the largest spread among its pairs. Every other pair is the exact expected value.</Note>}
      <Content>{THE_FIELD_LINE}</Content>
      <span style={{ display: 'none' }}>{n}</span>
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
      <FixedLines lines={[`${'Predictor ranks'.padEnd(20)}${String(rank)} of ${rr.entries.length}`]} testId="predictor-rank" />
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
  const pi = g.cleanRR.entries.length - 1
  const endLines = (run: GenerationsRun, rr: RoundRobin) => {
    const last = run.shares[run.shares.length - 1]
    return rr.entries.map((e, i) => `${entryLabel(e).padEnd(36)}${(100 * last[i]).toFixed(1).padStart(7)}%`)
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} data-panel="generations">
      <GroupLabel>No mistakes: each entry’s share over 300 generations</GroupLabel>
      <LinePlot series={series(g.clean, g.cleanRR)} yMax={1} xLabel="generation" yLabel="share of the population" />
      <FixedLines lines={[`${'At generation 300'.padEnd(36)}`, ...endLines(g.clean, g.cleanRR), `${'Vanished (under 1%)'.padEnd(36)}${g.clean.vanished.map((i) => entryLabel(g.cleanRR.entries[i])).join(', ') || 'none'}`]} testId="gen-clean" />
      <GroupLabel>With mistakes at {Math.round(g.noisyRR.noise * 100)}%</GroupLabel>
      <LinePlot series={series(g.noisy, g.noisyRR)} yMax={1} xLabel="generation" yLabel="share of the population" />
      <FixedLines lines={[`${'At generation 300'.padEnd(36)}`, ...endLines(g.noisy, g.noisyRR), `${'Vanished (under 1%)'.padEnd(36)}${g.noisy.vanished.map((i) => entryLabel(g.noisyRR.entries[i])).join(', ') || 'none'}`]} testId="gen-noisy" />
      <GroupLabel>Predictor’s cost per round</GroupLabel>
      <Choice value={String(s.cost)} options={PREDICTOR_COSTS.map((c) => ({ id: String(c), label: String(c) }))} onChange={(v) => s.setCost(Number(v) as (typeof PREDICTOR_COSTS)[number])} />
      <FixedLines lines={[`${'Predictor’s share at generation 300, no mistakes'.padEnd(52)}${(100 * g.clean.shares[g.clean.shares.length - 1][pi]).toFixed(1).padStart(6)}%`, `${'Predictor’s share at generation 300, with mistakes'.padEnd(52)}${(100 * g.noisy.shares[g.noisy.shares.length - 1][pi]).toFixed(1).padStart(6)}%`, `${'Its starting share'.padEnd(52)}${(100 / g.cleanRR.entries.length).toFixed(1).padStart(6)}%`, `${'Lowest cost at which it ends below its start, no mistakes'.padEnd(52)}${s.costStop?.clean === null ? 'none of the five' : s.costStop?.clean === undefined ? '' : String(s.costStop.clean)}`, `${'The same, with mistakes'.padEnd(52)}${s.costStop?.noisy === null ? 'none of the five' : s.costStop?.noisy === undefined ? '' : String(s.costStop.noisy)}`]} testId="cost-lines" />
      <Content>{STAND_IN_COST_LINE}</Content>
    </div>
  )
}

// --------------------------------------------------------------- Step 7

export const GRID_COLORS: Record<GridRule, string> = { 0: '#34d399', 1: '#f87171', 2: '#4f9cff' }

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
    const rgb: Record<GridRule, [number, number, number]> = { 0: [52, 211, 153], 1: [248, 113, 113], 2: [79, 156, 255] }
    for (let i = 0; i < grid.cells.length; i++) {
      const [r, g, b] = rgb[grid.cells[i] as GridRule]
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
export function CommonBand({ history, width = 420 }: { history: [number, number, number][]; width?: number }) {
  const n = history.length
  return (
    <svg width={width} height={16} viewBox={`0 0 ${width} 16`} style={{ display: 'block', borderRadius: 4 }} role="img" aria-label="the most common rule at each generation" data-band>
      {history.map((s, i) => {
        let best: GridRule = 0
        if (s[1] > s[best]) best = 1
        if (s[2] > s[best]) best = 2
        return <rect key={i} x={(i / Math.max(1, n)) * width} y={0} width={Math.max(1, width / Math.max(1, n))} height={16} fill={GRID_COLORS[best]} />
      })}
    </svg>
  )
}

export function GridPanel({ s }: { s: TournamentStore }) {
  const g = s.grid
  const table = s.encounterTable()
  const changes: Change[] = s.changes()
  const shares = g ? g.shares() : [0, 0, 0]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} data-panel="grid">
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <GridCanvas grid={g} size={320} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <GroupLabel>Key</GroupLabel>
          {([0, 1, 2] as GridRule[]).map((r) => (
            <div key={r} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12 }} data-key={r}>
              <span style={{ width: 14, height: 14, background: GRID_COLORS[r], borderRadius: 3, display: 'inline-block' }} />
              {GRID_RULE_LABELS[r]}
            </div>
          ))}
          <FixedLines lines={[`${'Generation'.padEnd(20)}${String(g?.generation ?? 0).padStart(6)}`, ...([0, 1, 2] as GridRule[]).map((r) => `${GRID_RULE_LABELS[r].padEnd(20)}${(100 * shares[r]).toFixed(1).padStart(5)}%`), `${'Most common'.padEnd(20)}${g ? GRID_RULE_LABELS[g.commonest()] : ''}`, `${'Changes of the rule'.padEnd(20)}${String(changes.length).padStart(6)}`, `${'  in the cycle’s order'.padEnd(20)}${String(changes.filter((c) => c.inOrder).length).padStart(6)}`]} testId="grid-status" />
          <Note>A change is counted when a rule passes half the grid after another held it. The cycle’s order is tit-for-tat → always-cooperate → always-defect → tit-for-tat.</Note>
        </div>
      </div>
      <GroupLabel>Each rule’s share over the generations, and the most common rule at each (the band)</GroupLabel>
      <LinePlot series={([0, 1, 2] as GridRule[]).map((r) => ({ label: GRID_RULE_LABELS[r], color: GRID_COLORS[r], data: s.history.map((h) => h[r]) }))} yMax={1} xLabel={`generation (last ${s.history.length})`} yLabel="share of the grid" />
      <CommonBand history={s.history} />
      {changes.length > 0 && <FixedLines lines={changes.slice(-8).map((c) => `${String(c.generation).padStart(5)}: ${GRID_RULE_LABELS[c.from]} → ${GRID_RULE_LABELS[c.to]}${c.inOrder ? '  (the cycle’s order)' : ''}`)} testId="grid-changes" />}
      <GroupLabel>Points per encounter at {Math.round(s.noise * 100)}% noise, 10 rounds, row against column</GroupLabel>
      <FixedLines lines={[`${''.padEnd(20)}${GRID_RULE_LABELS.map((l) => l.slice(0, 10).padStart(12)).join('')}`, ...table.map((row, i) => `${GRID_RULE_LABELS[i].padEnd(20)}${row.map((v) => f2(v).padStart(12)).join('')}`)]} testId="grid-table" />
      <Content>{THE_GRID_LINE}</Content>
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
