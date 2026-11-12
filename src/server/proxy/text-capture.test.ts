import { describe, expect, it } from 'vitest'
import { TextCapture } from './text-capture'

describe('TextCapture', () => {
  it('captures small bodies for usage parsing', () => {
    const capture = new TextCapture(100)
    capture.append('{"usage":{"total_tokens":3}}')

    expect(capture.text()).toBe('{"usage":{"total_tokens":3}}')
    expect(capture.usageText()).toBe('{"usage":{"total_tokens":3}}')
  })

  it('marks large bodies as truncated and disables usage parsing', () => {
    const capture = new TextCapture(5)
    capture.append('abcdef')

    expect(capture.text()).toContain('[truncated 1 bytes]')
    expect(capture.usageText()).toBeNull()
  })

  it('retains complete responses by default while keeping JSON usage scans bounded', () => {
    const capture = new TextCapture()
    const body = 'x'.repeat(300_000)
    capture.append(body.slice(0, 200_000))
    capture.append(body.slice(200_000))
    expect(capture.text()).toBe(body)
    expect(capture.usageText()).toBeNull()
  })
})
