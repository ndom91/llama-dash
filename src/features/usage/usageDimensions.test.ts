import { describe, expect, it } from 'vitest'
import type { ApiUsageBreakdownRow } from '../../lib/api'
import { usageRowLabel, usageRowRequestsSearch } from './usageDimensions'

function row(value: string | null, label: string | null = null): ApiUsageBreakdownRow {
  return {
    value,
    label,
    requests: 1,
    errors: 0,
    promptTokens: 1,
    completionTokens: 1,
    totalTokens: 2,
    avgGenTokPerSec: null,
  }
}

describe('usage row links', () => {
  it('maps status classes onto the Requests ok/err filter', () => {
    expect(usageRowRequestsSearch('status', row('2xx'))).toEqual({ status: 'ok' })
    expect(usageRowRequestsSearch('status', row('3xx'))).toEqual({ status: 'ok' })
    expect(usageRowRequestsSearch('status', row('5xx'))).toEqual({ status: 'err' })
    expect(usageRowRequestsSearch('status', row('error'))).toBeNull()
  })

  it('maps routing actions onto routed/unrouted', () => {
    expect(usageRowRequestsSearch('routing', row('rewrite_model'))).toEqual({ routing: 'routed' })
    expect(usageRowRequestsSearch('routing', row(null))).toEqual({ routing: 'unrouted' })
  })

  it('links hosts including the no-host filter', () => {
    expect(usageRowRequestsSearch('host', row('10.0.0.2'))).toEqual({ host: '10.0.0.2' })
    expect(usageRowRequestsSearch('host', row(null))).toEqual({ host: '__none__' })
  })

  it('links keys by name and skips deleted or keyless rows', () => {
    expect(usageRowRequestsSearch('key', row('k1', 'laptop'))).toEqual({ key: 'key:laptop' })
    expect(usageRowRequestsSearch('key', row('k1'))).toBeNull()
    expect(usageRowRequestsSearch('key', row(null))).toBeNull()
  })

  it('links text dimensions only when attributed', () => {
    expect(usageRowRequestsSearch('client', row('relic'))).toEqual({ client: 'relic' })
    expect(usageRowRequestsSearch('session', row('s-1'))).toEqual({ session: 's-1' })
    expect(usageRowRequestsSearch('endUser', row(null))).toBeNull()
    expect(usageRowRequestsSearch('model', row('m'))).toEqual({ model: 'm' })
  })
})

describe('usage row labels', () => {
  it('uses key names, null labels and folded counts', () => {
    expect(usageRowLabel('key', row('abcdef123456', 'laptop'))).toBe('laptop')
    expect(usageRowLabel('key', row('abcdef123456'))).toBe('deleted · abcdef12')
    expect(usageRowLabel('key', row(null))).toBe('no key')
    expect(usageRowLabel('client', row(null))).toBe('unattributed')
    expect(usageRowLabel('host', row(null, '3 more'))).toBe('3 more')
  })
})
