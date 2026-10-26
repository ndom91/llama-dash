# Key and model detail query performance

Key-detail statistics and model breakdowns read a 30-minute window. On a
production user key with about 164,000 historical requests, individual read-only
samples took 2.19 s and 1.71 s because SQLite chose the key/ID index and scanned
the key's history. These synchronous operations run on the server event loop.

In an isolated in-memory snapshot of 215,500 request metadata rows, adding
`idx_requests_key_started_at(key_id, started_at)` changed both queries to indexed
time-range seeks and preserved results. Across three samples, statistics dropped
from 13.91–15.13 ms to 0.05–0.21 ms, and breakdown from 12.63–13.64 ms to
0.04–0.11 ms. The isolated index used approximately 9.3 MB and took 43 ms to
build; production migration time and disk/WAL use can differ. The startup
migration can block database operations while the index is created.

Key and model request lists now select the same summary columns as the main
request list rather than loading stored headers and bodies they do not return.
The model suffix-match scan and request retention maintenance are separate
performance issues and are not changed here.
