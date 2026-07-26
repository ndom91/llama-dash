import { config } from '../../config.ts'
import type { BackendModel, BackendRunningModel, InferenceBackend, InferenceBackendInfo } from '../backend.ts'

const routerUserAgent = 'llama-dash/1.0'

function getRouterInfo(): InferenceBackendInfo {
  const upstreamUrl = new URL(config.inferenceBaseUrl)
  return {
    kind: 'llama-cpp-router',
    label: 'llama.cpp Router',
    upstreamBaseUrl: config.inferenceBaseUrl,
    upstreamHost: upstreamUrl.host,
    capabilities: {
      models: true,
      runningModels: true,
      lifecycle: true,
      logs: false,
      config: false,
      metrics: true,
    },
  }
}

const baseHeaders = {
  'User-Agent': routerUserAgent,
}

async function fetchJson<T>(endpoint: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${config.inferenceBaseUrl}${endpoint}`, {
    ...init,
    headers: {
      ...baseHeaders,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`llama.cpp router ${endpoint} -> ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

type RouterModelEntry = {
  id: string
  name?: string
  filename?: string
  size?: number
  digest?: string
  description?: string
  status?: {
    value: string
    description: string
  }
  tags?: string[]
  loading?: number
}

type RouterModelsResponse = {
  data: RouterModelEntry[]
}

export function createLlamaCppRouterBackend(): InferenceBackend {
  return {
    get info() {
      return getRouterInfo()
    },

    async ping() {
      const t0 = performance.now()
      try {
        await fetch(`${config.inferenceBaseUrl}/health`, { method: 'GET', headers: baseHeaders })
        return { reachable: true, latencyMs: Math.round(performance.now() - t0) }
      } catch {
        return { reachable: false }
      }
    },

    async health() {
      try {
        const t0 = performance.now()
        const [healthRes, propsRes] = await Promise.all([
          fetch(`${config.inferenceBaseUrl}/health`, { headers: baseHeaders }).then((r) => r.text()),
          fetchJson<Record<string, unknown>>('/props').catch(() => null),
        ])
        const latencyMs = Math.round(performance.now() - t0)
        const version =
          (propsRes?.version as string | undefined) ??
          (propsRes?.build_info as string | undefined) ??
          (propsRes?.router_version as string | undefined) ??
          undefined
        return {
          reachable: true,
          health: healthRes?.trim(),
          latencyMs,
          version,
        }
      } catch (err) {
        return {
          reachable: false,
          error: err instanceof Error ? err.message : String(err),
        }
      }
    },

    defaultProxyUpstream(pathname: string, search: string) {
      return `${config.inferenceBaseUrl}${pathname}${search}`
    },

    eventStreamUrl: `${config.inferenceBaseUrl}/models/sse`,

    async listModels(): Promise<BackendModel[]> {
      const data = await fetchJson<RouterModelsResponse>('/models')
      return (data.data ?? []).map((m: RouterModelEntry) => mapModel(m))
    },

    async listRunning(): Promise<BackendRunningModel[]> {
      const data = await fetchJson<RouterModelsResponse>('/models')
      return (data.data ?? [])
        .filter((m: RouterModelEntry) => {
          const status = m.status?.value
          return status === 'loaded' || status === 'sleeping'
        })
        .map((m: RouterModelEntry) => ({
          model: m.id,
          state: m.status?.value ?? 'unknown',
          ttl: null,
          contextLength: null,
        }))
    },

    async getCurrentModel(): Promise<string | null> {
      try {
        const data = await fetchJson<RouterModelsResponse>('/models')
        const loaded = (data.data ?? []).find((m: RouterModelEntry) => m.status?.value === 'loaded')
        return loaded?.id ?? null
      } catch {
        return null
      }
    },

    async loadModel(id: string): Promise<void> {
      await fetchJson('/models/load', {
        method: 'POST',
        body: JSON.stringify({ model: id }),
      })
    },

    async unloadModel(id: string): Promise<void> {
      await fetchJson('/models/unload', {
        method: 'POST',
        body: JSON.stringify({ model: id }),
      })
    },

    async unloadAll(): Promise<void> {
      // Router mode doesn't have a bulk unload endpoint.
      // Unload all loaded/sleeping models sequentially.
      try {
        const running = await listRunningModels()
        await Promise.allSettled(running.map((m) => unloadSingleModel(m.model)))
      } catch {
        // Best-effort: if /models fails, silently skip.
      }
    },
  }
}

function mapModel(m: RouterModelEntry): BackendModel {
  const name = m.name ?? m.filename ?? m.id.split('/').pop() ?? m.id
  return {
    id: m.id,
    name,
    kind: 'local' as const,
    peerId: null,
    contextLength: null,
    capabilities: {
      inputModalities: ['text'],
      outputModalities: ['text'],
      flags: (m.tags ?? []).filter((t: string) => typeof t === 'string'),
      supportedParameters: [],
    },
  }
}

async function listRunningModels(): Promise<Pick<BackendRunningModel, 'model'>[]> {
  const data = await fetchJson<RouterModelsResponse>('/models')
  return (data.data ?? [])
    .filter((m: RouterModelEntry) => {
      const status = m.status?.value
      return status === 'loaded' || status === 'sleeping'
    })
    .map((m: RouterModelEntry) => ({ model: m.id }))
}

async function unloadSingleModel(id: string): Promise<void> {
  await fetchJson('/models/unload', {
    method: 'POST',
    body: JSON.stringify({ model: id }),
  })
}
