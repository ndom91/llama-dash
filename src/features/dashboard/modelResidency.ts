import type { ApiModel, ApiModelActivityEntry, ApiModelEvent } from '../../lib/api'

export const RESIDENCY_WINDOWS = [
  { value: 15 * 60_000, label: '15m' },
  { value: 60 * 60_000, label: '1h' },
  { value: 6 * 60 * 60_000, label: '6h' },
  { value: 24 * 60 * 60_000, label: '24h' },
] as const

export type ResidencyWindowMs = (typeof RESIDENCY_WINDOWS)[number]['value']

export const DEFAULT_RESIDENCY_WINDOW_MS: ResidencyWindowMs = 60 * 60_000

/** The visible time range of every track in the panel, in epoch ms. */
export type ResidencyFrame = { start: number; end: number; now: number }

export type ResidencySpan = {
  start: number
  end: number
  /** Still resident at `now` (no matching unload yet). */
  open: boolean
}

export function buildResidencySpans(
  events: ReadonlyArray<ApiModelEvent>,
  frame: ResidencyFrame,
): Map<string, Array<ResidencySpan>> {
  const loadedAt = new Map<string, number>()
  const spans = new Map<string, Array<ResidencySpan>>()
  const push = (modelId: string, span: ResidencySpan) => {
    if (span.end <= frame.start) return
    const list = spans.get(modelId) ?? []
    list.push({ ...span, start: Math.max(span.start, frame.start) })
    spans.set(modelId, list)
  }

  for (const ev of events) {
    const ts = new Date(ev.timestamp).getTime()
    if (ev.event === 'load') {
      if (!loadedAt.has(ev.modelId)) loadedAt.set(ev.modelId, ts)
      continue
    }
    const start = loadedAt.get(ev.modelId)
    if (start == null) continue
    push(ev.modelId, { start, end: ts, open: false })
    loadedAt.delete(ev.modelId)
  }
  for (const [modelId, start] of loadedAt) push(modelId, { start, end: frame.now, open: true })

  return spans
}

/** Most recent load event per model — the "since" timestamp for resident models. */
export function lastLoadTimes(events: ReadonlyArray<ApiModelEvent>): Map<string, number> {
  const out = new Map<string, number>()
  for (const ev of events) {
    if (ev.event === 'load') out.set(ev.modelId, new Date(ev.timestamp).getTime())
  }
  return out
}

/** Five evenly spaced axis labels, oldest first, e.g. `-60m … now`. One unit per window. */
export function axisLabels(windowMs: number): Array<{ at: number; label: string }> {
  const hours = windowMs >= 2 * 60 * 60_000
  return [0, 25, 50, 75, 100].map((at) => {
    if (at === 100) return { at, label: 'now' }
    const agoMin = (windowMs * (1 - at / 100)) / 60_000
    return { at, label: hours ? `-${trimNumber(agoMin / 60)}h` : `-${trimNumber(agoMin)}m` }
  })
}

function trimNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

export function formatResident(ms: number): string {
  const mins = Math.round(ms / 60_000)
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

export function formatClock(ts: number, now: number): string {
  const d = new Date(ts)
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
  if (now - ts < 20 * 60 * 60_000) return time
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${time}`
}

export function formatAgo(ts: number, now: number): string {
  const secs = Math.max(0, Math.round((now - ts) / 1000))
  if (secs < 60) return `${secs}s ago`
  const mins = Math.round(secs / 60)
  if (mins < 60) return `${mins}m ago`
  return `${Math.round(mins / 60)}h ago`
}

export type ModelGroup = { kind: 'local' | 'peer'; key: string; host: string | null; models: Array<ApiModel> }

/** Local models (resident first), then one group per peer host so peers on one machine share a header. */
export function groupModels(
  models: ReadonlyArray<ApiModel>,
  showUnloaded: boolean,
  localHost: string | null,
): Array<ModelGroup> {
  const local: Array<ApiModel> = []
  const peers = new Map<string, Array<ApiModel>>()
  for (const model of models) {
    if (model.kind === 'selector') continue
    if (model.kind === 'peer') {
      const host = model.peerHost ?? model.peerId ?? 'peer'
      const list = peers.get(host) ?? []
      list.push(model)
      peers.set(host, list)
      continue
    }
    if (model.running || showUnloaded) local.push(model)
  }

  local.sort((a, b) => Number(b.running) - Number(a.running) || a.id.localeCompare(b.id))
  const groups: Array<ModelGroup> = []
  if (local.length > 0) groups.push({ kind: 'local', key: 'local', host: localHost, models: local })
  for (const [host, list] of [...peers.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    groups.push({ kind: 'peer', key: `peer:${host}`, host, models: list.sort((a, b) => a.id.localeCompare(b.id)) })
  }
  return groups
}

export type PeerHealth = { tone: 'ok' | 'warn' | 'err' | 'idle'; label: string; lastAt: number | null }

/** llama-swap doesn't report peer health, so derive it from proxied requests in the window. */
export function derivePeerHealth(
  models: ReadonlyArray<ApiModel>,
  activity: ReadonlyMap<string, ApiModelActivityEntry>,
): PeerHealth {
  let total = 0
  let errors = 0
  let lastAt: number | null = null
  for (const model of models) {
    const entry = activity.get(model.id)
    if (!entry) continue
    total += entry.total
    errors += entry.errors
    if (entry.lastAt != null) lastAt = Math.max(lastAt ?? 0, entry.lastAt)
  }
  if (total === 0) return { tone: 'idle', label: 'no traffic', lastAt }
  if (errors === 0) return { tone: 'ok', label: 'healthy', lastAt }
  if (errors === total) return { tone: 'err', label: 'failing', lastAt }
  return { tone: 'warn', label: `${errors} err / ${total}`, lastAt }
}

/** Shared by the column header and every model row so the track columns line up. */
export const MODEL_ROW_GRID =
  'grid grid-cols-[20px_minmax(150px,1.15fr)_96px_minmax(0,2.4fr)_64px_52px] items-center gap-x-3 px-4 max-[900px]:grid-cols-[20px_minmax(0,1fr)_minmax(0,1.4fr)_44px]'
