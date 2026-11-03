import { describe, expect, it } from 'vitest'
import type { ApiModel } from '../../lib/api'
import { axisLabels, buildResidencySpans, derivePeerHealth, formatResident, groupModels } from './modelResidency'

const model = (overrides: Partial<ApiModel>): ApiModel => ({
  id: 'm',
  name: 'm',
  kind: 'local',
  peerId: null,
  peerHost: null,
  selector: null,
  contextLength: null,
  state: 'ready',
  running: true,
  ttl: null,
  capabilities: { inputModalities: [], outputModalities: [], flags: [], supportedParameters: [] },
  ...overrides,
})

describe('buildResidencySpans', () => {
  const frame = { start: 1_000, end: 10_000, now: 10_000 }
  const ev = (modelId: string, event: 'load' | 'unload', ts: number) => ({
    id: `${modelId}-${ts}`,
    modelId,
    event,
    timestamp: new Date(ts).toISOString(),
  })

  it('clips spans to the frame and marks still-loaded spans open', () => {
    const spans = buildResidencySpans([ev('a', 'load', 0), ev('a', 'unload', 3_000), ev('a', 'load', 8_000)], frame)
    expect(spans.get('a')).toEqual([
      { start: 1_000, end: 3_000, open: false },
      { start: 8_000, end: 10_000, open: true },
    ])
  })

  it('drops spans that ended before the frame', () => {
    expect(buildResidencySpans([ev('a', 'load', 0), ev('a', 'unload', 500)], frame).get('a')).toBeUndefined()
  })
})

describe('axisLabels', () => {
  it('labels quarter points in minutes or hours', () => {
    expect(axisLabels(60 * 60_000).map((t) => t.label)).toEqual(['-60m', '-45m', '-30m', '-15m', 'now'])
    expect(axisLabels(6 * 60 * 60_000).map((t) => t.label)).toEqual(['-6h', '-4.5h', '-3h', '-1.5h', 'now'])
    expect(axisLabels(24 * 60 * 60_000).map((t) => t.label)).toEqual(['-24h', '-18h', '-12h', '-6h', 'now'])
  })
})

describe('formatResident', () => {
  it('switches to hours past 60 minutes', () => {
    expect(formatResident(47 * 60_000)).toBe('47m')
    expect(formatResident(60 * 60_000)).toBe('60m')
    expect(formatResident(125 * 60_000)).toBe('2h 5m')
  })
})

describe('groupModels', () => {
  const models = [
    model({ id: 'idle', running: false, state: 'stopped' }),
    model({ id: 'busy' }),
    model({ id: 'sel', kind: 'selector' }),
    model({ id: 'kokoro/kokoro', kind: 'peer', peerId: 'kokoro', peerHost: 'rig-02:8080', running: false }),
    model({ id: 'tts/q', kind: 'peer', peerId: 'tts', peerHost: 'rig-02:8080', running: false }),
    model({ id: 'asr/p', kind: 'peer', peerId: 'asr', peerHost: 'http://voice.lan:10314', running: false }),
  ]

  it('hides unloaded local models and selectors and puts every peer in one group', () => {
    const groups = groupModels(models, 'swap:8080')
    expect(groups.map((g) => [g.kind, g.host, g.models.map((m) => m.id)])).toEqual([
      ['local', 'swap:8080', ['busy']],
      ['peer', 'rig-02, voice.lan', ['asr/p', 'kokoro/kokoro', 'tts/q']],
    ])
  })
})

describe('derivePeerHealth', () => {
  const peers = [model({ id: 'p', kind: 'peer' })]
  const entry = (total: number, errors: number) => new Map([['p', { model: 'p', total, errors, lastAt: 5, ticks: [] }]])

  it('reports traffic-derived health', () => {
    expect(derivePeerHealth(peers, new Map()).label).toBe('no traffic')
    expect(derivePeerHealth(peers, entry(3, 0)).tone).toBe('ok')
    expect(derivePeerHealth(peers, entry(3, 1)).tone).toBe('warn')
    expect(derivePeerHealth(peers, entry(3, 3)).tone).toBe('err')
  })
})
