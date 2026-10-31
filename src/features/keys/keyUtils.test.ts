import { describe, expect, it, vi } from 'vitest'
import { isInactiveKey } from './keyUtils'

describe('isInactiveKey', () => {
  it('groups revoked and expired keys without affecting active keys', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-31T12:00:00Z'))
    try {
      expect(isInactiveKey({ disabledAt: null, expiresAt: null })).toBe(false)
      expect(isInactiveKey({ disabledAt: null, expiresAt: '2026-11-01T00:00:00Z' })).toBe(false)
      expect(isInactiveKey({ disabledAt: '2026-10-30T00:00:00Z', expiresAt: null })).toBe(true)
      expect(isInactiveKey({ disabledAt: null, expiresAt: '2026-10-30T00:00:00Z' })).toBe(true)
      expect(isInactiveKey({ disabledAt: null, expiresAt: '2026-10-31T12:00:00Z' })).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })
})
