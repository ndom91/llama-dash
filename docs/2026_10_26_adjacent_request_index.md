# Adjacent request index

Request detail finds the nearest inference IDs in both directions. Production
measurements on SQLite 3.53.4 with roughly 215,000 rows showed the planner using
the class/time index and a temporary sort: approximately 1,897 ms for older and
1,822 ms for newer in one sample. Forcing the existing ID index took 0.21 ms and
0.14 ms respectively. These are individual measurements, not sustained benchmarks.

An isolated in-memory database on the production host contained only IDs, request
classes and timestamps from 215,244 rows, read from production without modifying
it. Across three ID positions, the original plans took 15.77–27.33 ms. Adding
`idx_requests_class_id(request_class, id)` yielded covering index seeks without
temporary sorts, taking 0–0.01 ms and returning the same results. The isolated
index build took 38 ms and approximately 10.6 MB; these figures do not predict
production migration time or disk usage.

The migration creates the index automatically at startup. Index creation writes
to the database and can block other operations while it runs; allow sufficient
database and WAL disk space and plan for startup time. No production migration,
checkpoint or vacuum was performed as part of this investigation.
