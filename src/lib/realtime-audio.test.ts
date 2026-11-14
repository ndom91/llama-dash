import { describe, expect, it } from 'vitest'
import {
  base64ToPcm16,
  buildRealtimeFilename,
  concatPcm16,
  describeRealtimeClose,
  encodeWav,
  mergeEventLog,
  floatToPcm16,
  nextPlaybackStart,
  pcm16ToBase64,
  pcm16ToFloat,
  realtimeProtocols,
  realtimeUrl,
  rms,
  StreamResampler,
  VoiceActivityDetector,
} from './realtime-audio'

function sine(freq: number, rate: number, samples: number): Float32Array {
  const out = new Float32Array(samples)
  for (let i = 0; i < samples; i++) out[i] = Math.sin((2 * Math.PI * freq * i) / rate)
  return out
}

describe('realtimeUrl', () => {
  it('uses ws on http and wss on https', () => {
    expect(realtimeUrl('lfm audio', { protocol: 'http:', host: '10.0.0.2:5173' })).toBe(
      'ws://10.0.0.2:5173/v1/realtime?model=lfm%20audio',
    )
    expect(realtimeUrl('m', { protocol: 'https:', host: 'dash.local' })).toBe('wss://dash.local/v1/realtime?model=m')
  })

  it('offers only the key subprotocol, and nothing without a key', () => {
    expect(realtimeProtocols('sk-1')).toEqual(['openai-insecure-api-key.sk-1'])
    expect(realtimeProtocols(null)).toEqual([])
  })
})

describe('PCM16 conversion', () => {
  it('clamps and scales floats to int16', () => {
    expect(Array.from(floatToPcm16(new Float32Array([0, 1, -1, 2, -2, 0.5])))).toEqual([
      0, 32767, -32768, 32767, -32768, 16384,
    ])
  })

  it('round-trips through floats within one LSB', () => {
    const pcm = new Int16Array([0, 1, -1, 12345, -12345, 32767, -32768])
    const back = floatToPcm16(pcm16ToFloat(pcm))
    for (let i = 0; i < pcm.length; i++) expect(Math.abs(back[i] - pcm[i])).toBeLessThanOrEqual(1)
  })

  it('round-trips through base64 as little-endian bytes', () => {
    const pcm = new Int16Array([0, 1, -1, 256, -32768, 32767])
    const b64 = pcm16ToBase64(pcm)
    expect(atob(b64).charCodeAt(2)).toBe(1)
    expect(atob(b64).charCodeAt(3)).toBe(0)
    expect(Array.from(base64ToPcm16(b64))).toEqual(Array.from(pcm))
  })

  it('encodes subarray views without leaking neighbouring samples', () => {
    const backing = new Int16Array([9, 1, 2, 9])
    expect(Array.from(base64ToPcm16(pcm16ToBase64(backing.subarray(1, 3))))).toEqual([1, 2])
  })

  it('ignores a trailing odd byte', () => {
    expect(Array.from(base64ToPcm16(btoa('\x01\x00\x02')))).toEqual([1])
  })

  it('handles buffers larger than one encode chunk', () => {
    const pcm = new Int16Array(70_000).map((_, i) => (i % 2000) - 1000)
    expect(base64ToPcm16(pcm16ToBase64(pcm))).toEqual(pcm)
  })

  it('concatenates chunks in order', () => {
    expect(Array.from(concatPcm16([new Int16Array([1, 2]), new Int16Array([]), new Int16Array([3])]))).toEqual([
      1, 2, 3,
    ])
  })
})

describe('rms', () => {
  it('is zero for silence and empty input', () => {
    expect(rms(new Float32Array(10))).toBe(0)
    expect(rms(new Float32Array(0))).toBe(0)
  })

  it('is 1/sqrt(2) for a full-scale sine', () => {
    expect(rms(sine(440, 48_000, 48_000))).toBeCloseTo(Math.SQRT1_2, 3)
  })
})

describe('encodeWav', () => {
  it('writes a mono PCM16 RIFF header followed by the samples', async () => {
    const blob = encodeWav(new Int16Array([1, -2]), 24_000)
    const bytes = new Uint8Array(await blob.arrayBuffer())
    const view = new DataView(bytes.buffer)
    const text = (offset: number) => String.fromCharCode(...bytes.subarray(offset, offset + 4))
    expect(blob.type).toBe('audio/wav')
    expect(bytes.length).toBe(48)
    expect(text(0)).toBe('RIFF')
    expect(view.getUint32(4, true)).toBe(40)
    expect(text(8)).toBe('WAVE')
    expect(view.getUint16(20, true)).toBe(1)
    expect(view.getUint16(22, true)).toBe(1)
    expect(view.getUint32(24, true)).toBe(24_000)
    expect(view.getUint32(28, true)).toBe(48_000)
    expect(view.getUint16(34, true)).toBe(16)
    expect(text(36)).toBe('data')
    expect(view.getUint32(40, true)).toBe(4)
    expect(view.getInt16(44, true)).toBe(1)
    expect(view.getInt16(46, true)).toBe(-2)
  })
})

describe('StreamResampler', () => {
  it('passes audio through when rates match', () => {
    const input = new Float32Array([0.1, 0.2])
    expect(new StreamResampler(16_000, 16_000).process(input)).toBe(input)
  })

  it('produces the expected sample count from 48 kHz to 16 kHz', () => {
    const out = new StreamResampler(48_000, 16_000).process(new Float32Array(4800))
    expect(Math.abs(out.length - 1600)).toBeLessThanOrEqual(1)
  })

  it('handles non-integer ratios like 44.1 kHz to 16 kHz', () => {
    const resampler = new StreamResampler(44_100, 16_000)
    let total = 0
    for (let i = 0; i < 100; i++) total += resampler.process(new Float32Array(441)).length
    expect(Math.abs(total - 16_000)).toBeLessThanOrEqual(1)
  })

  it('gives the same output whether fed in one block or many', () => {
    const input = sine(300, 48_000, 4800)
    const whole = new StreamResampler(48_000, 16_000).process(input)
    const chunked = new StreamResampler(48_000, 16_000)
    const parts: Array<number> = []
    for (let i = 0; i < input.length; i += 128) parts.push(...chunked.process(input.subarray(i, i + 128)))
    expect(parts.length).toBe(whole.length)
    for (let i = 0; i < parts.length; i++) expect(parts[i]).toBeCloseTo(whole[i], 5)
  })

  it('keeps in-band tones and attenuates content above the new Nyquist', () => {
    const resampler = () => new StreamResampler(48_000, 16_000)
    const kept = resampler()
      .process(sine(1000, 48_000, 48_000))
      .subarray(200)
    const aliased = resampler()
      .process(sine(12_000, 48_000, 48_000))
      .subarray(200)
    expect(rms(kept)).toBeGreaterThan(0.65)
    expect(rms(aliased)).toBeLessThan(0.05)
  })

  it('upsamples by interpolation', () => {
    const out = new StreamResampler(16_000, 24_000).process(new Float32Array(1600).fill(0.5))
    expect(Math.abs(out.length - 2400)).toBeLessThanOrEqual(2)
    expect(out[10]).toBeCloseTo(0.5, 5)
  })
})

describe('VoiceActivityDetector', () => {
  it('starts, confirms, and ends a turn after enough silence', () => {
    const vad = new VoiceActivityDetector(0.02, 600, 200)
    expect(vad.feed(0.001, 20)).toBeNull()
    expect(vad.feed(0.1, 100)).toBe('start')
    expect(vad.feed(0.1, 100)).toBe('confirm')
    expect(vad.feed(0.1, 100)).toBeNull()
    expect(vad.feed(0.001, 300)).toBeNull()
    expect(vad.feed(0.1, 20)).toBeNull()
    expect(vad.feed(0.001, 300)).toBeNull()
    expect(vad.feed(0.001, 300)).toBe('end')
  })

  it('discards blips shorter than the minimum speech length', () => {
    const vad = new VoiceActivityDetector(0.02, 300, 250)
    expect(vad.feed(0.5, 20)).toBe('start')
    expect(vad.feed(0.001, 300)).toBe('discard')
  })

  it('confirms immediately when one block is already long enough', () => {
    expect(new VoiceActivityDetector(0.02, 300, 20).feed(0.5, 20)).toBe('confirm')
  })

  it('picks up threshold changes between blocks', () => {
    const vad = new VoiceActivityDetector(0.5, 300)
    expect(vad.feed(0.1, 20)).toBeNull()
    vad.threshold = 0.05
    expect(vad.feed(0.1, 20)).toBe('start')
  })
})

describe('nextPlaybackStart', () => {
  it('queues back to back while the playhead is ahead', () => {
    expect(nextPlaybackStart(2.5, 2.0, 0.05)).toBe(2.5)
  })

  it('restarts ahead of now after an underrun', () => {
    expect(nextPlaybackStart(1.0, 2.0, 0.05)).toBeCloseTo(2.05)
    expect(nextPlaybackStart(0, 0, 0.05)).toBeCloseTo(0.05)
  })
})

describe('buildRealtimeFilename', () => {
  it('slugs the model and stamps the time', () => {
    expect(buildRealtimeFilename('LFM3 Audio/2B', 'assistant', Date.UTC(2026, 0, 2, 3, 4, 5, 6))).toBe(
      'LFM3-Audio-2B-assistant-2026-01-02T03-04-05-006.wav',
    )
  })
})

describe('describeRealtimeClose', () => {
  const base = { code: 1000, reason: '', opened: true, sessionReady: true, serverError: null, userInitiated: false }

  it('stays quiet for user and normal closes', () => {
    expect(describeRealtimeClose({ ...base, userInitiated: true, code: 1006 })).toBeNull()
    expect(describeRealtimeClose(base)).toBeNull()
  })

  it('explains a refused handshake', () => {
    expect(describeRealtimeClose({ ...base, opened: false, code: 1006 })).toMatch(/handshake was refused/)
  })

  it('uses the close reason or the last server error for policy closes', () => {
    expect(describeRealtimeClose({ ...base, code: 1008, reason: 'model not allowed' })).toBe(
      'Session rejected: model not allowed',
    )
    expect(describeRealtimeClose({ ...base, code: 1008, serverError: 'key lacks access' })).toBe(
      'Session rejected: key lacks access',
    )
  })

  it('reports a close before session.created', () => {
    expect(describeRealtimeClose({ ...base, sessionReady: false, serverError: 'bad template' })).toBe(
      'The session closed before it started: bad template',
    )
  })

  it('surfaces a server error that preceded a normal close', () => {
    expect(describeRealtimeClose({ ...base, serverError: 'boom' })).toBe('Session ended: boom')
  })

  it('reports upstream failures and drops', () => {
    expect(describeRealtimeClose({ ...base, code: 1011 })).toBe('Server error: llama-server closed the session')
    expect(describeRealtimeClose({ ...base, code: 1006 })).toBe('The connection dropped unexpectedly.')
    expect(describeRealtimeClose({ ...base, code: 4000, reason: 'x' })).toBe('Connection closed (4000): x')
  })
})

describe('mergeEventLog', () => {
  const entry = (id: number, type: string, detail: string | null = null, direction: 'in' | 'out' = 'in') => ({
    id,
    at: id,
    direction,
    type,
    count: 1,
    detail,
  })

  it('folds consecutive identical events without detail', () => {
    const log = mergeEventLog([], [entry(1, 'a'), entry(2, 'a'), entry(3, 'a', 'x'), entry(4, 'a', null, 'out')], 10)
    expect(log.map((e) => [e.type, e.direction, e.count, e.at])).toEqual([
      ['a', 'in', 2, 2],
      ['a', 'in', 1, 3],
      ['a', 'out', 1, 4],
    ])
  })

  it('keeps only the newest entries', () => {
    const log = mergeEventLog([entry(1, 'a')], [entry(2, 'b'), entry(3, 'c')], 2)
    expect(log.map((e) => e.type)).toEqual(['b', 'c'])
  })
})
