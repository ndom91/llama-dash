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
  id: number
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

export type ApiHealth = {
  upstream:
    | { reachable: true; health: string; version: string; commit: string; build_date: string }
    | { reachable: false; error: string }
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
  listRequests: (params: { limit?: number; cursor?: number } = {}) => {
    const q = new URLSearchParams()
    if (params.limit != null) q.set('limit', String(params.limit))
    if (params.cursor != null) q.set('cursor', String(params.cursor))
    const suffix = q.toString() ? `?${q.toString()}` : ''
    return fetch(`/api/requests${suffix}`).then(json<{ requests: Array<ApiRequest>; nextCursor: number | null }>)
  },
  unloadModel: (id: string) =>
    fetch(`/api/models/${encodeURIComponent(id)}/unload`, { method: 'POST' }).then(json<{ ok: true }>),
  unloadAll: () => fetch('/api/models/unload', { method: 'POST' }).then(json<{ ok: true }>),
  health: () => fetch('/api/health').then(json<ApiHealth>),
}
