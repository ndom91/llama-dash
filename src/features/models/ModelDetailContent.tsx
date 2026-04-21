import { Link } from '@tanstack/react-router'
import { Play, Power } from 'lucide-react'
import { useMemo } from 'react'
import { PageHeader } from '../../components/PageHeader'
import { StatusDot, stateTone } from '../../components/StatusDot'
import type { ApiModelDetail } from '../../lib/api'
import { useLoadModel, useUnloadModel } from '../../lib/queries'
import { ModelEventsPanel } from './ModelEventsPanel'
import { ModelRequestsPanel } from './ModelRequestsPanel'
import { ModelStatsRow } from './ModelStatsRow'
import { formatTtl, parseModelConfigSnippet } from './modelUtils'

type Props = {
  data: ApiModelDetail
}

export function ModelDetailContent({ data }: Props) {
  const { model, events, stats, requests, configSnippet } = data
  const loadModel = useLoadModel()
  const unloadModel = useUnloadModel()
  const tone = model.kind === 'peer' ? ('warn' as const) : stateTone(model.state, model.running)
  const configMeta = useMemo(() => parseModelConfigSnippet(configSnippet), [configSnippet])

  return (
    <>
      <PageHeader
        kicker={`mdl · ${model.name.toLowerCase()}`}
        title={model.name}
        subtitle={
          <span translate="no">
            {model.id} · {model.kind}
          </span>
        }
        variant="integrated"
        action={
          <div className="flex items-center gap-2">
            {model.kind === 'local' ? (
              model.running ? (
                <button type="button" className="btn btn-danger-ghost btn-xs" onClick={() => unloadModel.mutate(model.id)} disabled={unloadModel.isPending}>
                  <Power className="icon-btn-12" strokeWidth={2} aria-hidden="true" />
                  {unloadModel.isPending ? 'unloading…' : 'unload'}
                </button>
              ) : (
                <button type="button" className="btn btn-xs" onClick={() => loadModel.mutate(model.id)} disabled={loadModel.isPending}>
                  <Play className="icon-btn-12" strokeWidth={2} aria-hidden="true" />
                  {loadModel.isPending ? 'loading…' : 'load'}
                </button>
              )
            ) : null}
          </div>
        }
      />

      <div className="detail-sidecar-shell">
        <aside className="detail-meta-rail">
          <div className="detail-meta-section">
            <div className="detail-meta-kicker">Summary</div>
            <dl className="detail-meta-list">
              <div>
                <dt>state</dt>
                <dd>
                  <StatusDot tone={tone} live={model.running} />
                  <span>{model.kind === 'peer' ? 'peer' : model.state}</span>
                </dd>
              </div>
              <div>
                <dt>kind</dt>
                <dd>{model.kind}</dd>
              </div>
              <div>
                <dt>ctx</dt>
                <dd>{configMeta.ctxSize ?? '—'}</dd>
              </div>
              <div>
                <dt>ttl</dt>
                <dd>{model.ttl != null ? formatTtl(model.ttl) : '—'}</dd>
              </div>
              <div>
                <dt>port</dt>
                <dd>{configMeta.port ?? '—'}</dd>
              </div>
            </dl>
          </div>

          {configMeta.aliases.length > 0 ? (
            <div className="detail-meta-section">
              <div className="detail-meta-kicker">Aliases</div>
              <div className="detail-meta-links">
                {configMeta.aliases.map((alias) => (
                  <span key={alias} className="detail-meta-link">
                    {alias}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </aside>

        <div className="detail-main-stack">
          <ModelStatsRow stats={stats} />
          {events.length > 0 ? <ModelEventsPanel events={events} /> : null}
          <ModelRequestsPanel rows={requests.rows} modelId={model.id} />
        </div>

        <aside className="detail-sidecar detail-sidecar-dark">
          {configSnippet ? (
            <section className="detail-sidecar-section">
              <div className="detail-sidecar-title">Command</div>
              <pre className="detail-sidecar-code">{configSnippet}</pre>
            </section>
          ) : null}

          <section className="detail-sidecar-section">
            <div className="detail-sidecar-title">Resident</div>
            <dl className="detail-sidecar-metrics">
              <div>
                <dt>kind</dt>
                <dd>{model.kind}</dd>
              </div>
              <div>
                <dt>ttl</dt>
                <dd>{model.ttl != null ? formatTtl(model.ttl) : '—'}</dd>
              </div>
              <div>
                <dt>ctx</dt>
                <dd>{configMeta.ctxSize ?? '—'}</dd>
              </div>
              <div>
                <dt>port</dt>
                <dd>{configMeta.port ?? '—'}</dd>
              </div>
            </dl>
          </section>

          <section className="detail-sidecar-section detail-sidecar-danger">
            <div className="detail-sidecar-title">Actions</div>
            <Link to="/playground" className="btn btn-sm">
              Open in Playground
            </Link>
            <Link to="/config" className="btn btn-sm">
              Edit in config.yaml
            </Link>
          </section>
        </aside>
      </div>
    </>
  )
}
