import { hasDashboardUsers } from '../../auth.ts'
import { config } from '../../config.ts'
import { asc, gte } from 'drizzle-orm'
import * as v from 'valibot'
import {
  SYSTEM_EVENTS_WINDOW_MS,
  SYSTEM_TELEMETRY_RANGE_MS,
  SystemTelemetryRangeSchema,
  type ApiSystemTelemetry,
} from '../../../lib/schemas/system.ts'
import { databasePathInfo, db, schema, sqliteDb } from '../../db/index.ts'
import { getGpuSnapshot } from '../../gpu-poller.ts'
import { inferenceBackend } from '../../inference/backend.ts'
import { getModelPricingStatus } from '../../pricing.ts'
import { getRequestLogQueueStats } from '../../proxy/log.ts'
import { compactDatabase, pruneRequestLogs } from '../../request-log-maintenance.ts'
import { getLatestTelemetry, getTelemetryRing, TELEMETRY_INTERVAL_MS } from '../../system-telemetry.ts'
import { getModelFootprints } from '../../model-footprints.ts'
import { getSystemEvents } from '../../system-events.ts'
import { getUpdateCheck } from '../../update-check.ts'
import { error, json, type Route } from './types.ts'
import { errorMessage } from '../../error-message.ts'

const DIRECT_TARGETS = ['https://api.openai.com/v1', 'https://api.anthropic.com/v1']
const GIT_COMMIT = typeof __GIT_COMMIT__ === 'string' ? __GIT_COMMIT__ : 'unknown'
const TELEMETRY_MAX_POINTS = 360
const ROW_COUNT_CACHE_MS = 60_000

let requestRowCount: { value: number; at: number } | null = null

// COUNT(*) scans an index, so cache it; the System page polls this endpoint.
function getRequestRowCount(): number {
  const now = Date.now()
  if (requestRowCount && now - requestRowCount.at < ROW_COUNT_CACHE_MS) return requestRowCount.value
  const row = sqliteDb.prepare('SELECT COUNT(*) AS count FROM requests').get() as { count: number }
  requestRowCount = { value: row.count, at: now }
  return row.count
}

function getDatabaseSizeBytes(): number | null {
  try {
    const pageCount = sqliteDb.pragma('page_count', { simple: true }) as number
    const pageSize = sqliteDb.pragma('page_size', { simple: true }) as number
    return pageCount * pageSize
  } catch {
    return null
  }
}

export const systemRoutes: Route[] = [
  {
    method: 'GET',
    pattern: /^\/api\/health$/,
    handler: async () => {
      const health = await inferenceBackend.health()
      return json(200, {
        upstream: { ...health, backend: inferenceBackend.info.label, host: inferenceBackend.info.upstreamHost },
      })
    },
  },
  {
    method: 'POST',
    pattern: /^\/api\/system\/request-logs\/prune$/,
    handler: async () => {
      try {
        return json(200, pruneRequestLogs())
      } catch (err) {
        return error(503, errorMessage(err))
      }
    },
  },
  {
    method: 'POST',
    pattern: /^\/api\/system\/database\/compact$/,
    handler: async () => {
      try {
        return json(200, compactDatabase())
      } catch (err) {
        return error(500, errorMessage(err))
      }
    },
  },
  {
    method: 'GET',
    pattern: /^\/api\/system$/,
    handler: async () => {
      const backend = inferenceBackend.info
      const gpu = getGpuSnapshot()
      const now = Date.now()
      const [update, inferenceHardware] = await Promise.all([
        getUpdateCheck(GIT_COMMIT),
        inferenceBackend.hardware?.().catch(() => null) ?? Promise.resolve(null),
      ])
      return json(200, {
        runtime: {
          uptimeSec: Math.round(process.uptime()),
          nodeVersion: process.version,
          gitCommit: GIT_COMMIT,
          update,
          pricing: getModelPricingStatus(),
        },
        database: {
          path: databasePathInfo.filename,
          specialPath: !databasePathInfo.needsDirectory,
          sizeBytes: getDatabaseSizeBytes(),
          requestRows: getRequestRowCount(),
        },
        proxy: {
          upstreamBaseUrl: backend.upstreamBaseUrl,
          upstreamHost: backend.upstreamHost,
          insecureTls: config.inferenceInsecure,
          directTargets: DIRECT_TARGETS,
        },
        inference: {
          kind: backend.kind,
          label: backend.label,
          capabilities: backend.capabilities,
        },
        inferenceHardware,
        modelFootprints: [...getModelFootprints()].map(([modelId, footprintMiB]) => ({ modelId, footprintMiB })),
        logging: getRequestLogQueueStats(),
        gpu: {
          available: gpu.available,
          cpuUtilizationPercent: gpu.cpuUtilizationPercent,
          driver: gpu.driver,
          gpuCount: gpu.gpus.length,
          polledAt: gpu.polledAt,
          ageMs: gpu.polledAt > 0 ? now - gpu.polledAt : null,
          gpus: gpu.gpus,
        },
      })
    },
  },
  {
    method: 'GET',
    pattern: /^\/api\/system\/telemetry$/,
    handler: async (request) => {
      const parsed = v.safeParse(SystemTelemetryRangeSchema, new URL(request.url).searchParams.get('range') ?? '15m')
      if (!parsed.success) return error(400, 'Invalid range')
      const range = parsed.output
      const now = Date.now()
      const since = now - Math.max(SYSTEM_TELEMETRY_RANGE_MS[range], SYSTEM_EVENTS_WINDOW_MS)
      const rangeSince = now - SYSTEM_TELEMETRY_RANGE_MS[range]
      const eventsSince = now - SYSTEM_EVENTS_WINDOW_MS
      const modelEvents = db
        .select({
          t: schema.modelEvents.timestamp,
          modelId: schema.modelEvents.modelId,
          event: schema.modelEvents.event,
        })
        .from(schema.modelEvents)
        .where(gte(schema.modelEvents.timestamp, new Date(since)))
        .orderBy(asc(schema.modelEvents.timestamp))
        .all()
      const body: ApiSystemTelemetry = {
        range,
        intervalMs: TELEMETRY_INTERVAL_MS,
        series: getTelemetryRing().read(rangeSince, TELEMETRY_MAX_POINTS),
        latest: getLatestTelemetry(),
        swaps: modelEvents
          .filter((event) => event.t.getTime() >= rangeSince)
          .map((event) => ({ ...event, t: event.t.getTime() })),
        events: [
          ...getSystemEvents(eventsSince),
          ...modelEvents
            .filter((event) => event.t.getTime() >= eventsSince)
            .map((event) => ({
              t: event.t.getTime(),
              kind: 'model' as const,
              tone: event.event === 'load' ? ('ok' as const) : ('idle' as const),
              message: event.event === 'load' ? 'loaded' : 'unloaded',
              modelId: event.modelId,
            })),
        ].sort((a, b) => b.t - a.t),
      }
      return json(200, body)
    },
  },
  {
    method: 'GET',
    pattern: /^\/api\/login-meta$/,
    handler: async (request) => {
      const publicUrl = getPublicUrl(request)
      return json(200, {
        instanceLabel: publicUrl.host || 'local instance',
        uptimeLabel: formatLoginUptime(Math.round(process.uptime())),
        commitLabel: formatLoginCommit(GIT_COMMIT),
        tlsLabel: publicUrl.protocol === 'https:' ? 'https · tls' : 'http · no tls',
        signupAllowed: !hasDashboardUsers(),
      })
    },
  },
]

function getPublicUrl(request: Request) {
  const url = new URL(request.url)
  const forwardedProto = firstForwardedValue(request.headers.get('x-forwarded-proto'))
  const forwardedHost = firstForwardedValue(request.headers.get('x-forwarded-host'))
  const host = forwardedHost ?? request.headers.get('host')

  if (forwardedProto) url.protocol = forwardedProto.endsWith(':') ? forwardedProto : `${forwardedProto}:`
  if (host) url.host = host

  return url
}

function firstForwardedValue(value: string | null) {
  return value?.split(',')[0]?.trim() || null
}

function formatLoginUptime(seconds: number) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours > 0) return `up · ${hours}h ${minutes}m`
  return `up · ${minutes}m`
}

function formatLoginCommit(commit: string) {
  if (commit === 'unknown') return commit
  return commit.slice(0, 7)
}
