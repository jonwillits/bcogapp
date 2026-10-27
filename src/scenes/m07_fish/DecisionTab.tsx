import { useState } from 'react'
import { Panel } from '../../components/Panel'
import { Section } from '../../components/Section'
import { Button, SelectControl, Slider } from '../../components/controls'
import { fmt } from '../../components/format'
import { CRITERION_RANGE } from '../../sim/fish/brain'
import { BASE_RATE_RANGE } from '../../sim/fish/kinds'
import { STAKES_PRESETS, byHand, describeCriterion, energyPer100, falseAlarmRate, hitRate, percentCorrect, type Counts, type Stakes } from '../../sim/fish/sdt'
import { CHEMISTRY, criterionShift, type FishWorld } from '../../sim/fish/world'
import type { FishSceneState } from './FishScene'
import { OUTCOME_WORDS, SDT_NAMES } from './labels'
import { EnergyPlot, EvidencePlot } from './plots'
import { GroupLabel, Note, NumberBox, PANEL_STYLE, RIGHT_STYLE, Row, TabBar } from './ui'

/**
 * The four outcomes on the test set at the criterion now in force, laid out
 * as the chapter's table lays them out.
 */
export function FourCounts({ world, counts }: { world: FishWorld; counts: Counts }) {
  const words = OUTCOME_WORDS[world.route]
  const cell: React.CSSProperties = { border: '1px solid var(--border)', padding: '5px 6px', fontSize: 11.5, textAlign: 'center' }
  const head: React.CSSProperties = { ...cell, color: 'var(--text-muted)', fontSize: 10.5 }
  const big: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 15, display: 'block' }
  return (
    <table style={{ borderCollapse: 'collapse', width: '100%' }}>
      <tbody>
        <tr>
          <td style={head} />
          <td style={head}>The fish responds: {words.verdict}</td>
          <td style={head}>The fish does not: {words.quiet}</td>
        </tr>
        <tr>
          <td style={head}>{words.happens}</td>
          <td style={cell}>
            {SDT_NAMES.hit}
            <span style={big}>{counts.hits}</span>
          </td>
          <td style={cell}>
            {SDT_NAMES.miss}
            <span style={big}>{counts.misses}</span>
          </td>
        </tr>
        <tr>
          <td style={head}>{words.doesNot}</td>
          <td style={cell}>
            {SDT_NAMES.falseAlarm}
            <span style={big}>{counts.falseAlarms}</span>
          </td>
          <td style={cell}>
            {SDT_NAMES.correctRejection}
            <span style={big}>{counts.correctRejections}</span>
          </td>
        </tr>
      </tbody>
    </table>
  )
}

/**
 * *By hand*: type four counts, get the two rates, d′ from the two rates, and
 * where the criterion sits. A calculator, not an instrument on the fish — it
 * reads nothing from the fish, so it stays available when a fish is hidden.
 */
/** Lab 7's box. `initial` and `note` let another lab open it empty, with its own line (Lab 10's room opens on zeros, since the reading's numbers there looked like the student's own). */
export function ByHandBox({ initial = { hits: 42, misses: 8, falseAlarms: 8, correctRejections: 42 }, note }: { initial?: Counts; note?: string } = {}) {
  const [c, setC] = useState<Counts>(initial)
  const r = byHand(c)
  const set = (k: keyof Counts) => (v: number) => setC((was) => ({ ...was, [k]: Math.max(0, Math.round(v)) }))
  const ok = c.hits + c.misses > 0 && c.falseAlarms + c.correctRejections > 0
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <NumberBox label="hits" value={c.hits} onChange={set('hits')} />
      <NumberBox label="misses" value={c.misses} onChange={set('misses')} />
      <NumberBox label="false alarms" value={c.falseAlarms} onChange={set('falseAlarms')} />
      <NumberBox label="correct rejections" value={c.correctRejections} onChange={set('correctRejections')} />
      <Row label="hit rate = hits ÷ (hits + misses)" value={ok ? r.hitRate.toFixed(3) : '—'} />
      <Row label="false-alarm rate = false alarms ÷ (false alarms + correct rejections)" value={ok ? r.falseAlarmRate.toFixed(3) : '—'} />
      <Row label="d′ = z(hit rate) − z(false-alarm rate)" value={ok ? r.dPrime.toFixed(2) : '—'} />
      <Row label="criterion: 0 neutral, below liberal, above conservative" value={ok ? `${fmt(r.criterion)} (${describeCriterion(r.criterion)})` : '—'} />
      <Row label="percent correct" value={ok ? `${r.percentCorrect.toFixed(1)}%` : '—'} />
      <Note>
        {note ?? 'z(·) is how many spreads from the middle of a bell curve a rate lies. The box opens on the reading’s first face-memory tester, 42 and 8 out of 50; the second is 49 hits, 1 miss, 25 false alarms, 25 correct rejections. A rate of exactly 0 or 1 has no z, so it is counted as half a response short of the end.'}
      </Note>
    </div>
  )
}

/**
 * The Decision tab: the signal detection instruments (§7.1.4). The criterion
 * and the two modulators on the left move where the line is drawn. Nothing
 * here moves a weight, a baseline or a single evidence value.
 */
export function DecisionTab(s: FishSceneState) {
  const { world, bump, hide } = s
  const st = world.settings
  const out = world.brain.circuit.output!
  const shift = criterionShift(st.chemistry, world.route)
  const set = world.tests[0]
  const counts = world.testCounts(set)
  const words = OUTCOME_WORDS[world.route]
  const preset = STAKES_PRESETS.find((p) => (Object.keys(p.stakes) as (keyof Stakes)[]).every((k) => p.stakes[k] === st.stakes[k]))
  const setStake = (k: keyof Stakes) => (v: number) => {
    world.set({ stakes: { ...st.stakes, [k]: v } })
    s.clearEnergy()
    bump()
  }

  const left = (
    <Panel title="The decision" style={PANEL_STYLE}>
      <TabBar tab={s.tab} onChange={s.setTab} />
      <Note>
        The output unit’s evidence is set against a <b>criterion</b>: at or above it, the fish responds ({words.verdict}); below it, it does not. <b>Sensitivity</b> is how far apart the two kinds of evidence lie, and lives in the weights. The criterion lives here.
      </Note>
      {hide ? (
        <Note>This fish’s numbers are hidden until you reveal it on the Fish tab. Its four counts are on the right, and the by-hand box works on any counts you type.</Note>
      ) : (
        <>
          <GroupLabel>The criterion</GroupLabel>
          {s.can('criterion') ? (
            <Slider
              label="criterion"
              value={out.threshold}
              min={CRITERION_RANGE.min}
              max={CRITERION_RANGE.max}
              step={CRITERION_RANGE.step}
              format={fmt}
              onChange={(v) => {
                world.wire({ layer: 'output', threshold: v })
                bump()
              }}
            />
          ) : (
            <Row label="criterion (locked)" value={fmt(out.threshold)} />
          )}
          {CHEMISTRY.map((c) =>
            s.can('chemistry') ? (
              <div key={c.id} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Slider
                  label={c.label}
                  value={st.chemistry[c.id]}
                  min={c.min}
                  max={c.max}
                  step={0.05}
                  onChange={(v) => {
                    world.set({ chemistry: { ...st.chemistry, [c.id]: v } })
                    bump()
                  }}
                />
                <Note>{c.does}</Note>
              </div>
            ) : (
              <Row key={c.id} label={`${c.label} (locked)`} value={st.chemistry[c.id].toFixed(2)} />
            ),
          )}
          <Row label="moved by arousal and vigilance" value={fmt(shift.arousal)} />
          <Row label="moved by satiety and tone" value={fmt(shift.satiety)} />
          <Row label="effective criterion" value={fmt(world.effectiveCriterion)} />
          <Note>
            The effective criterion is the slider plus what the two modulators add. Learning never writes any of the three, and the prediction that learning compares with the outcome is computed without them.
          </Note>

          <GroupLabel>The world’s side of it</GroupLabel>
          {s.can('baseRate') ? (
            <Slider
              label={world.route === 'dart' ? 'How often an eel is upstream' : 'How often the outcome happens'}
              value={st.baseRate}
              min={BASE_RATE_RANGE.min}
              max={BASE_RATE_RANGE.max}
              step={BASE_RATE_RANGE.step}
              format={(v) => `${Math.round(v * 100)}%`}
              onChange={(v) => {
                world.set({ baseRate: v })
                s.clearEnergy()
                bump()
              }}
            />
          ) : (
            <Row label="How often the outcome happens (locked)" value={`${Math.round(st.baseRate * 100)}%`} />
          )}
          {s.can('stakes') ? (
            <>
              <SelectControl
                label="What each outcome is worth"
                value={preset?.id ?? 'custom'}
                options={[...STAKES_PRESETS.map((p) => ({ value: p.id as string, label: p.label })), ...(preset ? [] : [{ value: 'custom', label: 'Your own numbers' }])]}
                onChange={(id: string) => {
                  const p = STAKES_PRESETS.find((x) => x.id === id)
                  if (!p) return
                  world.set({ stakes: { ...p.stakes } })
                  s.clearEnergy()
                  bump()
                }}
              />
              {preset && <Note>{preset.says}</Note>}
              <NumberBox label="a hit is worth" value={st.stakes.hit} onChange={setStake('hit')} />
              <NumberBox label="a miss is worth" value={st.stakes.miss} onChange={setStake('miss')} />
              <NumberBox label="a false alarm is worth" value={st.stakes.falseAlarm} onChange={setStake('falseAlarm')} />
              <NumberBox label="a correct rejection is worth" value={st.stakes.correctRejection} onChange={setStake('correctRejection')} />
              <Button onClick={s.scoreCriterion} title="Scores the criterion now in force on 500 fresh encounters, without learning and without drawing them.">
                Score this criterion
              </Button>
              <Note>Each press scores the present criterion on 500 fresh encounters and adds a point to the plot on the right. Move the criterion and press again to sweep it.</Note>
            </>
          ) : (
            <Row label="What each outcome is worth (locked)" value={preset?.label ?? 'custom'} mono={false} />
          )}
        </>
      )}
    </Panel>
  )

  const right = (
    <Panel title="Signal detection" style={RIGHT_STYLE}>
      {!hide && (
        <Section key={`${world.scenario.key}-${s.fish}-ev`} title="The evidence" defaultOpen>
          <EvidencePlot world={world} />
          <Note>
            Two histograms of the output unit’s evidence on the test set: one for encounters where {words.happens}, one where {words.doesNot}. <b>d′</b> is the distance between their two centers in units of their pooled spread. The bars to the right of the criterion are bright: in the blue histogram they are the hits, in the orange one the false alarms.
          </Note>
        </Section>
      )}
      <Section key={`${world.scenario.key}-${s.fish}-score`} title="The scorecard" defaultOpen>
        <FourCounts world={world} counts={counts} />
        <Note>On the test set of {set.x1.length.toLocaleString('en-US')} encounters, at the criterion now in force.</Note>
        {!hide && (
          <>
            <Row label="hit rate" value={hitRate(counts).toFixed(3)} />
            <Row label="false-alarm rate" value={falseAlarmRate(counts).toFixed(3)} />
            <Row label="percent correct" value={`${percentCorrect(counts).toFixed(1)}%`} />
            <Row label="Energy per 100 encounters" value={fmt(energyPer100(counts, st.stakes))} />
          </>
        )}
      </Section>
      {!hide && s.can('stakes') && (
        <Section key={`${world.scenario.key}-energy`} title="Energy against criterion" defaultOpen={world.scenario.open.includes('stakes')}>
          <EnergyPlot points={s.energyPoints} />
          <Note>One point per press of <b>Score this criterion</b>; the best so far is white. Changing the stakes or how often an eel is upstream clears the plot.</Note>
        </Section>
      )}
      <Section key="by-hand" title="By hand" defaultOpen={world.scenario.key === 'diagnosis'}>
        <ByHandBox />
      </Section>
    </Panel>
  )

  return { left, right }
}
