import { RefreshCw, PowerOff } from 'lucide-react'
import { useMemo } from 'react'
import { PageHeader } from '../../components/PageHeader'
import { RouteError } from '../../components/RouteError'
import { Tooltip } from '../../components/Tooltip'
import { cn } from '../../lib/cn'
import { useLoadModel, useModels, useUnloadAll, useUnloadModel } from '../../lib/queries'
import { ModelRow } from './ModelRow'
import { ModelsPageSkeleton } from './ModelsPageSkeleton'
import { SelectorRow } from './SelectorRow'

export function ModelsPage() {
  const { data: models, error, isRefetching, refetch } = useModels()
  const loadModel = useLoadModel()
  const unloadModel = useUnloadModel()
  const unloadAll = useUnloadAll()

  const hasRunning = useMemo(() => models?.some((m) => m.running && m.kind === 'local') ?? false, [models])
  const selectors = models?.filter((m) => m.kind === 'selector') ?? []
  const listedModels = models?.filter((m) => m.kind !== 'selector') ?? []

  if (error) {
    return <RouteError kicker="dsh · models" title="Failed to load models" message={error.message} />
  }

  return (
    <div className="content">
      <div className="page min-h-full flex-1 bg-surface-1">
        <PageHeader
          kicker="dsh · models"
          title="Models"
          subtitle="available models and their current state"
          variant="integrated"
          action={
            <div className="flex items-center gap-2">
              <Tooltip label="Refresh">
                <button
                  type="button"
                  className="btn btn-ghost btn-icon"
                  onClick={() => refetch()}
                  disabled={isRefetching}
                  aria-label="Refresh models"
                >
                  <RefreshCw
                    className={cn('size-3.5 shrink-0', isRefetching && 'animate-spin')}
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                </button>
              </Tooltip>
              <Tooltip label="Unload every running model" side="left">
                <button
                  type="button"
                  className="btn btn-danger-ghost btn-xs"
                  onClick={() => unloadAll.mutate()}
                  disabled={!hasRunning || unloadAll.isPending}
                >
                  <PowerOff className="size-3 shrink-0" strokeWidth={2} aria-hidden="true" />
                  {unloadAll.isPending ? 'unloading…' : 'unload all'}
                </button>
              </Tooltip>
            </div>
          }
        />

        <section className="panel !rounded-none !border-x-0 !bg-surface-1 flex min-h-0 flex-1 flex-col">
          {models == null ? (
            <ModelsPageSkeleton />
          ) : models.length === 0 ? (
            <div className="empty-state px-6 max-md:px-3">no models configured in llama-swap.</div>
          ) : (
            <div className="min-h-0 overflow-auto">
              {selectors.length > 0 ? (
                <section aria-labelledby="selectors-heading" className="border-b border-border">
                  <div className="flex items-baseline gap-2 px-4 py-3 max-md:px-3">
                    <h2 id="selectors-heading" className="font-mono text-xs font-medium tracking-wide text-fg">
                      Selectors
                    </h2>
                    <span className="text-xs text-fg-dim">llama-swap routing targets</span>
                  </div>
                  <table className="dtable">
                    <thead>
                      <tr>
                        <th style={{ width: 18 }} aria-label="state" />
                        <th className="mono" style={{ minWidth: 200 }}>
                          id
                        </th>
                        <th>strategy</th>
                        <th className="hide-mobile">targets</th>
                        <th className="hide-mobile">spillover</th>
                        <th style={{ width: 100 }} className="hide-mobile">
                          state
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectors.map((selector) => (
                        <SelectorRow key={selector.id} model={selector} />
                      ))}
                    </tbody>
                  </table>
                </section>
              ) : null}
              {listedModels.length > 0 ? (
                <table className="dtable">
                  <thead>
                    <tr>
                      <th style={{ width: 18 }} aria-label="state" />
                      <th className="mono" style={{ minWidth: 300 }}>
                        id
                      </th>
                      <th>name</th>
                      <th style={{ width: 72 }} className="hide-mobile">
                        kind
                      </th>
                      <th style={{ width: 130 }} className="hide-mobile">
                        state
                      </th>
                      <th style={{ width: 110 }} className="num hide-mobile">
                        action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {listedModels.map((m) => (
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
              ) : null}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
