# AGENTS

Notes for agents (and humans operating as agents) working on this repo.

## What this is

llama-dash is a sidecar in front of [llama-swap](https://github.com/mostlygeek/llama-swap):
a dashboard UI plus a logging, auth-ready proxy for llama-swap's `/v1/*`
OpenAI/Anthropic-compatible endpoint. Feature ideas and prioritization
live in [`next-plan.md`](./next-plan.md).

Short version of goals:

- Single-pane dashboard for a self-hosted llama-swap stack.
- Add proxy features llama-swap doesn't have: API keys, quotas, filters, logging.
- Model lifecycle (load / unload / configure / hot-reload) driven from the UI.
- Eventually shipped as a Docker Compose stack; llama-swap hidden internally.

Short version of non-goals:

- We do not run inference. That's llama-swap + llama.cpp.
- Not a multi-tenant SaaS. Single team, single box.
- No distributed deployment.

## Architecture

```
client ──► llama-dash :8080 ──► llama-swap (internal) ──► llama-server procs
           │
           ├─ UI (/)
           ├─ Admin API (/api/*)
           └─ Proxy (/v1/*)  ← also what clients hit
```

One public port. llama-swap is not exposed on the host. The proxy layer is
where auth, ACL, rate-limiting, policies/filters, and logging all hang off.

## Repo layout

```
src/
  routes/                 — TanStack Router file-routes (UI + __root.tsx)
    index.tsx               · / dashboard home
    models.index.tsx        · /models list + load/unload actions
    models.$id.tsx          · /models/:id detail (stats, history, config snippet)
    requests.index.tsx      · /requests log with filtering, sorting, histogram
    requests.$id.tsx        · /requests/:id detail view
    keys.index.tsx          · /keys list + create/revoke/delete
    keys.$id.tsx            · /keys/:id detail (stats, model breakdown, requests)
    policies.tsx            · /policies model aliases + request limits
    endpoints.tsx           · /endpoints client connection examples
    logs.tsx                · /logs raw log viewer
  features/               — route-owned UI, one component per file, grouped by feature
    dashboard/             · dashboard panels + metrics helpers
    endpoints/             · endpoint examples + copy/highlight helpers
    keys/                  · keys list/detail panels and forms
    models/                · models list/detail panels and helpers
    playground/            · playground tabs, rails, and media tools
    policies/              · alias and request-limit editing panels
    requests/              · request list/detail pages and payload helpers
    config/, logs/         · config editor + log viewer feature-local pieces
  components/             — shared UI components reused across features
    Sidebar.tsx             · nav + VRAM-resident readout in footer
    ModelTimeline.tsx        · 30-min model swap timeline (spans + legend)
    Sparkline.tsx           · SVG sparkline with above-line glow
    DurationBar.tsx         · inline latency bar for request tables
    StatusDot.tsx           · animated status indicator (ok/warn/err/idle)
    StatusCell.tsx          · status code + stream badge
    PageHeader.tsx          · reusable kicker + title + subtitle + actions
    TopBar.tsx, Tooltip.tsx, ThemeToggle.tsx, CopyableCode.tsx
  lib/
    api.ts                — typed client-side fetch wrappers for /api/*
    queries.ts            — TanStack Query hooks (5s polling, infinite scroll)
    schemas/              — valibot schemas (single source of truth for API types)
  server/                 — everything that runs in Node, never shipped to client
    config.ts             — env-var loader (LLAMASWAP_URL, DATABASE_PATH, …)
    vite-plugin.ts        — mounts proxy + admin handlers on the Vite dev server
    gpu-poller.ts         — polls nvidia-smi/rocm-smi/system_profiler for GPU stats
    model-watcher.ts      — polls /running every 15s, writes load/unload events
    db/                   — drizzle schema + SQLite init + migrator
    proxy/                — /v1/* pass-through: handler.ts, transforms.ts, usage.ts, log.ts, auth.ts, rate-limiter.ts
    admin/                — /api/* admin surface: handler.ts, requests.ts, model-events.ts, model-detail.ts, key-detail.ts, api-keys.ts, model-aliases.ts, settings.ts
    llama-swap/client.ts  — typed wrapper over llama-swap's HTTP API
    llama-swap/schemas.ts — valibot schemas for llama-swap API responses
drizzle/                  — generated SQL migrations (checked in)
data/                     — runtime DB lives here (gitignored)
next-plan.md              — feature ideas and prioritization
```

Keep the proxy layer isolated in `src/server/proxy/*` and the admin surface
in `src/server/admin/*`. Don't merge them — they have different evolution
paths (proxy will grow middleware; admin will grow CRUD).

## What's shipped

1. TanStack Start app on `:5173`.
2. SQLite (`data/dash.db`) + Drizzle. Five tables: `requests` (per-call
   metadata + optional bodies/headers), `model_events` (load/unload
   event-sourced timeline), `api_keys` (hashed keys + rate limits + ACLs +
   default model + system prompt), `model_aliases` (global model name
   mapping), `settings` (key-value config like request limits).
3. `/v1/*` pass-through proxy that streams SSE unchanged and logs one row
   per request with token counts pulled from the final SSE `usage` chunk (or
   the JSON `usage` field for non-streamed responses). Handles both OpenAI
   (`/v1/chat/completions`, flat `usage.prompt_tokens`/`completion_tokens`)
   and Anthropic (`/v1/messages`, `/v1/messages/count_tokens`, nested
   `message.usage` with `input_tokens`/`output_tokens`, `message_stop` stream
   terminator) shapes.
4. Admin API:
   - `/api/models` — list models (merged with running state + peer info)
   - `/api/models/:id` — model detail (stats, events, recent requests, config snippet, key breakdown)
   - `/api/models/:id/load`, `/api/models/:id/unload`, `/api/models/unload`
   - `/api/requests` — cursor-paginated list
   - `/api/requests/stats` — req/s, tok/s, p50, error rate + sparklines
   - `/api/requests/histogram` — bucketed req/s histogram
   - `/api/requests/:id` — detail with adjacent navigation
   - `/api/health` — upstream reachability, version, latency
   - `/api/model-timeline` — load/unload events for timeline viz
   - `/api/gpu` — cached GPU stats (VRAM, utilization, temp, power)
   - `/api/keys` — CRUD for API keys (create, list, revoke, delete)
   - `/api/keys/:id` — key detail (stats, model breakdown, recent requests); PATCH accepts `name`, `allowedModels`, `defaultModel`, `systemPrompt`
   - `/api/aliases` — CRUD for model aliases (global model name mapping)
   - `/api/settings/request-limits` — GET/PATCH global request size limits
5. GPU poller: auto-detects NVIDIA (`nvidia-smi`), AMD (`rocm-smi`), or
   Apple Silicon (`system_profiler`). Polls every 10s (static-only for
   Apple). AMD uses GTT memory (not BIOS-limited VRAM) for APUs.
6. Model watcher: polls llama-swap `/running` every 15s, diffs against
   known state, inserts `load`/`unload` events into SQLite.
7. UI views: Dashboard (stats, timeline, running models, upstream+GPU,
   recent requests), Models (list + load/unload + per-model detail),
   Requests (filtered/sorted log + histogram + detail), Logs, Playground,
   Config editor, API Keys (list + per-key detail), Policies (aliases +
   request limits), Endpoints (connection examples for curl, Python, TS,
   Home Assistant, Claude Code, opencode, Continue, Open WebUI).
8. API key auth + rate limiting. Keys are SHA-256 hashed at rest,
   shown once on creation. When keys exist in DB, proxy requires
   `Authorization: Bearer sk-...`. Per-key RPM/TPM token-bucket rate
   limiting (in-memory, resets on restart). Per-key model allow-lists.
   **Exception**: `/v1/messages` and `/v1/messages/count_tokens` with an
   `anthropic-version` header skip llama-dash key enforcement. The caller's
   `Authorization` header (OAuth subscription bearer or real Anthropic key)
   is meant for Anthropic — llama-swap's `peers:` entry handles final
   routing. Requests still get logged; no transforms apply (no keyRow).
9. Proxy transform pipeline (`src/server/proxy/transforms.ts`). Intercepts
   POST `/v1/*` requests between auth and forwarding. Parses body once,
   applies transforms in order, re-serializes only if mutated:
   model pinning → allow-list check → alias resolution → system prompt
   injection → request size limits. In-memory caches for aliases and
   settings, invalidated on admin writes. System-prompt injection branches
   by endpoint: `/v1/chat/completions` prepends a `system` message to
   `messages[]`; `/v1/messages` prepends to the top-level `system` field
   (string or content-block array, preserved shape).
10. Feature-local UI structure under `src/features/*`. Route files are thin
   entrypoints; page-specific components live with their feature instead of
   accumulating inside `src/routes/*` or flat shared component files.

## Tooling

- **Lint + format**: [Biome](https://biomejs.dev) (replaces ESLint + Prettier).
  Config matches the old Prettier style: 2-space indent, single quotes, no
  semicolons, trailing commas. `src/styles.css` is excluded because Biome's
  CSS parser rejects Tailwind v4 directives (`@plugin`, `@theme`).
- **Typecheck**: [tsgo](https://github.com/microsoft/typescript-go) via
  `@typescript/native-preview`. It's faster than `tsc` and is the default
  typechecker for this repo. Don't add `tsc` back. Note: tsgo rejects
  `baseUrl` in tsconfig — use `paths` with root-relative entries.
- **Package manager**: pnpm only. Don't commit `npm`/`yarn` lockfiles.
- **ORM**: Drizzle (`drizzle-orm` + `drizzle-kit`) over better-sqlite3.
  Migrations live in `drizzle/`. Generate with `pnpm db:generate`, apply
  with `pnpm db:migrate`.
- **Runtime validation**: [Valibot](https://valibot.dev) for runtime type
  validation at trust boundaries. Schemas live in `src/lib/schemas/` (shared
  API types) and `src/server/llama-swap/schemas.ts` (upstream response
  shapes). Types are derived from schemas via `v.InferOutput` — never
  hand-write a type that duplicates a schema. Use `v.parse()` where failure
  should throw (fetch wrappers) and `v.safeParse()` where you need to
  return a structured error (request body validation).
- **React framework**: TanStack Start (file-based router + Nitro under the
  hood). Server functions via `createServerFn` are available but we haven't
  leaned on them yet; UI data fetching goes client-side against `/api/*`.

## Styling

- **Tailwind v4** is the primary styling tool. Prefer Tailwind utility
  classes inline in JSX wherever practical over adding new rules to
  `src/styles.css`.
- Existing component classes in `styles.css` (`.btn`, `.dtable`, `.panel`,
  `.stat-card`, etc.) are fine to use when they are genuinely shared,
  especially if they are defined via `@apply`. Don't add new feature-local
  CSS classes in `styles.css` for layout/styling that can reasonably live in
  the component.
- Prefer this order:
  1. Inline Tailwind utilities in JSX for page/layout/component styling
  2. Small shared semantic classes in `@layer components` using `@apply`
  3. Plain CSS only for things that are awkward or noisy in utilities
     (syntax highlighting, editor overlays, markdown prose rules, complex
     pseudo-elements, scrollbars, keyframes, visualization widgets)
- Keep `src/styles.css` as a support layer, not the primary place for page
  styling. It should mostly contain:
  - theme tokens and root variables
  - shared `@apply` primitives (`.btn`, `.panel`, `.dtable`, etc.)
  - animations and keyframes
  - syntax-highlighting/editor/widget rules that are better expressed in CSS
- Theme tokens are mapped in the `@theme` block at the top of `styles.css`
  (e.g. `--color-fg`, `--color-surface-1`, `--color-accent`). Use the
  corresponding Tailwind classes (`text-fg`, `bg-surface-1`, `border-accent`)
  instead of raw `var(--fg)` in inline styles.
- Animation tokens (`--duration-normal`, `--ease-out`, etc.) live in `:root`.
  Use them via arbitrary values when needed (`transition-[border-color_var(--duration-micro)_ease]`),
  or keep short transitions in `styles.css` if the arbitrary syntax gets unwieldy.
- **Conditional classnames**: use the `cn()` helper from `src/lib/cn.ts`
  for composing classnames conditionally. Prefer `cn('foo', condition && 'bar')`
  over template literals or string concatenation.

## Refactor Learnings

- **Thin routes, feature-local UI.** Route files should stay thin entrypoints.
  Route-owned components and helpers belong in `src/features/<feature>/`, not
  back in `src/routes/*` or flat shared component files.
- **One component per file is the default.** If a file grows because it owns
  multiple embedded subcomponents, split it. Shared helpers can stay local to
  the feature.
- **Be careful with full-height layouts.** The biggest regression class during
  the Tailwind migration was losing `min-h-0` / `flex-1` / `h-full` behavior
  in nested grid/flex containers. On dashboard, requests, logs, and detail
  pages, always verify that the main content column actually stretches to the
  bottom and that scrollable regions still own the overflow.
- **Be careful with column dividers.** If a vertical border is meant to span a
  whole column, prefer putting it on the parent column container rather than a
  child panel whose height may not match adjacent content.
- **Preserve mono typography intentionally.** Another regression class during
  the styling refactor was losing the old dashboard/request sidebar feel when
  mono/text-dim styles were removed with old CSS classes. Labels, metrics,
  timestamps, IDs, and control chrome often intentionally use `font-mono`.
- **Hydration stability matters.** `TopBar` previously hydrated poorly because
  SSR rendered time/query-driven values that changed immediately on the client.
  For clocks and live operational readouts, prefer stable SSR placeholders and
  render live values only after mount.
- **Use browser verification for layout changes.** After meaningful styling or
  layout work, verify the actual rendered UI on the running dev server. Static
  checks alone won't catch full-height regressions, divider placement issues,
  or typography drift.

## Dependency version policy

- No `"latest"` in `package.json` — pin ranges (`^x.y.z`) to versions that
  are resolved and published. The user has a global pnpm
  `minimumReleaseAge` policy (>24h); installs will fail on freshly
  published versions. Pick a version that satisfies it rather than bypassing.

## Entity IDs

All entity primary keys are **prefixed ULIDs** stored as `text` in SQLite.
Format: `{prefix}_{ulid}`, e.g. `req_01J5A3KWGF9QXRZ0N1BVCH6YPM`.

| Entity      | Prefix |
| ----------- | ------ |
| Request     | `req`  |
| ModelEvent  | `mev`  |
| ApiKey      | `key`  |
| ModelAlias  | `mal`  |

When adding a new table, pick a short (2–4 char) lowercase prefix, add it
to the table above, and generate the ID at insert time via `ulidx`:

```ts
import { ulid } from 'ulidx'
const id = `pfx_${ulid()}`
```

IDs are strings everywhere — schema, API types, route params, query keys.
Never `Number()` them. Cursor-based pagination uses the ID directly (ULIDs
sort lexicographically by creation time).

## Dev environment

- Copy `.env.example` to `.env` and set `LLAMASWAP_URL` to point at your
  llama-swap instance. Default is `http://localhost:8080`.
- If your upstream uses HTTPS with a self-signed cert, set
  `LLAMASWAP_INSECURE=true` so Node accepts it (it sets
  `NODE_TLS_REJECT_UNAUTHORIZED=0` at boot). Off by default.
- Env vars consumed by the server live in `src/server/config.ts`. Add new
  ones there, not ad-hoc across the codebase.

## Runtime validation conventions

- **Validate at trust boundaries.** Every response from an external source
  (llama-swap API, GPU CLI tools, client HTTP request bodies) must be
  validated with a valibot schema. Internal data flow (e.g. DB → API
  response) can rely on TypeScript types derived from the same schemas.
- **Schemas are the single source of truth for API types.** Don't define a
  type by hand if a schema already describes that shape — use
  `v.InferOutput<typeof SomeSchema>`. If you need a new API type, write
  the schema first, derive the type from it.
- **Where schemas live:** shared API contract shapes go in
  `src/lib/schemas/`. Server-only upstream shapes (llama-swap responses)
  go in `src/server/llama-swap/schemas.ts`. If a new external integration
  is added, give it its own schema file near the client code.
- **Adding a new endpoint:** define request/response schemas in
  `src/lib/schemas/`, use `v.parse()` in the client-side `api.ts` fetch
  wrapper, and `v.safeParse()` for server-side request body validation in
  the admin handler.

## Design constraints worth keeping in mind

- **Request bodies are not logged.** Ever, in this first pass. If that
  changes it will be a deliberate opt-in feature, not a side-effect of
  another change. Privacy matters; prompts are sensitive.
- **Streaming correctness is non-negotiable.** SSE must pass through
  without buffering (`res.write(value)` as each chunk arrives, no gather-
  then-flush). Token counting happens on a `tee`d scan, not by reading the
  body end-to-end before forwarding.
- **Log on completion, not on start.** A `requests` row represents an
  exchange, not an attempt. If the client disconnects mid-stream we still
  write the row from the `catch` path with whatever usage we scraped.
- **Config round-tripping will matter later.** When the config editor
  lands, user comments and key order in `config.yaml` must survive a write.
  Don't pick a YAML library that doesn't round-trip.
- **Config reload is file-based.** llama-swap uses `-watch-config` (fsnotify)
  to detect config changes and reload automatically. There is no
  `/api/reload` endpoint — just write the file and llama-swap picks it up.

## llama-swap API surface we consume

- `POST /v1/*` — forward OpenAI / Anthropic calls unchanged (after our middleware)
- `GET /running` — which models are currently loaded
- `POST /models/unload` — unload a model
- `GET /upstream/:model_id/*` — proxy directly to a specific llama-server (useful for `/metrics`)
- `GET /logs/stream`, `/logs/stream/proxy`, `/logs/stream/upstream`, `/logs/stream/{model_id}` — SSE log streams
- `GET /health`
- `GET /v1/models` — OpenAI-format list including peers
- Hot reload: editing `config.yaml` when llama-swap runs with `-watch-config` (fsnotify-based; no SIGHUP)

**CLI flags**: `-config <path>`, `-listen <addr>` (default `:8080`), `-watch-config`, `-tls-cert-file`, `-tls-key-file`, `-version`.

**Signals**: `SIGINT` / `SIGTERM` with graceful shutdown of child processes. No `SIGHUP`.

## Claude Code / Anthropic passthrough

llama-dash fronts Anthropic's Messages API end-to-end. Point any Anthropic
SDK (including Claude Code) at llama-dash via `ANTHROPIC_BASE_URL` and the
proxy logs + forwards the call to `api.anthropic.com` through a llama-swap
`peers:` entry.

**Client config** (`~/.claude/settings.json`):

```json
{ "env": { "ANTHROPIC_BASE_URL": "http://<llama-dash>:5173" } }
```

Do not set `ANTHROPIC_AUTH_TOKEN` when using subscription OAuth — Claude Code
manages the bearer itself and llama-dash passes it through.

**llama-swap peer** (fragment of `config.yaml`):

```yaml
peers:
  anthropic:
    proxy: https://api.anthropic.com
    models:
      - claude-opus-4-7
      - claude-sonnet-4-6
      - claude-haiku-4-5-20251001
    # no apiKey — client Authorization header must pass through unchanged
```

**Proxy-layer specifics:**

- Auth bypass (`src/server/proxy/auth.ts` — `isAnthropicPassthrough`). Requests
  to `/v1/messages` or `/v1/messages/count_tokens` with an `anthropic-version`
  header skip llama-dash key enforcement. keyRow is null, so no transforms
  apply; requests still log.
- Response content-encoding strip (`src/server/proxy/handler.ts` —
  `STRIP_RESPONSE_HEADERS`). Node's fetch auto-decompresses upstream bodies
  when consumed as a stream, so forwarding `content-encoding: gzip|br` would
  cause clients to double-decode (ZlibError in Claude Code). `content-length`
  goes with it since the decoded length differs.
- SSE usage scanner reads Anthropic's nested shapes: `message_start`'s
  `body.message.usage` / `body.message.model`, `message_delta`'s top-level
  `body.usage`. `message_stop` terminates the stream (no `[DONE]`).
- System-prompt injection on `/v1/messages` mutates top-level `body.system`
  (string or content-block array; shape preserved).

## Config contract

`config.yaml` is the interface between llama-dash and llama-swap. Rules:

- Atomic writes (write to `.tmp`, fsync, rename).
- Preserve user comments and key order (YAML round-tripper).
- Validate against llama-swap's `config-schema.json` before writing.
- Back up the previous version on every write.

## Before you call work "done"

Always run — in this order — and make sure each command exits clean before
reporting a task complete:

```bash
pnpm lint:fix       # biome lint --write .
pnpm format:fix     # biome format --write .
pnpm typecheck      # tsgo --noEmit
```

If any of them emit errors that aren't auto-fixable, fix them before
reporting done. Do not suppress rules to make errors go away unless
there's a specific, commented reason.

**Do not start `pnpm dev` as a "final smoke test" before handing work back.**
The user runs the dev server themselves. Starting it leaves a background
process bound to :5173 and conflicts with their session. If a change
genuinely needs a running server to verify, start it in the middle of
your work, verify, and kill it — don't leave one running at the end.

## Keep docs in sync

After shipping a new feature or making major changes, update these three
files before calling the work done:

1. **`AGENTS.md`** — repo layout, "What's shipped" section, admin API list.
2. **`README.md`** — feature list, routes list, any user-facing changes.
3. **`next-plan.md`** — mark shipped items, re-prioritize if needed.

## Scope discipline

- MVP-first. Only implement what the current task asks for. No preemptive
  abstractions.
- For exploratory questions ("how should we do X?"), propose and wait.
  Don't land code until the approach is agreed.
- If a task touches both the proxy and the admin surface, think about
  whether it should be two commits.
