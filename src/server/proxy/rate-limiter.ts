type Bucket = {
  tokens: number
  lastRefillMs: number
}

const rpmBuckets = new Map<string, Bucket>()
const tpmBuckets = new Map<string, Bucket>()

// Get-or-create the key's bucket and refill it at `limit` per minute.
function getBucket(buckets: Map<string, Bucket>, keyId: string, limit: number, now: number): Bucket {
  let bucket = buckets.get(keyId)
  if (!bucket) {
    bucket = { tokens: limit, lastRefillMs: now }
    buckets.set(keyId, bucket)
  }
  const elapsed = now - bucket.lastRefillMs
  if (elapsed > 0) {
    bucket.tokens = Math.min(limit, bucket.tokens + elapsed * (limit / 60_000))
    bucket.lastRefillMs = now
  }
  return bucket
}

function retryAfterMs(bucket: Bucket, limit: number): number {
  return Math.ceil((1 - bucket.tokens) / (limit / 60_000))
}

export function checkRpm(keyId: string, limit: number): { allowed: boolean; retryAfterMs?: number } {
  const bucket = getBucket(rpmBuckets, keyId, limit, Date.now())

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1
    return { allowed: true }
  }

  return { allowed: false, retryAfterMs: retryAfterMs(bucket, limit) }
}

export function recordTokenUsage(keyId: string, limit: number, tokens: number): void {
  const bucket = getBucket(tpmBuckets, keyId, limit, Date.now())
  bucket.tokens = Math.max(0, bucket.tokens - tokens)
}

export function checkTpm(keyId: string, limit: number): { allowed: boolean; retryAfterMs?: number } {
  const bucket = getBucket(tpmBuckets, keyId, limit, Date.now())

  if (bucket.tokens >= 1) {
    return { allowed: true }
  }

  return { allowed: false, retryAfterMs: retryAfterMs(bucket, limit) }
}
