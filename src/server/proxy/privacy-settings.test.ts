import { describe, expect, it, vi } from 'vitest'

const settingsMock = vi.hoisted(() => ({
  privacy: {
    captureRequestBodies: true,
    captureResponseBodies: true,
    maxStoredBodyBytes: 32 * 1024,
  },
}))

vi.mock('../admin/settings.ts', () => ({
  getAttributionSettings: () => ({ clientNameHeader: null, endUserIdHeader: null, sessionIdHeader: null }),
  getPrivacySettings: () => settingsMock.privacy,
}))

const logsMock = vi.hoisted(() => ({
  writeRequestLog: vi.fn(),
}))

vi.mock('./log.ts', () => ({
  writeRequestLog: logsMock.writeRequestLog,
}))

vi.mock('./rate-limiter.ts', () => ({
  recordTokenUsage: vi.fn(),
}))

import { createProxyContext, loggedRequestBody } from './context'
import { forwardUpstreamAndLog } from './forward'
import { emptyRoutingOutcome } from './transforms'

describe('proxy privacy settings', () => {
  it('omits logged request bodies when request body capture is disabled', async () => {
    settingsMock.privacy = { ...settingsMock.privacy, captureRequestBodies: false }
    const request = new Request('http://localhost/v1/messages', {
      method: 'POST',
      body: '{"prompt":"secret"}',
      headers: { 'content-type': 'application/json' },
    })
    const ctx = createProxyContext(request)

    expect(loggedRequestBody(ctx)).toBeNull()
  })

  it('omits logged response bodies when response body capture is disabled', async () => {
    settingsMock.privacy = { ...settingsMock.privacy, captureResponseBodies: false }
    logsMock.writeRequestLog.mockClear()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({ usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 }, text: 'secret' }),
      ),
    )

    const response = await forwardUpstreamAndLog({
      upstream: 'http://upstream.test/v1/messages',
      method: 'POST',
      headers: {},
      body: undefined,
      hasBody: false,
      startedAt: Date.now(),
      endpoint: '/v1/messages',
      reqModel: null,
      reqHeadersJson: '{}',
      reqBody: null,
      keyId: null,
      keyRow: null,
      attribution: { clientName: null, endUserId: null, sessionId: null },
      routing: emptyRoutingOutcome(),
    })

    expect(response).toBeInstanceOf(Response)
    await (response as Response).text()
    expect(logsMock.writeRequestLog).toHaveBeenCalledWith(expect.objectContaining({ responseBody: null }))
    vi.unstubAllGlobals()
  })
})
