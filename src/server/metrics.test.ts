import { describe, expect, it, vi } from 'vitest'

vi.mock('./gpu-poller.ts', () => ({
  getGpuSnapshot: () => ({
    available: true,
    driver: 'nvidia',
    polledAt: Date.now(),
    gpus: [
      {
        index: 0,
        name: 'RTX Test',
        memoryUsedMiB: 1024,
        memoryTotalMiB: 2048,
        memoryPercent: 50,
        utilizationPercent: 25,
        temperatureC: 61,
        powerW: 110,
        powerMaxW: 250,
        cores: null,
      },
    ],
  }),
}))

vi.mock('./inference/backend.ts', () => ({
  inferenceBackend: {
    ping: vi.fn(async () => ({ reachable: true, latencyMs: 67, version: null })),
    listRunning: vi.fn(async () => [{ model: 'local-a' }, { model: 'local-b' }]),
  },
}))

vi.mock('./proxy/log.ts', () => ({
  getRequestLogQueueStats: () => ({ queued: 3, dropped: 1 }),
}))

vi.mock('./db/index.ts', () => {
  function chain(result: unknown) {
    const api = {
      from: () => api,
      groupBy: () => api,
      where: () => api,
      all: () => result,
      get: () => result,
    }
    return api
  }
  let selectCalls = 0
  return {
    db: {
      select: () => {
        selectCalls++
        if (selectCalls === 1) {
          return chain([
            {
              endpoint: '/v1/messages',
              model: 'claude-test',
              statusCode: 200,
              streamed: true,
              count: 2,
            },
          ])
        }
        if (selectCalls === 2) {
          return chain([
            {
              model: 'claude-test',
              promptTokens: 10,
              completionTokens: 5,
              cacheCreationTokens: 2,
              cacheReadTokens: 1,
            },
          ])
        }
        if (selectCalls === 3) return chain([{ durationMs: 100 }, { durationMs: 300 }])
        return chain({ success: 2, failure: 1 })
      },
    },
    schema: {
      requests: {
        endpoint: 'endpoint',
        model: 'model',
        statusCode: 'statusCode',
        streamed: 'streamed',
        promptTokens: 'promptTokens',
        completionTokens: 'completionTokens',
        cacheCreationTokens: 'cacheCreationTokens',
        cacheReadTokens: 'cacheReadTokens',
        durationMs: 'durationMs',
        startedAt: 'startedAt',
        credentialInjectionJson: 'credentialInjectionJson',
      },
    },
  }
})

import { renderPrometheusMetrics } from './metrics'

describe('renderPrometheusMetrics', () => {
  it('renders core prometheus metrics', async () => {
    const body = await renderPrometheusMetrics()

    expect(body).toContain(
      'llama_dash_requests_total{endpoint="/v1/messages",model="claude-test",status_class="2xx",streamed="true"} 2',
    )
    expect(body).toContain('llama_dash_tokens_total{model="claude-test",type="prompt"} 10')
    expect(body).toContain('llama_dash_tokens_total{model="claude-test",type="completion"} 5')
    expect(body).not.toContain('type="total"')
    expect(body).toContain('llama_dash_log_queue_depth 3')
    expect(body).toContain('llama_dash_log_queue_dropped_total 1')
    expect(body).toContain('llama_dash_credential_injections_total{result="success"} 2')
    expect(body).toContain('llama_dash_credential_injections_total{result="failure"} 1')
    expect(body).toContain('llama_dash_upstream_reachable 1')
    expect(body).toContain('llama_dash_models_running 2')
    expect(body).toContain('llama_dash_gpu_memory_used_bytes{index="0",name="RTX Test",driver="nvidia"} 1073741824')
  })
})
