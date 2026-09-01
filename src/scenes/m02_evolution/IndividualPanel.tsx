import { Panel } from '../../components/Panel'
import { Section } from '../../components/Section'
import { WiringDiagram } from '../../components/WiringDiagram'
import { ActuatorEquation } from '../../components/ActuatorEquation'
import { SensorTrace } from '../../components/SensorTrace'
import { fmt } from '../../components/format'
import { LineageTree } from './LineageTree'
import type { Vehicle } from '../../sim/world/world'
import { markCss, type Genome } from '../../sim/creature/genome'
import type { Lineage } from '../../sim/world/continuousWorld'

const GENE_ROW: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  fontFamily: 'var(--font-mono)',
  fontSize: 11.5,
  // Indented under whichever heading owns it. Without this the genes and the
  // creature's current state sat at the same level and read as one list, which
  // said that age and stored energy were inherited.
  paddingLeft: 10,
}

const SUB_LABEL: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--text-muted)',
  marginBottom: 4,
}

/** A label and its value on one line, for the live state readouts. */
const INLINE_ROW: React.CSSProperties = {
  display: 'flex',
  gap: 12,
  fontFamily: 'var(--font-mono)',
  fontSize: 11.5,
  paddingLeft: 10,
}

/** Radians from +X toward +Z, shown the way a compass would: 0-359 degrees. */
function headingDegrees(radians: number): number {
  const d = (radians * 180) / Math.PI
  return Math.round(((d % 360) + 360) % 360)
}

/**
 * Click any vehicle: the Lab 1 wiring panel, plus its genome and its path back
 * to a founder.
 *
 * Grouped into collapsible sections the same way the control panel is, because
 * the panel now holds three unrelated kinds of thing: what this creature is
 * doing right now, how its nervous system works, and what it inherited. The
 * grouping puts "what kind of thing am I looking at?" on the screen instead of
 * in the reader's head.
 *
 * **Genetics is closed by default and the other two are open.** Q11 sends a
 * student here to read the wiring, and the live state is three lines; the genes
 * are the thing they are meant to reach after looking, not before.
 *
 * The instruments inside — the diagram, the arithmetic, the sensor trace — are
 * the same components Lab 1 renders, which is what §6 means by asking a student
 * to open a panel they already know. What differs is the arrangement and the
 * wording, and that is composed here rather than switched on inside a shared
 * panel: see the note on primitives versus compositions in `WiringPanel`.
 *
 * There are no tuning sliders, and their absence is the point. From Module 2 on,
 * connection strength and bias are not things you set — they are things a
 * vehicle inherited.
 */
export function IndividualPanel({
  vehicle,
  genome,
  individualId,
  lineage,
  treeRevealed,
  energy,
  age,
  lifespan,
  treeSpan,
  onClose,
}: {
  vehicle: Vehicle
  genome: Genome
  individualId: number
  lineage?: readonly Lineage[]
  treeRevealed: boolean
  energy?: number
  /** Seconds lived, and the span this one was given. */
  age?: number
  lifespan?: number
  /** Simulated seconds the tree covers. */
  treeSpan?: number
  onClose: () => void
}) {
  const gene = (label: string, value: number) => (
    <div style={GENE_ROW}>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span>{fmt(value)}</span>
    </div>
  )

  return (
    <Panel
      title="Individual"
      onClose={onClose}
      style={{ width: 320 }}
      headerAccessory={
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            color: vehicle.color,
          }}
        >
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: vehicle.color,
            }}
          />
          #{individualId}
        </span>
      }
    >
      <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.45 }}>
        The same instruments you used in Lab 1. This vehicle did not have its
        wiring set — it inherited it.
      </div>

      <Section title="General Info" defaultOpen>
        <div style={INLINE_ROW}>
          <span>
            <span style={{ color: 'var(--text-muted)' }}>pos </span>
            {vehicle.state.x.toFixed(1)}, {vehicle.state.z.toFixed(1)}
          </span>
          <span>
            <span style={{ color: 'var(--text-muted)' }}>speed </span>
            {fmt((vehicle.actuators.left + vehicle.actuators.right) / 2)}
          </span>
          <span>
            <span style={{ color: 'var(--text-muted)' }}>heading </span>
            {headingDegrees(vehicle.state.heading)}°
          </span>
        </div>
        {energy !== undefined && (
          <div style={GENE_ROW}>
            <span style={{ color: 'var(--text-muted)' }}>energy stored</span>
            <span>{fmt(energy)}</span>
          </div>
        )}
        {age !== undefined && lifespan !== undefined && (
          <div style={GENE_ROW}>
            <span style={{ color: 'var(--text-muted)' }}>age</span>
            <span>
              {age.toFixed(0)}s of {lifespan.toFixed(0)}s
            </span>
          </div>
        )}
      </Section>

      <Section title="Neural System" defaultOpen>
        <div>
          <div style={SUB_LABEL}>Network Architecture</div>
          <WiringDiagram
            weights={vehicle.weights}
            sensors={vehicle.sensors}
            actuators={vehicle.actuators}
          />
        </div>

        <div>
          <div style={SUB_LABEL}>Actuator Value Calculations</div>
          <ActuatorEquation
            weights={vehicle.weights}
            sensors={vehicle.sensors}
            actuators={vehicle.actuators}
          />
        </div>

        <div>
          <div style={SUB_LABEL}>Sensor Activation Over Time</div>
          <SensorTrace history={vehicle.history} width={288} />
        </div>
      </Section>

      <Section title="Genetic Info">
        <div>
          <div style={SUB_LABEL}>Genes</div>
          {gene('sensor L → actuator L', genome.wLL)}
          {gene('sensor L → actuator R', genome.wLR)}
          {gene('sensor R → actuator L', genome.wRL)}
          {gene('sensor R → actuator R', genome.wRR)}
          {gene('actuator bias', genome.bias)}
          {/*
            The mark, not the body colour. Body colour is computed from the four
            weights above and so is not a gene at all; this bead is the gene that
            does nothing, and it is listed here among the others precisely because
            nothing in the panel should hint that it is different.
          */}
          <div style={GENE_ROW}>
            <span style={{ color: 'var(--text-muted)' }}>mark</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: markCss(genome.hue),
                  border: '1px solid var(--border)',
                }}
              />
              {Math.round(genome.hue)}°
            </span>
          </div>
        </div>

        {lineage && (
          <div>
            <div style={SUB_LABEL}>Ancestry</div>
            {treeRevealed ? (
              <LineageTree
                lineage={lineage}
                memberIds={[individualId]}
                highlight={[individualId]}
                span={treeSpan ?? 1}
                height={140}
              />
            ) : (
              <p
                style={{
                  fontSize: 11.5,
                  color: 'var(--text-muted)',
                  lineHeight: 1.45,
                  margin: 0,
                  fontStyle: 'italic',
                }}
              >
                Hidden. Reveal the tree when the lab tells you to — not before.
              </p>
            )}
          </div>
        )}
      </Section>

    </Panel>
  )
}
