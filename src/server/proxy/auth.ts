import { createHash, timingSafeEqual } from 'node:crypto'
import type { ApiKey } from '../db/schema.ts'
import { findKeyByHash, hasAnyUserKeys } from '../admin/api-keys.ts'
import { checkRpm, checkTpm } from './rate-limiter.ts'

type AuthOk = {
  ok: true
  keyId: string | null
  keyRow: ApiKey | null
}
type AuthErr = { ok: false; status: number; retryAfterMs?: number; body: { error: { message: string; type: string } } }
export type AuthResult = AuthOk | AuthErr

// The outcome of looking up the bearer token, without enforcing anything. This
// is intentionally cheap (header-only) so it can run before the request body is
// read, letting routing be evaluated in a single ordered pass.
export type KeyResolution =
  | { status: 'valid'; keyRow: ApiKey }
  | { status: 'absent' }
  | { status: 'invalid'; reason: string }

// Resolve the llama-dash API key from the Authorization header without deciding
// whether the request is allowed. A missing/unknown/revoked/expired token is
// reported as `absent`/`invalid` rather than rejected here — the matched routing
// rule's auth mode decides whether a valid key is actually required.
export function resolveApiKey(request: Request): KeyResolution {
  const token = bearerToken(request.headers.get('authorization'))
  if (!token) return { status: 'absent' }

  const hash = createHash('sha256').update(token).digest('hex')
  const keyRow = findKeyByHash(hash)
  if (!keyRow) return { status: 'invalid', reason: 'Invalid API key' }
  if (!timingSafeEqual(Buffer.from(hash), Buffer.from(keyRow.keyHash))) {
    return { status: 'invalid', reason: 'Invalid API key' }
  }
  if (keyRow.disabledAt != null) return { status: 'invalid', reason: 'API key has been revoked' }
  if (keyRow.expiresAt != null && keyRow.expiresAt.getTime() < Date.now()) {
    return { status: 'invalid', reason: 'API key has expired' }
  }
  return { status: 'valid', keyRow }
}

// Enforce authentication for a proxy request given the resolved key and the auth
// mode of the routing rule that matched (or `require_key` when no rule matched).
//
// - passthrough rules never require a llama-dash key; the client owns the
//   Authorization header for the upstream. A valid llama-dash key is still
//   attached when present so stored-credential passthrough can use it.
// - require_key rules demand a valid, active, in-quota key when any user keys
//   exist. When no keys exist the proxy runs open.
export function enforceAuth(resolution: KeyResolution, authMode: 'require_key' | 'passthrough'): AuthResult {
  const validKey = resolution.status === 'valid' ? resolution.keyRow : null

  if (authMode === 'passthrough') {
    return { ok: true, keyId: validKey?.id ?? null, keyRow: validKey }
  }

  if (!hasAnyUserKeys()) {
    return { ok: true, keyId: null, keyRow: null }
  }

  if (resolution.status === 'absent') {
    return {
      ok: false,
      status: 401,
      body: { error: { message: 'Missing or invalid API key', type: 'invalid_api_key' } },
    }
  }
  if (resolution.status === 'invalid') {
    return {
      ok: false,
      status: 401,
      body: { error: { message: resolution.reason, type: 'invalid_api_key' } },
    }
  }

  return applyRateLimits(resolution.keyRow, true)
}

export function authenticateGatewayRequest(request: Request): AuthResult {
  const token = request.headers.get('x-llama-dash-api-key') ?? request.headers.get('x-llama-dash-key')
  if (!hasAnyUserKeys()) {
    return {
      ok: false,
      status: 403,
      body: { error: { message: 'Create an API key before using MCP relays', type: 'gateway_key_required' } },
    }
  }
  if (!token) {
    return {
      ok: false,
      status: 401,
      body: { error: { message: 'Missing x-llama-dash-api-key', type: 'invalid_api_key' } },
    }
  }

  return authenticateApiKeyToken(token, false)
}

function authenticateApiKeyToken(token: string, checkTokenRateLimit: boolean): AuthResult {
  const hash = createHash('sha256').update(token).digest('hex')
  const keyRow = findKeyByHash(hash)

  if (!keyRow) {
    return {
      ok: false,
      status: 401,
      body: { error: { message: 'Invalid API key', type: 'invalid_api_key' } },
    }
  }

  if (!timingSafeEqual(Buffer.from(hash), Buffer.from(keyRow.keyHash))) {
    return {
      ok: false,
      status: 401,
      body: { error: { message: 'Invalid API key', type: 'invalid_api_key' } },
    }
  }

  if (keyRow.disabledAt != null) {
    return {
      ok: false,
      status: 401,
      body: { error: { message: 'API key has been revoked', type: 'invalid_api_key' } },
    }
  }

  if (keyRow.expiresAt != null && keyRow.expiresAt.getTime() < Date.now()) {
    return {
      ok: false,
      status: 401,
      body: { error: { message: 'API key has expired', type: 'invalid_api_key' } },
    }
  }

  return applyRateLimits(keyRow, checkTokenRateLimit)
}

function applyRateLimits(keyRow: ApiKey, checkTokenRateLimit: boolean): AuthResult {
  if (keyRow.rateLimitRpm != null) {
    const rpm = checkRpm(keyRow.id, keyRow.rateLimitRpm)
    if (!rpm.allowed) {
      return {
        ok: false,
        status: 429,
        retryAfterMs: rpm.retryAfterMs,
        body: { error: { message: 'Rate limit exceeded (RPM)', type: 'rate_limit_exceeded' } },
      }
    }
  }

  if (checkTokenRateLimit && keyRow.rateLimitTpm != null) {
    const tpm = checkTpm(keyRow.id, keyRow.rateLimitTpm)
    if (!tpm.allowed) {
      return {
        ok: false,
        status: 429,
        retryAfterMs: tpm.retryAfterMs,
        body: { error: { message: 'Rate limit exceeded (TPM)', type: 'rate_limit_exceeded' } },
      }
    }
  }

  return { ok: true, keyId: keyRow.id, keyRow }
}

function bearerToken(header: string | null): string | null {
  if (!header?.startsWith('Bearer ')) return null
  return header.slice(7)
}
