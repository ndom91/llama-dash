import { describe, expect, it } from 'vitest'
import { isInferenceProxyPath } from './proxy-path'

describe('isInferenceProxyPath', () => {
  it('routes native llama.cpp infill requests to the inference proxy instead of the dashboard', () => {
    expect(isInferenceProxyPath('/infill')).toBe(true)
    expect(isInferenceProxyPath('/login')).toBe(false)
    expect(isInferenceProxyPath('/')).toBe(false)
  })
})
