import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  finishInflight,
  listInflight,
  registerInflight,
  resetInflightForTest,
  updateInflight,
} from './inflight-requests.ts'

vi.mock('../admin/api-keys.ts', () => ({
  getApiKeyName: () => 'test-key',
}))

const publishAdminEvent = vi.hoisted(() => vi.fn())
vi.mock('../admin/events.ts', () => ({
  publishAdminEvent,
}))

describe('inflight-requests', () => {
  beforeEach(() => {
    resetInflightForTest()
    publishAdminEvent.mockClear()
  })

  it('registers, updates phase, and finishes', () => {
    registerInflight({
      id: 'req_a',
      startedAt: Date.now(),
      requestClass: 'inference',
      method: 'POST',
      endpoint: '/v1/chat/completions',
      model: 'llama3',
      streamed: true,
      phase: 'accepted',
      keyId: 'key_1',
      clientHost: null,
      clientName: null,
      endUserId: null,
      sessionId: null,
      routingRuleName: null,
      routingTargetType: 'local',
    })
    expect(publishAdminEvent).toHaveBeenCalledWith('request.started', expect.anything())
    expect(listInflight()).toHaveLength(1)

    updateInflight('req_a', { phase: 'queued' })
    expect(publishAdminEvent).toHaveBeenCalledWith(
      'request.updated',
      expect.objectContaining({ request: expect.objectContaining({ phase: 'queued' }) }),
    )

    updateInflight('req_a', { phase: 'active' })
    finishInflight('req_a')
    expect(listInflight()).toHaveLength(0)
  })

  it('is a no-op when registering the same id twice', () => {
    const input = {
      id: 'req_b',
      startedAt: Date.now(),
      requestClass: 'inference' as const,
      method: 'POST',
      endpoint: '/v1/models',
      model: null,
      streamed: false,
      keyId: null,
      clientHost: null,
      clientName: null,
      endUserId: null,
      sessionId: null,
      routingRuleName: null,
      routingTargetType: null,
    }
    registerInflight(input)
    registerInflight(input)
    expect(publishAdminEvent.mock.calls.filter((c) => c[0] === 'request.started')).toHaveLength(1)
  })
})
