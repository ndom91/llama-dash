import { createHash, timingSafeEqual } from 'node:crypto'
import type { ApiKey } from '../db/schema.ts'
import { findKeyByHash, hasAnyUserKeys } from '../admin/api-keys.ts'
import { checkRpm, checkTpm } from './rate-limiter.ts'

type AuthOk = { ok: true; keyId: string | null; keyRow: ApiKey | null }
type AuthErr = { ok: false; status: number; retryAfterMs?: number; body: { error: { message: string; type: string } } }
export type AuthResult = AuthOk | AuthErr

export function authenticateRequest(request: Request): AuthResult {
  if (!hasAnyUserKeys()) {
    return { ok: true, keyId: null, keyRow: null }
  }

  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return {
      ok: false,
      status: 401,
      body: { error: { message: 'Missing or invalid API key', type: 'invalid_api_key' } },
    }
  }

  const token = authHeader.slice(7)
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

  if (keyRow.rateLimitTpm != null) {
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
