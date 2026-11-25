import { ChevronDown, Search, X } from 'lucide-react'
import type { RefObject } from 'react'
import { Checkbox } from '../../components/Checkbox'
import {
  ResponsiveDisclosure,
  ResponsiveDisclosurePanel,
  ResponsiveDisclosureTrigger,
} from '../../components/ResponsiveDisclosure'
import { MultiSelectFilter, type MultiSelectFilterOption } from '../../components/MultiSelectFilter'
import { Select, type SelectOption } from '../../components/Select'
import type { AttributionSettings } from '../../lib/api'
import type { RequestFilterCounts } from '../../lib/schemas/request'
import { RequestsAttributionFilterInput } from './RequestsAttributionFilterInput'
import { RequestsFilterField } from './RequestsFilterField'
import type { RequestListFilters, StatusFilter } from './requestsListUtils'
import { type RequestsSearch, setFilterSearchPatch } from './requestsSearch'

type Props = {
  open: boolean
  onToggle: () => void
  searchRef: RefObject<HTMLInputElement | null>
  searchDraft: string
  onSearchDraftChange: (value: string) => void
  filters: RequestListFilters
  showMcpRelays: boolean
  filterOptionsStatus: { failed: boolean; cached: boolean; pending: boolean; onRetry: () => void }
  modelOptions: readonly MultiSelectFilterOption[]
  keyOptions: readonly MultiSelectFilterOption[]
  hostOptions: readonly MultiSelectFilterOption[]
  counts: RequestFilterCounts | undefined
  attribution: AttributionSettings | undefined
  updateSearch: (patch: Partial<RequestsSearch>) => void
  hasFilters: boolean
  onClearFilters: () => void
}

export function RequestsFilterSidebar({
  open,
  onToggle,
  searchRef,
  searchDraft,
  onSearchDraftChange,
  filters,
  showMcpRelays,
  filterOptionsStatus,
  modelOptions,
  keyOptions,
  hostOptions,
  counts,
  attribution,
  updateSearch,
  hasFilters,
  onClearFilters,
}: Props) {
  return (
    <ResponsiveDisclosure
      render={<aside />}
      desktopMinWidth={901}
      open={open}
      onOpenChange={onToggle}
      className="border-border bg-surface-1 px-4 py-4 font-mono text-[11px] text-fg max-[900px]:border-r-0 max-[900px]:border-b max-[768px]:py-2"
    >
      <ResponsiveDisclosureTrigger className="btn w-full justify-between min-[901px]:hidden">
        <span>Filters{hasFilters ? ' · active' : ''}</span>
        <span className="responsive-disclosure-chevron" aria-hidden="true">
          <ChevronDown size={16} />
        </span>
      </ResponsiveDisclosureTrigger>
      <ResponsiveDisclosurePanel id="request-filters">
        <div className="max-[900px]:pt-4">
          {filterOptionsStatus.failed ? (
            <div
              role="status"
              className="mb-4 rounded border border-border-strong bg-surface-2 p-2.5 text-xs text-fg-muted"
            >
              <p className="m-0 mb-2">
                {filterOptionsStatus.cached
                  ? 'Could not refresh filter choices. Showing previous choices.'
                  : 'Could not load model, key, and host choices.'}
              </p>
              <button
                type="button"
                className="btn btn-xs"
                disabled={filterOptionsStatus.pending}
                onClick={filterOptionsStatus.onRetry}
              >
                Retry choices
              </button>
            </div>
          ) : null}
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
            <MultiSelectFilter
              aria-label="Model"
              noun="models"
              value={filters.modelFilter}
              onChange={(v) => updateSearch(setFilterSearchPatch('model', v))}
              options={modelOptions}
              counts={counts?.models}
            />
          </RequestsFilterField>

          <RequestsFilterField label="Key">
            <MultiSelectFilter
              aria-label="Key"
              noun="keys"
              value={filters.keyFilter}
              onChange={(v) => updateSearch(setFilterSearchPatch('key', v))}
              options={keyOptions}
              counts={counts?.keys}
            />
          </RequestsFilterField>

          <RequestsFilterField label="Routing">
            <MultiSelectFilter
              aria-label="Routing"
              noun="routing"
              allLabel="All requests"
              value={filters.routingFilter}
              onChange={(v) => updateSearch(setFilterSearchPatch('routing', v))}
              options={ROUTING_OPTIONS}
              counts={counts?.routing}
            />
          </RequestsFilterField>

          <label className="mb-4 flex cursor-pointer items-center gap-2 rounded border border-border bg-surface-2 px-2.5 py-2 text-fg-dim transition-colors hover:border-border-strong hover:text-fg">
            <Checkbox
              checked={showMcpRelays}
              onChange={(e) => updateSearch({ mcp: e.target.checked ? true : undefined })}
            />
            <span className="flex min-w-0 flex-1 items-center justify-between gap-2 text-fg">
              <span className="truncate">Show MCP reqs</span>
            </span>
          </label>

          <RequestsFilterField label="Host">
            <MultiSelectFilter
              aria-label="Host"
              noun="hosts"
              value={filters.hostFilter}
              onChange={(v) => updateSearch(setFilterSearchPatch('host', v))}
              options={hostOptions}
              counts={counts?.hosts}
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
        </div>
      </ResponsiveDisclosurePanel>
    </ResponsiveDisclosure>
  )
}

const STATUS_OPTIONS: readonly SelectOption[] = [
  { value: 'all', label: 'All status' },
  { value: 'ok', label: 'Success' },
  { value: 'err', label: 'Errors' },
]

const ROUTING_OPTIONS: readonly MultiSelectFilterOption[] = [
  { value: 'routed', label: 'Routed' },
  { value: 'unrouted', label: 'Unrouted' },
]
