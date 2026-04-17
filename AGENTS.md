# AGENTS

Notes for agents (and humans operating as agents) working on this repo.

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

## Tooling

- **Lint + format**: [Biome](https://biomejs.dev) (replaces ESLint + Prettier).
- **Typecheck**: [tsgo](https://github.com/microsoft/typescript-go) via
  `@typescript/native-preview`. It's faster than `tsc` and is the default
  typechecker for this repo. Don't add `tsc` back.
- **Package manager**: pnpm only. Don't commit `npm`/`yarn` lockfiles.

## Dependency version policy

- No `"latest"` in `package.json` — pin ranges (`^x.y.z`) to versions that
  are resolved and published. The user has a global pnpm
  `minimumReleaseAge` policy (>24h); installs will fail on freshly
  published versions. Pick a version that satisfies it rather than bypassing.

## Scope discipline

- MVP-first. The roadmap in `plan.md` is long — only implement what the
  current task asks for. No preemptive abstractions.
- Keep the proxy middleware path isolated in `src/server/proxy/*` and the
  admin surface in `src/server/admin/*`. Don't merge them.
- Request *bodies* are not logged. If that changes it will be a deliberate
  opt-in feature, not a side-effect of another change.
