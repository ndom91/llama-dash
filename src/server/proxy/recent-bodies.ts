// In-memory cache of full request/response bodies for recent proxied calls.
// The DB stores truncated bodies to keep SQLite small and cheap; this cache
// keeps full payloads available while actively debugging, then evicts by byte
// budget. Bodies vanish on process restart.

type BodyPair = { requestBody: string | null; responseBody: string | null }

export const RECENT_BODY_MAX_BYTES = 10 * 1024 * 1024

const recent = new Map<string, BodyPair>()
let totalBytes = 0

export function storeRecentBodies(id: string, pair: BodyPair) {
  if (pair.requestBody == null && pair.responseBody == null) return
  const existing = recent.get(id)
  if (existing) totalBytes -= pairBytes(existing)
  recent.set(id, pair)
  totalBytes += pairBytes(pair)
  while (totalBytes > RECENT_BODY_MAX_BYTES) {
    const oldest = recent.keys().next().value
    if (oldest === undefined) break
    const removed = recent.get(oldest)
    recent.delete(oldest)
    if (removed) totalBytes -= pairBytes(removed)
  }
}

export function getRecentBodies(id: string): BodyPair | null {
  return recent.get(id) ?? null
}

export function clearRecentBodiesForTest() {
  recent.clear()
  totalBytes = 0
}

function pairBytes(pair: BodyPair): number {
  return Buffer.byteLength(pair.requestBody ?? '', 'utf8') + Buffer.byteLength(pair.responseBody ?? '', 'utf8')
}
