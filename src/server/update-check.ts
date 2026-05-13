type UpdateStatus = 'unknown' | 'current' | 'available' | 'error'

export type UpdateCheck = {
  status: UpdateStatus
  current: string
  latest: string | null
  url: string | null
  checkedAt: number | null
}

const RELEASES_URL = 'https://api.github.com/repos/ndom91/llama-dash/releases/latest'
const CACHE_MS = 60 * 60 * 1000

let cached: UpdateCheck | null = null
let cachedAt = 0

export async function getUpdateCheck(current: string): Promise<UpdateCheck> {
  const now = Date.now()
  if (cached && cached.current === current && now - cachedAt < CACHE_MS) return cached

  if (current === 'unknown') {
    cached = { status: 'unknown', current, latest: null, url: null, checkedAt: null }
    cachedAt = now
    return cached
  }

  try {
    const res = await fetch(RELEASES_URL, {
      headers: { accept: 'application/vnd.github+json', 'user-agent': 'llama-dash-update-check' },
    })
    if (!res.ok) throw new Error(`GitHub returned ${res.status}`)
    const body = (await res.json()) as { tag_name?: unknown; html_url?: unknown }
    const latest = typeof body.tag_name === 'string' ? body.tag_name : null
    const url = typeof body.html_url === 'string' ? body.html_url : null
    cached = {
      status: latest && normalizeVersion(latest) !== normalizeVersion(current) ? 'available' : 'current',
      current,
      latest,
      url,
      checkedAt: now,
    }
  } catch {
    cached = { status: 'error', current, latest: null, url: null, checkedAt: now }
  }
  cachedAt = now
  return cached
}

function normalizeVersion(value: string) {
  return value.trim().replace(/^v/i, '')
}
