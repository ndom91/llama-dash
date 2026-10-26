import { memo } from 'react'
import type { SseEvent } from './requestDetailUtils'
import { RequestTextView } from './RequestTextView'
import { MAX_TEXT_ROW_CHARS } from './textRows'

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
          <RequestTextView text={JSON.stringify(event.parsedData, null, 2)} highlightJson embedded />
        ) : event.isDone ? (
          <span className="sse-done">[DONE]</span>
        ) : event.data.length > MAX_TEXT_ROW_CHARS ? (
          <RequestTextView text={event.data} embedded />
        ) : (
          <span>{event.data}</span>
        )}
      </div>
    </div>
  )
})
