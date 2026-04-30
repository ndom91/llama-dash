import { beforeEach, describe, expect, it, vi } from 'vitest'

const settingsMock = vi.hoisted(() => ({
  maxBytes: 32 * 1024,
}))

vi.mock('../admin/settings.ts', () => ({
  getBodyLogLimits: () => ({ maxBytes: settingsMock.maxBytes }),
}))

const inserts = vi.hoisted(() => ({ values: vi.fn(() => ({ run: vi.fn() })) }))

vi.mock('../db/index.ts', () => ({
  db: { insert: vi.fn(() => inserts) },
  schema: { requests: 'requests' },
}))

vi.mock('../pricing.ts', () => ({
  computeCostUsd: () => null,
}))

vi.mock('./recent-bodies.ts', () => ({
  storeRecentBodies: vi.fn(),
}))

import { storeRecentBodies } from './recent-bodies'

import {
  flushRequestLogQueue,
  getRequestLogQueueStats,
  resetRequestLogQueueForTest,
  type RequestLogInput,
  writeRequestLog,
} from './log'

function row(overrides: Partial<RequestLogInput> = {}): RequestLogInput {
  return {
    startedAt: Date.now(),
    durationMs: 1,
    method: 'POST',
    endpoint: '/v1/messages',
    model: 'model',
    statusCode: 200,
    promptTokens: null,
    completionTokens: null,
    totalTokens: null,
    cacheCreationTokens: null,
    cacheReadTokens: null,
    streamed: false,
    error: null,
    requestHeaders: null,
    requestBody: null,
    responseHeaders: null,
    responseBody: null,
    streamCloseMs: null,
    keyId: null,
    clientHost: null,
    clientName: null,
    endUserId: null,
    sessionId: null,
    routingRuleId: null,
    routingRuleName: null,
    routingActionType: null,
    routingAuthMode: null,
    routingPreserveAuthorization: false,
    routingTargetType: null,
    routingTargetBaseUrl: null,
    routingRequestedModel: null,
    routingRoutedModel: null,
    routingRejectReason: null,
    ...overrides,
  }
}

describe('request log queue', () => {
  beforeEach(() => {
    resetRequestLogQueueForTest()
    settingsMock.maxBytes = 32 * 1024
    inserts.values.mockClear()
    vi.mocked(storeRecentBodies).mockClear()
  })

  it('enqueues logs and flushes them later', () => {
    writeRequestLog(row())

    expect(getRequestLogQueueStats()).toEqual({ queued: 1, dropped: 0 })
    expect(inserts.values).not.toHaveBeenCalled()

    flushRequestLogQueue()

    expect(getRequestLogQueueStats()).toEqual({ queued: 0, dropped: 0 })
    expect(inserts.values).toHaveBeenCalledTimes(1)
  })

  it('stores no body text or recent bodies when the body byte limit is zero', () => {
    settingsMock.maxBytes = 0

    writeRequestLog(row({ requestBody: '{"prompt":"secret"}', responseBody: '{"text":"secret"}' }))
    flushRequestLogQueue()

    expect(storeRecentBodies).not.toHaveBeenCalled()
    expect(inserts.values).toHaveBeenCalledWith(
      expect.objectContaining({
        requestBody: null,
        responseBody: null,
      }),
    )
  })

  it('drops logs when the queue is full', () => {
    for (let i = 0; i < 1001; i++) writeRequestLog(row())

    expect(getRequestLogQueueStats()).toEqual({ queued: 1000, dropped: 1 })
  })
})
