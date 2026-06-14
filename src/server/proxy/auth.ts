import { createHash, timingSafeEqual } from 'node:crypto'
import type { ApiKey } from '../db/schema.ts'
import { findKeyByHash, hasAnyUserKeys } from '../admin/api-keys.ts'
import { checkRpm, checkTpm } from './rate-limiter.ts'
import { evaluatePreAuthRouting } from './routing.ts'
import { emptyRoutingOutcome, type RoutingOutcome } from './transforms.ts'

type AuthOk = {
  ok: true
  keyId: string | null
  keyRow: ApiKey | null
  preAuthRouting: RoutingOutcome
}
type AuthErr = { ok: false; status: number; retryAfterMs?: number; body: { error: { message: string; type: string } } }
export type AuthResult = AuthOk | AuthErr

export function authenticateRequest(
  request: Request,
  endpoint: string,
  parsedBody: Record<string, unknown> | null,
): AuthResult {
  const preAuthRouting = evaluatePreAuthRouting(endpoint, parsedBody, request.headers)
  if (preAuthRouting.authMode === 'passthrough') {
    return { ok: true, keyId: null, keyRow: null, preAuthRouting }
  }

  if (!hasAnyUserKeys()) {
    return { ok: true, keyId: null, keyRow: null, preAuthRouting }
  }

  const token = bearerToken(request.headers.get('authorization'))
  if (!token) {
    return {
      ok: false,
      status: 401,
      body: { error: { message: 'Missing or invalid API key', type: 'invalid_api_key' } },
    }
  }

  return authenticateApiKeyToken(token, preAuthRouting, true)
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

  return authenticateApiKeyToken(token, emptyRoutingOutcome(), false)
}

function authenticateApiKeyToken(
  token: string,
  preAuthRouting: RoutingOutcome,
  checkTokenRateLimit: boolean,
): AuthResult {
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

  return { ok: true, keyId: keyRow.id, keyRow, preAuthRouting }
}

function bearerToken(header: string | null): string | null {
  if (!header?.startsWith('Bearer ')) return null
  return header.slice(7)
}
