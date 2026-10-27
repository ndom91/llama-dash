import { describe, expect, it } from 'vitest'
import { isInferenceProxyPath } from './proxy-path'

describe('isInferenceProxyPath', () => {
  it('routes native inference endpoints to the proxy instead of the dashboard', () => {
    expect(isInferenceProxyPath('/infill')).toBe(true)
    expect(isInferenceProxyPath('/tts')).toBe(true)
    expect(isInferenceProxyPath('/tts/other')).toBe(false)
    expect(isInferenceProxyPath('/tts-extra')).toBe(false)
    expect(isInferenceProxyPath('/v1/systemone')).toBe(true)
    expect(isInferenceProxyPath('/audiocpp')).toBe(true)
    expect(isInferenceProxyPath('/audiocpp/v1/audio/speech')).toBe(true)
    expect(isInferenceProxyPath('/login')).toBe(false)
    expect(isInferenceProxyPath('/')).toBe(false)
  })
})
