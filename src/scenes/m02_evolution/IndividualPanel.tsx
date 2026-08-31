import { Panel } from '../../components/Panel'
import { WiringPanel, fmt } from '../../components/WiringPanel'
import { LineageTree } from './LineageTree'
import type { Vehicle } from '../../sim/world/world'
import { markCss, type Genome } from '../../sim/creature/genome'
import type { Lineage } from '../../sim/world/continuousWorld'

const GENE_ROW: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  fontFamily: 'var(--font-mono)',
  fontSize: 11.5,
}

/**
 * Click any vehicle: the Lab 1 wiring panel, plus its genome and its path back
 * to a founder.
 *
 * The wiring half is literally the Lab 1 component — see `WiringPanel`. What is
 * new is underneath it, and the order matters: the wiring first, because that is
 * what a student already knows how to read and what Q11 asks about; the genome
 * second, as the same numbers seen as heritable material; the ancestry last, and
 * only when the tree has been revealed.
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
        The same panel you used in Lab 1. This vehicle did not have its wiring
        set — it inherited it.
      </div>

      <WiringPanel
        weights={vehicle.weights}
        sensors={vehicle.sensors}
        actuators={vehicle.actuators}
        history={vehicle.history}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>
          Its genes
        </div>
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
        {energy !== undefined && (
          <div style={{ ...GENE_ROW, marginTop: 4 }}>
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
      </div>

      {lineage && (
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
            Its ancestry
          </div>
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
    </Panel>
  )
}
