# llama-dash

A management dashboard and logging proxy for [llama-swap](https://github.com/mostlygeek/llama-swap).

Sits in front of llama-swap and gives you:

- A single UI to see what's configured, what's running, and every request that has flowed through the proxy.
- Per-model **Unload** buttons backed by llama-swap's `/api/models/unload/:id` endpoint.
- A SQLite log of every `/v1/*` call (method, endpoint, model, status, duration, token counts) — streamed or not.

See [`plan.md`](./plan.md) for the longer-term roadmap and the design decisions behind this first pass.

## Requirements

- Node 20+
- pnpm
- A reachable llama-swap (the default target is the dev deployment at `https://llama-swap.puff.lan`)

## Setup

```bash
pnpm install
pnpm db:migrate        # creates data/dash.db
pnpm dev               # http://localhost:5173
```

## Environment

| Var | Default | Notes |
|---|---|---|
| `LLAMASWAP_URL` | `https://llama-swap.puff.lan` | Upstream llama-swap base URL. No trailing slash. |
| `LLAMASWAP_INSECURE` | `true` | Skip TLS verification. On by default because the reference deployment uses an internal-CA self-signed cert. |
| `DATABASE_PATH` | `data/dash.db` | SQLite file, relative to CWD. |

## How it's wired

- `src/server/proxy/*` — the `/v1/*` pass-through: streaming SSE preserved, token counts scraped from the response as it flies by, one row per request written to SQLite on completion.
- `src/server/admin/*` — the `/api/*` admin surface consumed by the UI.
- `src/server/llama-swap/client.ts` — typed client over llama-swap's HTTP API.
- `src/server/vite-plugin.ts` — mounts the two handlers above as Vite dev-server middleware. Production packaging (Nitro / Docker) is not part of this first pass.
- `src/routes/*` — TanStack Start routes: `/`, `/models`, `/requests`.

## Useful scripts

```bash
pnpm dev           # dev server (:5173)
pnpm db:generate   # emit a new drizzle migration from the schema
pnpm db:migrate    # apply pending migrations
pnpm db:studio     # drizzle-kit studio
pnpm check         # prettier + eslint --fix
pnpm tsc --noEmit  # type-check
```
