# In-flight request visibility

## Goal

Show proxy exchanges on the dashboard / requests list as soon as they start,
then fill in finished metadata when the exchange completes — without changing
the SQLite contract that a `requests` row is a finished exchange.

## Approach

In-memory registry (`src/server/proxy/inflight-requests.ts`) + SSE, mirroring
how `request.completed` already patches list caches.

1. Mint `req_…` at proxy accept (`ProxyContext.requestId`).
2. Register when entering a long-lived path (local scheduler, direct forward, MCP).
3. Phase updates: `accepted` → `queued` → `active` via `request.updated`.
4. On log flush: reuse the same id, `finishInflight`, publish `request.completed`.

## API / events

| Surface | Role |
|---------|------|
| `GET /api/requests/inflight` | Snapshot for page load / SSE reconnect |
| `request.started` | Upsert live row into `qk.requestsInflight` |
| `request.updated` | Phase / model patch |
| `request.completed` | Remove live row + prepend finished `ApiRequest` (unchanged) |

Live rows are **not** written to SQLite. Process restart clears the registry.

## UI

Dashboard recent + `/requests` merge inflight at the top with a pulsing phase
badge and elapsed duration. Detail deep-link is deferred until the finished row
exists (clicking a live row is a no-op for now).
