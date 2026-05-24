import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearRecentBodiesForTest,
  deleteRecentBodies,
  getRecentBodies,
  RECENT_BODY_MAX_BYTES,
  storeRecentBodies,
} from './recent-bodies'

describe('recent body cache', () => {
  beforeEach(() => clearRecentBodiesForTest())

  it('evicts by byte budget instead of count', () => {
    storeRecentBodies('first', { requestBody: 'a'.repeat(RECENT_BODY_MAX_BYTES - 10), responseBody: null })
    storeRecentBodies('second', { requestBody: 'b'.repeat(20), responseBody: null })

    expect(getRecentBodies('first')).toBeNull()
    expect(getRecentBodies('second')?.requestBody).toBe('b'.repeat(20))
  })

  it('evicts a specific request body pair', () => {
    storeRecentBodies('first', { requestBody: 'secret', responseBody: null })
    storeRecentBodies('second', { requestBody: 'keep', responseBody: null })

    deleteRecentBodies('first')

    expect(getRecentBodies('first')).toBeNull()
    expect(getRecentBodies('second')?.requestBody).toBe('keep')
  })
})
