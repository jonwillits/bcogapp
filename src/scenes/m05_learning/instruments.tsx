import { Section } from '../../components/Section'
import { fmt } from '../../components/format'
import { Note, Row } from '../m04_bilaterian/BilaterianScene'
import { SIGNAL_TRACE_LEN, WEIGHT_SAMPLE_S, type LearningDish } from '../../sim/bilaterian/learning/learningDish'
import { WEIGHT_CEILING, WEIGHT_FLOOR } from '../../sim/bilaterian/learning/rule'
import { LinePlot, Legend } from './plots'
import { DOPAMINE_EVIDENCE_LINE, SIGNAL_COLORS } from './labels'

const SUB = '₁₂₃₄₅₆'
/** The weight trace shows the last five minutes and scrolls; it is never squeezed to fit a longer run. */
const WEIGHT_WINDOW = 600

/**
 * The weight trace — the instrument the whole lab is read through. Every
 * stored weight over time on one axis, a mark where the run started, and the
 * value each weight had then printed beside the value it has now: whether a
 * weight has gone back where it began has to be answerable by looking.
 */
export function WeightTraceSection({ world }: { world: LearningDish }) {
  const channels = world.scenario.channels
  const weights = world.learner.actor.weights
  const limits = world.learner.config.limits
  return (
    <Section title="The weight trace" defaultOpen hint="Every stored weight over the run. Nobody is touching a slider.">
      <LinePlot
        series={world.weightTrace.map((data, i) => ({ color: channels[i].color, data: data.slice(-WEIGHT_WINDOW), dashed: !limits[i].plastic }))}
        references={world.startWeights.map((value, i) => ({ value, color: channels[i].color }))}
        yMin={WEIGHT_FLOOR}
        yMax={WEIGHT_CEILING}
        capacity={WEIGHT_WINDOW}
        height={124}
        zeroLine
        startMark={world.weightTrace[0].length <= WEIGHT_WINDOW}
        timeAxis={{ now: world.time, secondsPerSample: WEIGHT_SAMPLE_S }}
      />
      <Legend items={channels.map((c, i) => ({ color: c.color, label: `b${SUB[i]} ${c.name}` }))} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {channels.map((c, i) => (
          <Row
            key={c.channel}
            label={`b${SUB[i]} — ${c.name}${limits[i].plastic ? '' : ' (innate: the rule cannot move it)'}`}
            value={`at the start ${fmt(world.startWeights[i])} · now ${fmt(weights[i])}`}
          />
        ))}
      </div>
      <Note>
        The plot shows the last {Math.round((WEIGHT_WINDOW * WEIGHT_SAMPLE_S) / 60)} minutes of the run, in minutes and seconds of run time, and scrolls once a run is longer than that: the <i>run started</i> mark then moves off the left edge. Dotted lines are where each weight started, and stay. The sliders on the left stay live: set a weight by hand and the rule carries on from there, and Reset will start from it.
      </Note>
    </Section>
  )
}

/** On the Chemistry tab's left panel: the fifth signal, which is not a slider. */
export function DopamineControls() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: SIGNAL_COLORS.dopamine }}>dopamine — the broadcast signal</div>
      <Note>
        Not a control. The four above are levels you set; this one is a number the animal generates, from how the last moment compared with what it expected. Above zero: better than predicted. Below: worse. Zero: exactly as predicted. It is released to every connection at once, and only the Verdict setting on the Learning tab lets it move a weight.
      </Note>
    </div>
  )
}

export function DopamineReadouts({ world }: { world: LearningDish }) {
  const l = world.learner
  return (
    <Section title="Dopamine" defaultOpen hint="The broadcast signal over the last minute.">
      <LinePlot
        series={[
          { color: SIGNAL_COLORS.value, data: world.signalTrace.value },
          { color: SIGNAL_COLORS.dopamine, data: world.signalTrace.broadcast },
        ]}
        yMin={-1.5}
        yMax={1.5}
        capacity={SIGNAL_TRACE_LEN}
        height={90}
        zeroLine
      />
      <Legend
        items={[
          { color: SIGNAL_COLORS.dopamine, label: 'dopamine (δ)' },
          { color: SIGNAL_COLORS.value, label: 'the value estimate' },
        ]}
      />
      <Row label="dopamine now" value={fmt(l.broadcast)} />
      <Row label="the value estimate now" value={fmt(l.value)} />
      <Note>{DOPAMINE_EVIDENCE_LINE}</Note>
    </Section>
  )
}
