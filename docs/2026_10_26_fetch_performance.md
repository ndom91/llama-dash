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
