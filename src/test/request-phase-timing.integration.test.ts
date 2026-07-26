import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buildTimingPhases } from '../features/requests/RequestTokenTrace.tsx'
import { analyzeTiming } from '../features/requests/requestDetailUtils.ts'
import { handleProxyRequest } from '../server/proxy/handler.ts'
import { ModelScheduler, resetModelScheduler, setModelScheduler } from '../server/proxy/model-scheduler.ts'
import { makeProxyRequest, openaiChatBody } from './fixtures/request.ts'
import { flushLogs, listLoggedRequests, resetTestDatabase } from './harness/db.ts'
import {
  buildTimedChatSseChunks,
  delayedJsonResponse,
  delayedSseResponse,
  installFakeUpstream,
  installFakeUpstreamUndiciMock,
  openaiChatCompletionJson,
  registerFakeUpstreamCleanup,
} from './harness/fake-upstream.ts'
import { settleProxyResponse } from './harness/proxy-request.ts'
import { undiciFetchMock } from './harness/undici-mock-state.ts'

installFakeUpstreamUndiciMock(undiciFetchMock)
registerFakeUpstreamCleanup()

function randBetween(min: number, max: number) {
  return min + Math.floor(Math.random() * (max - min + 1))
}

function expectPhasesSumToDuration(row: {
  durationMs: number
  queueMs: number | null
  modelLoadingMs: number | null
  prefillMs: number | null
  reasoningMs: number | null
  responseMs: number | null
  gpuPrefillMs: number | null
  gpuDecodeMs: number | null
}) {
  const timing = analyzeTiming({
    queueMs: row.queueMs,
    modelLoadingMs: row.modelLoadingMs,
    prefillMs: row.prefillMs,
    reasoningMs: row.reasoningMs,
    responseMs: row.responseMs,
    gpuPrefillMs: row.gpuPrefillMs,
    gpuDecodeMs: row.gpuDecodeMs,
  })
  const phases = buildTimingPhases(row.durationMs, timing)
  const sum = phases.reduce((acc, phase) => acc + phase.ms, 0)
  expect(sum).toBe(row.durationMs)
  return { timing, phases, sum }
}

describe('proxy request phase timing integration', () => {
  beforeEach(() => {
    resetTestDatabase()
  })

  afterEach(() => {
    resetModelScheduler()
  })

  it('streaming: display phases use GPU timings and still sum to duration', async () => {
    const prefillMs = randBetween(40, 90)
    const tokenGapMs = randBetween(15, 40)
    const closePaddingMs = randBetween(20, 50)

    installFakeUpstream(() =>
      delayedSseResponse(
        buildTimedChatSseChunks({
          prefillMs,
          tokenGapMs,
          tokenCount: 4,
          closePaddingMs,
          // Large vs wall clock — display uses these; other/trim reconciles to duration.
          misleadingGpuTimings: { prompt_ms: 5_000, predicted_ms: 9_000 },
        }),
      ),
    )

    const response = await handleProxyRequest(
      makeProxyRequest({
        headers: { 'content-type': 'application/json' },
        body: openaiChatBody('llama3', { stream: true }),
      }),
    )
    expect(response.status).toBe(200)
    expect(response.headers.get('x-llama-dash-queued')).toBe('false')
    expect(response.headers.get('content-type')).toContain('text/event-stream')
    const bodyText = await response.text()
    flushLogs()
    expect(bodyText).toMatch(/: relayed at_ms=\d+/)
    expect(bodyText).toMatch(/: respond at_ms=\d+/)
    expect(bodyText).not.toContain(': reason')

    const rows = listLoggedRequests()
    expect(rows).toHaveLength(1)
    const row = rows[0]!
    expect(row.streamed).toBe(true)
    expect(row.prefillMs).toBe(5_000)
    expect(row.gpuPrefillMs).toBe(5_000)
    expect(row.gpuDecodeMs).toBe(9_000)
    expect(row.responseMs).toBe(9_000)
    expect(row.reasoningMs).toBeNull()
    expect(row.decodeMs).toBeNull()
    expect(row.streamCloseMs).toBeNull()
    // Immediate (not queued): RELAY − START is ~0, allow 1–2ms clock skew.
    expect(row.queueMs ?? 0).toBeLessThan(20)

    const { phases } = expectPhasesSumToDuration(row)
    expect(phases.map((p) => p.key)).toContain('other')
    expect(phases.reduce((acc, p) => acc + p.ms, 0)).toBe(row.durationMs)
  })

  it('non-streaming: forces upstream SSE, assembles JSON, records phase timings', async () => {
    installFakeUpstream((call) => {
      const body = call.body ? JSON.parse(call.body) : {}
      expect(body.stream).toBe(true)
      return delayedSseResponse(
        buildTimedChatSseChunks({
          prefillMs: 40,
          tokenGapMs: 20,
          tokenCount: 3,
          closePaddingMs: 10,
          misleadingGpuTimings: { prompt_ms: 100, predicted_ms: 200 },
        }),
      )
    })

    const response = await handleProxyRequest(
      makeProxyRequest({
        headers: { 'content-type': 'application/json' },
        body: openaiChatBody('llama3', { stream: false }),
      }),
    )
    expect(response.status).toBe(200)
    expect(response.headers.get('x-llama-dash-queued')).toBe('false')
    expect(response.headers.get('x-llama-dash-queue-ms')).toBeTruthy()
    expect(response.headers.get('x-llama-dash-respond-ms')).toBeTruthy()
    expect(response.headers.get('content-type')).toContain('application/json')
    expect(response.headers.get('content-type')).not.toContain('text/event-stream')

    const json = await response.json()
    flushLogs()
    expect(json.object).toBe('chat.completion')
    expect(json.choices[0].message.content).toMatch(/t0t1t2/)

    const row = listLoggedRequests()[0]!
    expect(row.streamed).toBe(false)
    expect(row.prefillMs).toBe(100)
    expect(row.gpuPrefillMs).toBe(100)
    expect(row.responseMs).toBe(200)
    expect(row.queueMs ?? 0).toBeLessThan(20)
    expectPhasesSumToDuration(row)
  })

  it('concurrent: queued request records queueMs and both rows sum phases to duration', async () => {
    setModelScheduler(
      new ModelScheduler({
        maxConcurrency: 1,
        maxQueueSize: 10,
        queueTimeoutMs: 30_000,
        batchWindowMs: 0,
        fairnessTimeoutMs: 30_000,
        modelGrouping: false,
      }),
    )

    let active = 0
    installFakeUpstream(() => {
      active++
      const prefill = active === 1 ? 80 : 30
      return delayedSseResponse(
        buildTimedChatSseChunks({
          prefillMs: prefill,
          tokenGapMs: 20,
          tokenCount: 2,
          closePaddingMs: 25,
        }),
      )
    })

    const reqA = handleProxyRequest(
      makeProxyRequest({
        headers: { 'content-type': 'application/json' },
        body: openaiChatBody('model-a', { stream: true }),
      }),
    )
    await new Promise((r) => setTimeout(r, 15))
    const reqB = handleProxyRequest(
      makeProxyRequest({
        headers: { 'content-type': 'application/json' },
        body: openaiChatBody('model-b', { stream: true }),
      }),
    )

    const [resA, resB] = await Promise.all([reqA, reqB])
    await settleProxyResponse(resA)
    await settleProxyResponse(resB)

    const rows = listLoggedRequests().sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime())
    expect(rows).toHaveLength(2)

    const first = rows.find((r) => r.model === 'model-a') ?? rows[0]!
    const second = rows.find((r) => r.model === 'model-b') ?? rows[1]!

    expect(first.queueMs ?? 0).toBeLessThan(20)
    expect(second.queueMs).toBeGreaterThanOrEqual(50)
    expectPhasesSumToDuration(first)
    expectPhasesSumToDuration(second)
  })

  it('mixed stream + non-stream under concurrency still reconcile phase sums', async () => {
    setModelScheduler(
      new ModelScheduler({
        maxConcurrency: 2,
        maxQueueSize: 10,
        queueTimeoutMs: 30_000,
        batchWindowMs: 0,
        fairnessTimeoutMs: 30_000,
        modelGrouping: false,
      }),
    )

    let calls = 0
    installFakeUpstream((call) => {
      calls++
      const body = call.body ? JSON.parse(call.body) : {}
      // Non-stream chat is forced to upstream stream:true, so both paths get SSE.
      if (body.stream) {
        return delayedSseResponse(
          buildTimedChatSseChunks({
            prefillMs: randBetween(30, 70),
            tokenGapMs: randBetween(10, 25),
            tokenCount: 3,
            closePaddingMs: randBetween(15, 35),
          }),
        )
      }
      return delayedJsonResponse(randBetween(40, 90), openaiChatCompletionJson(body.model ?? 'llama3'))
    })

    const responses = await Promise.all([
      handleProxyRequest(
        makeProxyRequest({
          headers: { 'content-type': 'application/json' },
          body: openaiChatBody('s1', { stream: true }),
        }),
      ),
      handleProxyRequest(
        makeProxyRequest({
          headers: { 'content-type': 'application/json' },
          body: openaiChatBody('j1', { stream: false }),
        }),
      ),
      handleProxyRequest(
        makeProxyRequest({
          headers: { 'content-type': 'application/json' },
          body: openaiChatBody('s2', { stream: true }),
        }),
      ),
    ])

    for (const response of responses) {
      expect(response.status).toBe(200)
      await settleProxyResponse(response)
    }

    expect(calls).toBe(3)
    const rows = listLoggedRequests()
    expect(rows).toHaveLength(3)
    for (const row of rows) {
      expectPhasesSumToDuration(row)
    }
  })
})
