import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const DAY_MS = 24 * 60 * 60 * 1000

type FakeRequest = {
  id: string
  request_class: 'inference' | 'mcp_relay'
  status_code: number
  error: string | null
  started_at: number
  request_headers: string | null
  request_body: string | null
  response_headers: string | null
  response_body: string | null
}

const settingsMock = vi.hoisted(() => ({
  privacy: {
    requestLogRetentionDays: 30,
    mcpRelaySuccessRetentionDays: 7,
    mcpRelayErrorRetentionDays: 10,
    bodyRetentionDays: 3,
  },
}))

const dbMock = vi.hoisted(() => ({
  rows: [] as FakeRequest[],
  error: null as Error | null,
}))

const recentBodiesMock = vi.hoisted(() => ({
  deleteRecentBodies: vi.fn(),
}))

const rollupMock = vi.hoisted(() => ({
  refreshDailyStats: vi.fn(),
  backfillDays: vi.fn(() => [] as string[]),
  backfillDay: vi.fn(),
  finishBackfill: vi.fn(),
  markPrunedBefore: vi.fn(),
}))

vi.mock('./usage-rollup.ts', () => ({
  ...rollupMock,
}))

vi.mock('./admin/settings.ts', () => ({
  getPrivacySettings: () => settingsMock.privacy,
}))

vi.mock('./proxy/recent-bodies.ts', () => ({
  deleteRecentBodies: recentBodiesMock.deleteRecentBodies,
}))

vi.mock('./db/index.ts', () => ({
  sqliteDb: {
    transaction: (fn: () => unknown) => fn,
    prepare: (sql: string) => ({
      all: (...params: number[]) => {
        const inferenceAllowed = params.length === 4
        const [inferenceCutoff, mcpSuccessCutoff, mcpErrorCutoff, bodyCutoff] = inferenceAllowed
          ? params
          : [Number.NEGATIVE_INFINITY, ...params]
        if (dbMock.error) throw dbMock.error
        if (!sql.includes('select id')) return []
        return dbMock.rows
          .filter(
            (row) =>
              (row.request_class === 'inference' && row.started_at < inferenceCutoff) ||
              (row.request_class === 'mcp_relay' &&
                row.status_code < 400 &&
                row.error == null &&
                row.started_at < mcpSuccessCutoff) ||
              (row.request_class === 'mcp_relay' &&
                (row.status_code >= 400 || row.error != null) &&
                row.started_at < mcpErrorCutoff) ||
              (row.started_at < bodyCutoff && hasBodyText(row)),
          )
          .map((row) => ({ id: row.id }))
      },
      run: (cutoff: number) => {
        if (sql.includes("request_class = 'inference'")) {
          return deleteRows((row) => row.request_class === 'inference' && row.started_at < cutoff)
        }
        if (sql.includes('status_code < 400')) {
          return deleteRows(
            (row) =>
              row.request_class === 'mcp_relay' &&
              row.status_code < 400 &&
              row.error == null &&
              row.started_at < cutoff,
          )
        }
        if (sql.includes('status_code >= 400')) {
          return deleteRows(
            (row) =>
              row.request_class === 'mcp_relay' &&
              (row.status_code >= 400 || row.error != null) &&
              row.started_at < cutoff,
          )
        }
        if (sql.includes('set request_headers = null')) {
          let changes = 0
          for (const row of dbMock.rows) {
            if (row.started_at >= cutoff || !hasBodyText(row)) continue
            row.request_headers = null
            row.request_body = null
            row.response_headers = null
            row.response_body = null
            changes++
          }
          return { changes }
        }
        return { changes: 0 }
      },
    }),
    pragma: vi.fn(),
    exec: vi.fn(),
  },
}))

let maintenance: typeof import('./request-log-maintenance')

function hasBodyText(row: FakeRequest) {
  return (
    row.request_headers != null || row.request_body != null || row.response_headers != null || row.response_body != null
  )
}

function deleteRows(predicate: (row: FakeRequest) => boolean) {
  const before = dbMock.rows.length
  dbMock.rows = dbMock.rows.filter((row) => !predicate(row))
  return { changes: before - dbMock.rows.length }
}

function row(id: string, overrides: Partial<FakeRequest>): FakeRequest {
  return {
    id,
    request_class: 'inference',
    status_code: 200,
    error: null,
    started_at: 0,
    request_headers: null,
    request_body: null,
    response_headers: null,
    response_body: null,
    ...overrides,
  }
}

describe('request log maintenance', () => {
  beforeEach(async () => {
    vi.resetModules()
    vi.useFakeTimers()
    vi.setSystemTime(100 * DAY_MS)
    vi.clearAllMocks()
    maintenance = await import('./request-log-maintenance')
    settingsMock.privacy = {
      requestLogRetentionDays: 30,
      mcpRelaySuccessRetentionDays: 7,
      mcpRelayErrorRetentionDays: 10,
      bodyRetentionDays: 3,
    }
    dbMock.rows = []
    dbMock.error = null
    recentBodiesMock.deleteRecentBodies.mockClear()
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it('prunes rows by class and clears old body text from storage and recent cache', () => {
    const now = 100 * DAY_MS
    maintenance.startRequestLogMaintenance()
    vi.advanceTimersByTime(1)
    dbMock.rows = [
      row('old-inference', { started_at: now - 31 * DAY_MS, request_body: 'deleted-secret' }),
      row('new-inference', { started_at: now - 29 * DAY_MS }),
      row('old-mcp-success', { request_class: 'mcp_relay', started_at: now - 8 * DAY_MS }),
      row('new-mcp-success', { request_class: 'mcp_relay', started_at: now - 6 * DAY_MS }),
      row('old-mcp-error', { request_class: 'mcp_relay', status_code: 500, started_at: now - 11 * DAY_MS }),
      row('old-body', { started_at: now - 4 * DAY_MS, request_body: 'secret', response_headers: '{}' }),
      row('new-body', { started_at: now - 2 * DAY_MS, request_body: 'keep' }),
    ]

    expect(maintenance.pruneRequestLogs(now)).toEqual({
      inferenceDeleted: 1,
      mcpRelaySuccessDeleted: 1,
      mcpRelayErrorDeleted: 1,
      bodiesCleared: 1,
    })

    expect(dbMock.rows.map((r) => r.id)).toEqual(['new-inference', 'new-mcp-success', 'old-body', 'new-body'])
    expect(dbMock.rows.find((r) => r.id === 'old-body')).toMatchObject({
      request_body: null,
      response_headers: null,
    })
    expect(dbMock.rows.find((r) => r.id === 'new-body')?.request_body).toBe('keep')
    expect(recentBodiesMock.deleteRecentBodies).toHaveBeenCalledWith('old-inference')
    expect(recentBodiesMock.deleteRecentBodies).toHaveBeenCalledWith('old-mcp-success')
    expect(recentBodiesMock.deleteRecentBodies).toHaveBeenCalledWith('old-mcp-error')
    expect(recentBodiesMock.deleteRecentBodies).toHaveBeenCalledWith('old-body')
    expect(recentBodiesMock.deleteRecentBodies).toHaveBeenCalledTimes(4)
  })

  it('uses one cutoff even if the clock crosses a day boundary during rollup', () => {
    maintenance.startRequestLogMaintenance()
    vi.advanceTimersByTime(1)
    const boundary = 70 * DAY_MS
    const now = boundary + 30 * DAY_MS - 1
    vi.setSystemTime(now)
    dbMock.rows = [row('boundary', { started_at: boundary })]
    rollupMock.refreshDailyStats.mockImplementationOnce(() => {
      vi.setSystemTime(now + 2)
    })
    expect(maintenance.pruneRequestLogs().inferenceDeleted).toBe(0)
    expect(rollupMock.markPrunedBefore).toHaveBeenCalledWith(expect.anything(), now, 30)
    expect(dbMock.rows.map((r) => r.id)).toEqual(['boundary'])
  })

  it('logs scheduled counts and timings, and still reports failures', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const now = 100 * DAY_MS
      vi.setSystemTime(now)
      dbMock.rows = [
        row('old-body', { started_at: now - 4 * DAY_MS, request_body: 'secret' }),
        row('old-inference', { started_at: now - 31 * DAY_MS, request_body: 'secret' }),
        row('old-relay', { request_class: 'mcp_relay', started_at: now - 8 * DAY_MS }),
      ]
      expect(() => maintenance.pruneRequestLogs(now)).toThrow('backfill is not complete')
      expect(dbMock.rows.map((r) => r.id)).toEqual(['old-body', 'old-inference'])
      expect(dbMock.rows.every((r) => r.request_body === null)).toBe(true)
      rollupMock.backfillDays.mockImplementationOnce(() => {
        throw new Error('backfill failure')
      })
      rollupMock.backfillDays.mockReturnValueOnce(['2026-01-01', '2026-01-02'])
      rollupMock.backfillDays.mockReturnValueOnce(['2026-01-02'])
      rollupMock.backfillDay.mockImplementationOnce(() => {})
      rollupMock.backfillDay.mockImplementationOnce(() => {
        throw new Error('day failure')
      })
      maintenance.startRequestLogMaintenance()
      vi.advanceTimersByTime(60_000)
      expect(info).not.toHaveBeenCalled()
      expect(() => maintenance.pruneRequestLogs(now)).toThrow('backfill is not complete')
      vi.advanceTimersByTime(60 * 60_000)
      expect(info).toHaveBeenCalledWith('[request-log-maintenance] prune complete', {
        durationMs: expect.any(Number),
        selectionMs: expect.any(Number),
        candidateRows: 1,
        inferenceDeleted: 1,
        mcpRelaySuccessDeleted: 0,
        mcpRelayErrorDeleted: 0,
        bodiesCleared: 0,
      })
      expect(JSON.stringify(info.mock.calls)).not.toContain('secret')

      const error = new Error('database failure')
      dbMock.error = error
      vi.advanceTimersByTime(60 * 60_000)
      expect(warn).toHaveBeenCalledWith('Failed to prune request logs', error)
      expect(info).toHaveBeenCalledTimes(1)

      // A failed usage rollup skips pruning, so no unrolled rows are deleted.
      const rollupError = new Error('rollup failure')
      rollupMock.refreshDailyStats.mockImplementationOnce(() => {
        throw rollupError
      })
      dbMock.error = null
      vi.advanceTimersByTime(60 * 60_000)
      expect(warn).toHaveBeenCalledWith('Failed to prune request logs', rollupError)
      expect(rollupMock.backfillDays).toHaveBeenCalledTimes(3)
      expect(rollupMock.backfillDay.mock.calls.map(([, day]) => day)).toEqual([
        '2026-01-01',
        '2026-01-02',
        '2026-01-02',
      ])
    } finally {
      vi.clearAllTimers()
      vi.useRealTimers()
      info.mockRestore()
      warn.mockRestore()
    }
  })
})
