# Loading and cache ownership cleanup

This refactor addresses the High and Medium maintainability findings from the
performance work. It does not change endpoints, SQL projections, cache limits,
query identities, freshness settings, or request scheduling.

## Request presentation

`RequestDetailPage` passes metadata and a feature-local loading/error/ready payload
state separately. It no longer constructs an apparent full-detail object using
null placeholder payloads. `RequestPayloadsPanel` owns payload status, skeletons,
failure/retry, and ready-body presentation. Successfully fetched null bodies are
ready (not still loading). Failed background refreshes retain their existing
cached payload data for complete-detail actions, while the panel shows the error.

`useRequestPayloadAnalysis` memoizes headers, request JSON, response classification,
SSE parsing, and timing once for both the metadata rail and payload panel. A full
detail object is assembled only for export when actual payload data is available.

## Query ownership

- `query-client.ts` owns per-root client creation and retention-policy callbacks.
  Factory integration tests cover successful-fetch trimming, observer-removal
  trimming, active-view exemptions, instance isolation, and default options.
- `query-keys.ts` owns shared keys and prefix helpers. Recent-request keys include
  their MCP flag in one factory rather than appending it at call sites. Existing
  exports from `queries.ts` remain compatible.
- `request-query-data.ts` derives pagination types from the existing response
  schema and TanStack's `InfiniteData`, avoiding repeated hand-written page shapes.

## HTTP and server mappings

The GET wrapper explicitly owns validator lookup, 304 reuse, storage, and URL
eviction. Mutation wrappers explicitly clear validators after successful response
validation, rather than response parsing interpreting an absent cache key as a
mutation. Authentication failures still clear the shell hint and validators.

Legacy full-detail and split metadata/payload endpoints share pure field-mapping
helpers. Database and recent-body lookups remain explicit in the endpoint data
functions, preserving one request-row select per call and metadata's exclusion of
captured body/header columns.

## Verification

Tests cover actual QueryClient policy wiring, explicit loading/empty/error payload
presentation, retry callbacks, successful versus failed mutation invalidation,
and consistent legacy/split mappings without additional row selects. Browser
checks against the isolated fixture database confirmed metadata stays visible
while payloads wait or fail, retry restores the SSE view, and desktop/mobile
virtualized viewport heights remain unchanged without horizontal overflow.
