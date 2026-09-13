import { describe, expect, it } from 'vitest'
import { buildDirectUpstream } from './upstream'

describe('buildDirectUpstream', () => {
  it('preserves native llama.cpp endpoints outside the OpenAI v1 namespace', () => {
    expect(buildDirectUpstream('https://api.openai.com/v1', '/infill', '')).toBe('https://api.openai.com/infill')
  })

  it('routes OpenAI Responses requests to the ChatGPT Codex backend', () => {
    expect(buildDirectUpstream('https://chatgpt.com/backend-api/codex', '/v1/responses', '')).toBe(
      'https://chatgpt.com/backend-api/codex/responses',
    )
  })
})
