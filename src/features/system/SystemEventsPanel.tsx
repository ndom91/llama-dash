import { Link } from '@tanstack/react-router'
import { StatusDot } from '../../components/StatusDot'
import type { SystemEvent } from '../../lib/schemas/system'
import { SystemPanel } from './SystemPanel'
import { formatClock } from './systemMetrics'

const MAX_VISIBLE = 8

export function SystemEventsPanel({ events }: { events: Array<SystemEvent> }) {
  return (
    <SystemPanel
      title="Events"
      aside={
        <span className="flex items-center gap-3">
          last 1h
          <Link to="/logs" className="text-accent hover:underline">
            logs ›
          </Link>
        </span>
      }
    >
      {events.length === 0 ? (
        <p className="m-0 py-2 font-mono text-[11px] text-fg-faint">no events in the last hour</p>
      ) : (
        <ol className="m-0 list-none p-0">
          {events.slice(0, MAX_VISIBLE).map((event) => (
            <li
              key={`${event.t}-${event.kind}-${event.modelId ?? event.message}`}
              className="grid items-start gap-2.5 py-1.5 font-mono text-[11px] [grid-template-columns:58px_8px_minmax(0,1fr)]"
            >
              <span className="tabular-nums text-fg-faint">{formatClock(event.t)}</span>
              <span className="pt-1">
                <StatusDot tone={event.tone} />
              </span>
              <span className="min-w-0 break-words text-fg-muted">
                {event.modelId ? <span className="text-fg">{event.modelId} </span> : null}
                {event.message}
              </span>
            </li>
          ))}
        </ol>
      )}
    </SystemPanel>
  )
}
