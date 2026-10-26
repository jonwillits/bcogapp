import type { CSSProperties } from 'react'
import { PROPERTIES, RELATIONS, THINGS, type Thing } from '../../../sim/memory/foragers/world'

/**
 * The slow learner's world as a property table (spec §9.4): one row per
 * property, grouped by relation, the things as columns, a mark where the
 * thing has it, and the level. With `outputs`, the table shows how the
 * network answers now: each cell shaded by the output, so a property lost
 * (a right answer faded) and one borrowed from a sibling (a wrong answer
 * filled) both show.
 */
const SHORT: Record<Thing, string> = {
  'loose-bark log': 'loose log',
  'smooth log': 'smooth log',
  'seed grass': 'grass',
  'berry bush': 'bush',
  owl: 'owl',
  hawk: 'hawk',
  fox: 'fox',
  snake: 'snake',
  'acorn tree': 'tree',
  weasel: 'weasel',
}

export function PropertyTable({ outputs, things = THINGS }: { outputs?: number[][]; things?: readonly Thing[] }) {
  const cell: CSSProperties = { border: '1px solid var(--border)', padding: '2px 4px', fontSize: 10, textAlign: 'center', fontFamily: 'var(--font-mono)' }
  const head: CSSProperties = { ...cell, color: 'var(--text-muted)', fontFamily: undefined }
  const name: CSSProperties = { ...cell, textAlign: 'left', fontFamily: undefined, whiteSpace: 'nowrap' }
  return (
    <table style={{ borderCollapse: 'collapse' }} data-property-table={outputs ? 'answers' : 'world'}>
      <thead>
        <tr>
          <th style={head}>property</th>
          <th style={head}>level</th>
          {things.map((t) => (
            <th key={t} style={head}>
              {SHORT[t]}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {RELATIONS.map((rel) =>
          PROPERTIES.map((p, k) =>
            p.relation === rel ? (
              <tr key={p.name} data-property={p.name} data-level={p.level}>
                <td style={name}>
                  {rel} {p.name}
                </td>
                <td style={{ ...cell, color: 'var(--text-muted)' }}>{p.level[0]}</td>
                {things.map((t) => {
                  const has = p.things.includes(t)
                  const o = outputs ? outputs[k][things.indexOf(t)] : null
                  const wrong = o !== null && (o >= 0.5) !== has
                  return (
                    <td key={t} style={{ ...cell, background: o === null ? (has ? 'rgba(79,156,255,0.25)' : undefined) : `rgba(79,156,255,${(0.1 + 0.8 * o).toFixed(2)})`, color: wrong ? 'var(--avoid)' : 'var(--text)', fontWeight: wrong ? 700 : 400 }} data-has={has ? true : undefined} data-wrong={wrong ? true : undefined}>
                      {o === null ? (has ? '●' : '') : o.toFixed(2)}
                    </td>
                  )
                })}
              </tr>
            ) : null,
          ),
        )}
      </tbody>
    </table>
  )
}

export const TABLE_LEGEND = 'Levels: g general, m middle, s specific. A dot marks a property the thing has. When the table shows the network’s answers, each cell is the output, shaded; a wrong answer is in red.'
