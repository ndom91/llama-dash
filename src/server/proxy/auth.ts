import { createHash, timingSafeEqual } from 'node:crypto'
import type { ApiKey } from '../db/schema.ts'
import { findKeyByHash, hasAnyUserKeys } from '../admin/api-keys.ts'
import { checkRpm, checkTpm } from './rate-limiter.ts'

type AuthOk = { ok: true; keyId: string | null; keyRow: ApiKey | null }
type AuthErr = { ok: false; status: number; retryAfterMs?: number; body: { error: { message: string; type: string } } }
export type AuthResult = AuthOk | AuthErr

export function authenticateRequest(request: Request, requestBody: string | null): AuthResult {
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

  const allowedModels: Array<string> = JSON.parse(keyRow.allowedModels)
  if (allowedModels.length > 0 && requestBody) {
    try {
      const parsed = JSON.parse(requestBody)
      const model = typeof parsed.model === 'string' ? parsed.model : null
      if (model && !allowedModels.includes(model)) {
        return {
          ok: false,
          status: 403,
          body: { error: { message: `Model '${model}' is not allowed for this API key`, type: 'model_not_allowed' } },
        }
      }
    } catch {
      // non-JSON body — skip model check
    }
  }

  return { ok: true, keyId: keyRow.id, keyRow }
}
