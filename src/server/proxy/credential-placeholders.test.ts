import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RoutingOutcome } from './transforms'
import { applyCredentialInjection, placeholderForSlug, REDACTED_INJECTED_CREDENTIAL } from './credential-placeholders'

const credentialMock = vi.hoisted(() => ({
  getCredentialInjectionSecret: vi.fn(),
  markCredentialUsed: vi.fn(),
}))

vi.mock('../admin/upstream-credentials.ts', () => ({
  getCredentialInjectionSecret: credentialMock.getCredentialInjectionSecret,
  markCredentialUsed: credentialMock.markCredentialUsed,
}))

function routing(overrides: Partial<RoutingOutcome> = {}): RoutingOutcome {
  return {
    ruleId: 'rrl_test',
    ruleName: 'Test rule',
    actionType: 'continue',
    authMode: 'passthrough',
    preserveAuthorization: true,
    targetType: 'direct',
    targetBaseUrl: 'https://api.anthropic.com/v1',
    targetCredentialId: null,
    requestedModel: 'claude',
    routedModel: null,
    rejectReason: null,
    credentialBindings: [],
    ...overrides,
  }
}

function secret(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ucr_anthropic',
    name: 'Anthropic',
    slug: 'anthropic-prod',
    type: 'bearer',
    value: 'sk-real-secret',
    ...overrides,
  }
}

describe('applyCredentialInjection', () => {
  beforeEach(() => {
    credentialMock.getCredentialInjectionSecret.mockReset()
    credentialMock.markCredentialUsed.mockReset()
    credentialMock.getCredentialInjectionSecret.mockReturnValue(secret())
  })

  it('replaces an allowed header placeholder', () => {
    const headers = { authorization: `Bearer ${placeholderForSlug('anthropic-prod')}` }

    const result = applyCredentialInjection({
      headers,
      routing: routing({
        credentialBindings: [
          { credentialId: 'ucr_anthropic', mode: 'replace_placeholder', headerName: 'authorization', required: true },
        ],
      }),
      encryptionKey: 'x'.repeat(32),
    })

    expect(result.ok).toBe(true)
    expect(headers.authorization).toBe('Bearer sk-real-secret')
    expect(result.ok && result.redactedHeaderNames.has('authorization')).toBe(true)
    expect(result.ok && result.audit?.count).toBe(1)
    expect(credentialMock.markCredentialUsed).toHaveBeenCalledWith('ucr_anthropic')
  })

  it('rejects unresolved llama-dash placeholders', () => {
    const headers = { authorization: `Bearer ${placeholderForSlug('anthropic-prod')}` }

    const result = applyCredentialInjection({ headers, routing: routing(), encryptionKey: 'x'.repeat(32) })

    expect(result.ok).toBe(false)
    expect(!result.ok && result.type).toBe('credential_placeholder_unresolved')
    expect(headers.authorization).toContain('{{llama-dash:credential:anthropic-prod}}')
    expect(credentialMock.markCredentialUsed).not.toHaveBeenCalled()
  })

  it('ignores non-llama-dash placeholders', () => {
    const headers = { 'x-template': '{{github_token}}' }

    const result = applyCredentialInjection({ headers, routing: routing(), encryptionKey: 'x'.repeat(32) })

    expect(result.ok).toBe(true)
    expect(headers['x-template']).toBe('{{github_token}}')
  })

  it('sets a header without a client placeholder', () => {
    const headers: Record<string, string> = { accept: 'application/json' }

    const result = applyCredentialInjection({
      headers,
      routing: routing({
        credentialBindings: [{ credentialId: 'ucr_anthropic', mode: 'set_header', headerName: 'authorization' }],
      }),
      encryptionKey: 'x'.repeat(32),
    })

    expect(result.ok).toBe(true)
    expect(headers.authorization).toBe('Bearer sk-real-secret')
    expect(result.ok && result.redactedHeaderNames.has('authorization')).toBe(true)
  })

  it('returns a structured error when credential decryption fails', () => {
    credentialMock.getCredentialInjectionSecret.mockImplementation(() => {
      throw new Error('Unsupported credential payload')
    })
    const headers: Record<string, string> = {}

    const result = applyCredentialInjection({
      headers,
      routing: routing({
        credentialBindings: [{ credentialId: 'ucr_anthropic', mode: 'set_header', headerName: 'authorization' }],
      }),
      encryptionKey: 'x'.repeat(32),
    })

    expect(result.ok).toBe(false)
    expect(!result.ok && result.type).toBe('credential_injection_failed')
    expect(!result.ok && result.message).toContain('could not be decrypted')
    expect(headers.authorization).toBeUndefined()
  })

  it('returns a structured error when marking usage fails', () => {
    credentialMock.markCredentialUsed.mockImplementation(() => {
      throw new Error('database is locked')
    })
    const headers: Record<string, string> = {}

    const result = applyCredentialInjection({
      headers,
      routing: routing({
        credentialBindings: [{ credentialId: 'ucr_anthropic', mode: 'set_header', headerName: 'authorization' }],
      }),
      encryptionKey: 'x'.repeat(32),
    })

    expect(result.ok).toBe(false)
    expect(!result.ok && result.type).toBe('credential_injection_failed')
    expect(!result.ok && result.message).toContain('could not be injected')
    expect(headers.authorization).toBeUndefined()
  })

  it('treats direct target credentials as implicit authorization injection', () => {
    const headers: Record<string, string> = {}

    const result = applyCredentialInjection({
      headers,
      routing: routing({ targetCredentialId: 'ucr_anthropic' }),
      encryptionKey: 'x'.repeat(32),
    })

    expect(result.ok).toBe(true)
    expect(headers.authorization).toBe('Bearer sk-real-secret')
  })

  it('allows placeholder replacement based on routing rule binding alone', () => {
    const headers = { authorization: `Bearer ${placeholderForSlug('anthropic-prod')}` }

    const result = applyCredentialInjection({
      headers,
      routing: routing({
        credentialBindings: [
          { credentialId: 'ucr_anthropic', mode: 'replace_placeholder', headerName: 'authorization', required: true },
        ],
      }),
      encryptionKey: 'x'.repeat(32),
    })

    expect(result.ok).toBe(true)
    expect(headers.authorization).toBe('Bearer sk-real-secret')
  })

  it('exposes a shared redaction marker', () => {
    expect(REDACTED_INJECTED_CREDENTIAL).toBe('[redacted injected credential]')
  })
})
