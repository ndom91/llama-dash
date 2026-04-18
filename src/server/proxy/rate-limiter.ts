type Bucket = {
  tokens: number
  lastRefillMs: number
}

const rpmBuckets = new Map<string, Bucket>()
const tpmBuckets = new Map<string, Bucket>()

function refill(bucket: Bucket, max: number, refillPerMs: number, now: number): void {
  const elapsed = now - bucket.lastRefillMs
  if (elapsed <= 0) return
  bucket.tokens = Math.min(max, bucket.tokens + elapsed * refillPerMs)
  bucket.lastRefillMs = now
}

export function checkRpm(keyId: string, limit: number): { allowed: boolean; retryAfterMs?: number } {
  const now = Date.now()
  let bucket = rpmBuckets.get(keyId)
  if (!bucket) {
    bucket = { tokens: limit, lastRefillMs: now }
    rpmBuckets.set(keyId, bucket)
  }

  refill(bucket, limit, limit / 60_000, now)

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1
    return { allowed: true }
  }

  const refillRate = limit / 60_000
  const waitMs = Math.ceil((1 - bucket.tokens) / refillRate)
  return { allowed: false, retryAfterMs: waitMs }
}

export function recordTokenUsage(keyId: string, limit: number, tokens: number): void {
  const now = Date.now()
  let bucket = tpmBuckets.get(keyId)
  if (!bucket) {
    bucket = { tokens: limit, lastRefillMs: now }
    tpmBuckets.set(keyId, bucket)
  }

  refill(bucket, limit, limit / 60_000, now)
  bucket.tokens = Math.max(0, bucket.tokens - tokens)
}

export function checkTpm(keyId: string, limit: number): { allowed: boolean; retryAfterMs?: number } {
  const now = Date.now()
  let bucket = tpmBuckets.get(keyId)
  if (!bucket) {
    bucket = { tokens: limit, lastRefillMs: now }
    tpmBuckets.set(keyId, bucket)
  }

  refill(bucket, limit, limit / 60_000, now)

  if (bucket.tokens >= 1) {
    return { allowed: true }
  }

  const refillRate = limit / 60_000
  const waitMs = Math.ceil((1 - bucket.tokens) / refillRate)
  return { allowed: false, retryAfterMs: waitMs }
}
