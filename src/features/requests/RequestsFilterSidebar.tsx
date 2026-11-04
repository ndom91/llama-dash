import { Search, X } from 'lucide-react'
import type { RefObject } from 'react'
import { Select, type SelectOption } from '../../components/Select'
import type { AttributionSettings } from '../../lib/api'
import { formatCompactNumber } from '../../lib/format'
import { RequestsAttributionFilterInput } from './RequestsAttributionFilterInput'
import { RequestsFilterField } from './RequestsFilterField'
import type { RequestListFilters, RoutingFilter, StatusFilter } from './requestsListUtils'
import type { RequestsSearch } from './requestsSearch'

type Props = {
  searchRef: RefObject<HTMLInputElement | null>
  searchDraft: string
  onSearchDraftChange: (value: string) => void
  filters: RequestListFilters
  showMcpRelays: boolean
  mcpCount: number
  modelOptions: readonly SelectOption[]
  keyOptions: readonly SelectOption[]
  hostOptions: readonly SelectOption[]
  attribution: AttributionSettings | undefined
  updateSearch: (patch: Partial<RequestsSearch>) => void
  hasFilters: boolean
  onClearFilters: () => void
}

export function RequestsFilterSidebar({
  searchRef,
  searchDraft,
  onSearchDraftChange,
  filters,
  showMcpRelays,
  mcpCount,
  modelOptions,
  keyOptions,
  hostOptions,
  attribution,
  updateSearch,
  hasFilters,
  onClearFilters,
}: Props) {
  return (
    <aside className="h-full border-border bg-surface-1 px-4 py-4 font-mono text-[11px] text-fg max-[900px]:border-r-0 max-[900px]:border-b">
      <RequestsFilterField label="Search">
        <div className="relative min-w-0">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-fg-dim"
            size={14}
            strokeWidth={2}
            aria-hidden="true"
          />
          <input
            ref={searchRef}
            type="text"
            className="h-8 w-full rounded border border-border-strong bg-surface-2 px-7 pr-7 font-mono text-xs text-fg outline-none transition-[border-color,box-shadow] duration-100 focus:border-accent focus:[box-shadow:var(--shadow-focus)]"
            placeholder="endpoint, model, status"
            value={searchDraft}
            onChange={(e) => onSearchDraftChange(e.target.value)}
          />
          {searchDraft ? (
            <button
              type="button"
              className="absolute top-1/2 right-1.5 inline-flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-[3px] bg-transparent p-0 text-fg-dim transition-colors hover:bg-surface-3 hover:text-fg"
              onClick={() => {
                onSearchDraftChange('')
                updateSearch({ q: undefined })
              }}
              aria-label="Clear search"
            >
              <X size={12} strokeWidth={2} />
            </button>
          ) : (
            <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded-[3px] border border-border px-[3px] py-0 font-mono text-[10px] text-fg-faint">
              /
            </span>
          )}
        </div>
      </RequestsFilterField>

      <RequestsFilterField label="Status">
        <Select
          aria-label="Status"
          value={filters.statusFilter}
          onValueChange={(v) => updateSearch({ status: v as StatusFilter })}
          options={STATUS_OPTIONS}
        />
      </RequestsFilterField>

      <RequestsFilterField label="Model">
        <Select
          multiple
          aria-label="Model"
          placeholder="All models"
          value={filters.modelFilter}
          onValueChange={(v) => updateSearch({ model: v })}
          options={modelOptions}
        />
      </RequestsFilterField>

      <RequestsFilterField label="Key">
        <Select
          multiple
          aria-label="Key"
          placeholder="All keys"
          value={filters.keyFilter}
          onValueChange={(v) => updateSearch({ key: v })}
          options={keyOptions}
        />
      </RequestsFilterField>

      <RequestsFilterField label="Routing">
        <Select
          aria-label="Routing"
          value={filters.routingFilter}
          onValueChange={(v) => updateSearch({ routing: v as RoutingFilter })}
          options={ROUTING_OPTIONS}
        />
      </RequestsFilterField>

      <label className="mb-4 flex cursor-pointer items-center gap-2 rounded border border-border bg-surface-2 px-2.5 py-2 text-fg-dim transition-colors hover:border-border-strong hover:text-fg">
        <input
          type="checkbox"
          className="accent-accent"
          checked={showMcpRelays}
          onChange={(e) => updateSearch({ mcp: e.target.checked ? true : undefined })}
        />
        <span className="flex min-w-0 flex-1 items-center justify-between gap-2 text-fg">
          <span className="truncate">Show MCP reqs</span>
          <span className="shrink-0 text-fg-faint">
            {`${formatCompactNumber(mcpCount)} ${showMcpRelays ? 'visible' : 'hidden'}`}
          </span>
        </span>
      </label>

      <RequestsFilterField label="Host">
        <Select
          multiple
          aria-label="Host"
          placeholder="All hosts"
          value={filters.hostFilter}
          onValueChange={(v) => updateSearch({ host: v })}
          options={hostOptions}
        />
      </RequestsFilterField>

      <RequestsAttributionFilterInput
        label="Client"
        header={attribution?.clientNameHeader ?? 'x-client-name'}
        value={filters.clientFilter}
        placeholder="claude-code"
        onChange={(client) => updateSearch({ client })}
      />
      <RequestsAttributionFilterInput
        label="End user"
        header={attribution?.endUserIdHeader ?? 'x-end-user-id'}
        value={filters.endUserFilter}
        placeholder="alice"
        onChange={(endUser) => updateSearch({ endUser })}
      />
      <RequestsAttributionFilterInput
        label="Session"
        header={attribution?.sessionIdHeader ?? 'x-session-id'}
        value={filters.sessionFilter}
        placeholder="sess_123"
        onChange={(session) => updateSearch({ session })}
      />

      {hasFilters ? (
        <button type="button" className="btn btn-ghost btn-xs self-start" onClick={onClearFilters}>
          Clear filters
        </button>
      ) : null}
    </aside>
  )
}

const STATUS_OPTIONS: readonly SelectOption[] = [
  { value: 'all', label: 'All status' },
  { value: 'ok', label: 'Success' },
  { value: 'err', label: 'Errors' },
]

const ROUTING_OPTIONS: readonly SelectOption[] = [
  { value: 'all', label: 'All requests' },
  { value: 'routed', label: 'Routed only' },
  { value: 'unrouted', label: 'Unrouted only' },
]
