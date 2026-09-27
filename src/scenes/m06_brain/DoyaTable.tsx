import { useState } from 'react'
import { Note } from './ui'

/**
 * Doya's table, empty at the start (spec §8.7): one row per family of
 * learning, one column — which pathway, when silenced, stopped it? The
 * student fills it in from their own results; the scene does not check it.
 * Its correct form is the chapter's `#t-learning-structures`, which the
 * handout gives after the student has filled it in.
 */

const FAMILIES = ['unsupervised', 'prediction', 'supervised', 'reinforcement'] as const
const OPTIONS = ['', 'climbing fibers', 'dopamine fibers', 'none'] as const

export function DoyaTable() {
  const [rows, setRows] = useState<Record<string, string>>({})
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <Note>Which pathway, when silenced during training, stopped it? Fill this in from your own results. The scene does not check it.</Note>
      <table style={{ borderCollapse: 'collapse', fontSize: 12, width: '100%' }}>
        <thead>
          <tr style={{ color: 'var(--text-muted)', fontSize: 11 }}>
            <th style={{ textAlign: 'left', fontWeight: 600, padding: '2px 0' }}>Kind of learning</th>
            <th style={{ textAlign: 'left', fontWeight: 600, padding: '2px 0' }}>Which pathway, when silenced, stopped it?</th>
          </tr>
        </thead>
        <tbody>
          {FAMILIES.map((f) => (
            <tr key={f} style={{ borderTop: '1px solid var(--border)' }}>
              <td style={{ padding: '4px 6px 4px 0' }}>{f}</td>
              <td style={{ padding: '4px 0' }}>
                <select
                  value={rows[f] ?? ''}
                  onChange={(e) => setRows({ ...rows, [f]: e.target.value })}
                  style={{ width: '100%', padding: '3px 6px', background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }}
                >
                  {OPTIONS.map((o) => (
                    <option key={o} value={o}>
                      {o === '' ? '—' : o}
                    </option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
