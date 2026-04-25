import { beforeEach, describe, expect, it } from 'vitest'
import { clearRecentBodiesForTest, getRecentBodies, RECENT_BODY_MAX_BYTES, storeRecentBodies } from './recent-bodies'

describe('recent body cache', () => {
  beforeEach(() => clearRecentBodiesForTest())

  it('evicts by byte budget instead of count', () => {
    storeRecentBodies('first', { requestBody: 'a'.repeat(RECENT_BODY_MAX_BYTES - 10), responseBody: null })
    storeRecentBodies('second', { requestBody: 'b'.repeat(20), responseBody: null })

    expect(getRecentBodies('first')).toBeNull()
    expect(getRecentBodies('second')?.requestBody).toBe('b'.repeat(20))
  })
})
