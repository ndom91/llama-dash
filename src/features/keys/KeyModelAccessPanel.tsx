import { Link } from '@tanstack/react-router'
import { useMemo } from 'react'
import { cn } from '../../lib/cn'
import type { ApiKeyModelBreakdown, ModelAccessMode } from '../../lib/api'
import { useModels, useUpdateKeyModels } from '../../lib/queries'

type Props = {
  keyId: string
  modelAccessMode: ModelAccessMode
  allowedModels: Array<string>
  breakdown: Array<ApiKeyModelBreakdown>
  isRevoked: boolean
}

export function KeyModelAccessPanel({ keyId, modelAccessMode, allowedModels, breakdown, isRevoked }: Props) {
  const { data: allModels } = useModels()
  const updateModels = useUpdateKeyModels()
  const allowAll = modelAccessMode === 'all'
  const breakdownByModel = useMemo(() => {
    const map = new Map<string, ApiKeyModelBreakdown>()
    for (const b of breakdown) {
      if (!b.model) continue
      map.set(b.model, b)
      const bare = b.model.includes('/') ? b.model.split('/').pop() : b.model
      if (bare && bare !== b.model) map.set(bare, b)
    }
    return map
  }, [breakdown])

  const toggleModel = (modelId: string) => {
    if (isRevoked || allowAll) return
    const next = allowedModels.includes(modelId)
      ? allowedModels.filter((m) => m !== modelId)
      : [...allowedModels, modelId]
    updateModels.mutate({ id: keyId, modelAccessMode, allowedModels: next })
  }

  const restrictModels = () => {
    if (isRevoked || !allModels) return
    updateModels.mutate({ id: keyId, modelAccessMode: 'restricted', allowedModels: allModels.map((m) => m.id) })
  }

  const enableAll = () => {
    if (isRevoked) return
    updateModels.mutate({ id: keyId, modelAccessMode: 'all', allowedModels: [] })
  }

  if (!allModels) return null

  const modelIds = new Set(allModels.map((model) => model.id))
  const unavailableModels = allowedModels.filter((modelId) => !modelIds.has(modelId))
  const availableAllowedCount = allowedModels.length - unavailableModels.length

  const removeUnavailableModels = () => {
    if (isRevoked || unavailableModels.length === 0) return
    updateModels.mutate({
      id: keyId,
      modelAccessMode: 'restricted',
      allowedModels: allowedModels.filter((modelId) => modelIds.has(modelId)),
    })
  }

  return (
    <section className="panel detail-stacked-section">
      <div className="panel-head">
        <span className="panel-title text-fg-muted">Model access</span>
        <span className="panel-sub">
          · {allowAll ? 'all models' : `${availableAllowedCount} of ${allModels.length}`}
        </span>
        {!isRevoked ? (
          allowAll ? (
            <button
              type="button"
              className="btn btn-ghost btn-xs ml-auto"
              onClick={restrictModels}
              disabled={updateModels.isPending}
            >
              restrict
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-ghost btn-xs ml-auto"
              onClick={enableAll}
              disabled={updateModels.isPending}
            >
              allow all
            </button>
          )
        ) : null}
      </div>
      <table className="dtable">
        <thead>
          <tr>
            <th style={{ width: 32 }} aria-label="enabled" />
            <th className="mono">model</th>
            <th className="num" style={{ width: 100 }}>
              requests
            </th>
            <th className="num" style={{ width: 100 }}>
              tokens
            </th>
            <th className="num" style={{ width: 80 }}>
              errors
            </th>
          </tr>
        </thead>
        <tbody>
          {allModels.map((m) => {
            const enabled = allowAll || allowedModels.includes(m.id)
            const canToggle = !allowAll && !isRevoked
            const stats = breakdownByModel.get(m.id)
            return (
              <tr key={m.id} className={cn(!enabled && 'opacity-40')}>
                <td>
                  <input
                    type="checkbox"
                    checked={enabled}
                    disabled={!canToggle}
                    onChange={() => toggleModel(m.id)}
                    className="accent-accent size-3.5 cursor-pointer disabled:cursor-default"
                  />
                </td>
                <td className="mono" translate="no">
                  <Link to="/models/$id" params={{ id: m.id }} className={cn(!enabled && 'text-fg-dim')}>
                    {m.id}
                  </Link>
                </td>
                <td className="num">{stats?.requestCount.toLocaleString() ?? '—'}</td>
                <td className="num">{stats?.totalTokens.toLocaleString() ?? '—'}</td>
                <td className="num">
                  {stats && stats.errorCount > 0 ? <span className="text-err">{stats.errorCount}</span> : '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {!allowAll && unavailableModels.length > 0 ? (
        <div className="border-t border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-warn">Unavailable models · {unavailableModels.length}</span>
            {!isRevoked ? (
              <button
                type="button"
                className="btn btn-ghost btn-xs ml-auto"
                onClick={removeUnavailableModels}
                disabled={updateModels.isPending}
              >
                remove unavailable
              </button>
            ) : null}
          </div>
          <p className="mt-1 font-mono text-[11px] text-fg-faint">
            These models are no longer configured. Removing them keeps this key restricted and does not allow other
            models.
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {unavailableModels.map((modelId) => (
              <span
                key={modelId}
                className="rounded-sm border border-warn/35 px-1.5 py-0.5 font-mono text-[11px] text-warn"
              >
                {modelId}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  )
}
