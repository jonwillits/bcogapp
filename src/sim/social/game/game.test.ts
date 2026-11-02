import { describe, it, expect } from 'vitest'
import { makeRng } from '../../random'
import { RULES, RULE_IDS, buildRule, chipsOf, cooperates, matchesPartner, nextMove, outcomeOf, points, ruleById, OUTCOMES, type Move, type Outcome } from './rules'
import { partnerMove, playMatch, rulePlayer } from './match'
import { expectedPayoff } from './exact'
import { bestTotal, bruteForceBest, informativeRounds, totalFor } from './best'
import { headToHead, populationThreshold, populationPayoffs, twoRuleRoundRobin, TWO_RULES_ROUNDS } from './tworules'
import { estimates, expectedPointsOfSequence, freshCounts, predictorPlayer, PROBE_RATE, HORIZON, bestFirstMove } from './predictor'
import { roundRobin, predictorVersus, type Entry } from './tournament'
import { runGenerations, costsFor, memoryUnits, ruleUnits } from './generations'
import { Grid, SHIPPED_GRID, encounterTable, measureCycle, median } from './grid'

/**
 * The repeated-game engine (spec §5, §6, §16): each rule's moves on
 * fixtures covering every branch; a partner's move never depends on the
 * student's choice in the same round; the best total against brute force;
 * the Two Rules formulas exactly; exact payoffs against simulated matches;
 * tit-for-tat and the rule that defects forever identical except against
 * suspicious tit-for-tat; the rule builder; Predictor's estimates, choice
 * and probe rate; the cost slider; and the shipped grid's targets.
 */

const moves = (s: string) => s.split('') as Move[]

describe('the six rules, defined by behavior alone (§5.2)', () => {
  /** The partner's moves against a scripted sequence of the student's moves. */
  function replay(id: (typeof RULE_IDS)[number], student: string): string {
    const rule = ruleById(id)
    const history: { student: Move; partner: Move }[] = []
    let out = ''
    for (const m of moves(student)) {
      const p = partnerMove(rule, history)
      out += p
      history.push({ student: m, partner: p })
    }
    return out
  }
  const SCRIPT = 'CCDCDDCC'
  it('always cooperate and always defect', () => {
    expect(replay('allc', SCRIPT)).toBe('CCCCCCCC')
    expect(replay('alld', SCRIPT)).toBe('DDDDDDDD')
  })
  it('tit-for-tat cooperates first, then plays the student’s previous move', () => {
    expect(replay('tft', SCRIPT)).toBe('C' + SCRIPT.slice(0, -1))
  })
  it('suspicious tit-for-tat differs only on round 1', () => {
    expect(replay('stft', SCRIPT)).toBe('D' + SCRIPT.slice(0, -1))
  })
  it('defect forever after one defection', () => {
    expect(replay('grim', 'CCCDCCCC')).toBe('CCCCDDDD')
    expect(replay('grim', 'CCCCCCCC')).toBe('CCCCCCCC')
  })
  it('win-stay, lose-shift after each of the four outcomes', () => {
    const r = ruleById('wsls')
    // From its own side: (its move, the student's move). 3 or 5 points: repeat; 0 or 1: switch.
    expect(nextMove(r, 'CC')).toBe('C') // 3: stay
    expect(nextMove(r, 'CD')).toBe('D') // 0: shift
    expect(nextMove(r, 'DC')).toBe('D') // 5: stay
    expect(nextMove(r, 'DD')).toBe('C') // 1: shift
    expect(replay('wsls', 'DCCDDC')).toBe('CDDDCD')
  })
  it('a partner’s move is computed from the history before the round and the same whatever the student then plays', () => {
    for (const rule of RULES) {
      const history = [
        { student: 'C' as Move, partner: 'C' as Move },
        { student: 'D' as Move, partner: 'C' as Move },
      ]
      const before = partnerMove(rule, history)
      for (const mine of ['C', 'D'] as Move[]) {
        const again = partnerMove(rule, history)
        expect(again).toBe(before)
        void mine
      }
    }
  })
  it('the payoff matrix is the chapter’s', () => {
    expect(points('C', 'C')).toBe(3)
    expect(points('D', 'D')).toBe(1)
    expect(points('D', 'C')).toBe(5)
    expect(points('C', 'D')).toBe(0)
  })
})

describe('the best possible total (§5.5, §16)', () => {
  it('matches a brute-force search over every sequence of moves for matches of up to 12 rounds, for every rule', () => {
    for (const rule of RULES) {
      for (let rounds = 1; rounds <= 12; rounds++) {
        const best = bestTotal(rule, rounds)
        expect(best.total, `${rule.id} ${rounds}`).toBe(bruteForceBest(rule, rounds))
        expect(totalFor(rule, best.moves)).toBe(best.total)
        expect(best.moves.length).toBe(rounds)
      }
    }
  })
  it('against tit-for-tat the best play cooperates until the last round and defects then: 3(R − 1) + 5', () => {
    for (const rounds of [15, 20, 25]) expect(bestTotal(ruleById('tft'), rounds).total).toBe(3 * (rounds - 1) + 5)
    expect(bestTotal(ruleById('alld'), 20).total).toBe(20)
    expect(bestTotal(ruleById('allc'), 20).total).toBe(100)
  })
  it('a round is informative when the six rules do not all make the same move given the history', () => {
    const history = [
      { student: 'C' as Move, partner: 'C' as Move },
      { student: 'D' as Move, partner: 'C' as Move },
      { student: 'C' as Move, partner: 'D' as Move },
    ]
    // Round 1: the rules differ (always-defect and suspicious tit-for-tat defect). Round 2 after CC: differ. Round 3 after the student's defection: differ.
    expect(informativeRounds(RULES, history)).toEqual([true, true, true])
    const allC = [{ student: 'C' as Move, partner: 'C' as Move }]
    expect(informativeRounds([ruleById('tft'), ruleById('grim')], allC)).toEqual([false])
  })
})

describe('Two Rules reproduces the formulas of §6.1 exactly', () => {
  it('head to head: always-defect 5 + (R − 1), tit-for-tat R − 1, for R = 1, 2, 3, 10, 200', () => {
    for (const R of TWO_RULES_ROUNDS) {
      const h = headToHead(R)
      expect(h.alld).toBe(5 + (R - 1))
      expect(h.tft).toBe(R - 1)
    }
  })
  it('the round-robin of the two: tit-for-tat 4R − 1, always-defect 2R + 4', () => {
    for (const R of TWO_RULES_ROUNDS) {
      const rr = twoRuleRoundRobin(R)
      expect(rr.tft.total).toBeCloseTo(4 * R - 1, 9)
      expect(rr.alld.total).toBeCloseTo(2 * R + 4, 9)
      expect(rr.tft.vsAlld).toBeCloseTo(R - 1, 9)
      expect(rr.alld.vsTft).toBeCloseTo(R + 4, 9)
    }
  })
  it('the population threshold is 1/(2R − 3): never for R of 1 or 2', () => {
    expect(populationThreshold(1)).toBeNull()
    expect(populationThreshold(2)).toBeNull()
    for (const R of [3, 10, 200]) {
      const x = populationThreshold(R)!
      expect(x).toBeCloseTo(1 / (2 * R - 3), 9)
      const below = populationPayoffs(R, x - 0.01)
      const above = populationPayoffs(R, x + 0.01)
      expect(below.tft).toBeLessThan(below.alld)
      expect(above.tft).toBeGreaterThan(above.alld)
    }
  })
})

describe('exact expected payoffs (§16)', () => {
  it('match the mean of 10,000 simulated matches within 1%, for every pair, at 0% and 5% noise', () => {
    const rounds = 20
    const n = 10000
    for (const noise of [0, 0.05]) {
      for (let i = 0; i < RULES.length; i++) {
        for (let j = i; j < RULES.length; j++) {
          const a = RULES[i]
          const b = RULES[j]
          const e = expectedPayoff(a, b, rounds, noise)
          const rng = makeRng(77 + i * 7 + j + Math.round(noise * 100))
          let sa = 0
          let sb = 0
          for (let k = 0; k < n; k++) {
            const m = playMatch(rulePlayer(a), rulePlayer(b), rounds, noise, rng)
            sa += m.totalA
            sb += m.totalB
          }
          const ma = sa / n
          const mb = sb / n
          expect(Math.abs(ma - e.a), `${a.id} vs ${b.id} at ${noise}: exact ${e.a.toFixed(2)} sim ${ma.toFixed(2)}`).toBeLessThanOrEqual(0.01 * Math.max(e.a, 1) + 1e-9)
          expect(Math.abs(mb - e.b), `${b.id} vs ${a.id} at ${noise}`).toBeLessThanOrEqual(0.01 * Math.max(e.b, 1) + 1e-9)
        }
      }
    }
  }, 120000)
  it('tit-for-tat against suspicious tit-for-tat alternates and averages 2.5 a round', () => {
    const e = expectedPayoff(ruleById('tft'), ruleById('stft'), 200, 0)
    expect(e.aPerRound).toBeCloseTo(2.5, 9)
    expect(e.bPerRound).toBeCloseTo(2.5, 9)
  })
})

describe('tit-for-tat and the rule that defects forever (decision 11)', () => {
  it('make identical moves against every partner except suspicious tit-for-tat, with no noise', () => {
    for (const partner of RULES) {
      const tft = playMatch(rulePlayer(ruleById('tft')), rulePlayer(partner), 200, 0, makeRng(1))
      const grim = playMatch(rulePlayer(ruleById('grim')), rulePlayer(partner), 200, 0, makeRng(1))
      const same = tft.rounds.every((r, k) => r.a === grim.rounds[k].a)
      expect(same, partner.id).toBe(partner.id !== 'stft')
    }
  })
})

describe('the rule builder (§6.2)', () => {
  it('reproduces each of the six Part 1 rules exactly, and the panel names the match', () => {
    for (const rule of RULES) {
      const built = buildRule(chipsOf(rule))
      expect(matchesPartner(built)?.id).toBe(rule.id)
      for (const o of OUTCOMES) expect(cooperates(built, o)).toBe(cooperates(rule, o))
      expect(cooperates(built, null)).toBe(cooperates(rule, null))
    }
    expect(matchesPartner(buildRule({ ...chipsOf(ruleById('tft')), generosity: 0.1 }))).toBeNull()
    expect(matchesPartner(buildRule({ first: 'D', CC: 'D', CD: 'C', DC: 'D', DD: 'C', generosity: 0 }))).toBeNull()
  })
  it('generosity cooperates after the partner defects at least that often, and leaves the other chips alone', () => {
    const r = buildRule({ ...chipsOf(ruleById('tft')), generosity: 1 / 3 })
    expect(r.after.CD).toBeCloseTo(1 / 3)
    expect(r.after.DD).toBeCloseTo(1 / 3)
    expect(r.after.CC).toBe(1)
    expect(r.after.DC).toBe(1)
  })
})

describe('Predictor (§6.4, §16)', () => {
  it('its estimates converge on each fixed partner’s true table, for the outcomes that partner produces, within 0.05 after 200 rounds', () => {
    for (const partner of RULES) {
      const m = playMatch(predictorPlayer({ probeRate: 0.05 }), rulePlayer(partner), 200, 0, makeRng(3))
      // Replay the counts from the record.
      const counts = freshCounts()
      let previous: Outcome | null = null
      for (const r of m.rounds) {
        if (previous === null) counts.first[r.b === 'C' ? 0 : 1]++
        else counts.after[previous][r.b === 'C' ? 0 : 1]++
        previous = outcomeOf(r.a, r.b)
      }
      const est = estimates(counts)
      for (const o of OUTCOMES) {
        const seen = counts.after[o][0] + counts.after[o][1] - 2
        if (seen < 20) continue
        // From the partner's side the outcome is flipped.
        const truth = cooperates(partner, `${o[1]}${o[0]}` as Outcome)
        expect(Math.abs(est[o] - truth), `${partner.id} after ${o}: ${est[o].toFixed(3)} vs ${truth}`).toBeLessThanOrEqual(0.05)
      }
    }
  })
  it('its choice on every round equals a brute-force search over its own moves for the horizon under its current estimates', () => {
    // An independent brute force: enumerate sequences and partner branches by recursion.
    const brute = (previous: Outcome, est: Record<Outcome, number>): Move => {
      let best = -Infinity
      let move: Move = 'C'
      for (let mask = 0; mask < 1 << HORIZON; mask++) {
        const seq: Move[] = []
        for (let k = 0; k < HORIZON; k++) seq.push(mask & (1 << k) ? 'D' : 'C')
        const value = (k: number, o: Outcome): number => (k === HORIZON ? 0 : est[o] * (points(seq[k], 'C') + value(k + 1, outcomeOf(seq[k], 'C'))) + (1 - est[o]) * (points(seq[k], 'D') + value(k + 1, outcomeOf(seq[k], 'D'))))
        const v = value(0, previous)
        if (v > best + 1e-9) {
          best = v
          move = seq[0]
        } else if (Math.abs(v - best) <= 1e-9 && seq[0] === 'C') move = 'C'
      }
      return move
    }
    for (const partner of RULES) {
      const player = predictorPlayer({ probeRate: 0 })
      let s = player.start()
      const rng = makeRng(5)
      const partnerP = rulePlayer(partner)
      let ps = partnerP.start()
      for (let t = 0; t < 60; t++) {
        const est = estimates(s.counts)
        const d = player.decide(s, rng)
        if (s.previous !== null) expect(d.move, `${partner.id} round ${t + 1}`).toBe(brute(s.previous, est))
        else expect(d.move).toBe('C')
        const pm = partnerP.decide(ps, rng).move
        s = player.observe(s, d.move, pm)
        ps = partnerP.observe(ps, pm, d.move)
      }
    }
    expect(expectedPointsOfSequence(['D', 'D', 'D'], 'CC', { CC: 1, CD: 1, DC: 1, DD: 1 })).toBe(15)
    expect(bestFirstMove('CC', { CC: 1, CD: 1, DC: 1, DD: 1 }).move).toBe('D')
  })
  it('its measured probe rate is 5% ± 1% over 10,000 rounds', () => {
    let probes = 0
    let rounds = 0
    for (let s = 0; s < 50; s++) {
      const m = playMatch(predictorPlayer(), rulePlayer(ruleById('tft')), 200, 0, makeRng(100 + s))
      probes += m.rounds.filter((r) => r.probeA).length
      rounds += m.rounds.length - 1 // round 1 is never a probe
    }
    expect(rounds).toBeGreaterThanOrEqual(9950)
    expect(probes / rounds).toBeGreaterThan(PROBE_RATE - 0.01)
    expect(probes / rounds).toBeLessThan(PROBE_RATE + 0.01)
  })
  it('its results against each partner are means over 50 seeds with their spread, and it scores on its predictions before each round', () => {
    const v = predictorVersus(ruleById('allc'), 20)
    expect(v.points.mean).toBeGreaterThan(60) // it comes to defect against always cooperate
    expect(v.predictionsShare).toBeGreaterThan(0.9)
    expect(v.best).toBe(100)
    expect(v.sample.rounds.length).toBe(20)
    expect(v.sample.rounds.every((r) => r.predictedA === 'C' || r.predictedA === 'D')).toBe(true)
    const vd = predictorVersus(ruleById('alld'), 20)
    expect(vd.points.mean).toBeLessThan(22)
  })
})

describe('the round-robin and the generations (§6.3, §6.6)', () => {
  const entries: Entry[] = RULES.map((rule) => ({ kind: 'rule', rule }))
  it('every entry plays every entry including itself for 200 rounds; the table is points per round; the total is the mean over opponents', () => {
    const rr = roundRobin(entries, 0)
    expect(rr.table.length).toBe(6)
    expect(rr.table[2][2].mean).toBeCloseTo(3, 9) // tit-for-tat with itself
    expect(rr.table[1][0].mean).toBeCloseTo(5, 9) // always defect against always cooperate
    expect(rr.totals[2]).toBeCloseTo(rr.table[2].reduce((a, c) => a + c.mean, 0) / 6, 9)
    expect(rr.ranking[0]).toBe(2) // tit-for-tat wins this field with no noise (§6.3)
  })
  it('the memory cost is charged per stored number: none for the two fixed rules, one for a memory-one rule, eleven for Predictor; at no cost nothing changes', () => {
    const withP: Entry[] = [...entries, { kind: 'predictor' }]
    expect(withP.map(memoryUnits)).toEqual([0, 0, 1, 1, 1, 1, 11])
    expect(ruleUnits({ id: 'x', label: 'x', first: 1, after: { CC: 1, CD: 1, DC: 1, DD: 1 } })).toBe(0)
    expect(ruleUnits({ id: 'x', label: 'x', first: 0, after: { CC: 1, CD: 1, DC: 1, DD: 1 } })).toBe(1)
    const rr = roundRobin(withP, 0, 200, 4)
    const a = runGenerations(rr, [], 50)
    const b = runGenerations(rr, costsFor(rr, 0.05), 50)
    expect(costsFor(rr, 0.05).map((c) => Number(c.toFixed(3)))).toEqual([0, 0, 0.05, 0.05, 0.05, 0.05, 0.55])
    expect(b.shares[50][6]).toBeLessThan(a.shares[50][6])
    const c = runGenerations(rr, costsFor(rr, 0), 50)
    expect(c.shares[50]).toEqual(a.shares[50])
  })
})

describe('the grid (§6.7)', () => {
  it('the 3 × 3 table is the engine’s own: tit-for-tat with itself 30 over 10 rounds with no noise, always-defect against always-cooperate 50', () => {
    const t = encounterTable(10, 0)
    expect(t[2][2]).toBeCloseTo(30, 9)
    expect(t[1][0]).toBeCloseTo(50, 9)
    expect(t[0][1]).toBeCloseTo(0, 9)
  })
  it('each cell copies the rule of its highest-scoring neighbor, and wraps at the edges', () => {
    const g = new Grid({ ...SHIPPED_GRID, width: 6, height: 6, mutation: 0, noise: 0 }, 1)
    g.start('allc')
    g.cells[g.index(0, 0)] = 1 // one defector among cooperators
    g.step()
    // The defector scored 50 an encounter and every neighbor copies it, including the wrapped ones.
    expect(g.cells[g.index(5, 5)]).toBe(1)
    expect(g.cells[g.index(1, 1)]).toBe(1)
    expect(g.cells[g.index(3, 3)]).toBe(0)
  })
  it('on a bounded grid the edges stop: a corner has three neighbors, an edge five, and a score is the average per encounter, so a corner cell is compared fairly', () => {
    const g = new Grid({ ...SHIPPED_GRID, width: 6, height: 6, mutation: 0, noise: 0, boundary: 'bounded' }, 1)
    expect(g.neighborCount(g.index(0, 0))).toBe(3)
    expect(g.neighborCount(g.index(3, 0))).toBe(5)
    expect(g.neighborCount(g.index(3, 3))).toBe(8)
    g.start('allc')
    g.cells[g.index(0, 0)] = 1
    g.step()
    // The corner defector averaged 50 an encounter over its three neighbors and all three copy it; nothing wrapped to the far corner.
    expect(g.cells[g.index(1, 1)]).toBe(1)
    expect(g.cells[g.index(1, 0)]).toBe(1)
    expect(g.cells[g.index(5, 5)]).toBe(0)
    expect(g.cells[g.index(2, 2)]).toBe(0)
  })
  it('the grid holds any set of the entries, Predictor included, with its table played for Predictor’s pairs and exact for the rest', () => {
    const entriesG: Entry[] = [{ kind: 'rule', rule: ruleById('tft') }, { kind: 'rule', rule: ruleById('alld') }, { kind: 'predictor' }]
    const g = new Grid({ ...SHIPPED_GRID, width: 8, height: 8, noise: 0 }, 3, entriesG)
    expect(g.table[0][0]).toBeCloseTo(30, 9)
    expect(g.table[1][0]).toBeCloseTo(14, 9) // always-defect against tit-for-tat over 10 rounds: 5 + 9
    expect(g.table[2][0]).toBeGreaterThan(15) // Predictor against tit-for-tat: mostly mutual cooperation
    expect(g.table[2][0]).toBeLessThanOrEqual(30)
    g.start('predictor')
    expect(g.shares()[2]).toBe(1)
    g.start('mixed')
    g.run(5)
    expect(g.shares().reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9)
    expect(() => g.start('allc')).toThrow()
  })
  it('the shipped setting meets the targets over twenty seeds: each start world is taken over by the next rule in the cycle, single mutants do not take an all-defect world in 1,000 generations, a dropped block does in most seeds, and a mixed start changes its most common rule at least twice in most seeds, mostly in the cycle’s order', () => {
    const r = measureCycle(SHIPPED_GRID, 20)
    const count = (v: (number | null)[]) => v.filter((x) => x !== null).length
    expect(count(r.tftToAllc)).toBeGreaterThanOrEqual(18)
    expect(count(r.allcToAlld)).toBeGreaterThanOrEqual(18)
    expect(count(r.alldToTftMutants)).toBeLessThanOrEqual(2)
    expect(count(r.alldToTftBlock)).toBeGreaterThanOrEqual(11)
    const twoOrMore = r.mixedChanges.filter((m) => m.changes >= 2).length
    expect(twoOrMore).toBeGreaterThanOrEqual(11)
    const inOrder = r.mixedChanges.reduce((a, m) => a + m.inOrder, 0)
    const all = r.mixedChanges.reduce((a, m) => a + m.changes, 0)
    expect(inOrder / Math.max(1, all)).toBeGreaterThan(0.5)
    expect(median(r.tftToAllc)).not.toBeNull()
  }, 240000)
})
