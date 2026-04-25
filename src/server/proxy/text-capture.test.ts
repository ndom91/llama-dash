import { describe, expect, it } from 'vitest'
import { BoundedTextCapture } from './text-capture'

describe('BoundedTextCapture', () => {
  it('captures small bodies for usage parsing', () => {
    const capture = new BoundedTextCapture(100)
    capture.append('{"usage":{"total_tokens":3}}')

    expect(capture.text()).toBe('{"usage":{"total_tokens":3}}')
    expect(capture.usageText()).toBe('{"usage":{"total_tokens":3}}')
  })

  it('marks large bodies as truncated and disables usage parsing', () => {
    const capture = new BoundedTextCapture(5)
    capture.append('abcdef')

    expect(capture.text()).toContain('[truncated 1 bytes]')
    expect(capture.usageText()).toBeNull()
  })
})
