// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useLlamaSwapLogs } from './use-llama-swap-logs'

let source: MockEventSource

class MockEventSource {
  onopen: (() => void) | null = null
  onerror: (() => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  close = vi.fn()

  constructor(_url: string) {
    source = this
  }
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function emit(raw: string, nested: boolean, logSource = 'proxy') {
  const data = { source: logSource, data: raw }
  act(() => {
    source.onmessage?.(
      new MessageEvent('message', {
        data: JSON.stringify({ type: 'logData', data: nested ? JSON.stringify(data) : data }),
      }),
    )
  })
}

describe('useLlamaSwapLogs timestamps', () => {
  it.each([true, false])('preserves individual message times across replay (nested data: %s)', (nested) => {
    vi.stubGlobal('EventSource', MockEventSource)
    const now = vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-11-22T14:17:13.670Z'))
    const raw = '2026-11-22T12:00:01.123Z [INFO] first\n2026-11-22T12:00:02.456Z [WARN] second\n'
    const original = renderHook(useLlamaSwapLogs)
    emit(raw, nested)
    const timestamps = original.result.current.lines.map((line) => line.ts)
    expect(timestamps).toEqual([Date.parse('2026-11-22T12:00:01.123Z'), Date.parse('2026-11-22T12:00:02.456Z')])
    original.unmount()
    expect(source.close).toHaveBeenCalledOnce()

    now.mockReturnValue(Date.parse('2026-11-22T15:00:00Z'))
    const reopened = renderHook(useLlamaSwapLogs)
    emit(raw, nested)
    expect(reopened.result.current.lines.map((line) => line.ts)).toEqual(timestamps)

    emit('2026-11-22T15:00:03.789Z [INFO] live\n', nested)
    expect(reopened.result.current.lines.at(-1)?.ts).toBe(Date.parse('2026-11-22T15:00:03.789Z'))
  })

  it('leaves missing timestamps unknown, including llama.cpp uptime', () => {
    vi.stubGlobal('EventSource', MockEventSource)
    const { result } = renderHook(useLlamaSwapLogs)
    emit('[INFO] no timestamp\n4801.04.670.511 W srv warning\n', true)
    expect(result.current.lines.map((line) => line.ts)).toEqual([null, null])
  })

  it('timestamps live upstream messages on receipt, keeping initial history unknown', () => {
    vi.stubGlobal('EventSource', MockEventSource)
    const now = vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-11-22T15:00:00Z'))
    const { result, unmount } = renderHook(useLlamaSwapLogs)
    emit('[INFO] proxy history\n', true)
    emit('0.00.036.302 W srv old warning\n0.08.017.104 I srv old info\n', true, 'upstream')
    expect(result.current.lines.map((line) => line.ts)).toEqual([null, null, null])

    emit('0.09.000.000 I srv live info\n0.09.000.001 W srv live warning\n', true, 'upstream')
    expect(result.current.lines.slice(-2).map((line) => [line.ts, line.isReceiptTime])).toEqual([
      [now(), true],
      [now(), true],
    ])
    now.mockReturnValue(Date.parse('2026-11-22T15:00:01Z'))
    emit('0.10.000.000 I srv next live info\n', true, 'upstream')
    expect(result.current.lines.at(-1)).toMatchObject({ ts: now(), isReceiptTime: true })
    unmount()

    const reopened = renderHook(useLlamaSwapLogs)
    emit('0.10.000.000 I srv next live info\n', true, 'upstream')
    expect(reopened.result.current.lines[0]).toMatchObject({ ts: null, isReceiptTime: false })
  })

  it('prefers embedded timestamps over receipt times for live messages', () => {
    vi.stubGlobal('EventSource', MockEventSource)
    const { result } = renderHook(useLlamaSwapLogs)
    emit('2026-11-22T12:00:00Z [INFO] history\n', false)
    emit('2026-11-22T12:01:00Z [INFO] live\n', false)
    expect(result.current.lines.at(-1)).toMatchObject({
      ts: Date.parse('2026-11-22T12:01:00Z'),
      isReceiptTime: false,
    })
  })

  it('resets history detection for every source on reconnect, but not when cleared', () => {
    vi.stubGlobal('EventSource', MockEventSource)
    const now = vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-11-22T15:00:00Z'))
    const { result } = renderHook(useLlamaSwapLogs)
    act(() => source.onopen?.())
    emit('history\n', false, 'upstream')
    emit('live\n', false, 'upstream')
    expect(result.current.lines.at(-1)?.ts).toBe(now())
    act(() => result.current.clear())
    emit('live after clear\n', false, 'upstream')
    expect(result.current.lines[0]?.ts).toBe(now())

    act(() => source.onerror?.())
    expect(result.current.connected).toBe(false)
    act(() => source.onopen?.())
    expect(result.current.connected).toBe(true)
    expect(result.current.lines).toEqual([])
    emit('upstream replay\n', false, 'upstream')
    emit('proxy replay\n', false)
    expect(result.current.lines.map((line) => line.ts)).toEqual([null, null])
    emit('new live\n', false, 'upstream')
    expect(result.current.lines.at(-1)?.ts).toBe(now())
  })

  it('conservatively leaves the first batch untimed when a source had no history', () => {
    vi.stubGlobal('EventSource', MockEventSource)
    const { result } = renderHook(useLlamaSwapLogs)
    emit('first live batch with no preceding history\n', true, 'upstream')
    expect(result.current.lines[0]?.ts).toBeNull()
  })

  it('ignores malformed log data without consuming the initial history batch', () => {
    vi.stubGlobal('EventSource', MockEventSource)
    const { result } = renderHook(useLlamaSwapLogs)
    act(() => {
      source.onmessage?.(
        new MessageEvent('message', {
          data: JSON.stringify({ type: 'logData', data: { source: 'upstream', data: 123 } }),
        }),
      )
    })
    emit('history\n', false, 'upstream')
    expect(result.current.lines.map((line) => line.ts)).toEqual([null])
  })
})
