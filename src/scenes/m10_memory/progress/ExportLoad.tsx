import { useRef, useState } from 'react'
import { Btn, Note } from '../../m06_brain/ui'
import type { ProgressStore } from '../../../sim/memory/progress/store'
import type { SavedState } from '../../../sim/memory/progress/state'
import { describeReplacement, exportFileName, exportText, parseImport } from '../../../sim/memory/progress/transfer'

/**
 * Export my results and Load my results (spec §4.2; Jon, 2026-10-25: one
 * button each, with a two-sentence explanation of when a student would use
 * them). Export writes a small file to the student's own device through a
 * download link; Load reads one back from a file the student chooses.
 * Nothing is uploaded. A loaded file never replaces saved results without
 * the confirmation panel on the page, which says what will be replaced; no
 * browser dialog is used (spec §12, item 11).
 */

export const EXPORT_LOAD_LINE = 'Use these if you change computers, or if your browser clears its data. Export writes a small file to your computer; Load reads one back.'

export function ExportLoad({ store }: { store: ProgressStore }) {
  const input = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<SavedState | null>(null)
  const [done, setDone] = useState<string | null>(null)

  const exportNow = () => {
    const text = exportText(store.state)
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = exportFileName(store.seed)
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    setDone(`Exported ${exportFileName(store.seed)}.`)
    setError(null)
  }

  const onFile = (file: File | undefined) => {
    setDone(null)
    setPending(null)
    if (!file) return
    file
      .text()
      .then((text) => {
        const r = parseImport(text)
        if (!r.ok) {
          setError(r.reason)
          return
        }
        setError(null)
        setPending(r.state)
      })
      .catch(() => setError('The file could not be read.'))
      .finally(() => {
        if (input.current) input.current.value = ''
      })
  }

  const replace = () => {
    if (!pending) return
    store.replaceWith(pending)
    setPending(null)
    setDone('Your saved results were replaced with the file’s contents.')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-export-load>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <Btn onClick={exportNow}>Export my results</Btn>
        <Btn onClick={() => input.current?.click()}>Load my results</Btn>
        <input ref={input} type="file" accept=".json,application/json" style={{ display: 'none' }} aria-label="Load my results from a file" onChange={(e) => onFile(e.target.files?.[0])} />
      </div>
      <Note>{EXPORT_LOAD_LINE}</Note>
      {error && (
        <Note data-load-error style={{ color: 'var(--avoid)' }}>
          {error}
        </Note>
      )}
      {done && <Note data-load-done>{done}</Note>}
      {pending && (
        <div data-confirm style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)' }}>
          {describeReplacement(store.state, pending).map((l) => (
            <Note key={l} style={{ color: 'var(--text)' }}>
              {l}
            </Note>
          ))}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <Btn primary onClick={replace}>
              Replace my saved results
            </Btn>
            <Btn onClick={() => setPending(null)}>Keep what I have</Btn>
          </div>
        </div>
      )}
    </div>
  )
}
