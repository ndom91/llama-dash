import { beforeEach, describe, expect, it, vi } from 'vitest'
import { handleMcpRelayRequest } from './handler'

const relaysMock = vi.hoisted(() => ({
  getMcpRelayBySlug: vi.fn(),
}))

const forwardMock = vi.hoisted(() => ({
  forwardUpstreamAndLog: vi.fn(),
  writeProxyLog: vi.fn(),
}))

const settingsMock = vi.hoisted(() => ({
  privacy: { captureRequestBodies: true, captureResponseBodies: true, maxStoredBodyBytes: 32 * 1024 },
}))

const authMock = vi.hoisted(() => ({
  authenticateGatewayRequest: vi.fn(),
}))

vi.mock('../admin/mcp-relays.ts', () => ({
  getMcpRelayBySlug: relaysMock.getMcpRelayBySlug,
}))

vi.mock('../admin/settings.ts', () => ({
  getAttributionSettings: () => ({ clientNameHeader: null, endUserIdHeader: null, sessionIdHeader: null }),
  getPrivacySettings: () => settingsMock.privacy,
}))

vi.mock('../config.ts', () => ({
  config: { credentialEncryptionKey: 'x'.repeat(32), databasePath: ':memory:' },
}))

vi.mock('../proxy/auth.ts', () => ({
  authenticateGatewayRequest: authMock.authenticateGatewayRequest,
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
    forwardMock.forwardUpstreamAndLog.mockResolvedValue(new Response('{}'))
    authMock.authenticateGatewayRequest.mockReturnValue({
      ok: true,
      keyId: 'key_test',
      keyRow: { allowedMcpRelays: JSON.stringify(['mrl_test']) },
    })
    settingsMock.privacy = { captureRequestBodies: true, captureResponseBodies: true, maxStoredBodyBytes: 32 * 1024 }
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

  it('captures JSON request bodies for proxied relay requests', async () => {
    relaysMock.getMcpRelayBySlug.mockReturnValue({
      id: 'mrl_test',
      name: 'Example',
      slug: 'example',
      targetUrl: 'https://mcp.example.test/mcp',
      enabled: true,
      credentialBindings: [],
    })

    const response = await handleMcpRelayRequest(
      new Request('http://dash.test/mcp-relays/example', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-llama-dash-api-key': 'sk-test' },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'tools/list', id: 1 }),
      }),
    )

    expect(response.status).toBe(200)
    expect(forwardMock.forwardUpstreamAndLog).toHaveBeenCalledWith(
      expect.objectContaining({
        hasBody: true,
        reqBody: '{"jsonrpc":"2.0","method":"tools/list","id":1}',
      }),
    )
  })

  it('rejects API keys that are not scoped to the relay', async () => {
    authMock.authenticateGatewayRequest.mockReturnValue({
      ok: true,
      keyId: 'key_test',
      keyRow: { allowedMcpRelays: JSON.stringify(['mrl_other']) },
    })
    relaysMock.getMcpRelayBySlug.mockReturnValue({
      id: 'mrl_test',
      name: 'Example',
      slug: 'example',
      targetUrl: 'https://mcp.example.test/mcp',
      enabled: true,
      credentialBindings: [],
    })

    const response = await handleMcpRelayRequest(
      new Request('http://dash.test/mcp-relays/example', {
        headers: { 'x-llama-dash-api-key': 'sk-test' },
      }),
    )

    expect(response.status).toBe(403)
    expect(forwardMock.forwardUpstreamAndLog).not.toHaveBeenCalled()
  })

  it('does not buffer relay bodies when request body capture is disabled', async () => {
    settingsMock.privacy = { ...settingsMock.privacy, captureRequestBodies: false }
    relaysMock.getMcpRelayBySlug.mockReturnValue({
      id: 'mrl_test',
      name: 'Example',
      slug: 'example',
      targetUrl: 'https://mcp.example.test/mcp',
      enabled: true,
      credentialBindings: [],
    })

    await handleMcpRelayRequest(
      new Request('http://dash.test/mcp-relays/example', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-llama-dash-api-key': 'sk-test' },
        body: '{"jsonrpc":"2.0"}',
      }),
    )

    const input = forwardMock.forwardUpstreamAndLog.mock.calls[0][0]
    expect(input.reqBody).toBeNull()
    await expect(new Response(input.body).text()).resolves.toBe('{"jsonrpc":"2.0"}')
  })

  it('rejects oversized relay bodies before forwarding', async () => {
    relaysMock.getMcpRelayBySlug.mockReturnValue({
      id: 'mrl_test',
      name: 'Example',
      slug: 'example',
      targetUrl: 'https://mcp.example.test/mcp',
      enabled: true,
      credentialBindings: [],
    })

    const response = await handleMcpRelayRequest(
      new Request('http://dash.test/mcp-relays/example', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'content-length': String(10 * 1024 * 1024 + 1),
          'x-llama-dash-api-key': 'sk-test',
        },
        body: '{}',
      }),
    )

    expect(response.status).toBe(413)
    expect(forwardMock.forwardUpstreamAndLog).not.toHaveBeenCalled()
    expect(forwardMock.writeProxyLog).toHaveBeenCalledWith(expect.objectContaining({ status: 413 }))
  })
})
