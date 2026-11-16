import { FixedLines, GroupLabel, Note, Content } from './ui'
import { PENDING_REFERENCE_LINE, type Reference } from '../../sim/language/references'

/** A reference value's panel: the study, the year and the section of the reading, the values as aligned rows with where each comes from, or the pending line and what appears once the source is added (LAB_COMMON_FEATURES §6). */
export function ReferencePanel({ reference: r }: { reference: Reference }) {
  return (
    <div data-reference={r.id} style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 8, border: '1px solid var(--border)', borderRadius: 8 }}>
      <GroupLabel>{r.title}</GroupLabel>
      <Note>{r.source}</Note>
      {r.values ? (
        <>
          <FixedLines lines={r.values.map((v) => `${v.label}: ${v.value}`)} mono={false} />
          <Note>From {r.where}.</Note>
          <Note>{r.note}</Note>
        </>
      ) : (
        <>
          <Content>{PENDING_REFERENCE_LINE}</Content>
          <Note>{r.note}</Note>
        </>
      )}
    </div>
  )
}
