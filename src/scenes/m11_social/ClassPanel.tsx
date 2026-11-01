import { useState } from 'react'
import { cloudFor, classEntry, ONE_PERSON_LINE, PENDING_CLASS_LINE, REAL_CLASS_LINE, SIMULATED_CLASS_LINE } from '../../sim/social/classes'
import { Btn, Content, DotPlot, GroupLabel, Note } from './ui'

/**
 * A simulated class (spec §4.3): a cloud of simulated students with the
 * student's own result marked, labeled as simulated with its source; this
 * term's real class in its place when present, with a toggle back; and
 * *Simulated class pending* with no cloud where no source gives a spread
 * between people. The cloud's points come only from `classes.ts`.
 */

export function ClassPanel({ entryId, own, xLabel, yLabel, equalLine, title }: { entryId: string; own: number[] | null; xLabel: string; yLabel: string; equalLine?: boolean; title?: string }) {
  const entry = classEntry(entryId)
  const [showSim, setShowSim] = useState(false)
  const cloud = cloudFor(entry, !showSim)
  const own2 = own && own.length >= 2 ? own : null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 10px', borderRadius: 8, border: '1px dashed var(--border)' }} data-class={entryId} data-class-kind={cloud.kind}>
      <GroupLabel>{title ?? `A simulated class: ${entry.panel}`}</GroupLabel>
      {cloud.kind === 'pending' && (
        <>
          <Content>{PENDING_CLASS_LINE}</Content>
          <Note>Measures this cloud would plot: {entry.measures.join('; ')}.</Note>
        </>
      )}
      {cloud.kind !== 'pending' && (
        <>
          <DotPlot points={[...cloud.points.map((p) => ({ x: p[0], y: p[1], color: 'var(--text-muted)' })), ...(own2 ? [{ x: own2[0], y: own2[1], color: 'var(--accent)', label: 'you' }] : [])]} xLabel={xLabel} yLabel={yLabel} width={320} height={200} marks={equalLine ? undefined : undefined} />
          <Content>{cloud.kind === 'real' ? REAL_CLASS_LINE : SIMULATED_CLASS_LINE}</Content>
          {cloud.kind === 'simulated' && <Note>{cloud.sources.map((s) => `${s.source}; ${s.where}. ${s.differed}`).join(' ')}</Note>}
          {entry.real && entry.real.length > 0 && entry.sources.every((s) => s !== null) && (
            <div>
              <Btn small onClick={() => setShowSim(!showSim)}>
                {showSim ? 'Show this term’s class' : 'Show the simulated class instead'}
              </Btn>
            </div>
          )}
        </>
      )}
      <Content>{ONE_PERSON_LINE}</Content>
    </div>
  )
}
