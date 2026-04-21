import { useMemo } from 'react'
import { parseSseEvents } from './requestDetailUtils'
import { RequestJsonHighlight } from './RequestJsonHighlight'

type Props = {
  body: string
}

export function RequestSseEvents({ body }: Props) {
  const events = useMemo(() => parseSseEvents(body), [body])
  if (events.length === 0) return <>{body}</>
  return (
    <div className="sse-events">
      {events.map((e, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: stream is append-only, index is stable
        <div className="sse-event" key={i}>
          {e.event != null ? (
            <div className="sse-event-head">
              <span className="sse-field">event:</span>
              <span className="sse-event-name">{e.event}</span>
            </div>
          ) : null}
          <div className="sse-event-data">
            <span className="sse-field">data:</span>{' '}
            {e.parsedData ? (
              <RequestJsonHighlight json={JSON.stringify(e.parsedData, null, 2)} />
            ) : e.isDone ? (
              <span className="sse-done">[DONE]</span>
            ) : (
              <span>{e.data}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
