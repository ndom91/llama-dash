export type ProxyRequestOptions = {
  url?: string
  method?: string
  headers?: Record<string, string>
  body?: string | ReadableStream<Uint8Array> | null
  duplex?: boolean
}

/** Build a Request aimed at the local proxy for handler/integration tests. */
export function makeProxyRequest(options: ProxyRequestOptions = {}): Request {
  const method = options.method ?? 'POST'
  const headers = { ...options.headers }
  const init: RequestInit = { method, headers }

  if (options.body != null) {
    init.body = options.body
    if (options.duplex || typeof options.body !== 'string') {
      Object.assign(init, { duplex: 'half' })
    }
  }

  return new Request(options.url ?? 'http://dash.test/v1/chat/completions', init)
}

export function openaiChatBody(model = 'llama3', overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    model,
    messages: [{ role: 'user', content: 'hi' }],
    ...overrides,
  })
}

export function anthropicMessagesBody(model = 'claude-haiku-4-5-20251001', overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    model,
    max_tokens: 64,
    messages: [{ role: 'user', content: 'hi' }],
    ...overrides,
  })
}
