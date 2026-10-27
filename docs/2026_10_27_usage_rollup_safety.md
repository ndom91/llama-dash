# Usage rollup lifecycle

Startup discovers retained inference days and backfills one UTC day per event
loop turn. A persisted cursor advances in the same transaction as each day's
rollup; an interrupted or failed run resumes from the last committed day. A
completed run is restarted on the next service start so fully retained days are
refreshed even when an earlier snapshot exists. Each day's aggregation remains
synchronous, so a particularly busy day can still block the event loop.

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

Rollup failures do not block expired request-body/header clearing or MCP relay
retention. A manual prune returns an error after that independent cleanup if
inference pruning was skipped. Historical usage may be incomplete while startup
backfill is running. Requests completing more than 24 hours after they start
remain outside the supported assumptions for updating fully retained historical
days.
