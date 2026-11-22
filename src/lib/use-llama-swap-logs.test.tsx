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

function emit(raw: string, nested: boolean) {
  const data = { source: 'proxy', data: raw }
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
})
