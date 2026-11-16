import { describe, expect, it } from 'vitest'
import { shouldLoadNextRequestPage } from './requestPagination'

describe('automatic request pagination', () => {
  const nearEnd = {
    lastIndex: 5,
    rowCount: 6,
    hasNextPage: true,
    isFetching: false,
    isFetchNextPageError: false,
    hasLocalFilters: false,
  }

  it('does not scan more pages when local filters leave a sparse viewport', () => {
    expect(shouldLoadNextRequestPage({ ...nearEnd, hasLocalFilters: true })).toBe(false)
    expect(shouldLoadNextRequestPage(nearEnd)).toBe(true)
  })

  it('does not automatically retry a failed page or fetch while busy or exhausted', () => {
    expect(shouldLoadNextRequestPage({ ...nearEnd, isFetchNextPageError: true })).toBe(false)
    expect(shouldLoadNextRequestPage({ ...nearEnd, isFetching: true })).toBe(false)
    expect(shouldLoadNextRequestPage({ ...nearEnd, hasNextPage: false })).toBe(false)
    expect(shouldLoadNextRequestPage({ ...nearEnd, rowCount: 100 })).toBe(false)
  })
})
