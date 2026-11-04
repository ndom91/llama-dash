# Codebase simplification pass

Six commits (`841652b..e22660b`) aimed at removing dead code and duplication
without changing product behaviour, plus one small route removal and two fixes.

## Commits

- `66ece27` — dead code: unreferenced files, hooks, API wrappers, query keys and
  server helpers; unused props/branches (ThemeToggle icon variant, RouteError
  retry, Logo wordmark, TopBar actions); `components/Playground*.tsx` re-export
  shims; `lib/schemas/index.ts` barrel; ~1.3k lines of unused CSS.
- `fa3708e` — server dedup: shared proxy/relay log helpers, body byte reader,
  API-key token lookup, recent-request stats/row mapping, admin
  `parseBody`/`errorMessage` helpers.
- `db30206` — frontend dedup: `lib/format.ts`, `use-copy-to-clipboard.ts`,
  shared playground API-key hook, sidebar account helpers, key secret banner,
  `SystemPanel`/`MetaRow`/`PolicyPanel` split out, playground and request-body
  types derived from valibot (`lib/schemas/playground.ts`), `cn()` everywhere.
  `RouteSkeleton` removed.
- `22280ac` — removed redundant/changelog-style comments; renamed
  `PRE_AUTH_PREFIX_BYTES` to `ROUTING_FALLBACK_PREFIX_BYTES`.
- `91cce91` — `RequestsPage` split into `RequestsFilterSidebar` (+ field/input
  pieces), `requestsListUtils`, and `requestsSearch.ts`; route file stays thin.
- `e22660b` — dropped `GET /api/requests/:id`, fixed login theme persistence,
  added pricing status to `/api/system` and the System page.

## Behaviour-adjacent changes

- Copy buttons show "copied" only when the clipboard write succeeds.
- Playground requests wait for the playground API key to resolve.
- GPU poller builds one snapshot per poll (success or failure) and publishes
  it from a single point.
- Mobile menu open state now lives in `AuthenticatedShell`, so it resets when
  the authenticated shell remounts.
- Login page theme toggle writes the shared theme-mode cookie/localStorage key,
  so SSR matches after sign-in.
- `/api/requests/:id` now 404s; use `/metadata` and `/payloads`.
- System runtime panel shows a `pricing` row (`models.dev` catalog status).

## Deliberately left alone

- Proxy `content-length` handling in `src/server/proxy/body.ts`: subtle,
  correctness-critical for forwarding, and not worth churn in a cleanup pass.
