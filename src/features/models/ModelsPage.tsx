import { RefreshCw, PowerOff } from 'lucide-react'
import { useMemo } from 'react'
import { PageHeader } from '../../components/PageHeader'
import { Tooltip } from '../../components/Tooltip'
import { TopBar } from '../../components/TopBar'
import { cn } from '../../lib/cn'
import { useLoadModel, useModels, useUnloadAll, useUnloadModel } from '../../lib/queries'
import { ModelRow } from './ModelRow'
import { ModelsPageSkeleton } from './ModelsPageSkeleton'

export function ModelsPage() {
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
                className={cn('icon-14', isRefetching && 'animate-spin')}
                strokeWidth={1.75}
                aria-hidden="true"
              />
            </button>
          </Tooltip>
        }
      />
      <div className="content">
        <div className="page min-h-full flex-1 bg-surface-1">
          <PageHeader
            kicker="dsh · models"
            title="Models"
            subtitle="available models and their current state"
            variant="integrated"
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

          {error ? <div className="err-banner mx-6 mt-3 max-md:mx-3">{error.message}</div> : null}

          <section className="panel !rounded-none !border-x-0 !bg-surface-1 flex min-h-0 flex-1 flex-col">
            {models == null ? (
              <ModelsPageSkeleton />
            ) : models.length === 0 ? (
              <div className="empty-state px-6 max-md:px-3">no models configured in llama-swap.</div>
            ) : (
              <table className="dtable">
                <thead>
                  <tr>
                    <th style={{ width: 18 }} aria-label="state" />
                    <th className="mono" style={{ minWidth: 180 }}>
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
