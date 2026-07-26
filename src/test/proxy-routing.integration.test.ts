import { beforeEach, describe, expect, it } from 'vitest'
import { createApiKey } from '../server/admin/api-keys.ts'
import { createRoutingRule, reorderRoutingRules } from '../server/admin/routing-rules.ts'
import { handleProxyRequest } from '../server/proxy/handler.ts'
import { emptyRoutingMatch } from './fixtures/routing-rule.ts'
import { anthropicMessagesBody, makeProxyRequest, openaiChatBody } from './fixtures/request.ts'
import { listLoggedRequests, resetTestDatabase } from './harness/db.ts'
import {
  getUpstreamCalls,
  installFakeUpstream,
  installFakeUpstreamUndiciMock,
  lastUpstreamCall,
  openaiChatCompletionJson,
  registerFakeUpstreamCleanup,
} from './harness/fake-upstream.ts'
import { settleProxyResponse } from './harness/proxy-request.ts'
import { undiciFetchMock } from './harness/undici-mock-state.ts'

installFakeUpstreamUndiciMock(undiciFetchMock)
registerFakeUpstreamCleanup()

describe('proxy routing/auth integration', () => {
  beforeEach(() => {
    resetTestDatabase()
    installFakeUpstream(() => ({ json: openaiChatCompletionJson() }))
  })

  it('rejects invalid keys without forwarding when no passthrough rule matches', async () => {
    await createApiKey({ name: 'gate' })

    const response = await handleProxyRequest(
      makeProxyRequest({
        headers: { authorization: 'Bearer sk-invalid', 'content-type': 'application/json' },
        body: openaiChatBody('llama3'),
      }),
    )

    expect(response.status).toBe(401)
    expect(getUpstreamCalls()).toHaveLength(0)
    const rows = listLoggedRequests()
    expect(rows).toHaveLength(1)
    expect(rows[0]?.statusCode).toBe(401)
    expect(rows[0]?.error).toMatch(/Invalid API key/i)
  })

  it('does not consume the body before rejecting an unauthenticated require_key request', async () => {
    await createApiKey({ name: 'gate' })
    const request = makeProxyRequest({
      headers: { authorization: 'Bearer sk-invalid', 'content-type': 'application/json' },
      body: openaiChatBody('llama3'),
    })

    const response = await handleProxyRequest(request)

    expect(response.status).toBe(401)
    await expect(request.text()).resolves.toBe(openaiChatBody('llama3'))
  })

  it('lets a require_key rewrite rule ordered above passthrough win for a matching key', async () => {
    const { key, rawKey } = await createApiKey({ name: 'opencode' })
    const rewrite = createRoutingRule({
      name: 'local rewrite',
      enabled: true,
      authMode: 'require_key',
      action: { type: 'rewrite_model', model: 'qwen3.6-35b' },
      target: { type: 'llama_swap' },
      match: emptyRoutingMatch({
        requestedModels: ['claude-haiku-4-5-20251001'],
        apiKeyIds: [key.id],
      }),
    })
    const passthrough = createRoutingRule({
      name: 'anthropic passthrough',
      enabled: true,
      authMode: 'passthrough',
      preserveAuthorization: true,
      action: { type: 'continue' },
      target: { type: 'direct', baseUrl: 'https://api.anthropic.com/v1' },
      match: emptyRoutingMatch({ endpoints: ['/v1/messages'] }),
    })
    reorderRoutingRules([rewrite.id, passthrough.id])

    const response = await settleProxyResponse(
      await handleProxyRequest(
        makeProxyRequest({
          url: 'http://dash.test/v1/messages',
          headers: { authorization: `Bearer ${rawKey}`, 'content-type': 'application/json' },
          body: anthropicMessagesBody('claude-haiku-4-5-20251001'),
        }),
      ),
    )

    expect(response.status).toBe(200)
    const upstream = lastUpstreamCall()
    expect(upstream.url).toBe('http://llama-swap.test/v1/messages')
    expect(JSON.parse(upstream.body ?? '{}').model).toBe('qwen3.6-35b')

    const rows = listLoggedRequests()
    expect(rows).toHaveLength(1)
    expect(rows[0]?.routingRuleId).toBe(rewrite.id)
    expect(rows[0]?.routingActionType).toBe('rewrite_model')
    expect(rows[0]?.routingAuthMode).toBe('require_key')
    expect(rows[0]?.routingRoutedModel).toBe('qwen3.6-35b')
    expect(rows[0]?.keyId).toBe(key.id)
  })

  it('forwards passthrough direct upstreams without a llama-dash key and preserves Authorization', async () => {
    createRoutingRule({
      name: 'anthropic passthrough',
      enabled: true,
      authMode: 'passthrough',
      preserveAuthorization: true,
      action: { type: 'continue' },
      target: { type: 'direct', baseUrl: 'https://api.anthropic.com/v1' },
      match: emptyRoutingMatch({ endpoints: ['/v1/messages'] }),
    })

    const response = await settleProxyResponse(
      await handleProxyRequest(
        makeProxyRequest({
          url: 'http://dash.test/v1/messages',
          headers: { authorization: 'Bearer upstream-oauth', 'content-type': 'application/json' },
          body: anthropicMessagesBody(),
        }),
      ),
    )

    expect(response.status).toBe(200)
    const upstream = lastUpstreamCall()
    expect(upstream.url).toBe('https://api.anthropic.com/v1/messages')
    expect(upstream.headers.authorization).toBe('Bearer upstream-oauth')

    const rows = listLoggedRequests()
    expect(rows).toHaveLength(1)
    expect(rows[0]?.routingAuthMode).toBe('passthrough')
    expect(rows[0]?.routingTargetType).toBe('direct')
    expect(rows[0]?.keyId).toBeNull()
  })

  it('routes authenticated local traffic to the inference backend and logs the exchange', async () => {
    const { key, rawKey } = await createApiKey({ name: 'local' })

    const response = await settleProxyResponse(
      await handleProxyRequest(
        makeProxyRequest({
          headers: { authorization: `Bearer ${rawKey}`, 'content-type': 'application/json' },
          body: openaiChatBody('llama3'),
        }),
      ),
    )

    expect(response.status).toBe(200)
    expect(lastUpstreamCall().url).toBe('http://llama-swap.test/v1/chat/completions')

    const rows = listLoggedRequests()
    expect(rows).toHaveLength(1)
    expect(rows[0]?.statusCode).toBe(200)
    expect(rows[0]?.keyId).toBe(key.id)
    expect(rows[0]?.model).toBe('llama3')
    expect(rows[0]?.promptTokens).toBe(3)
    expect(rows[0]?.completionTokens).toBe(1)
  })
})
