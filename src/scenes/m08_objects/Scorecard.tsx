import type { CSSProperties } from 'react'
import { byHand, type Counts } from '../../sim/fish/sdt'
import { fmtSigned } from '../../components/format'
import { SDT_NAMES } from '../m07_fish/labels'
import { CORRECTION_LINE } from './lines'
import { Note } from './ui'

/**
 * Lab 7's scorecard, with the same four words in the same layout, for one
 * condition of Part 3: hits, misses, false alarms, correct rejections, and
 * d′ by hand from the two rates. With four trials of each kind a rate of 0
 * or 1 is common; Lab 7's By hand repair (half a response short of the end)
 * is applied and a line says so.
 */
export function Scorecard({ counts, title, who, steps }: { counts: Counts; title: string; who: string; steps?: number }) {
  const r = byHand(counts)
  const repaired = counts.hits === 0 || counts.misses === 0 || counts.falseAlarms === 0 || counts.correctRejections === 0
  const cell: CSSProperties = { border: '1px solid var(--border)', padding: '4px 6px', fontSize: 11.5, textAlign: 'center' }
  const head: CSSProperties = { ...cell, color: 'var(--text-muted)', fontSize: 10 }
  const big: CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 14, display: 'block' }
  return (
    <div data-scorecard={`${who}/${title}`} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ fontSize: 12 }}><b>{title}</b></div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'pre' }}>{steps === undefined ? who : `${who}, after ${String(steps).padStart(5)} steps`}</div>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <tbody>
          <tr>
            <td style={head} />
            <td style={head}>said same shoe</td>
            <td style={head}>said not the same</td>
          </tr>
          <tr>
            <td style={head}>the target shoe</td>
            <td style={cell}>{SDT_NAMES.hit}<span style={big}>{counts.hits}</span></td>
            <td style={cell}>{SDT_NAMES.miss}<span style={big}>{counts.misses}</span></td>
          </tr>
          <tr>
            <td style={head}>another object</td>
            <td style={cell}>{SDT_NAMES.falseAlarm}<span style={big}>{counts.falseAlarms}</span></td>
            <td style={cell}>{SDT_NAMES.correctRejection}<span style={big}>{counts.correctRejections}</span></td>
          </tr>
        </tbody>
      </table>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, whiteSpace: 'pre', lineHeight: 1.5 }}>
        {`hit rate          ${r.hitRate.toFixed(2)}\nfalse-alarm rate  ${r.falseAlarmRate.toFixed(2)}\nd′                ${fmtSigned(r.dPrime)}`}
      </div>
      {repaired && <Note>{CORRECTION_LINE}</Note>}
    </div>
  )
}
