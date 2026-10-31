import { RefreshCw } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { PageHeader } from '../../components/PageHeader'
import { PROVIDER_ENDPOINTS, PROVIDER_TARGETS } from '../../lib/providers'
import { useProviderConnections, useRefreshProviderModels } from '../../lib/queries'
import { Chip } from '../policies/routing-ui'

/**
 * Models page: every model served by a connected provider endpoint, discovered
 * live from the provider — never hardcoded. llama-swap's loaded models live on
 * their own page (`/models`).
 */
export function CloudModelsPage() {
  const { data: connections = [] } = useProviderConnections()
  const refreshMutation = useRefreshProviderModels()
  const [query, setQuery] = useState('')

  return (
    <div className="content">
      <div className="page flex-1">
        <PageHeader
          kicker="dsh · models"
          title="Models"
          subtitle="models served by connected provider endpoints · discovered live from each provider"
          variant="integrated"
          action={
            <input
              type="search"
              className="h-9 w-56 rounded border border-border bg-surface-3 px-3 font-mono text-xs text-fg focus-visible:outline-none focus-visible:shadow-focus"
              placeholder="filter models…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          }
        />

        {connections.length === 0 ? (
          <section className="card">
            <div className="panel-head">
              <span className="panel-title">No provider connected</span>
            </div>
            <div className="p-4 font-mono text-xs text-fg-dim">
              Connect a subscription (MiniMax, Xiaomi MiMo, Z.AI GLM) on the{' '}
              <Link to="/policies" search={{ tab: 'providers' }} className="text-accent hover:underline">
                Policies → Providers
              </Link>{' '}
              page and its models appear here automatically.
            </div>
          </section>
        ) : (
          <div className="grid gap-3 pt-4">
            {connections.map((connection) => {
              const target = PROVIDER_TARGETS.find((item) => item.id === connection.targetId)
              const surfaces = PROVIDER_ENDPOINTS.filter((endpoint) => endpoint.targetId === connection.targetId)
              const models = connection.models.filter((model) =>
                model.toLowerCase().includes(query.trim().toLowerCase()),
              )
              return (
                <section key={connection.targetId} className="card">
                  <div className="panel-head">
                    <span className="panel-title">{connection.targetLabel}</span>
                    <span className="panel-sub">
                      · {models.length} of {connection.models.length} models
                      {connection.modelsDiscoveredAt
                        ? ` · discovered ${new Date(connection.modelsDiscoveredAt).toLocaleString()}`
                        : ''}
                    </span>
                    <div className="ml-auto flex items-center gap-2">
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs"
                        disabled={refreshMutation.isPending}
                        onClick={() => refreshMutation.mutate(connection.targetId)}
                      >
                        <RefreshCw
                          size={11}
                          className={`mr-1 inline-block ${refreshMutation.isPending ? 'animate-spin' : ''}`}
                          aria-hidden="true"
                        />
                        refresh
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 p-4">
                    <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px] text-fg-faint">
                      <span>{target ? target.origin : ''}</span>
                      {surfaces.map((surface) => (
                        <Chip key={surface.id} tone={surface.apiStyle === 'anthropic' ? 'info' : 'default'}>
                          {surface.apiStyle}
                        </Chip>
                      ))}
                    </div>
                    {models.length === 0 ? (
                      <div className="font-mono text-xs text-fg-faint">
                        {connection.models.length === 0
                          ? 'No models discovered yet — press refresh, or re-connect the provider.'
                          : 'No models match the filter.'}
                      </div>
                    ) : (
                      <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
                        {models.map((model) => (
                          <div
                            key={model}
                            className="rounded border border-border bg-surface-2 px-2.5 py-1.5 font-mono text-xs text-fg"
                          >
                            {model}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </section>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
