import { memo } from 'react'
import type { SseEvent } from './requestDetailUtils'
import { RequestJsonHighlight } from './RequestJsonHighlight'

export const RequestSseEvent = memo(function RequestSseEvent({ event }: { event: SseEvent }) {
  return (
    <div className="sse-event">
      {event.event != null ? (
        <div className="sse-event-head">
          <span className="sse-field">event:</span>
          <span className="sse-event-name">{event.event}</span>
        </div>
      ) : null}
      <div className="sse-event-data">
        <span className="sse-field">data:</span>{' '}
        {event.parsedData ? (
          <RequestJsonHighlight json={JSON.stringify(event.parsedData, null, 2)} />
        ) : event.isDone ? (
          <span className="sse-done">[DONE]</span>
        ) : (
          <span>{event.data}</span>
        )}
      </div>
    </div>
  )
})
