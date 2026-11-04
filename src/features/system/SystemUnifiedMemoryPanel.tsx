import type { ApiModel } from '../../lib/schemas/model'
import type { ApiSystemStatus, SystemTelemetryLatest } from '../../lib/schemas/system'
import { assignSeriesSteps, seriesVar } from '../../lib/series-color'
import { formatGiB, mibToBytes } from './systemMetrics'

type Segment = { id: string; label: string; detail?: string; bytes: number; color: string; striped?: boolean }

function isUnifiedMemory(status: ApiSystemStatus): boolean {
  if (status.gpu.driver === 'apple') return true
  const gpuTotal = status.gpu.gpus[0]?.memoryTotalMiB
  const dedicated = status.inferenceHardware?.accelerators[0]?.memory.capacity_bytes
  // APUs report a small BIOS carve-out as dedicated VRAM but allocate from a much larger GTT pool.
  return gpuTotal != null && dedicated != null && mibToBytes(gpuTotal) > dedicated * 2
}

export function SystemUnifiedMemoryPanel({
  status,
  latest,
  models,
}: {
  status: ApiSystemStatus
  latest: SystemTelemetryLatest | null
  models: Array<ApiModel>
}) {
  const gpu = status.gpu.available ? (status.gpu.gpus[0] ?? null) : null
  if (!gpu || gpu.memoryUsedMiB == null || gpu.memoryTotalMiB == null) return null

  const unified = isUnifiedMemory(status)
  const gpuUsed = mibToBytes(gpu.memoryUsedMiB)
  const gpuLimit = mibToBytes(gpu.memoryTotalMiB)
  const poolTotal = unified
    ? (status.inferenceHardware?.memory.capacity_bytes ?? latest?.memTotalBytes ?? gpuLimit)
    : gpuLimit
  const footprints = new Map(status.modelFootprints.map((row) => [row.modelId, mibToBytes(row.footprintMiB)]))
  const resident = models.filter((model) => model.kind === 'local' && model.running)
  const steps = assignSeriesSteps(resident.map((model) => model.id))

  const modelSegments: Array<Segment> = resident.flatMap((model) => {
    const bytes = footprints.get(model.id)
    return bytes == null ? [] : [{ id: model.id, label: model.id, bytes, color: seriesVar(steps.get(model.id) ?? 0) }]
  })
  const attributed = modelSegments.reduce((sum, segment) => sum + segment.bytes, 0)
  const segments: Array<Segment> = [
    ...modelSegments,
    {
      id: 'gpu-other',
      label: modelSegments.length > 0 ? 'other gpu allocations' : 'gpu allocations',
      detail: modelSegments.length < resident.length ? 'includes unmeasured models' : undefined,
      bytes: Math.max(0, gpuUsed - attributed),
      color: 'var(--fg-dim)',
    },
  ]
  // On Apple the GPU reading already is system-wide memory use, so processes would double count.
  if (unified && status.gpu.driver !== 'apple' && latest) {
    segments.push({
      id: 'processes',
      label: 'other processes',
      detail: latest.source === 'backend' ? 'inference host' : 'this host',
      bytes: latest.memUsedBytes,
      color: 'var(--fg-faint)',
    })
    if (latest.pageCacheBytes != null) {
      segments.push({
        id: 'cache',
        label: 'page cache',
        detail: 'reclaimable',
        bytes: latest.pageCacheBytes,
        color: 'var(--fg-faint)',
        striped: true,
      })
    }
  }
  const used = segments.filter((segment) => !segment.striped).reduce((sum, segment) => sum + segment.bytes, 0)
  const listed = segments.reduce((sum, segment) => sum + segment.bytes, 0)
  const free = Math.max(0, poolTotal - listed)
  const gpuFree = Math.max(0, Math.min(gpuLimit - gpuUsed, free))
  const nextFit = largestFit(models, footprints, gpuFree)

  return (
    <section className="border-t border-border">
      <div className="flex h-10 items-center gap-3 border-b border-border px-6 max-md:px-4">
        <h2 className="panel-title">{unified ? 'Unified Memory' : 'GPU Memory'}</h2>
        <span className="font-mono text-[10px] text-fg-faint">
          {formatGiB(poolTotal)} GiB {unified ? 'shared between CPU and GPU' : 'dedicated'}
        </span>
        {unified ? (
          <span className="ml-auto font-mono text-[10px] text-fg-faint">GTT limit {formatGiB(gpuLimit)} GiB</span>
        ) : null}
      </div>
      <div className="px-6 pt-3 pb-4 max-md:px-4">
        <div className="mb-2 flex items-baseline gap-2 font-mono">
          <span className="text-2xl font-semibold tabular-nums tracking-[-0.03em] text-fg">{formatGiB(used)} GiB</span>
          <span className="text-[11px] text-fg-dim">in use · {formatGiB(free)} GiB free</span>
        </div>
        <div className="relative flex h-5 overflow-hidden rounded-sm border border-border bg-surface-2">
          {segments.map((segment) => (
            <div
              key={segment.id}
              className="h-full border-r border-surface-0/60 transition-[width] duration-300 ease-out"
              style={{
                width: `${(segment.bytes / poolTotal) * 100}%`,
                background: segment.striped
                  ? `repeating-linear-gradient(135deg, ${segment.color} 0 3px, transparent 3px 6px)`
                  : segment.color,
              }}
            />
          ))}
          {unified ? (
            <div
              className="absolute inset-y-0 w-px bg-fg"
              style={{ left: `${Math.min(100, (gpuLimit / poolTotal) * 100)}%` }}
              aria-hidden="true"
            />
          ) : null}
        </div>
        <dl className="m-0 mt-3 grid gap-x-8 gap-y-1.5 md:grid-cols-2 xl:grid-cols-3">
          {[...segments, { id: 'free', label: 'free', bytes: free, color: 'transparent' } satisfies Segment].map(
            (segment) => (
              <div key={segment.id} className="flex items-center gap-2 font-mono text-[11px]">
                <span
                  className="size-2 shrink-0 rounded-[2px] border border-border"
                  style={{ background: segment.color }}
                  aria-hidden="true"
                />
                <dt className="truncate text-fg-muted">
                  {segment.label}
                  {segment.detail ? <span className="ml-1.5 text-[10px] text-fg-faint">{segment.detail}</span> : null}
                </dt>
                <dd className="m-0 ml-auto whitespace-nowrap tabular-nums text-fg">{formatGiB(segment.bytes)} GiB</dd>
              </div>
            ),
          )}
        </dl>
        <p className="m-0 mt-3 font-mono text-[10px] text-fg-faint">
          Per-model sizes are the GPU memory growth observed when each model last loaded on its own.{' '}
          <span className="text-fg-dim">What fits next?</span> {nextFit}
        </p>
      </div>
    </section>
  )
}

function largestFit(models: Array<ApiModel>, footprints: Map<string, number>, freeBytes: number): string {
  const candidates = models
    .filter((model) => model.kind === 'local' && !model.running && footprints.has(model.id))
    .map((model) => ({ id: model.id, bytes: footprints.get(model.id)! }))
  if (candidates.length === 0) return 'no measured footprints for stopped models yet.'
  const fitting = candidates.filter((candidate) => candidate.bytes <= freeBytes).sort((a, b) => b.bytes - a.bytes)
  if (fitting.length === 0) return `${formatGiB(freeBytes)} GiB free · no measured model fits without unloading.`
  return `${formatGiB(freeBytes)} GiB free → largest measured model that fits: ${fitting[0].id} (${formatGiB(fitting[0].bytes)} GiB).`
}
