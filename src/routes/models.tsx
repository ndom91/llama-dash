import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'
import { api, type ApiModel } from '../lib/api'

export const Route = createFileRoute('/models')({ component: Models })

function Models() {
  const [models, setModels] = useState<Array<ApiModel> | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [unloadingId, setUnloadingId] = useState<string | null>(null)
  const [unloadingAll, setUnloadingAll] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const data = await api.listModels()
      setModels(data.models)
      setErr(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    }
  }, [])

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, 5000)
    return () => clearInterval(id)
  }, [refresh])

  const onUnload = async (id: string) => {
    setUnloadingId(id)
    try {
      await api.unloadModel(id)
      await refresh()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setUnloadingId(null)
    }
  }

  const onUnloadAll = async () => {
    setUnloadingAll(true)
    try {
      await api.unloadAll()
      await refresh()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setUnloadingAll(false)
    }
  }

  const hasRunning = models?.some((m) => m.running) ?? false

  return (
    <main className="page-wrap px-4 pb-8 pt-10">
      <div className="mb-6 flex items-end justify-between gap-3">
        <div>
          <p className="island-kicker mb-2">Models</p>
          <h1 className="m-0 text-2xl font-semibold text-[var(--sea-ink)]">
            Configured models
          </h1>
          <p className="m-0 mt-1 text-sm text-[var(--sea-ink-soft)]">
            From <code className="rounded bg-black/5 px-1">/v1/models</code>,
            joined with <code className="rounded bg-black/5 px-1">/running</code>{' '}
            to show which are currently loaded.
          </p>
        </div>
        <button
          type="button"
          onClick={onUnloadAll}
          disabled={!hasRunning || unloadingAll}
          className="rounded-full border border-[rgba(23,58,64,0.2)] bg-white/60 px-4 py-2 text-sm font-semibold text-[var(--sea-ink)] transition enabled:hover:-translate-y-0.5 enabled:hover:border-[rgba(23,58,64,0.35)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {unloadingAll ? 'Unloading…' : 'Unload all'}
        </button>
      </div>

      {err ? (
        <div className="mb-4 rounded-2xl border border-red-300 bg-red-50 p-4 text-sm text-red-700">
          {err}
        </div>
      ) : null}

      <div className="island-shell overflow-x-auto rounded-2xl">
        {models == null ? (
          <p className="p-5 text-sm text-[var(--sea-ink-soft)]">Loading…</p>
        ) : models.length === 0 ? (
          <p className="p-5 text-sm text-[var(--sea-ink-soft)]">
            No models configured in llama-swap.
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-[var(--sea-ink-soft)]">
              <tr>
                <Th>ID</Th>
                <Th>Name</Th>
                <Th>Kind</Th>
                <Th>State</Th>
                <Th className="text-right">Action</Th>
              </tr>
            </thead>
            <tbody>
              {models.map((m) => (
                <tr key={m.id} className="border-t border-[var(--line)]">
                  <Td className="font-mono text-xs">{m.id}</Td>
                  <Td>{m.name}</Td>
                  <Td>
                    <KindPill kind={m.kind} />
                  </Td>
                  <Td>
                    <StatePill state={m.state} running={m.running} />
                  </Td>
                  <Td className="text-right">
                    {m.kind === 'local' ? (
                      <button
                        type="button"
                        onClick={() => onUnload(m.id)}
                        disabled={!m.running || unloadingId === m.id}
                        className="rounded-full border border-[rgba(23,58,64,0.2)] bg-white/60 px-3 py-1.5 text-xs font-semibold text-[var(--sea-ink)] transition enabled:hover:-translate-y-0.5 enabled:hover:border-[rgba(23,58,64,0.35)] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {unloadingId === m.id ? 'Unloading…' : 'Unload'}
                      </button>
                    ) : (
                      <span className="text-xs text-[var(--sea-ink-soft)]">peer</span>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  )
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-4 py-3 font-medium ${className}`}>{children}</th>
}

function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 ${className}`}>{children}</td>
}

function KindPill({ kind }: { kind: 'local' | 'peer' }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
        kind === 'local'
          ? 'bg-[rgba(79,184,178,0.15)] text-[var(--lagoon-deep)]'
          : 'bg-[rgba(47,106,74,0.12)] text-[var(--sea-ink)]'
      }`}
    >
      {kind}
    </span>
  )
}

function StatePill({ state, running }: { state: string; running: boolean }) {
  if (running) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-700">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
        {state}
      </span>
    )
  }
  return (
    <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs font-medium text-[var(--sea-ink-soft)]">
      {state}
    </span>
  )
}
