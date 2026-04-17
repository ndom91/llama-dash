import { createFileRoute } from '@tanstack/react-router'
import { Play, Power, PowerOff, RefreshCw } from 'lucide-react'
import { useMemo } from 'react'
import { PageHeader } from '../components/PageHeader'
import { StatusDot, stateTone } from '../components/StatusDot'
import { Tooltip } from '../components/Tooltip'
import { TopBar } from '../components/TopBar'
import type { ApiModel } from '../lib/api'
import { useLoadModel, useModels, useUnloadAll, useUnloadModel } from '../lib/queries'

export const Route = createFileRoute('/models')({ component: Models })

function Models() {
  const { data: models, error, isRefetching, refetch } = useModels()
  const loadModel = useLoadModel()
  const unloadModel = useUnloadModel()
  const unloadAll = useUnloadAll()

  const hasRunning = useMemo(() => models?.some((m) => m.running) ?? false, [models])

  return (
    <div className="main-col">
      <TopBar
        actions={
          <Tooltip label="Refresh">
            <button
              type="button"
              className="btn btn-ghost btn-icon"
              onClick={() => refetch()}
              disabled={isRefetching}
              aria-label="Refresh models"
            >
              <RefreshCw
                className={`icon-14${isRefetching ? ' animate-spin' : ''}`}
                strokeWidth={1.75}
                aria-hidden="true"
              />
            </button>
          </Tooltip>
        }
      />
      <div className="content">
        <div className="page">
          <PageHeader
            title="Models"
            subtitle={
              <>
                configured in <code translate="no">config.yaml</code>, joined with <code translate="no">/running</code>
              </>
            }
            action={
              <button
                type="button"
                className="btn btn-danger-ghost btn-xs"
                onClick={() => unloadAll.mutate()}
                disabled={!hasRunning || unloadAll.isPending}
                title="Unload every running model"
              >
                <PowerOff className="icon-btn-12" strokeWidth={2} aria-hidden="true" />
                {unloadAll.isPending ? 'unloading…' : 'unload all'}
              </button>
            }
          />

          {error ? <div className="err-banner">{error.message}</div> : null}

          <section className="panel">
            {models == null ? (
              <div className="empty-state">loading…</div>
            ) : models.length === 0 ? (
              <div className="empty-state">no models configured in llama-swap.</div>
            ) : (
              <table className="dtable">
                <thead>
                  <tr>
                    <th style={{ width: 18 }} aria-label="state" />
                    <th className="mono" style={{ minWidth: 180 }}>
                      id
                    </th>
                    <th>name</th>
                    <th style={{ width: 72 }}>kind</th>
                    <th style={{ width: 130 }}>state</th>
                    <th style={{ width: 110 }} className="num">
                      action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {models.map((m) => (
                    <ModelRow
                      key={m.id}
                      model={m}
                      loading={loadModel.isPending && loadModel.variables === m.id}
                      unloading={unloadModel.isPending && unloadModel.variables === m.id}
                      onLoad={() => loadModel.mutate(m.id)}
                      onUnload={() => unloadModel.mutate(m.id)}
                    />
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

function ModelRow({
  model,
  loading,
  unloading,
  onLoad,
  onUnload,
}: {
  model: ApiModel
  loading: boolean
  unloading: boolean
  onLoad: () => void
  onUnload: () => void
}) {
  const tone = stateTone(model.state, model.running)
  return (
    <tr>
      <td>
        <StatusDot tone={tone} live={model.running} />
      </td>
      <td className="mono" translate="no">
        {model.id}
      </td>
      <td>{model.name}</td>
      <td>
        <span className="mono" style={{ fontSize: 11, color: 'var(--fg-dim)' }}>
          {model.kind}
        </span>
      </td>
      <td>
        {model.kind === 'local' ? <span className={`state-label state-label-${tone}`}>{model.state}</span> : null}
      </td>
      <td className="num">
        {model.kind === 'local' ? (
          model.running ? (
            <button
              type="button"
              className="btn btn-xs"
              onClick={onUnload}
              disabled={unloading}
              title={`Unload ${model.id}`}
            >
              <Power className="icon-btn-12" strokeWidth={2} aria-hidden="true" />
              {unloading ? 'unloading…' : 'unload'}
            </button>
          ) : (
            <button type="button" className="btn btn-xs" onClick={onLoad} disabled={loading} title={`Load ${model.id}`}>
              <Play className="icon-btn-12" strokeWidth={2} aria-hidden="true" />
              {loading ? 'loading…' : 'load'}
            </button>
          )
        ) : (
          <span className="mono dim" style={{ fontSize: 11 }}>
            —
          </span>
        )}
      </td>
    </tr>
  )
}
