import { describe, expect, it, vi } from 'vitest'
import { handleMcpRelayRequest } from './handler'

const relaysMock = vi.hoisted(() => ({
  getMcpRelayBySlug: vi.fn(),
}))

vi.mock('../admin/mcp-relays.ts', () => ({
  getMcpRelayBySlug: relaysMock.getMcpRelayBySlug,
}))

vi.mock('../admin/settings.ts', () => ({
  getAttributionSettings: () => ({ clientNameHeader: null, endUserIdHeader: null, sessionIdHeader: null }),
}))

vi.mock('../config.ts', () => ({
  config: { credentialEncryptionKey: 'x'.repeat(32), databasePath: ':memory:' },
}))

vi.mock('../proxy/auth.ts', () => ({
  authenticateGatewayRequest: () => ({ ok: true, keyId: 'key_test', keyRow: null }),
}))

vi.mock('../proxy/forward.ts', async () => {
  const actual = await vi.importActual<typeof import('../proxy/forward.ts')>('../proxy/forward.ts')
  return {
    ...actual,
    forwardUpstreamAndLog: vi.fn(),
    writeProxyLog: vi.fn(),
  }
})

describe('handleMcpRelayRequest', () => {
  it('fails closed when relay credential bindings are invalid', async () => {
    relaysMock.getMcpRelayBySlug.mockImplementation(() => {
      throw new Error('Invalid credential bindings for MCP relay mrl_test')
    })

    const response = await handleMcpRelayRequest(new Request('http://dash.test/mcp-relays/example'))

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({
      error: { message: 'Invalid credential bindings for MCP relay mrl_test' },
    })
  })
})
