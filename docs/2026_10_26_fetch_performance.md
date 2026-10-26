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
At stacked/mobile widths, payload panes have bounded 24rem heights and the detail
grid flows vertically instead of squeezing both panes into the remaining viewport.
This keeps virtual-list viewports usable and bounded rather than expanding to the
entire event spacer or collapsing underneath the summary rail.

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

## Cache bounds and invalidation

- Parsed validator LRU: 128 entries, 4 MiB serialized UTF-16 text budget, five-minute
  maximum age. Reads affect eviction order but never extend expiry. Schema identity
  guards cached validated outputs; 304s reuse the parsed object. In-flight requests
  pin the exact representation matching their sent validator even if the LRU
  evicts it. No-store/no-validator responses are not retained. Mutations and 401s
  clear validators; other HTTP failures evict their URL.
- Metadata queries revalidate after 30 seconds and expire after one minute inactive.
  Payload queries have the same timing. After payload fetches, inactive payloads
  are trimmed to at most eight retained entries and a 16 MiB string budget; active
  viewers are exempt. These budgets bound retained text, not total JavaScript heap.
- Live request events keep each loaded list page at 50 rows and rebalance pages,
  cursors, and page parameters. Automatically arriving events no longer grow the
  first page indefinitely. Older rows remain reachable via the updated cursor.
  User-requested history pages remain available; there is no hidden history cap.
  An empty filtered view exposes an explicit older-history action, including when
  the newest page consists entirely of hidden MCP relay rows.
- SSE reconnect/visibility resync and malformed request-event fallbacks invalidate
  named live queries instead of the whole Query cache. Completed request payloads
  are not refetched on every reconnect. Manual retention prune invalidates metadata
  and payloads explicitly; histogram retains its existing polling fallback.

## Verification

The browser was tested against an isolated temporary database. A cold direct
detail URL displayed metadata while its payload fetch was deliberately held.
For a 5,001-event fixture, the metadata response was 882 bytes versus 334,071
payload bytes; metadata contained no bodies, matched validators returned 304,
and payload responses carried `no-store` with no ETag. The SSE viewport mounted
8–10 events and scrolling to the end reached `[DONE]` without horizontal overflow.
A held root shell call reproduced the original stale-list symptom and verified
the immediate pending outlet fix. These are fixture checks, not deployment-wide
latency benchmarks. Production build and the complete test suite are checked.
The production server also passed held-session navigation, payload failure/retry
without losing metadata, and 401 checks for unauthenticated metadata/payload
requests. At 800px width the SSE viewport remained scrollable at roughly 299px
with 7–9 mounted events and reached `[DONE]`. A fixture with 60 newer hidden MCP
rows verified that the empty-state older-history action reveals the inference
rows on the next page.
