export type ApiModel = {
  id: string
  name: string
  kind: 'local' | 'peer'
  peerId: string | null
  state: string
  running: boolean
  ttl: number | null
}

export type ApiRequest = {
  id: string
  startedAt: string
  durationMs: number
  method: string
  endpoint: string
  model: string | null
  statusCode: number
  promptTokens: number | null
  completionTokens: number | null
  totalTokens: number | null
  streamed: boolean
  error: string | null
}

export type ApiRequestDetail = ApiRequest & {
  requestHeaders: string | null
  requestBody: string | null
  responseHeaders: string | null
  responseBody: string | null
}

export type ApiHealth = {
  upstream:
    | { reachable: true; health: string; version: string; commit: string; build_date: string }
    | { reachable: false; error: string }
}

export type ApiRequestStats = {
  reqPerSec: number
  tokPerSec: number
  p50Latency: number
  errorRate: number
  sparklines: {
    reqs: Array<number>
    toks: Array<number>
    latency: Array<number>
    errors: Array<number>
  }
}

export type ApiHistogramBucket = {
  timestamp: number
  total: number
  errors: number
}

export type ApiModelEvent = {
  id: string
  modelId: string
  event: 'load' | 'unload'
  timestamp: string
}

const json = async <T>(res: Response): Promise<T> => {
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`${res.status} ${res.statusText}: ${body.slice(0, 200)}`)
  }
  return (await res.json()) as T
}

export const api = {
  listModels: () => fetch('/api/models').then(json<{ models: Array<ApiModel> }>),
  listRequests: (params: { limit?: number; cursor?: string } = {}) => {
    const q = new URLSearchParams()
    if (params.limit != null) q.set('limit', String(params.limit))
    if (params.cursor != null) q.set('cursor', params.cursor)
    const suffix = q.toString() ? `?${q.toString()}` : ''
    return fetch(`/api/requests${suffix}`).then(json<{ requests: Array<ApiRequest>; nextCursor: string | null }>)
  },
  getRequest: (id: string) =>
    fetch(`/api/requests/${id}`).then(
      json<{ request: ApiRequestDetail; prevId: string | null; nextId: string | null }>,
    ),
  loadModel: (id: string) =>
    fetch(`/api/models/${encodeURIComponent(id)}/load`, { method: 'POST' }).then(json<{ ok: true }>),
  unloadModel: (id: string) =>
    fetch(`/api/models/${encodeURIComponent(id)}/unload`, { method: 'POST' }).then(json<{ ok: true }>),
  unloadAll: () => fetch('/api/models/unload', { method: 'POST' }).then(json<{ ok: true }>),
  health: () => fetch('/api/health').then(json<ApiHealth>),
  requestStats: () => fetch('/api/requests/stats').then(json<ApiRequestStats>),
  modelTimeline: (windowMs?: number) => {
    const q = windowMs != null ? `?window=${windowMs}` : ''
    return fetch(`/api/model-timeline${q}`).then(json<{ events: Array<ApiModelEvent> }>)
  },
  requestHistogram: (params: { window?: number; bucket?: number } = {}) => {
    const q = new URLSearchParams()
    if (params.window != null) q.set('window', String(params.window))
    if (params.bucket != null) q.set('bucket', String(params.bucket))
    const suffix = q.toString() ? `?${q.toString()}` : ''
    return fetch(`/api/requests/histogram${suffix}`).then(json<{ buckets: Array<ApiHistogramBucket> }>)
  },
}
