import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { handleProxyRequest } from '../server/proxy/handler.ts'
import { clearRecentBodiesForTest, RECENT_BODY_MAX_BYTES } from '../server/proxy/recent-bodies.ts'
import { makeProxyRequest, openaiChatBody } from './fixtures/request.ts'
import { listLoggedRequests, resetTestDatabase } from './harness/db.ts'
import {
  buildTimedChatSseChunks,
  delayedSseResponse,
  installFakeUpstream,
  installFakeUpstreamUndiciMock,
  registerFakeUpstreamCleanup,
} from './harness/fake-upstream.ts'
import { settleProxyResponse } from './harness/proxy-request.ts'
import { undiciFetchMock } from './harness/undici-mock-state.ts'

installFakeUpstreamUndiciMock(undiciFetchMock)
registerFakeUpstreamCleanup()

function mb(bytes: number) {
  return Math.round((bytes / 1024 / 1024) * 10) / 10
}

function snap(label: string) {
  // Vitest/Node may not expose gc; RSS still informative.
  try {
    ;(globalThis as { gc?: () => void }).gc?.()
  } catch {
    // ignore
  }
  const m = process.memoryUsage()
  const line = `${label.padEnd(44)} rss=${String(mb(m.rss)).padStart(6)} MB  heapUsed=${String(mb(m.heapUsed)).padStart(6)} MB  heapTotal=${String(mb(m.heapTotal)).padStart(6)} MB`
  // Always print so `vitest run` shows the measurements.
  console.log(line)
  return m
}

describe('memory footprint (proxy stack)', () => {
  beforeEach(() => {
    resetTestDatabase()
    clearRecentBodiesForTest()
  })

  afterEach(() => {
    clearRecentBodiesForTest()
  })

  it('reports RSS around idle and after many streamed requests', async () => {
    console.log(
      `\nnode ${process.version}  recentBodyBudget=${RECENT_BODY_MAX_BYTES / 1024 / 1024}MB  (vitest integration process)`,
    )
    const boot = snap('boot (after migrate/reset)')

    installFakeUpstream(() =>
      delayedSseResponse(
        buildTimedChatSseChunks({
          prefillMs: 5,
          tokenGapMs: 2,
          tokenCount: 8,
          closePaddingMs: 5,
          // ~few KB of content per request via token chunks
        }),
      ),
    )

    const N = 50
    for (let i = 0; i < N; i++) {
      const response = await settleProxyResponse(
        await handleProxyRequest(
          makeProxyRequest({
            headers: { 'content-type': 'application/json' },
            body: openaiChatBody(`model-${i % 3}`, {
              stream: true,
              messages: [{ role: 'user', content: `bench ${i} ${'pad '.repeat(200)}` }],
            }),
          }),
        ),
      )
      expect(response.status).toBe(200)
    }

    expect(listLoggedRequests().length).toBe(N)
    const after = snap(`after ${N} streamed proxy requests`)
    await new Promise((r) => setTimeout(r, 300))
    const idle = snap('idle +300ms')

    // Soft sanity: recent-body budget alone cannot explain >~40MB heap growth from this run.
    // (RSS can stay high because V8 rarely returns pages to the OS.)
    const heapGrowthMb = mb(after.heapUsed - boot.heapUsed)
    console.log(`heapUsed delta vs boot: ${heapGrowthMb} MB  |  RSS delta vs boot: ${mb(idle.rss - boot.rss)} MB`)
    console.log(
      'Interpretation: ~200–350MB RSS for a full Node dashboard+proxy process is typically normal;\n' +
        'this harness is proxy+SQLite only (no Vite/Nitro UI), so numbers are a lower bound.',
    )

    expect(heapGrowthMb).toBeLessThan(80)
  }, 60_000)
})
