import { publishAdminEvent } from './admin/events.ts'

type UpdateStatus = 'unknown' | 'current' | 'available' | 'error'

export type UpdateCheck = {
  status: UpdateStatus
  current: string
  latest: string | null
  url: string | null
  checkedAt: number | null
}

const BRANCH_URL = 'https://api.github.com/repos/ndom91/llama-dash/branches/main'
const CACHE_MS = 60 * 60 * 1000

let cached: UpdateCheck | null = null
let cachedAt = 0
let lastPublishedUpdate = ''

export async function getUpdateCheck(current: string): Promise<UpdateCheck> {
  const now = Date.now()
  if (cached && cached.current === current && now - cachedAt < CACHE_MS) return cached

  if (current === 'unknown') {
    cached = { status: 'unknown', current, latest: null, url: null, checkedAt: null }
    cachedAt = now
    publishUpdateIfChanged(cached)
    return cached
  }

  try {
    const res = await fetch(BRANCH_URL, {
      headers: { accept: 'application/vnd.github+json', 'user-agent': 'llama-dash-update-check' },
    })
    if (!res.ok) throw new Error(`GitHub returned ${res.status}`)
    const body = (await res.json()) as { commit?: { sha?: unknown; html_url?: unknown } }
    const latest = typeof body.commit?.sha === 'string' ? body.commit.sha : null
    const url = typeof body.commit?.html_url === 'string' ? body.commit.html_url : null
    cached = {
      status: latest && !sameCommit(latest, current) ? 'available' : 'current',
      current,
      latest,
      url,
      checkedAt: now,
    }
  } catch {
    cached = { status: 'error', current, latest: null, url: null, checkedAt: now }
  }
  cachedAt = now
  publishUpdateIfChanged(cached)
  return cached
}

function publishUpdateIfChanged(update: UpdateCheck) {
  const fingerprint = JSON.stringify({
    status: update.status,
    current: update.current,
    latest: update.latest,
    url: update.url,
  })
  if (fingerprint === lastPublishedUpdate) return
  lastPublishedUpdate = fingerprint
  publishAdminEvent('system.changed', { update: update.status })
}

function sameCommit(remoteSha: string, current: string) {
  const normalizedRemote = remoteSha.trim().toLowerCase()
  const normalizedCurrent = current.trim().toLowerCase()
  return normalizedRemote === normalizedCurrent || normalizedRemote.startsWith(normalizedCurrent)
}
