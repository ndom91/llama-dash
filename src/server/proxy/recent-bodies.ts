// In-memory cache of full request/response bodies for the most recent N
// proxied calls. The DB stores truncated bodies to keep SQLite small and
// cheap; this ring keeps the full payloads available while you're actively
// debugging, then evicts them LRU-style. Bodies vanish on process restart.

type BodyPair = { requestBody: string | null; responseBody: string | null }

const CAPACITY = 100

const recent = new Map<string, BodyPair>()

export function storeRecentBodies(id: string, pair: BodyPair) {
  if (pair.requestBody == null && pair.responseBody == null) return
  recent.set(id, pair)
  if (recent.size > CAPACITY) {
    const oldest = recent.keys().next().value
    if (oldest !== undefined) recent.delete(oldest)
  }
}

export function getRecentBodies(id: string): BodyPair | null {
  return recent.get(id) ?? null
}
