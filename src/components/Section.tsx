import { useState, type ReactNode } from 'react'

/**
 * A collapsible group of controls, headed by a solid bar you click to open.
 *
 * The Module 2 control panel reached fifteen controls covering three unrelated
 * things — the world, the creatures, and the run itself — in one flat column
 * that a student had to scroll. Grouping them puts the question "what kind of
 * thing am I changing?" on the screen instead of in the reader's head, and
 * collapsing keeps the panel short enough to take in at a glance.
 *
 * Open state lives here rather than in the scene: which sections a student has
 * expanded is not something any other part of the app needs to know, and
 * lifting it would mean threading a setter through every panel.
 */
export function Section({
  title,
  children,
  defaultOpen = false,
  hint,
}: {
  title: string
  children: ReactNode
  defaultOpen?: boolean
  /** One line under the title, for what the group is *for*. */
  hint?: string
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          padding: '6px 9px',
          background: open ? 'var(--panel-strong, rgba(255,255,255,0.08))' : 'transparent',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--text)',
          font: 'inherit',
          fontSize: 12,
          fontWeight: 600,
          textAlign: 'left',
          cursor: 'pointer',
        }}
        aria-expanded={open}
      >
        <span
          aria-hidden
          style={{
            display: 'inline-block',
            width: 9,
            transition: 'transform 120ms',
            transform: open ? 'rotate(90deg)' : 'none',
            color: 'var(--text-muted)',
          }}
        >
          ▶
        </span>
        {title}
      </button>
      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '0 2px 4px' }}>
          {hint && (
            <p
              style={{
                margin: 0,
                fontSize: 11.5,
                color: 'var(--text-muted)',
                lineHeight: 1.4,
              }}
            >
              {hint}
            </p>
          )}
          {children}
        </div>
      )}
    </div>
  )
}
