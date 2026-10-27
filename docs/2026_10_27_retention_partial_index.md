# Request retention partial index

Scheduled retention runs observed on production took roughly 2.9–4.5 seconds;
candidate selection accounted for 1.45–3.03 seconds in sampled hourly runs.
The body cutoff uses request start time, not completion or logging time.

An isolated in-memory snapshot of 221,001 request metadata rows and payload
presence flags (no captured content) tested a partial `started_at` index for rows
with any non-null request/response header or body. Candidate selection fell from
26.87 ms to 1.11 ms and clearing 366 payloads from 29.51 ms to 0.31 ms. The
eviction IDs, changes and remaining rows matched. These timings are not
production latency measurements; the isolated index occupied about 0.5 MB and
built in 25 ms, which does not guarantee production migration time or disk/WAL
space. The migration runs on startup and can block database operations while
building the index.

The index changes neither retention cutoffs nor cleanup logic. It adds index
maintenance to writes and to body clearing, so production logs should be used to
verify the tradeoff after deployment. No production checkpoint or prune was run
for the benchmark.
