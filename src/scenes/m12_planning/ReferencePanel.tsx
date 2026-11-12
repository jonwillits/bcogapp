import { PENDING_REFERENCE_LINE } from '../../sim/planning/classes'
import type { Reference } from '../../sim/planning/references'
import { Content, GroupLabel, Note } from './ui'

/** A reference panel (spec §9): the source, where its values come from, the values or the pending line, and how the lab's procedure differed. */
export function ReferencePanel({ reference }: { reference: Reference }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 10px', borderRadius: 8, border: '1px dashed var(--border)' }} data-reference={reference.id} data-pending={reference.values ? undefined : true}>
      <GroupLabel>{reference.title}</GroupLabel>
      <Note>
        {reference.source}; {reference.where}.
      </Note>
      {reference.values ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {reference.values.map((v) => (
            <Note key={v.label} style={{ color: 'var(--text)' }}>
              {v.label}: <span style={{ fontFamily: 'var(--font-mono)' }}>{typeof v.value === 'number' ? (Number.isInteger(v.value) ? v.value : v.value.toFixed(2)) : v.value}</span>
            </Note>
          ))}
        </div>
      ) : (
        <Content>{PENDING_REFERENCE_LINE}</Content>
      )}
      <Note>How the lab differed: {reference.differed}</Note>
    </div>
  )
}
