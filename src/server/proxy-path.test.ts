import { describe, expect, it } from 'vitest'
import { canonicalProxyEndpoint, isInferenceProxyPath } from './proxy-path'

describe('isInferenceProxyPath', () => {
  it('routes native inference endpoints to the proxy instead of the dashboard', () => {
    expect(isInferenceProxyPath('/infill')).toBe(true)
    expect(isInferenceProxyPath('/tts')).toBe(false)
    expect(isInferenceProxyPath('/tts/other')).toBe(false)
    expect(isInferenceProxyPath('/tts-extra')).toBe(false)
    expect(isInferenceProxyPath('/v1/systemone')).toBe(true)
    expect(isInferenceProxyPath('/audiocpp')).toBe(true)
    expect(isInferenceProxyPath('/audiocpp/v1/audio/speech')).toBe(true)
    expect(isInferenceProxyPath('/login')).toBe(false)
    expect(isInferenceProxyPath('/')).toBe(false)
  })

  it('routes the llama-swap paths outside /v1', () => {
    for (const path of [
      '/completion',
      '/rerank',
      '/reranking',
      '/props',
      '/v/chat/completions',
      '/sdapi/v1/txt2img',
      '/sdapi/v1/loras',
      '/comfyui',
      '/comfyui/ws',
      '/comfyui/api/prompt',
    ]) {
      expect(isInferenceProxyPath(path)).toBe(true)
    }
    for (const path of ['/props-extra', '/completions', '/v', '/version', '/sdapi', '/comfyui-x', '/api/models']) {
      expect(isInferenceProxyPath(path)).toBe(false)
    }
  })
})

describe('canonicalProxyEndpoint', () => {
  it('maps versionless /v/ aliases onto /v1/', () => {
    expect(canonicalProxyEndpoint('/v/chat/completions')).toBe('/v1/chat/completions')
    expect(canonicalProxyEndpoint('/v1/chat/completions')).toBe('/v1/chat/completions')
    expect(canonicalProxyEndpoint('/completion')).toBe('/completion')
  })
})
