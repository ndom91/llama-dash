import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { api, type ApiHealth, type ApiModel, type ApiRequest } from '../lib/api'

export const Route = createFileRoute('/')({ component: Dashboard })

function Dashboard() {
  const [health, setHealth] = useState<ApiHealth | null>(null)
  const [models, setModels] = useState<Array<ApiModel> | null>(null)
  const [requests, setRequests] = useState<Array<ApiRequest> | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      api.health(),
      api.listModels(),
      api.listRequests({ limit: 10 }),
    ])
      .then(([h, m, r]) => {
        if (cancelled) return
        setHealth(h)
        setModels(m.models)
        setRequests(r.requests)
      })
      .catch((e: Error) => !cancelled && setErr(e.message))
    return () => {
      cancelled = true
    }
  }, [])

  const running = models?.filter((m) => m.running) ?? []

  return (
    <main className="page-wrap px-4 pb-8 pt-10">
      <section className="island-shell rise-in rounded-[2rem] px-6 py-10 sm:px-10">
        <p className="island-kicker mb-3">Dashboard</p>
        <h1 className="display-title mb-3 max-w-3xl text-4xl font-bold tracking-tight text-[var(--sea-ink)] sm:text-5xl">
          llama-dash
        </h1>
        <p className="mb-0 max-w-2xl text-base text-[var(--sea-ink-soft)]">
          Sidecar for llama-swap: pass-through OpenAI/Anthropic proxy with
          request logging and model management.
        </p>
      </section>

      {err ? (
        <section className="island-shell mt-8 rounded-2xl border-red-300 p-6 text-red-700">
          <p className="m-0 text-sm">Failed to load dashboard: {err}</p>
        </section>
      ) : null}

      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="llama-swap"
          value={
            health == null
              ? '…'
              : health.upstream.reachable
                ? `v${health.upstream.version}`
                : 'unreachable'
          }
          sub={
            health?.upstream.reachable
              ? `commit ${health.upstream.commit.slice(0, 7)}`
              : health?.upstream.reachable === false
                ? health.upstream.error
                : ' '
          }
        />
        <StatCard
          label="Running models"
          value={models == null ? '…' : String(running.length)}
          sub={
            running.length > 0
              ? running.map((m) => m.id).join(', ')
              : models == null
                ? ' '
                : 'none loaded'
          }
        />
        <StatCard
          label="Configured models"
          value={models == null ? '…' : String(models.length)}
          sub="from /v1/models"
        />
      </section>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="m-0 text-base font-semibold text-[var(--sea-ink)]">
            Recent requests
          </h2>
          <Link to="/requests" className="nav-link">
            View all →
          </Link>
        </div>
        <div className="island-shell overflow-x-auto rounded-2xl">
          <RequestsTable requests={requests} />
        </div>
      </section>
    </main>
  )
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string
  value: string
  sub: string
}) {
  return (
    <article className="island-shell rise-in rounded-2xl p-5">
      <p className="island-kicker mb-2">{label}</p>
      <p className="m-0 text-2xl font-semibold text-[var(--sea-ink)]">{value}</p>
      <p className="m-0 mt-1 truncate text-xs text-[var(--sea-ink-soft)]">{sub}</p>
    </article>
  )
}

function RequestsTable({ requests }: { requests: Array<ApiRequest> | null }) {
  if (requests == null) {
    return <p className="p-5 text-sm text-[var(--sea-ink-soft)]">Loading…</p>
  }
  if (requests.length === 0) {
    return (
      <p className="p-5 text-sm text-[var(--sea-ink-soft)]">
        No requests yet — hit{' '}
        <code className="rounded bg-black/5 px-1">/v1/*</code> and they'll show up here.
      </p>
    )
  }
  return (
    <table className="w-full text-left text-sm">
      <thead className="text-xs text-[var(--sea-ink-soft)]">
        <tr>
          <Th>Time</Th>
          <Th>Endpoint</Th>
          <Th>Model</Th>
          <Th>Status</Th>
          <Th className="text-right">Tokens</Th>
          <Th className="text-right">Duration</Th>
        </tr>
      </thead>
      <tbody>
        {requests.map((r) => (
          <tr key={r.id} className="border-t border-[var(--line)]">
            <Td>{new Date(r.startedAt).toLocaleTimeString()}</Td>
            <Td className="font-mono text-xs">{r.endpoint}</Td>
            <Td className="truncate">{r.model ?? '—'}</Td>
            <Td>
              <StatusPill code={r.statusCode} streamed={r.streamed} />
            </Td>
            <Td className="text-right font-mono text-xs">
              {r.totalTokens != null
                ? `${r.promptTokens ?? 0} + ${r.completionTokens ?? 0} = ${r.totalTokens}`
                : '—'}
            </Td>
            <Td className="text-right font-mono text-xs">{r.durationMs} ms</Td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-4 py-3 font-medium ${className}`}>{children}</th>
}

function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 ${className}`}>{children}</td>
}

export function StatusPill({ code, streamed }: { code: number; streamed: boolean }) {
  const ok = code >= 200 && code < 300
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
        ok
          ? 'bg-emerald-500/15 text-emerald-700'
          : 'bg-red-500/15 text-red-700'
      }`}
    >
      {code}
      {streamed ? <span className="opacity-60">· SSE</span> : null}
    </span>
  )
}
