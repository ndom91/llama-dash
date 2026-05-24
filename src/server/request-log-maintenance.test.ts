import { beforeEach, describe, expect, it, vi } from 'vitest'

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
}))

const recentBodiesMock = vi.hoisted(() => ({
  deleteRecentBodies: vi.fn(),
}))

vi.mock('./admin/settings.ts', () => ({
  getPrivacySettings: () => settingsMock.privacy,
}))

vi.mock('./proxy/recent-bodies.ts', () => ({
  deleteRecentBodies: recentBodiesMock.deleteRecentBodies,
}))

vi.mock('./db/index.ts', () => ({
  sqliteDb: {
    prepare: (sql: string) => ({
      all: (inferenceCutoff: number, mcpSuccessCutoff: number, mcpErrorCutoff: number, bodyCutoff: number) => {
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

import { pruneRequestLogs } from './request-log-maintenance'

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
  beforeEach(() => {
    settingsMock.privacy = {
      requestLogRetentionDays: 30,
      mcpRelaySuccessRetentionDays: 7,
      mcpRelayErrorRetentionDays: 10,
      bodyRetentionDays: 3,
    }
    dbMock.rows = []
    recentBodiesMock.deleteRecentBodies.mockClear()
  })

  it('prunes rows by class and clears old body text from storage and recent cache', () => {
    const now = 100 * DAY_MS
    dbMock.rows = [
      row('old-inference', { started_at: now - 31 * DAY_MS, request_body: 'deleted-secret' }),
      row('new-inference', { started_at: now - 29 * DAY_MS }),
      row('old-mcp-success', { request_class: 'mcp_relay', started_at: now - 8 * DAY_MS }),
      row('new-mcp-success', { request_class: 'mcp_relay', started_at: now - 6 * DAY_MS }),
      row('old-mcp-error', { request_class: 'mcp_relay', status_code: 500, started_at: now - 11 * DAY_MS }),
      row('old-body', { started_at: now - 4 * DAY_MS, request_body: 'secret', response_headers: '{}' }),
      row('new-body', { started_at: now - 2 * DAY_MS, request_body: 'keep' }),
    ]

    expect(pruneRequestLogs(now)).toEqual({
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
})
