import { readFile } from 'node:fs/promises'
import { availableParallelism, freemem, totalmem } from 'node:os'
import type { SystemTelemetryLatest } from '../lib/schemas/system.ts'
import { publishAdminEvent } from './admin/events.ts'
import { getGpuSnapshot } from './gpu-poller.ts'
import { getRequestLogQueueStats } from './proxy/log.ts'
import { evaluateQueueDrops, evaluateThresholdEvents, recordSystemEvent } from './system-events.ts'
import { type HostPerformanceSample, inferenceBackend } from './inference/backend.ts'
import { TelemetryRing, type TelemetryValues } from './telemetry-ring.ts'

export const TELEMETRY_INTERVAL_MS = 10_000
// 24 h of 10 s slots: ~8.6k slots × 10 Float32 columns, well under 1 MB.
const RING_CAPACITY = (24 * 60 * 60 * 1000) / TELEMETRY_INTERVAL_MS
const MIB = 1024 * 1024

const ring = new TelemetryRing(RING_CAPACITY)
let latest: SystemTelemetryLatest | null = null
let lastHostSampleAt: number | null = null
let lastProcessCpu = process.cpuUsage()
let lastProcessCpuAt = performance.now()
let started = false

export function getTelemetryRing() {
  return ring
}

export function getLatestTelemetry() {
  return latest
}

const CPU_THRESHOLD_WINDOW_MS = 5 * 60_000

export function startSystemTelemetry(commit: string) {
  if (started) return
  started = true
  recordSystemEvent({ kind: 'startup', tone: 'ok', message: `llama-dash started · ${commit.slice(0, 7)}` })
  void backfill().finally(() => {
    void tick()
    setInterval(() => void tick(), TELEMETRY_INTERVAL_MS)
  })
}

/** Seed CPU/RAM history from llama-swap's own 1 h buffer so charts are not empty after a restart. */
async function backfill() {
  const samples = await fetchHostSamples()
  if (!samples || samples.length === 0) return
  let bucketStart = Math.floor(samples[0].timestamp / TELEMETRY_INTERVAL_MS) * TELEMETRY_INTERVAL_MS
  let bucket: Array<HostPerformanceSample> = []
  for (const sample of samples) {
    if (sample.timestamp >= bucketStart + TELEMETRY_INTERVAL_MS) {
      if (bucket.length > 0) ring.push(bucketStart + TELEMETRY_INTERVAL_MS, hostValues(bucket))
      bucket = []
      bucketStart = Math.floor(sample.timestamp / TELEMETRY_INTERVAL_MS) * TELEMETRY_INTERVAL_MS
    }
    bucket.push(sample)
  }
  if (bucket.length > 0) ring.push(bucketStart + TELEMETRY_INTERVAL_MS, hostValues(bucket))
}

async function fetchHostSamples(): Promise<Array<HostPerformanceSample> | null> {
  if (!inferenceBackend.hostPerformance) return null
  try {
    const samples = await inferenceBackend.hostPerformance(lastHostSampleAt ?? undefined)
    const last = samples.at(-1)
    if (last) lastHostSampleAt = last.timestamp
    return samples
  } catch {
    return null
  }
}

function mean(values: Array<number>): number | null {
  return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length
}

function hostValues(samples: Array<HostPerformanceSample>): TelemetryValues {
  return {
    cpu: mean(samples.map((sample) => mean(sample.cpuPerCore) ?? 0)),
    memUsedMiB: mean(samples.map((sample) => sample.memUsedBytes / MIB)),
    memTotalMiB: samples.at(-1)!.memTotalBytes / MIB,
    swapUsedMiB: mean(samples.map((sample) => sample.swapUsedBytes / MIB)),
    load1: samples.at(-1)!.loadAvg[0],
  }
}

async function tick() {
  const now = Date.now()
  const gpu = getGpuSnapshot()
  const card = gpu.available ? (gpu.gpus[0] ?? null) : null
  // Without a backfill cursor the first fetch returns the whole hour; only the newest slot belongs here.
  const samples = (await fetchHostSamples())?.filter((sample) => sample.timestamp > now - 2 * TELEMETRY_INTERVAL_MS)
  const host = samples?.at(-1) ?? null

  const values: TelemetryValues = {
    gpuUtil: card?.utilizationPercent,
    gpuTemp: card?.temperatureC,
    gpuPower: card?.powerW,
    gpuMemUsedMiB: card?.memoryUsedMiB,
    gpuMemTotalMiB: card?.memoryTotalMiB,
    ...(samples && samples.length > 0 ? hostValues(samples) : localHostValues(gpu.cpuUtilizationPercent)),
  }
  ring.push(now, values)

  latest = {
    timestamp: now,
    source: host ? 'backend' : 'local',
    cpuPerCore: host?.cpuPerCore.map((value) => Math.round(value * 10) / 10) ?? latest?.cpuPerCore ?? [],
    loadAvg: host?.loadAvg ?? latest?.loadAvg ?? null,
    memTotalBytes: host?.memTotalBytes ?? (values.memTotalMiB ?? 0) * MIB,
    memUsedBytes: host?.memUsedBytes ?? (values.memUsedMiB ?? 0) * MIB,
    swapTotalBytes: host?.swapTotalBytes ?? latest?.swapTotalBytes ?? null,
    swapUsedBytes: host?.swapUsedBytes ?? latest?.swapUsedBytes ?? null,
    pageCacheBytes: await readPageCacheBytes(),
    process: sampleProcess(),
  }
  evaluateEvents(now, values)
  publishAdminEvent('system.telemetry', { latest, point: { t: now, ...values } })
}

function evaluateEvents(now: number, values: TelemetryValues) {
  const cpuWindow = ring.read(now - CPU_THRESHOLD_WINDOW_MS, 1).cpu[0] ?? null
  evaluateThresholdEvents({
    gpuTempC: values.gpuTemp,
    gpuMemPercent: percent(values.gpuMemUsedMiB, values.gpuMemTotalMiB),
    ramPercent: percent(values.memUsedMiB, values.memTotalMiB),
    cpuPercent: cpuWindow,
    queueDropped: getRequestLogQueueStats().dropped,
  })
  evaluateQueueDrops(getRequestLogQueueStats().dropped)
}

function percent(used: number | null | undefined, total: number | null | undefined): number | null {
  return used == null || total == null || total <= 0 ? null : (used / total) * 100
}

/** Fallback when the backend has no performance API: this machine's own counters. */
function localHostValues(cpuUtilizationPercent: number | null): TelemetryValues {
  return {
    cpu: cpuUtilizationPercent,
    memUsedMiB: (totalmem() - freemem()) / MIB,
    memTotalMiB: totalmem() / MIB,
  }
}

// Page cache is only visible from procfs on this machine, so it is accurate only when
// llama-dash shares a host with the inference backend (the bundled compose setup).
async function readPageCacheBytes(): Promise<number | null> {
  try {
    const meminfo = await readFile('/proc/meminfo', 'utf8')
    const kib = (label: string) => Number(meminfo.match(new RegExp(`^${label}:\\s+(\\d+) kB`, 'm'))?.[1] ?? 0)
    return (kib('Cached') + kib('Buffers')) * 1024
  } catch {
    return null
  }
}

function sampleProcess(): SystemTelemetryLatest['process'] {
  const cpu = process.cpuUsage()
  const nowMs = performance.now()
  const elapsedMicros = (nowMs - lastProcessCpuAt) * 1000
  const usedMicros = cpu.user - lastProcessCpu.user + (cpu.system - lastProcessCpu.system)
  lastProcessCpu = cpu
  lastProcessCpuAt = nowMs
  const cpuPercent = elapsedMicros > 0 ? (usedMicros / elapsedMicros / availableParallelism()) * 100 : 0
  return { cpuPercent: Math.round(cpuPercent * 10) / 10, rssBytes: process.memoryUsage.rss() }
}
