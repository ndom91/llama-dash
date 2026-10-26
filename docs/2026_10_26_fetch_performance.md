# Fetch and navigation performance

## Navigation delay

The root route awaited `getShellContext()` on every navigation before mounting
the destination. Updating browser history precedes this asynchronous check, so
a slow session round trip could leave the request list visible under the detail
URL. There was also no explicit route-pending feedback.

Reuse authenticated shell context in the browser for at most 30 seconds, bounded
by session expiry. Never share this cache between SSR requests or cache signed-out
results. Show route pending feedback after 150 ms with no minimum display delay.
Server API authentication remains mandatory and unchanged. Shell fetch errors
are no longer silently converted into a signed-out redirect.

## Independent request loading

The UI fetches `/api/requests/:id/metadata` and `/api/requests/:id/payloads`
concurrently, with independent query keys. Metadata excludes captured body/header
columns in SQL and includes adjacent IDs. Payloads retain the existing recent-body
fallback and privacy behavior. Payload errors retain the metadata view and expose
a local retry. Hover and adjacent prefetches fetch metadata only, avoiding
speculative downloads of large prompt/response bodies. The legacy full-detail
endpoint remains compatible. Payload Query cache entries expire after one minute
inactive and revalidate after 30 seconds so retention cleanup can take effect.

## SSE rendering

Streams over 100 events use a variable-height virtual list with five overscan
events. Only mounted events are formatted/highlighted. The event viewport owns
scrolling separately from the assembled-text accordion so opening it does not
invalidate event offsets. Copy and export retain the complete captured body.
Short streams remain fully rendered; browser find only covers mounted events
for virtualized streams (copy/export provides the complete capture).

## Session waterfall review

The server entry gate and the root shell server function both resolved the same
session. An AsyncLocalStorage scope now deduplicates that promise only within a
single inbound request; parallel callers cannot share it. Requests outside the
scope do not cache. The root QueryClient is created per root instance rather than
as a server module singleton. API 401s clear the browser shell hint so the next
navigation checks the session again. No server authorization is bypassed.

Browser reproduction with the shell response held showed that TanStack's default
pending boundary does not activate while the root `beforeLoad` is awaiting its
session. The mounted authenticated shell now observes router loading/destination
state directly and replaces the old page immediately on pathname changes. Search
and sort changes on the same page do not blank its contents.

## Conditional JSON overhead

Admin JSON responses serialize once and generate weak validators with native
SHA-256 rather than a JavaScript character loop. The dispatcher compares the
existing header without reading, decoding, re-encoding, or reconstructing the
response. Matching GETs return bodyless 304s. Validators still require route data
generation; this is not a cross-request response cache. Cache control is private.
Sensitive captured-payload and legacy full-detail responses use `no-store` and
skip hashing entirely. Weak/strong/list/wildcard matching is tested.

## Interactive fetch priority

Request list, metadata, and payload loads use high fetch priority. Intent/adjacent
metadata prefetches and recurring telemetry use low priority. Browsers without
Fetch Priority ignore the hint without changing behavior. Query abort signals
reach the fetch layer for these paths, so leaving a detail page aborts its
unobserved in-flight payload instead of competing with the next page. Existing
query keys preserve deduplication when navigation meets a pending prefetch.
Priority is a browser scheduling hint, not a server-side request queue.
