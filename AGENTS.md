# AGENTS

Notes for agents (and humans operating as agents) working on this repo.

## What this is

llama-dash is a sidecar in front of [llama-swap](https://github.com/mostlygeek/llama-swap):
a dashboard UI plus a logging, auth-ready proxy for llama-swap's `/v1/*`
OpenAI/Anthropic-compatible endpoint. The long version — goals, non-goals,
roadmap, infra context, lessons learned from the reference deployment — lives
in [`plan.md`](./plan.md). Read it before making design decisions that touch
anything beyond the current task.

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
where auth, ACL, rate-limiting, filters, and logging all hang off — today
only logging is wired up; the rest are future work listed in `plan.md`.

## Repo layout

```
src/
  routes/                 — TanStack Router file-routes (UI + __root.tsx)
    index.tsx               · / dashboard home
    models.tsx              · /models list + Unload actions
    requests.tsx            · /requests log view
  components/             — UI components (Header, Footer, ThemeToggle)
  lib/
    api.ts                — typed client-side fetch wrappers for /api/*
  server/                 — everything that runs in Node, never shipped to client
    config.ts             — env-var loader (LLAMASWAP_URL, DATABASE_PATH, …)
    vite-plugin.ts        — mounts proxy + admin handlers on the Vite dev server
    db/                   — drizzle schema + SQLite init + migrator
    proxy/                — /v1/* pass-through: handler.ts, usage.ts, log.ts
    admin/                — /api/* admin surface: handler.ts, requests.ts
    llama-swap/client.ts  — typed wrapper over llama-swap's HTTP API
drizzle/                  — generated SQL migrations (checked in)
data/                     — runtime DB lives here (gitignored)
plan.md                   — long-form vision and infra context
```

Keep the proxy layer isolated in `src/server/proxy/*` and the admin surface
in `src/server/admin/*`. Don't merge them — they have different evolution
paths (proxy will grow middleware; admin will grow CRUD).

## What's shipped (first-pass scope)

1. TanStack Start app on `:5173`.
2. SQLite (`data/dash.db`) + Drizzle. One table: `requests` (metadata only).
3. `/v1/*` pass-through proxy that streams SSE unchanged and logs one row
   per request with token counts pulled from the final SSE `usage` chunk (or
   the JSON `usage` field for non-streamed responses).
4. Admin API: `/api/models`, `/api/models/:id/unload`, `/api/models/unload`
   (unload-all), `/api/requests` (cursor-paginated), `/api/health`.
5. UI: Dashboard / Models / Requests views.

## What's explicitly NOT done yet

Don't accidentally rebuild these — they have intentional shapes in `plan.md`:

- Auth (admin password or API keys). Proxy is unauthenticated.
- Rate limiting / quotas.
- Content filters (regex block/redact, prompt injection).
- Config editor (`config.yaml` round-tripping).
- Live log tail (SSE of llama-swap's `/logs/stream/*`).
- Cost estimates, playground, export, replay.
- Docker Compose packaging. The proxy is wired via a Vite dev-server
  middleware; there's no production entry point yet.

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
- **React framework**: TanStack Start (file-based router + Nitro under the
  hood). Server functions via `createServerFn` are available but we haven't
  leaned on them yet; UI data fetching goes client-side against `/api/*`.

## Dependency version policy

- No `"latest"` in `package.json` — pin ranges (`^x.y.z`) to versions that
  are resolved and published. The user has a global pnpm
  `minimumReleaseAge` policy (>24h); installs will fail on freshly
  published versions. Pick a version that satisfies it rather than bypassing.

## Dev environment

- Upstream llama-swap lives at `https://llama-swap.puff.lan` (the reference
  deployment described in `plan.md`). It uses a self-signed cert from an
  internal CA. Plain HTTP on that host goes to Caddy's default vhost, **not**
  llama-swap — llama-swap is HTTPS-only there.
- `LLAMASWAP_INSECURE=true` is the default, which sets
  `NODE_TLS_REJECT_UNAUTHORIZED=0` at boot. Dev-only. Flip off once we front a
  publicly-trusted endpoint.
- Env vars consumed by the server live in `src/server/config.ts`. Add new
  ones there, not ad-hoc across the codebase.

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

## Scope discipline

- MVP-first. The roadmap in `plan.md` is long — only implement what the
  current task asks for. No preemptive abstractions.
- For exploratory questions ("how should we do X?"), propose and wait.
  Don't land code until the approach is agreed.
- If a task touches both the proxy and the admin surface, think about
  whether it should be two commits.
