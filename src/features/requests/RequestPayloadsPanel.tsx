import type { ApiRequestMetadata } from '../../lib/schemas/request'
import { RequestBodySkeleton } from './RequestBodySkeleton'
import { RequestPayloadPane } from './RequestPayloadPane'
import type { RequestPayloadState } from './requestPayloadState'
import { byteSize } from './requestDetailUtils'
import type { useRequestPayloadAnalysis } from './use-request-payload-analysis'

type Props = {
  request: Pick<ApiRequestMetadata, 'id' | 'streamed' | 'promptTokens' | 'completionTokens'>
  state: RequestPayloadState
  analysis: ReturnType<typeof useRequestPayloadAnalysis>
  onRetry: () => void
}

export function RequestPayloadsPanel({ request, state, analysis, onRetry }: Props) {
  let status = 'loading payloads…'
  if (state.status === 'error') status = 'payload load failed'
  if (state.status === 'ready') status = `${byteSize(state.data.requestBody ?? '')} on the wire`

  const { reqHeaders, resHeaders, requestPayload, responseAnalysis, parsedSse } = analysis
  return (
    <section className="panel !rounded-none !border-l-0 !border-r border-r-border !border-b-0 !bg-surface-1 flex min-h-0 flex-1 flex-col">
      <div className="panel-head bg-surface-1 px-4">
        <span className="panel-title">Payloads</span>
        <span className="panel-sub">request • response</span>
        <span className="panel-sub ml-auto" role="status">
          {status}
        </span>
      </div>
      {state.status === 'error' ? (
        <div className="p-4 font-mono text-xs" role="alert">
          <p className="text-err">Failed to load payloads: {state.message}</p>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onRetry}>
            Retry payloads
          </button>
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-2 items-stretch max-[1024px]:grid-cols-1">
          {state.status === 'loading' ? (
            <>
              <RequestBodySkeleton title="Request" />
              <RequestBodySkeleton title="Response" />
            </>
          ) : (
            <>
              <RequestPayloadPane
                key={`${request.id}-request`}
                title="Request"
                subtitle={`${byteSize(state.data.requestBody ?? '')} • ${requestPayload.messagesCount} messages${requestPayload.toolsCount > 0 ? ` • ${requestPayload.toolsCount} tools` : ''} • ${request.promptTokens?.toLocaleString() ?? '—'} tok`}
                body={state.data.requestBody ?? ''}
                headers={reqHeaders}
                mode="pretty"
              />
              <RequestPayloadPane
                key={`${request.id}-response`}
                title="Response"
                subtitle={`${request.streamed ? 'SSE' : 'body'} • ${byteSize(state.data.responseBody ?? '')} • ${request.completionTokens?.toLocaleString() ?? '—'} tok`}
                body={responseAnalysis.displayBody}
                headers={resHeaders}
                mode={responseAnalysis.isSse ? 'sse' : responseAnalysis.isJson ? 'pretty' : 'raw'}
                sseStream={parsedSse}
              />
            </>
          )}
        </div>
      )}
    </section>
  )
}
