import { BellRing, ScrollText, Wrench, X } from 'lucide-react'
import { type Ref, useId, useMemo, useRef } from 'react'
import { CopyButton } from '../../components/CopyButton'
import { formatCompactNumber } from '../../lib/format'
import { RequestTextView } from './RequestTextView'
import type { TranscriptContext } from './sessionTranscript'

type Props = {
  ref: Ref<HTMLDialogElement>
  context: TranscriptContext | null
}

export function SessionContextDialog({ ref, context }: Props) {
  const titleId = useId()
  const pressedOutside = useRef(false)
  const stats = useMemo(() => (context ? textStats(context.text) : null), [context])

  return (
    <dialog
      ref={ref}
      closedby="any"
      // Light-dismiss fallback for browsers without `closedby`.
      onPointerDown={(event) => {
        if (!('closedBy' in HTMLDialogElement.prototype)) pressedOutside.current = isOutside(event)
      }}
      onPointerUp={(event) => {
        if (!('closedBy' in HTMLDialogElement.prototype) && pressedOutside.current && isOutside(event)) {
          event.currentTarget.close()
        }
        pressedOutside.current = false
      }}
      aria-labelledby={titleId}
      // The dialog itself takes focus on open; the important shadow beats the global :focus-visible ring.
      className="session-context-dialog fixed inset-0 outline-none m-auto max-h-[min(84dvh,880px)] w-[min(92vw,880px)] max-w-[calc(100%-2rem)] flex-col overflow-hidden rounded border border-border-strong bg-surface-0 p-0 text-fg shadow-[0_24px_64px_-16px_rgb(0_0_0/0.55)]! backdrop:bg-surface-0/80 open:flex"
    >
      {context && stats ? (
        <>
          <header className="flex shrink-0 items-center gap-3 border-b border-border-strong bg-surface-2 py-3 pr-3 pl-4">
            <span className="grid size-9 shrink-0 place-items-center rounded border border-border-strong bg-surface-1 text-fg-dim">
              <KindIcon kind={context.kind} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-fg-dim">
                <span>context · {context.kind}</span>
                {context.changed ? (
                  <span className="rounded-sm border border-info/40 bg-info/10 px-1.5 py-px tracking-[0.08em] text-info">
                    changed since previous request
                  </span>
                ) : null}
              </div>
              <h2 id={titleId} className="m-0 mt-0.5 truncate text-[15px] font-semibold text-fg">
                {contextTitle(context)}
              </h2>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <CopyButton
                text={context.text}
                ariaLabel="Copy context"
                className="btn btn-sm h-7 bg-surface-3 hover:bg-surface-4"
              />
              <form method="dialog">
                <button
                  type="submit"
                  className="btn btn-sm h-7 w-7 justify-center bg-surface-3 px-0 hover:bg-surface-4"
                  aria-label="Close"
                >
                  <X className="size-3.5" strokeWidth={2} aria-hidden="true" />
                </button>
              </form>
            </div>
          </header>
          <div className="flex shrink-0 items-center gap-3 border-b border-border bg-surface-1 px-4 py-1.5 font-mono text-[11px] text-fg-dim">
            <span className="min-w-0 flex-1 truncate">
              {[
                context.kind === 'tools' ? context.label : null,
                `~${formatCompactNumber(Math.ceil(context.text.length / 4))} tok`,
                formatBytes(stats.bytes),
                `${stats.lines.toLocaleString()} ${stats.lines === 1 ? 'line' : 'lines'}`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
            <span className="shrink-0 max-md:hidden">
              <kbd className="rounded-sm border border-border-strong bg-surface-2 px-1 text-[10px] text-fg-muted">
                esc
              </kbd>{' '}
              to close
            </span>
          </div>
          {/* Tool schemas can reach several MB; RequestTextView virtualizes large text. */}
          <RequestTextView
            text={context.text}
            highlightJson={context.kind === 'tools'}
            highlightMarkdown={context.kind !== 'tools'}
            className="flex-1 pl-4"
          />
        </>
      ) : null}
    </dialog>
  )
}

const KIND_ICONS = { system: ScrollText, tools: Wrench, reminder: BellRing }

function KindIcon({ kind }: { kind: TranscriptContext['kind'] }) {
  const Icon = KIND_ICONS[kind]
  return <Icon className="size-4" strokeWidth={1.75} aria-hidden="true" />
}

function isOutside(event: React.PointerEvent<HTMLDialogElement>): boolean {
  const rect = event.currentTarget.getBoundingClientRect()
  return (
    event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom
  )
}

function contextTitle(context: TranscriptContext): string {
  if (context.kind === 'tools') return 'Tool schemas'
  return context.label.charAt(0).toUpperCase() + context.label.slice(1)
}

function textStats(text: string): { bytes: number; lines: number } {
  let lines = 1
  for (let index = text.indexOf('\n'); index !== -1; index = text.indexOf('\n', index + 1)) lines++
  return { bytes: new TextEncoder().encode(text).length, lines }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
