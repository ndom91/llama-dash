# Usage rollup lifecycle

Startup discovers retained inference days and backfills one UTC day per event
loop turn. A persisted cursor advances in the same transaction as each day's
rollup; an interrupted or failed run resumes from the last committed day. A
completed run is checked on the next service start. Fully retained days whose
raw request counts match their rollup counts are skipped; missing or mismatched
days are rebuilt. Each day's aggregation remains synchronous, so a particularly
busy day can still block the event loop.

Increment `BACKFILL_VERSION` in `src/server/usage-rollup.ts` whenever rollup
dimensions or aggregation semantics change. A new version resets an older
cursor and rebuilds eligible retained days once. The pruning watermark still
prevents rebuilding partially pruned days. Count comparison assumes request
rows are immutable: it cannot detect out-of-band edits that leave a day's row
count unchanged. Such edits require an explicit rebuild of affected fully
retained days or a version bump; never rebuild a partially pruned day from raw
rows, because that would discard its historical totals.

Inference pruning waits for backfill and a successful recent-day refresh. The
pruning cutoff and its persisted high-water mark use the same timestamp, and
the watermark and inference delete commit together. A watermark is initialized
conservatively from the configured retention window because older rows may have
been pruned before usage rollups were introduced. It never moves backwards.

If a request completes for a day with an existing snapshot, its numeric usage
is appended in the same SQLite transaction as its request log. This keeps
already-backfilled days current if backfill is interrupted and later resumed.
When no snapshot exists and the day may already be partially pruned, the day is
rebuilt from the available raw requests instead. The aggregate can contain more
than one row for the same dimensions; usage reports sum those rows. If the
transaction fails, neither the request row nor the rollup contribution is
committed, and the bounded logging queue reports the dropped log as usual.
This adds a rollup lookup to each inference log write and an extra insert for
requests whose day already has a snapshot; recent-day refreshes regroup rows.

To assess whether incremental rows are accumulating, run this read-only query
against a populated database and compare `rows` with `groups`, particularly
for days at and before the pruning cutoff:

```sql
SELECT day, count(*) AS rows,
       count(DISTINCT json_array(model, client_name, key_id, status_class,
         routing_action, client_host, end_user_id)) AS groups,
       sum(requests) AS requests
FROM request_daily_stats
GROUP BY day ORDER BY day DESC;
```

Multiple rows per group are expected between refreshes. A persistent excess on
older days can justify investigating consolidation; this query does not alter
rollups or reveal individual dimension values.

Rollup failures do not block expired request-body/header clearing or MCP relay
retention. A manual prune returns an error after that independent cleanup if
inference pruning was skipped. Historical usage may be incomplete while startup
backfill is running. Requests completing more than 24 hours after they start
remain outside the supported assumptions for updating fully retained historical
days.
