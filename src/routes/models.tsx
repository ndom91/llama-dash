import { createFileRoute } from '@tanstack/react-router'
import { Power, PowerOff, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { StatusDot, stateTone } from '../components/StatusDot'
import { TopBar } from '../components/TopBar'
import { api, type ApiModel } from '../lib/api'
import { useLiveData } from '../lib/live-data'

export const Route = createFileRoute('/models')({ component: Models })

function Models() {
  const { models, err, refresh } = useLiveData()
  const [unloadingId, setUnloadingId] = useState<string | null>(null)
  const [unloadingAll, setUnloadingAll] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const hasRunning = models?.some((m) => m.running) ?? false

  const doRefresh = async () => {
    setRefreshing(true)
    await refresh()
    setRefreshing(false)
  }

  const onUnload = async (id: string) => {
    setUnloadingId(id)
    try {
      await api.unloadModel(id)
      await refresh()
    } finally {
      setUnloadingId(null)
    }
  }

  const onUnloadAll = async () => {
    setUnloadingAll(true)
    try {
      await api.unloadAll()
      await refresh()
    } finally {
      setUnloadingAll(false)
    }
  }

  return (
    <div className="main-col">
      <TopBar
        actions={
          <>
            <button
              type="button"
              className="btn btn-ghost btn-icon"
              onClick={doRefresh}
              disabled={refreshing}
              title="Refresh"
            >
              <RefreshCw className={`icon-14${refreshing ? ' animate-spin' : ''}`} strokeWidth={1.75} />
            </button>
            <button
              type="button"
              className="btn btn-danger-ghost btn-xs"
              onClick={onUnloadAll}
              disabled={!hasRunning || unloadingAll}
              title="Unload every running model"
            >
              <PowerOff className="icon-btn-12" strokeWidth={2} />
              {unloadingAll ? 'unloading…' : 'unload all'}
            </button>
          </>
        }
      />
      <div className="content">
        <div className="page">
          <h1 className="page-title">Models</h1>
          <p className="page-sub">
            configured in <code>config.yaml</code>, joined with <code>/running</code>
          </p>

          {err ? <div className="err-banner">{err}</div> : null}

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
                    <ModelRow key={m.id} model={m} unloading={unloadingId === m.id} onUnload={() => onUnload(m.id)} />
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

function ModelRow({ model, unloading, onUnload }: { model: ApiModel; unloading: boolean; onUnload: () => void }) {
  const tone = stateTone(model.state, model.running)
  return (
    <tr>
      <td>
        <StatusDot tone={tone} live={model.running} />
      </td>
      <td className="mono">{model.id}</td>
      <td>{model.name}</td>
      <td>
        <span className="mono" style={{ fontSize: 11, color: 'var(--fg-dim)' }}>
          {model.kind}
        </span>
      </td>
      <td>
        <span className={`state-label state-label-${tone}`}>{model.state}</span>
      </td>
      <td className="num">
        {model.kind === 'local' ? (
          <button
            type="button"
            className="btn btn-xs"
            onClick={onUnload}
            disabled={!model.running || unloading}
            title={model.running ? 'Unload this model' : 'Not loaded'}
          >
            <Power className="icon-btn-12" strokeWidth={2} />
            {unloading ? 'unloading…' : 'unload'}
          </button>
        ) : (
          <span className="mono dim" style={{ fontSize: 11 }}>
            —
          </span>
        )}
      </td>
    </tr>
  )
}
