import { describe, expect, it } from 'vitest'
import { buildDirectUpstream } from './upstream'

describe('buildDirectUpstream', () => {
  it('preserves native llama.cpp endpoints outside the OpenAI v1 namespace', () => {
    expect(buildDirectUpstream('https://api.openai.com/v1', '/infill', '')).toBe('https://api.openai.com/infill')
  })
})
