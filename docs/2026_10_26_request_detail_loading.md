# Request detail loading: first pass

Request-list navigation previously waited for the entire detail response before
showing any metadata, even when the request summary was already in Query cache.

- `useRequest()` now supplies an ID-matched list/recent summary as observer-only
  placeholder data. It never stores a partial detail result in the query cache.
- The detail view renders cached metadata immediately, marks detail-only values
  as loading, and keeps skeletons in the payload area. Copy-curl and export are
  unavailable until the complete detail arrives; missing bodies are not presented
  as uncaptured while still loading.
- Pointer hover and keyboard selection prefetch after 100 ms. Moving away or
  changing selection cancels the intent timer. Click/Enter starts the same fetch
  immediately, before route navigation. TanStack Query deduplicates these calls.
- Detail loading and adjacent prefetches share `requestQueryOptions()` so they
  use identical cache keys and freshness settings.
- Navigation never retains another request's detail under a different ID. Direct
  visits without a cached summary still use the full detail skeleton.

No API or database changes. Body splitting, SSE virtualization, and broader
router/session fetching changes remain separate follow-up work.

Verified in-browser using a temporary database and a held detail response:
metadata rendered while both payload skeletons remained visible, export stayed
disabled, and releasing the response replaced the skeletons with payloads.
Keyboard selection and pointer hover initiated prefetches; opening a completed
prefetch rendered payloads without a second detail fetch. Desktop layout retained
full height without horizontal overflow. Hook tests cover list/recent summaries,
ID changes, query deduplication, completed-cache reuse, and fetch errors.

Large-payload transfer/parsing benchmarks remain follow-up work. No quantified
latency reduction is claimed from this first pass.
