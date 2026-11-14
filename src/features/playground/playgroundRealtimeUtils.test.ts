import { describe, expect, it } from 'vitest'
import { formatRealtimeMs, isRealtimeAudioModel, splitRealtimeModels } from './playgroundRealtimeUtils'

const model = (id: string, kind: 'local' | 'peer', input: Array<string>, output: Array<string>) => ({
  id,
  kind,
  capabilities: { inputModalities: input, outputModalities: output, flags: [], supportedParameters: [] },
})

describe('realtime model selection', () => {
  it('requires audio on both sides', () => {
    expect(isRealtimeAudioModel(model('a', 'local', ['text', 'audio'], ['text', 'audio']))).toBe(true)
    expect(isRealtimeAudioModel(model('b', 'local', ['audio'], ['text']))).toBe(false)
  })

  it('keeps other local models selectable and drops peers', () => {
    const split = splitRealtimeModels([
      model('omni', 'local', ['audio'], ['audio']),
      model('chat', 'local', ['text'], ['text']),
      model('remote', 'peer', ['audio'], ['audio']),
    ])
    expect(split.audio.map((m) => m.id)).toEqual(['omni'])
    expect(split.other.map((m) => m.id)).toEqual(['chat'])
  })
})

describe('formatRealtimeMs', () => {
  it('switches to seconds above one second', () => {
    expect(formatRealtimeMs(null)).toBe('—')
    expect(formatRealtimeMs(412.6)).toBe('413 ms')
    expect(formatRealtimeMs(1520)).toBe('1.52 s')
  })
})
