import { beforeEach, describe, expect, it, vi } from 'vitest'
import { handleMcpRelayRequest } from './handler'

const relaysMock = vi.hoisted(() => ({
  getMcpRelayBySlug: vi.fn(),
}))

const forwardMock = vi.hoisted(() => ({
  forwardUpstreamAndLog: vi.fn(),
  writeProxyLog: vi.fn(),
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
    forwardUpstreamAndLog: forwardMock.forwardUpstreamAndLog,
    writeProxyLog: forwardMock.writeProxyLog,
  }
})

describe('handleMcpRelayRequest', () => {
  beforeEach(() => {
    relaysMock.getMcpRelayBySlug.mockReset()
    forwardMock.forwardUpstreamAndLog.mockReset()
    forwardMock.writeProxyLog.mockReset()
  })

  it('fails closed when relay credential bindings are invalid', async () => {
    relaysMock.getMcpRelayBySlug.mockImplementation(() => {
      throw new Error('Invalid credential bindings for MCP relay mrl_test')
    })

    const response = await handleMcpRelayRequest(new Request('http://dash.test/mcp-relays/example'))

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({
      error: { message: 'Invalid credential bindings for MCP relay mrl_test', type: 'mcp_relay_invalid_config' },
    })
    expect(forwardMock.writeProxyLog).toHaveBeenCalledWith(expect.objectContaining({ status: 500 }))
    expect(forwardMock.forwardUpstreamAndLog).not.toHaveBeenCalled()
  })

  it('logs missing relay attempts', async () => {
    relaysMock.getMcpRelayBySlug.mockReturnValue(null)

    const response = await handleMcpRelayRequest(new Request('http://dash.test/mcp-relays/missing'))

    expect(response.status).toBe(404)
    expect(forwardMock.writeProxyLog).toHaveBeenCalledWith(
      expect.objectContaining({ status: 404, error: 'MCP relay missing not found' }),
    )
    expect(forwardMock.forwardUpstreamAndLog).not.toHaveBeenCalled()
  })
})
