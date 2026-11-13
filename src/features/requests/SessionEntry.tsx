import { type ReactNode, useEffect, useId, useState } from 'react'

type EntryKind = 'sent' | 'user' | 'thinking' | 'assistant' | 'tool'

export function SessionEntry({
  kind,
  summary,
  meta,
  actions,
  children,
  initiallyOpen = false,
  onActivate,
}: {
  kind: EntryKind
  summary?: ReactNode
  meta?: ReactNode
  actions?: ReactNode
  children?: ReactNode
  initiallyOpen?: boolean
  onActivate?: () => void
}) {
  const [open, setOpen] = useState(initiallyOpen)
  const id = useId()
  useEffect(() => setOpen(initiallyOpen), [initiallyOpen])
  const interactive = Boolean(children) || Boolean(onActivate)
  const line = (
    <>
      <span className="session-entry-label">{kind}</span>{' '}
      {summary ? <span className="session-entry-summary">{summary}</span> : null}{' '}
      <span className="session-entry-meta">{meta}</span>
      {kind === 'tool' && children ? <span aria-hidden="true">{open ? '▾' : '▸'}</span> : null}
    </>
  )
  return (
    <div className={`session-entry session-entry-${kind}`}>
      <span className="session-entry-tile" aria-hidden="true">
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          width="14"
          height="14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {kind === 'sent' ? (
            <path d="M6 4v7h8m-3-3 3 3-3 3" />
          ) : kind === 'user' ? (
            <path d="m8 5 5 5-5 5" />
          ) : kind === 'assistant' ? (
            <circle cx="10" cy="10" r="4" fill="currentColor" stroke="none" />
          ) : kind === 'thinking' ? (
            <>
              <circle cx="10" cy="6" r="1" fill="currentColor" stroke="none" />
              <circle cx="6" cy="13" r="1" fill="currentColor" stroke="none" />
              <circle cx="14" cy="13" r="1" fill="currentColor" stroke="none" />
            </>
          ) : (
            <path d="M10 3v14M13 6.5c-.5-1-1.5-1.5-3-1.5-1.8 0-3 1-3 2.5 0 3.5 6 1.5 6 5 0 1.5-1.2 2.5-3 2.5-1.5 0-2.5-.5-3-1.5" />
          )}
        </svg>
      </span>
      <div className="min-w-0">
        <div className="session-entry-header">
          {interactive ? (
            <button
              type="button"
              className="session-entry-line"
              aria-expanded={children ? open : undefined}
              aria-controls={children ? id : undefined}
              onClick={() => (onActivate ? onActivate() : setOpen(!open))}
            >
              {line}
            </button>
          ) : (
            <div className="session-entry-line">{line}</div>
          )}
          {actions}
        </div>
        {children && open ? (
          <div id={id} className="session-entry-body">
            {children}
          </div>
        ) : null}
      </div>
    </div>
  )
}
