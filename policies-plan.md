# Policies / Filters — Implementation Plan

Proxy-layer request transforms for llama-dash. All features intercept
`/v1/*` requests between authentication and forwarding to llama-swap.

## Proxy middleware execution order

```
1. Read request body          (existing)
2. Authenticate               (existing — auth.ts)
3. Model pinning              (overwrite model from key's defaultModel)
4. Model allow-list check     (moved here from auth — checks post-pin, pre-alias)
5. Alias resolution           (rewrite model via model_aliases table)
6. System prompt injection    (prepend system message if key has one)
7. Request size limit check   (reject if messages/tokens exceed global limits)
8. Re-serialize body          (only if any step mutated it)
9. Forward to llama-swap      (existing)
```

Steps 3–7 only apply to POST requests with a JSON body.

---

## Feature 1: Model Aliases (global)

Map client-facing model names to llama-swap model IDs. Lets clients
that hardcode `gpt-4` or `claude-3` just work.

### DB

New table `model_aliases`:

| Column     | Type           | Notes                           |
|------------|----------------|---------------------------------|
| `id`       | `text` PK      | `mal_` + ULID                   |
| `alias`    | `text` UNIQUE  | What clients send (`gpt-4`)     |
| `model`    | `text` NOT NULL| What llama-swap expects          |
| `created_at`| `timestamp_ms`| Creation time                   |

### Server

- **`src/server/admin/model-aliases.ts`** — CRUD + `resolveAlias(model): string`
- In-memory `Map<string, string>` cache, invalidated on writes
- Single-level resolution only (no chaining aliases)

### API

| Method   | Route               | Action         |
|----------|---------------------|----------------|
| `GET`    | `/api/aliases`      | List all       |
| `POST`   | `/api/aliases`      | Create         |
| `PATCH`  | `/api/aliases/:id`  | Update         |
| `DELETE` | `/api/aliases/:id`  | Delete         |

### Valibot schemas

New file `src/lib/schemas/model-alias.ts`:
- `ModelAliasSchema` — id, alias, model, createdAt
- `ModelAliasListResponseSchema`
- `CreateModelAliasBodySchema` — alias + model (both required, 1–200 chars)
- `UpdateModelAliasBodySchema` — both optional

### UI

New `/policies` route with "Model Aliases" panel:
- Table showing alias → model mappings
- Inline create form
- Edit/delete per row
- Sidebar entry under "configure": `{ to: '/policies', label: 'Policies', Icon: Shield }`

### Client

- `api.listAliases()`, `api.createAlias()`, `api.updateAlias()`, `api.deleteAlias()`
- Query hooks: `useAliases()`, `useCreateAlias()`, `useUpdateAlias()`, `useDeleteAlias()`
- Query key: `qk.aliases`

---

## Feature 2: Model Pinning Per Key

Per-key default model override. If set, the proxy fills/overrides the
`model` field for all requests using that key. Applied BEFORE alias
resolution, so you can pin to an alias name.

### DB

Add column to `api_keys`:

```
default_model text  -- nullable, null = no pinning
```

### Server

- Proxy reads `keyRow.defaultModel`, overwrites parsed body's `model` field
- `api-keys.ts`: add to `createApiKey`, `updateApiKey`, `toApiShape`

### Model allow-list interaction

The allow-list check currently lives in `auth.ts`. It needs to move
into the handler, after model pinning is applied but before alias
resolution. Extract into a standalone `checkModelAllowed(keyRow, model)`
function.

The allow-list checks the **post-pin, pre-alias** model name. If a key
is pinned to `gpt-4` and the allow-list contains `gpt-4`, it works even
though the backend name is different after alias resolution.

### Valibot

- Add `defaultModel: v.nullable(v.string())` to `ApiKeySchema`
- Add `defaultModel: v.optional(v.nullable(v.string()))` to create/update body schemas

### UI

- Key detail page: show in stats strip, editable via model dropdown
- Key creation form: optional "Default model" select

---

## Feature 3: System Prompt Injection Per Key

Per-key system prompt prepended to the `messages` array on
`/v1/chat/completions` requests.

### DB

Add column to `api_keys`:

```
system_prompt text  -- nullable, null = no injection
```

Can share a migration with `default_model` (both ALTER TABLE on api_keys).

### Server

- Only applies when endpoint is `/v1/chat/completions` and body has `messages`
- Prepend `{ role: 'system', content: keyRow.systemPrompt }` as first element
- If client already has a system message, ours comes first (higher priority)

### Valibot

- Add `systemPrompt: v.nullable(v.string())` to `ApiKeySchema`
- Add `systemPrompt: v.optional(v.nullable(v.pipe(v.string(), v.maxLength(10000))))` to create/update schemas

### UI

- Key detail page: new "System prompt" panel between stats and model access
- Textarea with edit/save/cancel
- Key creation form: expandable "Advanced" section with textarea

---

## Feature 4: Request Size Limits (global)

Global limits on request size. Reject before forwarding to llama-swap.

### DB

New table `settings`:

| Column       | Type           | Notes                 |
|--------------|----------------|-----------------------|
| `key`        | `text` PK      | Natural key           |
| `value`      | `text` NOT NULL| Stored as string      |
| `updated_at` | `timestamp_ms` | Last modification     |

Settings keys:
- `max_messages_per_request` — integer or null (unlimited)
- `max_estimated_prompt_tokens` — integer or null (unlimited)

### Server

- **`src/server/admin/settings.ts`** — `getSetting`, `setSetting`, `getRequestLimits()`
- In-memory cache, invalidated on writes
- Token estimation: `Math.ceil(JSON.stringify(messages).length / 4)`
- Reject with 422 + OpenAI-shaped error body
- Checks run AFTER system prompt injection (limits reflect actual payload)

### API

| Method  | Route                          | Action             |
|---------|--------------------------------|--------------------|
| `GET`   | `/api/settings/request-limits` | Get current limits |
| `PATCH` | `/api/settings/request-limits` | Update limits      |

### Valibot

New file `src/lib/schemas/settings.ts`:
- `RequestLimitsSchema` — maxMessages, maxEstimatedTokens (both nullable number)
- `UpdateRequestLimitsBodySchema` — both optional nullable, integer, minValue(1)

### UI

"Request limits" panel on `/policies` page:
- Two number inputs (empty = unlimited)
- Save button

---

## Commit sequence

| # | Scope | Description |
|---|-------|-------------|
| 1 | Refactor | Proxy transform pipeline scaffold — parse body once, extract allow-list check from auth.ts |
| 2 | Feature 1 | Model aliases: DB + server + API + schemas |
| 3 | Feature 1 | Model aliases: UI (policies page, sidebar, client hooks) |
| 4 | Features 2+3 | Model pinning + system prompt: DB + server + API + schemas |
| 5 | Features 2+3 | Model pinning + system prompt: UI (key detail + creation form) |
| 6 | Feature 4 | Request size limits: DB + server + API + UI |
| 7 | Docs | Update CLAUDE.md, README.md, next-plan.md |

## Key decisions

- **Purpose-built, not generic.** Each feature is a column or table. No JSON policy blobs.
- **In-memory caches for hot path.** Aliases and settings cached in memory, invalidated on admin writes. No per-request DB queries.
- **Single parse, conditional re-serialize.** Parse request body JSON once. Only `JSON.stringify` if a transform mutated it.
- **Allow-list checks post-pin, pre-alias.** The allow-list is user-facing; it should match the model name the key owner configured, not the backend name after alias resolution.
- **Transforms as a function, not middleware.** Single `applyTransforms()` call in the handler keeps flow explicit.
