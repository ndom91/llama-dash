import { describe, expect, it } from 'vitest'
import { analyzeTiming, formatPhaseMs, groupHeaders, parseSseStream } from './requestDetailUtils.ts'

describe('analyzeTiming', () => {
  it('prefers persisted display phases when present', () => {
    const timing = analyzeTiming({
      queueMs: 10,
      modelLoadingMs: 40,
      prefillMs: 95,
      reasoningMs: 50,
      responseMs: 130,
      gpuPrefillMs: 95,
      gpuDecodeMs: 180,
    })
    expect(timing.queueMs).toBe(10)
    expect(timing.modelLoadingMs).toBe(40)
    expect(timing.prefillMs).toBe(95)
    expect(timing.reasoningMs).toBe(50)
    expect(timing.responseMs).toBe(130)
  })

  it('scrapes GPU timings from SSE for legacy rows and maps them to display phases', () => {
    const sse = parseSseStream(
      [
        'data: {"choices":[{"delta":{"content":"hi"}}]}',
        '',
        'data: {"timings":{"prompt_ms":110,"predicted_ms":220}}',
        '',
        'data: [DONE]',
        '',
      ].join('\n'),
    )
    const timing = analyzeTiming({
      sse,
      queueMs: 90,
      prefillMs: 50,
      decodeMs: 80,
      streamCloseMs: 5,
    })
    expect(timing.queueMs).toBe(90)
    expect(timing.prefillMs).toBe(110)
    expect(timing.responseMs).toBe(220)
    expect(timing.modelLoadingMs).toBeNull()
    expect(timing.reasoningMs).toBeNull()
  })

  it('keeps persisted GPU-backed prefill when equal to gpuPrefillMs', () => {
    const timing = analyzeTiming({
      queueMs: 5,
      prefillMs: 12,
      responseMs: 34,
      gpuPrefillMs: 12,
      gpuDecodeMs: 34,
    })
    expect(timing.prefillMs).toBe(12)
    expect(timing.responseMs).toBe(34)
  })
})

describe('formatPhaseMs', () => {
  it('shows em dash for null or zero', () => {
    expect(formatPhaseMs(null)).toBe('—')
    expect(formatPhaseMs(0)).toBe('—')
    expect(formatPhaseMs(12)).toBe('12.0 ms')
  })
})

const keys = (entries: Array<[string, string]>) => entries.map(([k]) => k)

describe('groupHeaders', () => {
  it('puts priority headers first, in curated order', () => {
    const grouped = groupHeaders([
      ['user-agent', 'curl/8'],
      ['content-type', 'application/json'],
      ['authorization', 'Bearer sk-x'],
    ])
    expect(keys(grouped.primary)).toEqual(['authorization', 'content-type', 'user-agent'])
  })

  it('sorts non-priority headers alphabetically after the priority block', () => {
    const grouped = groupHeaders([
      ['x-zulu', '1'],
      ['content-type', 'application/json'],
      ['x-alpha', '2'],
    ])
    expect(keys(grouped.primary)).toEqual(['content-type', 'x-alpha', 'x-zulu'])
  })

  // The fold problem: eight of these ahead of content-type in serialization
  // order made the pane useless at its 50% max height.
  it('separates browser boilerplate out of the primary list', () => {
    const grouped = groupHeaders([
      ['sec-ch-ua', '"Chromium";v="150"'],
      ['sec-ch-ua-platform', '"macOS"'],
      ['sec-fetch-mode', 'cors'],
      ['accept-language', 'en-US'],
      ['cookie', 'a=b'],
      ['dnt', '1'],
      ['content-type', 'application/json'],
    ])
    expect(keys(grouped.primary)).toEqual(['content-type'])
    expect(keys(grouped.boilerplate)).toEqual([
      'accept-language',
      'cookie',
      'dnt',
      'sec-ch-ua',
      'sec-ch-ua-platform',
      'sec-fetch-mode',
    ])
  })

  it('treats accept as meaningful but accept-encoding as boilerplate', () => {
    const grouped = groupHeaders([
      ['accept-encoding', 'gzip'],
      ['accept', '*/*'],
    ])
    expect(keys(grouped.primary)).toEqual(['accept'])
    expect(keys(grouped.boilerplate)).toEqual(['accept-encoding'])
  })

  it('is case-insensitive when classifying', () => {
    const grouped = groupHeaders([
      ['Content-Type', 'application/json'],
      ['Sec-CH-UA-Platform', '"macOS"'],
    ])
    expect(keys(grouped.primary)).toEqual(['Content-Type'])
    expect(keys(grouped.boilerplate)).toEqual(['Sec-CH-UA-Platform'])
  })

  it('never drops a header', () => {
    const entries: Array<[string, string]> = [
      ['authorization', 'Bearer x'],
      ['sec-ch-ua', 'x'],
      ['x-custom', 'x'],
      ['cookie', 'x'],
    ]
    const grouped = groupHeaders(entries)
    expect(grouped.primary.length + grouped.boilerplate.length).toBe(entries.length)
  })

  it('handles an empty header map', () => {
    expect(groupHeaders([])).toEqual({ primary: [], boilerplate: [] })
  })
})
