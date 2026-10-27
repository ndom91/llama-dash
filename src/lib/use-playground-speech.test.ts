// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { usePlaygroundSpeech } from './use-playground-speech'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  localStorage.clear()
})

it('uses native TTS without sending the OpenAI voice and preserves WAV data', async () => {
  const fetchMock = vi.fn(async (url: string) => {
    if (url === '/api/playground-key') return Response.json({ key: 'test-key' })
    return { ok: true, status: 200, blob: async () => new Blob(['audio'], { type: 'audio/wav' }) }
  })
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {})
  vi.stubGlobal('fetch', fetchMock)
  const { result, unmount } = renderHook(() => usePlaygroundSpeech())
  act(() => {
    result.current.setModel('lfm3-audio-2b')
    result.current.setVoice('openai-voice')
    result.current.setSpeechApi('llama')
    result.current.setText('Hello')
  })
  await act(async () => {
    await result.current.generate()
  })
  const call = fetchMock.mock.calls.find(([url]) => url === '/v1/audio/llama-tts')
  expect(call).toBeDefined()
  expect(JSON.parse((call as unknown as [string, RequestInit])[1].body as string)).toEqual({
    model: 'lfm3-audio-2b',
    input: 'Hello',
  })
  expect(result.current.entries[0]?.audioUrl).toMatch(/^data:audio\/wav/)
  expect(result.current.entries[0].voice).toBe('default')
  unmount()
})
