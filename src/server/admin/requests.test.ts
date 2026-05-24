import { beforeEach, describe, expect, it, vi } from 'vitest'

const dbMock = vi.hoisted(() => ({
  preparedSql: [] as string[],
}))

vi.mock('../db/index.ts', () => {
  const schema = {
    requests: {
      id: 'id',
      requestClass: 'requestClass',
    },
  }
  return {
    db: {
      select: () => ({
        from: () => ({
          where: () => ({
            orderBy: () => ({
              limit: () => ({ get: () => undefined, all: () => [] }),
            }),
          }),
        }),
      }),
    },
    schema,
    sqliteDb: {
      prepare: (sql: string) => {
        dbMock.preparedSql.push(sql)
        return {
          get: (...args: unknown[]) => preparedGet(sql, args),
          all: (...args: unknown[]) => preparedAll(sql, args),
        }
      },
    },
  }
})

import { getRequestHistogram, getRequestStats } from './requests'

function preparedGet(sql: string, _args: unknown[]) {
  if (sql.includes('count(*) as total')) {
    return { total: 1, errors: 0, last_minute_total: 1, last_minute_tokens: 10 }
  }
  if (sql.includes('duration_ms as durationMs')) return { durationMs: 123 }
  return undefined
}

function preparedAll(sql: string, args: unknown[]) {
  const bucketMs = typeof args[0] === 'number' ? args[0] : 60_000
  const bucket = Math.floor((Date.now() - 1_000) / bucketMs)
  if (sql.includes('avg(duration_ms)')) return [{ bucket, reqs: 1, toks: 10, latency: 123, errs: 0 }]
  if (sql.includes('count(*) as total')) return [{ bucket, total: 1, errors: 0 }]
  return []
}

describe('request admin metrics', () => {
  beforeEach(() => {
    dbMock.preparedSql = []
  })

  it('filters MCP relay rows out of default stats queries', () => {
    const stats = getRequestStats()

    expect(stats.reqPerSec).toBe(1 / 60)
    expect(dbMock.preparedSql).toHaveLength(3)
    for (const sql of dbMock.preparedSql) {
      expect(sql).toContain("request_class = 'inference'")
    }
  })

  it('filters MCP relay rows out of default histogram queries', () => {
    const buckets = getRequestHistogram()

    expect(buckets.some((bucket) => bucket.total === 1)).toBe(true)
    expect(dbMock.preparedSql).toHaveLength(1)
    expect(dbMock.preparedSql[0]).toContain("request_class = 'inference'")
  })
})
