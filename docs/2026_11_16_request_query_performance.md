# Request query performance

Run the opt-in benchmark with:

```sh
REQUEST_BENCHMARK=1 pnpm test src/server/admin/requests.bench.test.ts
```

`REQUEST_BENCHMARK_ROWS` changes the default 100,000 rows. The benchmark creates
and deletes a temporary SQLite file, applies the checked-in migrations, and calls
the actual request query functions. It never opens the application database.

## Method

Measured locally on 2026-11-16 with better-sqlite3 13.0.3. The synthetic log spans
30 days, with 30 models, 10 clients, 50 hosts, tied sort values, missing token
counts, 2% MCP rows and about 1% errors. One third of rows retain roughly 4 KiB
of request/response bodies. WAL mode and a 16 MiB SQLite page cache are used.

The report includes the first run after releasing SQLite's page cache and the
median of seven subsequent runs, plus EXPLAIN QUERY PLAN output. The OS file
cache is not flushed, so the first run is not a cold-storage benchmark. These
are query-function timings, excluding HTTP, JSON encoding and browser rendering.

## Results

Warm medians, milliseconds, before and after migration 0049:

| Query | Before | After |
| --- | ---: | ---: |
| Time descending | 0.41 | 0.39 |
| Duration descending | 13.96 | 0.35 |
| Status ascending | 13.67 | 0.26 |
| Tokens descending | 14.11 | 0.28 |
| Duration with MCP included | 10.38 | 10.01 |
| Text search with matches | 0.93 | 0.89 |
| Text search with no matches | 161.92 | 160.50 |
| Model filter and time sort | 2.42 | 2.38 |
| Last hour | 0.29 | 0.26 |
| Custom day | 0.28 | 0.27 |
| All-history traffic chart | 44.10 | 9.87 |
| Filter options | 39.86 | 0.08 |

The database grows from 183.2 to 198.4 MiB with the added indexes. Write overhead
was not benchmarked; each insertion maintains four extra indexes and a wider
class/time index.

The separate match-count endpoint was measured after it was added: 1.19 ms for
all retained inference requests and 149.50 ms for a text filter with no matches
on the same synthetic database. Counts are independent of page loading and sort
changes. Active count and chart queries refresh at most once per five-second
burst of request events, with a 60-second polling fallback.

## Changes and limits

- Class/value/ID indexes remove full-history temporary sorts for duration,
  status and coalesced token counts in the default inference-only list.
- The existing class/time index now includes ID and status to cover chart
  aggregation and the time sort's tie-breaker.
- A host index makes distinct host options a covering-index scan; SQLite can
  skip duplicate host values after ANALYZE on the benchmark database.
- Aggregate SSE refreshes are coalesced over five seconds. Lists still receive
  matching completed requests directly, and slow polling remains a fallback.
- The duration sort with MCP included still scans/sorts the combined log.
  Extra indexes for that optional view are deferred until its scale warrants them.
- Arbitrary Unicode substring search intentionally retains its existing
  semantics. A miss scans the log; narrower timeframes reduce that work.
  FTS/trigram search needs a separate decision about substring and Unicode behavior.
- The benchmark runs ANALYZE to reflect representative statistics. Production
  results also depend on SQLite's query planner statistics and disk/cache state.

Drizzle Kit 0.31.10 generated malformed SQL for the comma in the coalesce
expression index. Migration 0049 was corrected to use the expression directly;
the generated schema snapshot correctly records it as an expression. Migration
and pagination tests run against the corrected SQL.
