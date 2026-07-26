import { describe, expect, it } from 'vitest'
import { formatVersionLabel } from './format'

describe('formatVersionLabel', () => {
  it('adds a v prefix to bare version numbers', () => {
    expect(formatVersionLabel('243')).toBe('v243')
  })

  it('does not duplicate an existing v prefix', () => {
    expect(formatVersionLabel('v243')).toBe('v243')
    expect(formatVersionLabel('V243')).toBe('V243')
  })

  it('falls back for missing versions', () => {
    expect(formatVersionLabel(null)).toBe('—')
    expect(formatVersionLabel(undefined)).toBe('—')
  })
})
