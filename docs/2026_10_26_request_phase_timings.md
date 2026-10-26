# Request phase timings

Request detail previously parsed phase times only from captured SSE. Most local
production chat requests are non-streaming and contain a top-level `timings`
object, so their prefill/decode values were not shown.

New request rows store nullable `prefill_ms` and `decode_ms` separately from
response bodies. The proxy reads finite non-negative `timings.prompt_ms` and
`timings.predicted_ms` independently of token usage; zero is valid. Streaming
scanning retains the latest valid values through completion or disconnect, even
when body capture is disabled or the body prefix is truncated. Non-streaming JSON
uses the existing bounded response scanner, independently of body capture. Values
are not estimated, and upstreams without timing fields remain unknown.

Legacy rows have null columns. Detail display falls back to the retained response
body: SSE events for streams and a complete JSON response otherwise. No database
backfill or extra prompt retention is performed. Non-streaming responses exceeding
the existing 256 KiB complete-JSON scan limit cannot provide persisted timings;
malformed, truncated, disabled, or pruned legacy bodies may lack fallback timings.
For interrupted streams, the latest received timing can be partial, not the final
inference duration. Existing incomplete captured streams have the same limitation.

Browser checks against an isolated migrated fixture database verified that a
new persisted non-streaming timing is visible even while payload loading is held,
and an older row with only retained JSON renders the same phase breakdown.

The non-streaming view uses a `Timing · phase breakdown` panel, while streams keep
their `Stream · token trace` label. The untinted remainder includes time not
reported by upstream (such as queueing and network), and is not guessed TTFT.
