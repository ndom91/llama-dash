# Design refresh — elevation model, surface ramp, new palettes

**Date:** 2026-10-31
**Scope:** Token layer, shared component layer, per-page surface promotion, accent
palettes. No proxy, admin, or server behaviour changed.

## The problem

The dashboard read as a wireframe. Every panel was a hairline rectangle on a
flat background, because `.content` / `.page` (the page canvas) and `.panel`
(the cards sitting on it) both resolved to `bg-surface-1`. A card that shares a
surface step with the canvas behind it is not a card — it is an outline.

The old theme layer compounded this:

- Text contrast was too low for the sizes it was used at. The 10px `dim` labels
  sat near 3:1 against the canvas.
- Borders were opaque, so a single hairline could not composite over more than
  one surface.
- Elevation was absent. Panels had no shadow and no lit edge, so nothing
  separated them from the background except the border.
- `themes.json` shipped a `shared` block that described a theme the app did
  not use (different surfaces, different fonts, different radius scale). It
  was read by nobody and lied to everyone.

## The fix: a canvas/card split

Surfaces now form a five-step ramp, and the canvas and the cards sit on
**different** steps:

| Token | Role | Dark | Light |
| ----- | ---- | ---- | ----- |
| `--bg-0` / `--surface-0` | **stage** — app shell, page canvas, wells | `#06070b` | `#eceef2` |
| `--bg-1` / `--surface-1` | **card** — panels, rails, headers | `#191e29` | `#ffffff` |
| `--bg-2` / `--surface-2` | nested content inside a card | `#222835` | `#f6f7f9` |
| `--bg-3` / `--surface-3` | controls, hover, selected | `#2c3340` | `#e9ecf1` |
| `--bg-4` / `--surface-4` | popovers, menus | `#363e4d` | `#e0e4ea` |

- `.content` and `.page` → `bg-surface-0` (the stage).
- `.panel`, `.stat-card`, `.stats-row` → `bg-surface-1` (cards).
- A well *inside* a card (chat transcript, code body, inspector pane) steps
  back down to `bg-surface-0` and drops the shadow.

**The separation has to be large enough to see.** The first attempt at this
split moved the hexes by a few units — stage `#07080a`, card `#101217` — which
is a relative-luminance gap of **0.36 points**. That is imperceptible at a
glance: the same wireframe failure as no split at all. The shipped ramp gaps
**0.98 points** (stage `#06070b` at L 0.19%, card `#191e29` at L 1.25%), and
that is finally visible.

Two page roots also carried an explicit `bg-surface-1` utility that beat the
`.page` rule, so their canvases were card-coloured with card-coloured panels
on top — invisible panels by construction. Models, Keys, Endpoints, Logs,
Attribution, Policies, and the error/skeleton frames now drop that override.

Light mode mirrors the ramp exactly: a grey stage (`#eceef2`) with white cards
(`#ffffff`). The old light mode used white canvas + white cards, which had the
same problem in reverse.

## Elevation

Elevation is a shadow scale plus a **lit top edge** rather than a gradient:

```css
--shadow-1: 0 1px 2px rgb(0 0 0 / 0.4), 0 2px 8px -4px rgb(0 0 0 / 0.5);
--shadow-2: 0 6px 18px -4px rgb(0 0 0 / 0.55), 0 2px 6px -2px rgb(0 0 0 / 0.4);
--shadow-3: 0 22px 50px -12px rgb(0 0 0 / 0.7), 0 6px 14px -6px rgb(0 0 0 / 0.45);
--hi-line: inset 0 1px 0 rgb(255 255 255 / 0.07);
--hi-line-soft: inset 0 1px 0 rgb(255 255 255 / 0.045);
```

`--hi-line` goes on panels, panel headers, buttons, table headers, and stat
rows. It reads as a single pixel of light catching the top of the surface —
which is what makes a dark card look like an object rather than a hole.

Light mode overrides the shadows to `rgb(16 24 40 / …)` and the hi-line to
`rgb(255 255 255 / 0.9)` / `0.7`, so the same rule works on white cards.

## Borders

Borders are alpha, not opaque:

```css
--border: rgb(255 255 255 / 0.1);     /* dark  */
--border: rgb(10 14 22 / 0.1);        /* light */
```

One hairline now composites correctly over any surface in the ramp. Hard-coded
opaque border colours break this — don't add them.

## Text and radius

Contrast was lifted across the board:

| Role | Dark | Light |
| ---- | ---- | ----- |
| `fg` | `#e8ebf0` | `#14171c` |
| `fg-muted` | `#a4acb9` | — |
| `fg-dim` | `#7c8593` | — |
| `fg-faint` | `#5b6370` | — |

Radius moved from 3/6/9 px to **4/10/14 px** (`--radius-sm`, `--radius`,
`--radius-lg`).

## Palettes

`src/lib/themes.json` now holds 14 palettes. The default is `sapphire`
(`DEFAULT_THEME_ID` in `src/lib/theme.ts`).

New in this pass: **sapphire** (default), **jade**, **ember**, **brass**,
**orchid**, **slate**.

Each palette carries its own status hues, and they are chosen so the accent
never collides with `--ok` / `--warn` / `--err` / `--info`. For example
`sapphire` uses a cyan `#6CB6C4` for `info` rather than a second blue, so a
cyan "info" dot never reads as "an accent thing".

## Component-layer changes

- `.panel` — `bg-surface-1`, `--shadow-1`, `--hi-line`.
- `.panel-head` — `--hi-line` on the header strip.
- `.btn` — `--hi-line-soft`; `box-shadow` joins the transition list.
- `.dtable thead th` — header fill is `color-mix(in srgb, var(--bg-1) 86%, var(--bg-2))`,
  i.e. the card surface nudged one step, plus `--hi-line`.
- `.dtable tbody td` — `px-3.5 py-2.5` for a slightly airier grid.
- `.stat-card` — `bg-surface-1` instead of the stage, so stats read as cards.
- `.stats-row` — `--shadow-1` + `--hi-line`.
- `.page-header` — fill is `color-mix(in srgb, var(--bg-0) 72%, var(--bg-1))`,
  which keeps the header tied to the stage instead of floating as a card.

## Per-page surface promotion

Page-level containers that were stage-coloured were promoted to card so the
canvas does not show through behind a page that is conceptually one object:

- Attribution, Policies (routing / credentials / MCP relay), System,
  Requests payload + SSE panes.
- Playground: the whole page is one card (`bg-surface-1`) with the chat area
  and the inspector recessed to `bg-surface-0`.

Deliberately left at `bg-surface-0`:

- The Requests list pane — it is the stage frame; the sections inside it are
  cards.
- The Policies tab strip — a recessed band.
- The login page shell — the form is the only card on the stage.

The matching skeletons (`RequestsPageSkeleton`, `RouteRequestsSkeleton`) were
updated to mirror the real page so the loading state doesn't jump.

## Login page

14 palettes overflowed the 28vw login rail and stacked vertically. The
swatches now live in their own wrapping row, and the mode toggle plus the
`self-hosted` / `tls` labels moved to a separate row below it.

## Verification

- `pnpm lint:fix`, `pnpm format:fix`, `pnpm typecheck` all exit clean.
- Browser-verified against the dev server in both dark and light mode:
  dashboard, requests, models, policies, playground, settings (theme picker).
- The compose instance on `:8181` runs the published image; it will not show
  these changes until a new image is built and pushed.
