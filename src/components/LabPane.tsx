import { useEffect, useState } from 'react'
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import styles from './LabPane.module.css'
import type { LabSource } from '../scenes/registry'

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ok'; markdown: string }
  | { kind: 'error'; reason: string }

/**
 * The in-scene lab pane: instructions + questions, plus a link to the report
 * doc students submit.
 *
 * The **course repo is the single source of truth** — the handout markdown is
 * fetched at runtime from `intro_to_bcs` rather than copied into this repo, so
 * editing the course repo updates every student's view with no redeploy (raw
 * GitHub allows cross-origin reads and the service worker caches the response
 * for offline use). If the fetch fails — offline on a first visit, or the file
 * was moved/renamed — the pane degrades to a clear "not available" message with
 * a link straight to the handout, rather than showing nothing.
 */
export function LabPane({
  lab,
  onClose,
}: {
  lab: LabSource
  onClose: () => void
}) {
  const [state, setState] = useState<LoadState>({ kind: 'loading' })

  useEffect(() => {
    const ctrl = new AbortController()
    setState({ kind: 'loading' })
    fetch(lab.rawUrl, { signal: ctrl.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.text()
      })
      .then((markdown) => setState({ kind: 'ok', markdown }))
      .catch((e: unknown) => {
        if (ctrl.signal.aborted) return
        setState({ kind: 'error', reason: String(e) })
      })
    return () => ctrl.abort()
  }, [lab.rawUrl])

  return (
    <aside className={styles.pane} aria-label="Lab instructions">
      <div className={styles.header}>
        <span className={styles.title}>Lab</span>
        <span className={styles.spacer} />
        <button
          type="button"
          className={styles.close}
          onClick={onClose}
          aria-label="Close lab pane"
          title="Close lab pane"
        >
          ×
        </button>
      </div>

      <div className={styles.actions}>
        {lab.reportUrl && (
          <a
            className={styles.reportLink}
            href={lab.reportUrl}
            target="_blank"
            rel="noreferrer"
          >
            ↓ {lab.reportLabel ?? 'Lab report'}
          </a>
        )}
        <a
          className={styles.sourceLink}
          href={lab.sourceUrl}
          target="_blank"
          rel="noreferrer"
        >
          Handout source
        </a>
      </div>

      <div className={styles.body}>
        {state.kind === 'loading' && (
          <p className={styles.status}>Loading lab instructions…</p>
        )}

        {state.kind === 'error' && (
          <div className={styles.status}>
            <div className={styles.statusTitle}>Lab info not available</div>
            <p>
              The instructions couldn’t be loaded from the course repository.
              You may be offline, or the handout may have moved.
            </p>
            <p>
              You can read it directly on{' '}
              <a href={lab.sourceUrl} target="_blank" rel="noreferrer">
                GitHub
              </a>
              .
            </p>
          </div>
        )}

        {state.kind === 'ok' && (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            // The handout lives in another repo, so relative links and images
            // (e.g. ../images/turtle_neuro.png) must resolve against the raw
            // file's URL or they'd 404 against this app's origin.
            urlTransform={(url) => {
              const safe = defaultUrlTransform(url)
              if (!safe) return safe
              if (safe.startsWith('#') || /^[a-z][a-z0-9+.-]*:/i.test(safe)) {
                return safe
              }
              try {
                return new URL(safe, lab.rawUrl).toString()
              } catch {
                return safe
              }
            }}
            components={{
              // Never navigate the student away from the running simulation.
              a: ({ children, ...props }) => (
                <a {...props} target="_blank" rel="noreferrer">
                  {children}
                </a>
              ),
            }}
          >
            {state.markdown}
          </ReactMarkdown>
        )}
      </div>
    </aside>
  )
}
