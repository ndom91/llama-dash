import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'
import { type ApiRequest, api } from '../lib/api'
import { StatusPill } from './index'

export const Route = createFileRoute('/requests')({ component: Requests })

const PAGE_SIZE = 50

function Requests() {
  const [rows, setRows] = useState<Array<ApiRequest>>([])
  const [cursor, setCursor] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const loadFirst = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.listRequests({ limit: PAGE_SIZE })
      setRows(data.requests)
      setCursor(data.nextCursor)
      setErr(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadFirst()
  }, [loadFirst])

  const loadMore = async () => {
    if (cursor == null || loadingMore) return
    setLoadingMore(true)
    try {
      const data = await api.listRequests({ limit: PAGE_SIZE, cursor })
      setRows((prev) => [...prev, ...data.requests])
      setCursor(data.nextCursor)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setLoadingMore(false)
    }
  }

  return (
    <main className="page-wrap px-4 pb-8 pt-10">
      <div className="mb-6 flex items-end justify-between gap-3">
        <div>
          <p className="island-kicker mb-2">Requests</p>
          <h1 className="m-0 text-2xl font-semibold text-[var(--sea-ink)]">Request log</h1>
          <p className="m-0 mt-1 text-sm text-[var(--sea-ink-soft)]">
            Every call proxied through <code className="rounded bg-black/5 px-1">/v1/*</code>, newest first. Bodies are
            not stored.
          </p>
        </div>
        <button
          type="button"
          onClick={loadFirst}
          disabled={loading}
          className="rounded-full border border-[rgba(23,58,64,0.2)] bg-white/60 px-4 py-2 text-sm font-semibold text-[var(--sea-ink)] transition enabled:hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {err ? (
        <div className="mb-4 rounded-2xl border border-red-300 bg-red-50 p-4 text-sm text-red-700">{err}</div>
      ) : null}

      <div className="island-shell overflow-x-auto rounded-2xl">
        {loading && rows.length === 0 ? (
          <p className="p-5 text-sm text-[var(--sea-ink-soft)]">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="p-5 text-sm text-[var(--sea-ink-soft)]">
            No requests yet. Call <code className="rounded bg-black/5 px-1">/v1/*</code> to populate this view.
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-[var(--sea-ink-soft)]">
              <tr>
                <Th>When</Th>
                <Th>Method</Th>
                <Th>Endpoint</Th>
                <Th>Model</Th>
                <Th>Status</Th>
                <Th className="text-right">Prompt</Th>
                <Th className="text-right">Completion</Th>
                <Th className="text-right">Total</Th>
                <Th className="text-right">Duration</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-[var(--line)]">
                  <Td className="whitespace-nowrap">{new Date(r.startedAt).toLocaleString()}</Td>
                  <Td className="font-mono text-xs">{r.method}</Td>
                  <Td className="font-mono text-xs">{r.endpoint}</Td>
                  <Td className="max-w-[220px] truncate">{r.model ?? '—'}</Td>
                  <Td>
                    <StatusPill code={r.statusCode} streamed={r.streamed} />
                  </Td>
                  <Td className="text-right font-mono text-xs">{r.promptTokens ?? '—'}</Td>
                  <Td className="text-right font-mono text-xs">{r.completionTokens ?? '—'}</Td>
                  <Td className="text-right font-mono text-xs">{r.totalTokens ?? '—'}</Td>
                  <Td className="text-right font-mono text-xs">{r.durationMs} ms</Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {cursor != null ? (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="rounded-full border border-[rgba(23,58,64,0.2)] bg-white/60 px-4 py-2 text-sm font-semibold text-[var(--sea-ink)] transition enabled:hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        </div>
      ) : null}
    </main>
  )
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-4 py-3 font-medium ${className}`}>{children}</th>
}

function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 ${className}`}>{children}</td>
}
