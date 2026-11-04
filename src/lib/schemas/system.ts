import * as v from 'valibot'
import { GpuInfoSchema } from './gpu'
import { InferenceHardwareSchema } from './inference-hardware'

export const ModelPricingStatusSchema = v.union([
  v.object({ status: v.picklist(['idle', 'loading']) }),
  v.object({
    status: v.literal('ready'),
    count: v.number(),
    skippedRecords: v.number(),
    partialCacheRecords: v.number(),
  }),
  v.object({ status: v.literal('unavailable'), reason: v.string() }),
])

export type ModelPricingStatus = v.InferOutput<typeof ModelPricingStatusSchema>

export const ApiSystemStatusSchema = v.object({
  runtime: v.object({
    uptimeSec: v.number(),
    nodeVersion: v.string(),
    gitCommit: v.string(),
    update: v.object({
      status: v.union([v.literal('unknown'), v.literal('current'), v.literal('available'), v.literal('error')]),
      current: v.string(),
      latest: v.nullable(v.string()),
      url: v.nullable(v.string()),
      checkedAt: v.nullable(v.number()),
    }),
    pricing: ModelPricingStatusSchema,
  }),
  database: v.object({
    path: v.string(),
    specialPath: v.boolean(),
    sizeBytes: v.nullable(v.number()),
    requestRows: v.number(),
  }),
  proxy: v.object({
    upstreamBaseUrl: v.string(),
    upstreamHost: v.string(),
    insecureTls: v.boolean(),
    directTargets: v.array(v.string()),
  }),
  inference: v.object({
    kind: v.string(),
    label: v.string(),
    capabilities: v.object({
      models: v.boolean(),
      runningModels: v.boolean(),
      lifecycle: v.boolean(),
      logs: v.boolean(),
      config: v.boolean(),
      metrics: v.boolean(),
    }),
  }),
  inferenceHardware: v.nullable(InferenceHardwareSchema),
  modelFootprints: v.array(v.object({ modelId: v.string(), footprintMiB: v.number() })),
  logging: v.object({
    queued: v.number(),
    dropped: v.number(),
  }),
  gpu: v.object({
    available: v.boolean(),
    cpuUtilizationPercent: v.nullable(v.number()),
    driver: v.nullable(v.union([v.literal('nvidia'), v.literal('amd'), v.literal('apple')])),
    gpuCount: v.number(),
    polledAt: v.number(),
    ageMs: v.nullable(v.number()),
    gpus: v.array(GpuInfoSchema),
  }),
})

export type ApiSystemStatus = v.InferOutput<typeof ApiSystemStatusSchema>

export const SYSTEM_TELEMETRY_RANGES = ['5m', '15m', '1h', '6h', '24h'] as const
export const SystemTelemetryRangeSchema = v.picklist(SYSTEM_TELEMETRY_RANGES)
export type SystemTelemetryRange = v.InferOutput<typeof SystemTelemetryRangeSchema>

export const SYSTEM_TELEMETRY_RANGE_MS: Record<SystemTelemetryRange, number> = {
  '5m': 5 * 60_000,
  '15m': 15 * 60_000,
  '1h': 60 * 60_000,
  '6h': 6 * 60 * 60_000,
  '24h': 24 * 60 * 60_000,
}

/** Ranges short enough that every 10 s point is kept, so live SSE points can be appended as-is. */
export function isLiveAppendRange(range: SystemTelemetryRange): boolean {
  return SYSTEM_TELEMETRY_RANGE_MS[range] <= SYSTEM_TELEMETRY_RANGE_MS['1h']
}

const NullableNumberArray = v.array(v.nullable(v.number()))

export const SystemTelemetryPointSchema = v.object({
  t: v.number(),
  gpuUtil: v.optional(v.nullable(v.number())),
  gpuTemp: v.optional(v.nullable(v.number())),
  gpuPower: v.optional(v.nullable(v.number())),
  gpuMemUsedMiB: v.optional(v.nullable(v.number())),
  gpuMemTotalMiB: v.optional(v.nullable(v.number())),
  cpu: v.optional(v.nullable(v.number())),
  memUsedMiB: v.optional(v.nullable(v.number())),
  memTotalMiB: v.optional(v.nullable(v.number())),
  swapUsedMiB: v.optional(v.nullable(v.number())),
  load1: v.optional(v.nullable(v.number())),
})

export const SystemTelemetrySeriesSchema = v.object({
  t: v.array(v.number()),
  gpuUtil: NullableNumberArray,
  gpuTemp: NullableNumberArray,
  gpuPower: NullableNumberArray,
  gpuMemUsedMiB: NullableNumberArray,
  gpuMemTotalMiB: NullableNumberArray,
  cpu: NullableNumberArray,
  memUsedMiB: NullableNumberArray,
  memTotalMiB: NullableNumberArray,
  swapUsedMiB: NullableNumberArray,
  load1: NullableNumberArray,
})

export type SystemTelemetrySeries = v.InferOutput<typeof SystemTelemetrySeriesSchema>

export const SystemTelemetryLatestSchema = v.object({
  timestamp: v.number(),
  /** `backend` = inference host via its performance API; `local` = this machine's counters. */
  source: v.picklist(['backend', 'local']),
  cpuPerCore: v.array(v.number()),
  loadAvg: v.nullable(v.tuple([v.number(), v.number(), v.number()])),
  memTotalBytes: v.number(),
  memUsedBytes: v.number(),
  swapTotalBytes: v.nullable(v.number()),
  swapUsedBytes: v.nullable(v.number()),
  pageCacheBytes: v.nullable(v.number()),
  process: v.object({
    cpuPercent: v.number(),
    rssBytes: v.number(),
  }),
})

export type SystemTelemetryLatest = v.InferOutput<typeof SystemTelemetryLatestSchema>

export const SystemModelSwapSchema = v.object({
  t: v.number(),
  modelId: v.string(),
  event: v.picklist(['load', 'unload']),
})

export const SystemEventSchema = v.object({
  t: v.number(),
  kind: v.picklist(['threshold', 'queue', 'startup', 'model']),
  tone: v.picklist(['ok', 'warn', 'err', 'idle']),
  message: v.string(),
  modelId: v.optional(v.string()),
})

export type SystemEvent = v.InferOutput<typeof SystemEventSchema>

export const SYSTEM_EVENTS_WINDOW_MS = 60 * 60_000

export const ApiSystemTelemetrySchema = v.object({
  range: SystemTelemetryRangeSchema,
  intervalMs: v.number(),
  series: SystemTelemetrySeriesSchema,
  latest: v.nullable(SystemTelemetryLatestSchema),
  swaps: v.array(SystemModelSwapSchema),
  /** Newest first, always the last hour regardless of range. */
  events: v.array(SystemEventSchema),
})

export type ApiSystemTelemetry = v.InferOutput<typeof ApiSystemTelemetrySchema>

export const SystemTelemetryEventSchema = v.object({
  latest: SystemTelemetryLatestSchema,
  point: SystemTelemetryPointSchema,
})

export const LoginMetaSchema = v.object({
  instanceLabel: v.string(),
  uptimeLabel: v.string(),
  commitLabel: v.string(),
  tlsLabel: v.string(),
  signupAllowed: v.boolean(),
})

export type LoginMeta = v.InferOutput<typeof LoginMetaSchema>
