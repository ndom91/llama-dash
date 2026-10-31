# Layout contract — page gutter, workspace cards, reading pages

**Date:** 2026-10-31
**Scope:** Presentation only. No routes, queries, proxy, admin API, database,
auth, or behaviour changed. This document records the layout rules the UI now
follows; `docs/2026_10_31_design_refresh.md` covers the colour/elevation layer
these rules sit on top of.

## The problem

The console had no consistent measure. Three failure modes showed up at once:

1. **No breathing room.** `.content` / `.page` carried no horizontal padding,
   so panels ran edge to edge and the table rows touched the viewport. On a
   wide monitor the log table stretched to 2000px+ and the eye had no anchor.
2. **No width strategy.** Every page behaved the same way regardless of what
   it contained. A dense request log and a page of copy-onboarding text were
   laid out identically, so neither looked deliberate.
3. **Off-scale spacing.** Padding and gaps were a mix of `10px`, `14px`,
   `18px`, `22px`, `26px` — values that belong to no scale. Two adjacent
   panels could differ by 4px of vertical gap and nobody could say why.

The flush panel mosaic made it worse. Panels were built to sit flush against
each other (no radius, no side borders) and the mosaic ran to the window
edges. Without a card to contain it, the result read as one borderless slab
rather than a set of panels.

## The contract

### 1. One gutter, one scale

`--gutter` is the single source of horizontal breathing room:

| Breakpoint | Gutter |
| ---------- | ------ |
| > 900px    | 24px   |
| ≤ 900px    | 16px   |
| ≤ 600px    | 12px   |

`.page` applies it as `padding-inline` plus `padding-bottom`, so every page
gets the same inset without each route re-deciding it. Card padding is
`--card-pad` (16px). Everything between those two is Tailwind utilities on a
**4px scale** — `p-2`, `p-3`, `p-4`, `gap-2`, `gap-3`, `gap-4`. A 10px,
14px, 18px, 22px, or 26px value is a bug; use `px-[14px]` only when the value
is a measured pixel artefact of an icon or a chart, never for layout rhythm.

The page header band is intentionally **full-bleed** — it aligns with the
TopBar chrome above it. Only the content below it respects the gutter.

### 2. Two page shapes

- **Data pages** (Dashboard, Requests, Usage, Logs, Models, System, Config,
  Playground, API Keys, and every detail page) are **full-bleed**: they fill
  the content column and use the gutter as their only inset. Dense tables and
  live panels want every pixel.
- **Reading pages** (Settings, Attribution, Endpoints, Policies) add
  `.page-reading`, which caps the column at `--content-max` (1180px) and
  centres it. Long-form copy stops stretching past comfortable measure.

`.page-reading` is a width rule only. It does not change spacing or surface.

### 3. Workspace cards

Data pages whose content is a **mosaic of flush panels** (the Dashboard grid,
the Requests filter + table split, the Models table, the Logs stream, the
Config editor, the Usage breakdowns, the Playground workspace, the System
panels, and every detail-page sidecar shell) wrap that mosaic in a single
`.workspace` element.

`.workspace` is the card:

- rounded (`--radius-lg`), bordered, `bg-surface-1`, `--shadow-2` + `--hi-line`
- `overflow-hidden` so inner panels clip to the radius
- `margin-top: 12px` so it separates from the page header band

The inner panels stay **flush** — no radius, no side borders — and drop their
own shadow (`.workspace .panel { box-shadow: none }`). The result reads as one
card made of regions, not as a pile of boxes.

Where a page needs a second, independent card *above* the workspace (the API
key create form), that card is a normal `.panel` with `mt-3`; it is not part
of the mosaic.

### 4. Reading pages use separate cards

Reading pages do **not** use a workspace wrapper. Their sections are
individual `.panel` cards separated by `gap-3` (12px), so each section has its
own header, border, and radius. Stacking flush sections on a reading page
made the sections indistinguishable from each other.

### 5. Nested surfaces step down

Inside a card (`bg-surface-1`), nested content uses `bg-surface-2` — panel
headers, table heads, stat tiles, inspector rails. A well *inside* a card
(chat transcript, code body) steps back down to `bg-surface-0` and drops the
shadow. The canvas is `bg-surface-0`; a card is `bg-surface-1`; a nested
surface is `bg-surface-2`. Never put `bg-surface-1` on top of `bg-surface-1`.

### 6. Detail pages

Detail pages use `.page.detail-page.detail-page-sidecar`. The sidecar page
background is the stage (`--bg-0`), the header band sits above it, and the
`.detail-sidecar-shell` / `.request-detail-grid` is the workspace card that
holds the meta rail, the main stack, and the right rail.

## What changed in code

- `src/styles.css` — added `--gutter`, `--content-max`, `--card-pad`,
  `.page-reading`, `.workspace`; `.page` gained `padding-inline` /
  `padding-bottom`; normalised `.btn`, `.panel-head`, `.dtable` cells,
  `.stat-card`, `.histogram`, `.histogram-header`, `.empty-state`,
  `.err-banner`, `.detail-meta-rail`, `.detail-sidecar*` to the 4px scale;
  fixed the sidebar breakpoint off-by-one (`768px` → `767.98px`) so the
  collapsed rail and the mobile drawer do not both apply at 768px.
- Feature pages — flush `panel !rounded-none !border-x-0` mosaics replaced
  with `.workspace`; reading pages converted to separate `.panel` cards with
  `gap-3`; the Playground page root dropped its `bg-surface-1` so the canvas
  shows through around the workspace card.
- Skeletons — `RouteRequestsSkeleton`, `RequestsPageSkeleton`,
  `RouteConfigSkeleton`, `RouteLogsSkeleton`, `RequestDetailSkeleton`,
  `ModelDetailSkeleton` mirror the workspace treatment so loading states do
  not jump when the real page arrives.
- Shared chrome — `Tabs` accent padding tightened to `px-3 py-2`;
  `NavigationPending` uses the same `gap-4 pt-3` rhythm as the real pages.

## Verification

- `pnpm lint:fix`, `pnpm format:fix`, `pnpm typecheck` all exit clean.
- Browser-verified against the dev server in dark and light mode at 1440,
  1024, 768, and 600px: dashboard, requests, models, model detail, logs,
  usage, system, playground, API keys (list + create form), settings,
  endpoints, attribution, policies.
- The request log currently has zero rows, so request-detail pages could not
  be verified with real payload data.
