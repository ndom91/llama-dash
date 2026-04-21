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
                <button type="button" className="btn btn-ghost btn-xs" onClick={() => unloadModel.mutate(model.id)} disabled={unloadModel.isPending}>
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

      <div className="grid min-h-0 flex-1 grid-cols-[240px_minmax(0,1fr)_350px] items-stretch gap-0 max-[1200px]:grid-cols-[240px_minmax(0,1fr)] max-[900px]:grid-cols-1">
        <aside className="border-r border-[color:color-mix(in_srgb,var(--border)_86%,transparent)] bg-surface-1 px-3.5 py-4 max-[900px]:border-r-0 max-[900px]:border-b">
          <div>
            <div className="mb-2.5 font-mono text-[10px] uppercase tracking-[0.12em] text-fg-dim">Summary</div>
            <dl className="grid gap-2 m-0">
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
            <div className="mt-3.5 border-t border-[color:color-mix(in_srgb,var(--border)_72%,transparent)] pt-3.5">
              <div className="mb-2.5 font-mono text-[10px] uppercase tracking-[0.12em] text-fg-dim">Aliases</div>
              <div className="grid gap-1.5">
                {configMeta.aliases.map((alias) => (
                  <span key={alias} className="font-mono text-[11px] text-fg-muted">
                    {alias}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </aside>

        <div className="flex min-h-0 min-w-0 flex-col gap-0">
          <ModelStatsRow stats={stats} />
          {events.length > 0 ? <ModelEventsPanel events={events} /> : null}
          <ModelRequestsPanel rows={requests.rows} modelId={model.id} />
        </div>

        <aside className="bg-[color:color-mix(in_srgb,var(--bg-0)_92%,black_8%)] px-3.5 py-3 max-[1200px]:col-span-full max-[1200px]:border-t max-[1200px]:border-t-[color:color-mix(in_srgb,var(--border)_86%,transparent)]">
          {configSnippet ? (
            <section>
              <div className="mb-2.5 font-mono text-[10px] uppercase tracking-[0.12em] text-fg-dim">Command</div>
              <pre className="m-0 whitespace-pre-wrap bg-[color:color-mix(in_srgb,var(--bg-1)_84%,var(--bg-2))] border border-[color:color-mix(in_srgb,var(--border)_86%,transparent)] p-3 font-mono text-[11px] leading-[1.55] text-fg-dim">{configSnippet}</pre>
            </section>
          ) : null}

          <section className="mt-4 border-t border-[color:color-mix(in_srgb,var(--border)_72%,transparent)] pt-4">
            <div className="mb-2.5 font-mono text-[10px] uppercase tracking-[0.12em] text-fg-dim">Resident</div>
            <dl className="grid gap-2 m-0">
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

          <section className="mt-4 grid gap-2 border-t border-[color:color-mix(in_srgb,var(--border)_72%,transparent)] pt-4">
            <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.12em] text-fg-dim">Actions</div>
            <Link to="/playground" className="btn btn-sm">
              Open in Playground
            </Link>
            <Link to="/config" className="btn btn-sm">
              Edit in config.yaml
            </Link>
            {model.kind === 'local' ? (
              <button type="button" className="btn btn-danger btn-sm" onClick={() => unloadModel.mutate(model.id)} disabled={!model.running || unloadModel.isPending}>
                Unload
              </button>
            ) : null}
          </section>
        </aside>
      </div>
    </>
  )
}
