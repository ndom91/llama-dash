export function toErrorBody(endpoint: string, body: { error: { message: string; type: string } }): unknown {
  if (!isAnthropicEndpoint(endpoint)) return body
  return { type: 'error', error: { type: body.error.type, message: body.error.message } }
}

export function queueOverflowError(
  queueDepth: number,
  maxQueue: number,
): {
  status: number
  headers: Headers
  body: unknown
} {
  const errorBody = {
    error: {
      message: `Local backend is at capacity. Queue is full (${queueDepth}/${maxQueue}).`,
      type: 'queue_overflow',
      queue_depth: queueDepth,
      max_queue: maxQueue,
    },
  }
  return {
    status: 503,
    headers: new Headers({
      'content-type': 'application/json',
      'retry-after': '30',
    }),
    body: errorBody,
  }
}

export function queueTimeoutError(timeoutMs: number): {
  status: number
  headers: Headers
  body: unknown
} {
  const errorBody = {
    error: {
      message: `Request timed out waiting in queue after ${timeoutMs}ms`,
      type: 'queue_timeout',
      timeout_ms: timeoutMs,
    },
  }
  return {
    status: 408,
    headers: new Headers({ 'content-type': 'application/json' }),
    body: errorBody,
  }
}

function isAnthropicEndpoint(endpoint: string): boolean {
  return endpoint === '/v1/messages' || endpoint === '/v1/messages/count_tokens'
}
