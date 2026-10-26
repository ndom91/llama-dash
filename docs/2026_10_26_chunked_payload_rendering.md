# Chunked payload rendering

## Scope

Virtualizing logical JSON lines alone did not bound rendering: a multi-megabyte
`content` string can occupy one line. `RequestTextView` now handles pretty JSON,
raw bodies, embedded SSE event data, and expanded assembled response text.
Transport, capture policy, payload query caching, and export data are unchanged.

## Row preparation and rendering

- `splitTextRows()` keeps source-offset ranges rather than eagerly copying or
  tokenizing the entire body. Lines over 1,024 UTF-16 code units are split into
  bounded rows; surrogate pairs stay together. Blank lines and original input
  remain intact.
- Any chunked line activates virtualization, even below the existing 300-line
  threshold. Bodies over 300 ordinary rows or 32,768 UTF-16 code units are
  virtualized too, so dense collections of shorter lines stay bounded.
- The viewport renders visible rows plus eight rows of overscan. Width-based
  estimates seed the scroll range, mounted rows are measured, and resize changes
  invalidate measurements.
- Ordinary JSON lines retain `RequestJsonLine` highlighting. Oversized logical
  lines are plain text throughout, avoiding unbounded regex work and misleading
  highlighting of fragments inside JSON strings. Chunk boundaries can introduce
  additional visual wraps; they do not alter the underlying payload.
- Large embedded SSE code blocks get their own bounded 320px viewport. Assembled
  text retains its 300px limit, mounts only when expanded, and uses the same row
  rendering rather than a giant text node hidden inside the collapsed panel.
- Virtual viewports are named, focusable scroll regions for keyboard access.

## Full data access

Payload and assembled-text copy buttons still use the entire original strings,
not DOM text or mounted chunks. JSONL export remains based on the original query
data. Browser find/select only covers mounted rows, as with other virtualized
views; use full copy/export when working with the whole capture.

## Verification

Tests cover short JSON highlighting, blank/CRLF lines, multi-megabyte values with
few logical lines, surrogate boundaries, raw text, oversized and malformed SSE
events, collapsed/expanded assembled text, and full-body copying in pretty/raw
modes. Initial HTML is bounded rather than proportional to a giant value.

Browser checks used an isolated fixture database with approximately three-million-
character JSON, raw, and single-event SSE captures. The main views mounted roughly
10–14 rows (~10,000 UTF-16 code units), reached the final marker, and retained bounded rows
at 800px width. The oversized SSE event used a 320px viewport and assembled text
used 300px; both reached their final markers. Copying the SSE response returned
all 3,080,073 UTF-16 code units while only about 18,000 were mounted. These are rendering
bounds checks, not deployed end-to-end latency benchmarks.
