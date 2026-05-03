import { count, gte, sql } from 'drizzle-orm'
import { getGpuSnapshot } from './gpu-poller.ts'
import { inferenceBackend } from './inference/backend.ts'
import { getRequestLogQueueStats } from './proxy/log.ts'
import { db, schema } from './db/index.ts'

type RequestMetricRow = {
  endpoint: string
  model: string | null
  statusCode: number
  streamed: boolean
  count: number
}

type TokenMetricRow = {
  model: string | null
  promptTokens: number | null
  completionTokens: number | null
  cacheCreationTokens: number | null
  cacheReadTokens: number | null
  totalTokens: number | null
}

const ENDPOINT_ALLOWLIST = new Set([
  '/v1/chat/completions',
  '/v1/messages',
  '/v1/messages/count_tokens',
  '/v1/embeddings',
  '/v1/models',
  '/v1/audio/transcriptions',
  '/v1/audio/speech',
  '/v1/images/generations',
])

function metricLine(name: string, value: number, labels?: Record<string, string | number | boolean | null>): string {
  const labelEntries = Object.entries(labels ?? {}).filter(([, value]) => value != null)
  if (labelEntries.length === 0) return `${name} ${value}`
  const rendered = labelEntries.map(([key, value]) => `${key}="${escapeLabel(String(value))}"`).join(',')
  return `${name}{${rendered}} ${value}`
}

function escapeLabel(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')
}

function normalizeEndpoint(endpoint: string): string {
  return ENDPOINT_ALLOWLIST.has(endpoint) ? endpoint : 'other'
}

function normalizeModel(model: string | null): string {
  return model || 'unknown'
}

function statusClass(statusCode: number): string {
  if (statusCode >= 100 && statusCode <= 599) return `${Math.floor(statusCode / 100)}xx`
  return 'other'
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))] / 1_000
}

async function upstreamMetrics(): Promise<{ reachable: number; latencySeconds: number }> {
  const health = await inferenceBackend.ping()
  return { reachable: health.reachable ? 1 : 0, latencySeconds: (health.latencyMs ?? 0) / 1_000 }
}

export async function renderPrometheusMetrics(): Promise<string> {
  const requestRows = db
    .select({
      endpoint: schema.requests.endpoint,
      model: schema.requests.model,
      statusCode: schema.requests.statusCode,
      streamed: schema.requests.streamed,
      count: count(),
    })
    .from(schema.requests)
    .groupBy(schema.requests.endpoint, schema.requests.model, schema.requests.statusCode, schema.requests.streamed)
    .all()

  const tokenRows = db
    .select({
      model: schema.requests.model,
      promptTokens: sql<number>`coalesce(sum(${schema.requests.promptTokens}), 0)`,
      completionTokens: sql<number>`coalesce(sum(${schema.requests.completionTokens}), 0)`,
      cacheCreationTokens: sql<number>`coalesce(sum(${schema.requests.cacheCreationTokens}), 0)`,
      cacheReadTokens: sql<number>`coalesce(sum(${schema.requests.cacheReadTokens}), 0)`,
      totalTokens: sql<number>`coalesce(sum(${schema.requests.totalTokens}), 0)`,
    })
    .from(schema.requests)
    .groupBy(schema.requests.model)
    .all() as TokenMetricRow[]

  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60_000)
  const latencyRows = db
    .select({ durationMs: schema.requests.durationMs })
    .from(schema.requests)
    .where(gte(schema.requests.startedAt, thirtyMinutesAgo))
    .all()

  const queue = getRequestLogQueueStats()
  const gpu = getGpuSnapshot()
  const [upstream, runningModels] = await Promise.all([
    upstreamMetrics(),
    (inferenceBackend.listRunning?.() ?? Promise.resolve([])).then(
      (result) => result.length,
      () => 0,
    ),
  ])
  const lines: string[] = []

  lines.push('# HELP llama_dash_process_uptime_seconds Process uptime in seconds.')
  lines.push('# TYPE llama_dash_process_uptime_seconds gauge')
  lines.push(metricLine('llama_dash_process_uptime_seconds', process.uptime()))

  lines.push('# HELP llama_dash_requests_total Total logged proxy requests.')
  lines.push('# TYPE llama_dash_requests_total counter')
  for (const row of requestRows as RequestMetricRow[]) {
    lines.push(
      metricLine('llama_dash_requests_total', row.count, {
        endpoint: normalizeEndpoint(row.endpoint),
        model: normalizeModel(row.model),
        status_class: statusClass(row.statusCode),
        streamed: row.streamed,
      }),
    )
  }

  lines.push('# HELP llama_dash_tokens_total Total logged tokens by model and token type.')
  lines.push('# TYPE llama_dash_tokens_total counter')
  for (const row of tokenRows) {
    const model = normalizeModel(row.model)
    lines.push(metricLine('llama_dash_tokens_total', row.promptTokens ?? 0, { model, type: 'prompt' }))
    lines.push(metricLine('llama_dash_tokens_total', row.completionTokens ?? 0, { model, type: 'completion' }))
    lines.push(metricLine('llama_dash_tokens_total', row.cacheCreationTokens ?? 0, { model, type: 'cache_creation' }))
    lines.push(metricLine('llama_dash_tokens_total', row.cacheReadTokens ?? 0, { model, type: 'cache_read' }))
    lines.push(metricLine('llama_dash_tokens_total', row.totalTokens ?? 0, { model, type: 'total' }))
  }

  const latencies = latencyRows.map((row) => row.durationMs)
  lines.push('# HELP llama_dash_request_duration_p50_seconds_30m Request duration p50 over the last 30 minutes.')
  lines.push('# TYPE llama_dash_request_duration_p50_seconds_30m gauge')
  lines.push(metricLine('llama_dash_request_duration_p50_seconds_30m', percentile(latencies, 0.5)))
  lines.push('# HELP llama_dash_request_duration_p95_seconds_30m Request duration p95 over the last 30 minutes.')
  lines.push('# TYPE llama_dash_request_duration_p95_seconds_30m gauge')
  lines.push(metricLine('llama_dash_request_duration_p95_seconds_30m', percentile(latencies, 0.95)))

  lines.push('# HELP llama_dash_log_queue_depth Request log rows waiting to be written.')
  lines.push('# TYPE llama_dash_log_queue_depth gauge')
  lines.push(metricLine('llama_dash_log_queue_depth', queue.queued))
  lines.push('# HELP llama_dash_log_queue_dropped_total Request log rows dropped by the bounded queue.')
  lines.push('# TYPE llama_dash_log_queue_dropped_total counter')
  lines.push(metricLine('llama_dash_log_queue_dropped_total', queue.dropped))

  lines.push('# HELP llama_dash_upstream_reachable Whether inference backend health is reachable.')
  lines.push('# TYPE llama_dash_upstream_reachable gauge')
  lines.push(metricLine('llama_dash_upstream_reachable', upstream.reachable))
  lines.push('# HELP llama_dash_upstream_latency_seconds Inference backend health check latency.')
  lines.push('# TYPE llama_dash_upstream_latency_seconds gauge')
  lines.push(metricLine('llama_dash_upstream_latency_seconds', upstream.latencySeconds))

  lines.push('# HELP llama_dash_models_running Current count of running models reported by the inference backend.')
  lines.push('# TYPE llama_dash_models_running gauge')
  lines.push(metricLine('llama_dash_models_running', runningModels))

  for (const gpuEntry of gpu.gpus) {
    const labels = { index: gpuEntry.index, name: gpuEntry.name, driver: gpu.driver }
    if (gpuEntry.memoryUsedMiB != null) {
      lines.push(metricLine('llama_dash_gpu_memory_used_bytes', gpuEntry.memoryUsedMiB * 1024 * 1024, labels))
    }
    if (gpuEntry.memoryTotalMiB != null) {
      lines.push(metricLine('llama_dash_gpu_memory_total_bytes', gpuEntry.memoryTotalMiB * 1024 * 1024, labels))
    }
    if (gpuEntry.memoryPercent != null) {
      lines.push(metricLine('llama_dash_gpu_memory_percent', gpuEntry.memoryPercent, labels))
    }
    if (gpuEntry.utilizationPercent != null) {
      lines.push(metricLine('llama_dash_gpu_utilization_percent', gpuEntry.utilizationPercent, labels))
    }
    if (gpuEntry.temperatureC != null) {
      lines.push(metricLine('llama_dash_gpu_temperature_celsius', gpuEntry.temperatureC, labels))
    }
    if (gpuEntry.powerW != null) {
      lines.push(metricLine('llama_dash_gpu_power_watts', gpuEntry.powerW, labels))
    }
  }

  return `${lines.join('\n')}\n`
}
