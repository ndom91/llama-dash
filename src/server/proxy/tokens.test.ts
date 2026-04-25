import { describe, expect, it } from 'vitest'
import { estimatePromptTokens, getPromptTokenEstimateParts } from './tokens'

describe('estimatePromptTokens', () => {
  it('estimates from model-visible input fields', () => {
    const body = {
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'hello' }],
      system: 'be terse',
      tools: [{ name: 'lookup' }],
      stream: true,
    }

    expect(getPromptTokenEstimateParts(body)).toEqual([body.messages, body.system, body.tools])
    expect(estimatePromptTokens(body)).toBe(
      Math.ceil(JSON.stringify([body.messages, body.system, body.tools]).length / 4),
    )
  })

  it('returns null when there is no prompt-like input', () => {
    expect(estimatePromptTokens({ model: 'gpt-4', stream: true })).toBeNull()
  })
})
