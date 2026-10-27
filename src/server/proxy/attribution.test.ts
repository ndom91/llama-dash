import { describe, expect, it } from 'vitest'
import { extractAttribution } from './attribution'

describe('extractAttribution', () => {
  it('maps configured headers into normalized attribution fields', () => {
    const headers = new Headers({
      'x-client-name': ' claude-code ',
      'x-end-user-id': ' alice ',
      'x-session-id': ' sess_123 ',
    })

    expect(
      extractAttribution(headers, {
        clientNameHeader: 'x-client-name',
        endUserIdHeader: 'x-end-user-id',
        sessionIdHeader: 'x-session-id',
      }),
    ).toEqual({
      clientName: 'claude-code',
      endUserId: 'alice',
      sessionId: 'sess_123',
    })
  })

  it('returns null for empty or missing header values', () => {
    const headers = new Headers({
      'x-client-name': '   ',
    })

    expect(
      extractAttribution(headers, {
        clientNameHeader: 'x-client-name',
        endUserIdHeader: 'x-end-user-id',
        sessionIdHeader: 'x-session-id',
      }),
    ).toEqual({
      clientName: null,
      endUserId: null,
      sessionId: null,
    })
  })

  it('does not throw on invalid stored header names', () => {
    const headers = new Headers({ 'x-client-name': 'claude-code' })

    expect(
      extractAttribution(headers, {
        clientNameHeader: 'bad header',
        endUserIdHeader: 'x-end-user-id',
        sessionIdHeader: 'x-session-id',
      }),
    ).toEqual({
      clientName: null,
      endUserId: null,
      sessionId: null,
    })
  })

  it('ignores sensitive header mappings', () => {
    const headers = new Headers({ authorization: 'Bearer secret' })

    expect(
      extractAttribution(headers, {
        clientNameHeader: 'authorization',
        endUserIdHeader: null,
        sessionIdHeader: null,
      }),
    ).toEqual({
      clientName: null,
      endUserId: null,
      sessionId: null,
    })
  })

  it('falls back to known user-agent heuristics when no client header is configured', () => {
    const headers = new Headers({
      'user-agent': 'Claude-Code/1.0',
    })

    expect(
      extractAttribution(headers, {
        clientNameHeader: null,
        endUserIdHeader: null,
        sessionIdHeader: null,
      }),
    ).toEqual({
      clientName: 'claude-code',
      endUserId: null,
      sessionId: null,
    })
  })

  it('prefers explicit client header mapping over user-agent heuristics', () => {
    const headers = new Headers({
      'user-agent': 'Claude-Code/1.0',
      'x-client-name': 'my-wrapper',
    })

    expect(
      extractAttribution(headers, {
        clientNameHeader: 'x-client-name',
        endUserIdHeader: null,
        sessionIdHeader: null,
      }),
    ).toEqual({
      clientName: 'my-wrapper',
      endUserId: null,
      sessionId: null,
    })
  })

  it('recognizes Claude CLI without attributing generic Anthropic clients to Claude Code', () => {
    const settings = { clientNameHeader: null, endUserIdHeader: null, sessionIdHeader: null }
    expect(
      extractAttribution(new Headers({ 'user-agent': 'claude-cli/2.1.311 (external, cli)' }), settings).clientName,
    ).toBe('claude-code')
    expect(extractAttribution(new Headers({ 'user-agent': 'CLAUDE-CLI/2.1.311' }), settings).clientName).toBe(
      'claude-code',
    )
    expect(
      extractAttribution(new Headers({ 'user-agent': 'anthropic-typescript/0.128.0' }), settings).clientName,
    ).toBeNull()
    expect(extractAttribution(new Headers({ 'user-agent': 'not-claude-cli/1.0' }), settings).clientName).toBeNull()
    expect(
      extractAttribution(new Headers({ 'user-agent': 'claude-cli/2.1.311', 'x-client-name': 'wrapper' }), {
        ...settings,
        clientNameHeader: 'x-client-name',
      }).clientName,
    ).toBe('wrapper')
  })
})
