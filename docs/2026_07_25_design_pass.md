# Design pass: signal-rich → signal-honest

Date: 2026-07-25

## Why

The dashboard already had a deliberate point of view — terminal-operator, mono
micro-labels, tabular figures, one accent, eight accent palettes. What it had
instead of sloppiness was **over-signalling**, in three specific forms:

1. **Status colour spent on identity.** `--ok` / `--warn` / `--err` / `--info`
   carry semantic weight, and they were being used to tell *things* apart rather
   than report *states*.
2. **The same fact rendered 3–5 times on one screen**, with the duplicates
   sometimes louder than, or contradicting, the original.
3. **Chrome rendered where there was no information** — animation on static
   data, colour on zero values, affordances nothing implemented.

The fix throughout was subtraction and re-assignment, not addition.

## The series ramp

Identity now has its own colour channel, separate from status.

`themeStyleVars()` in `src/lib/theme.ts` emits two tokens — `--ld-series-h` and
`--ld-series-c` — taken from the active accent's oklch hue and chroma. The
lightness/chroma *band* lives in `src/styles.css`, once per colour mode.

Why two tokens rather than five precomputed colours: `themeStyleVars()` feeds
three injection paths, one of which is a **render-blocking** inline script
(`theme-init-script.ts`). Five colours × two modes × eight palettes is ~3.4 KB of
blocking script; two numbers is ~60 bytes.

### Design decisions

- **Lightness is anchored to an absolute band, not offset from the accent's own
  L.** Accent lightness ranges 72–87% across the eight palettes; offsetting would
  push `chartreuse` (85%) and `monochrome` (87%) past 100% and clip. Only hue and
  chroma come from the accent.
- **Lightness is the primary axis, chroma inversely coupled as a second cue.**
  `monochrome` has `C = 0.005`, so any chroma-primary encoding vanishes entirely
  in that theme. Lightness *has* to carry it.
- **Dark and light invert.** Bars sit on `--bg-3`, which is `#1c2024` (L≈24%) in
  dark and `#eef0eb` (L≈94%) in light. Dark descends 88→56% lightness; light
  ascends 36→64%. Contrast *ordering* is preserved, so `--series-1` is the most
  prominent step in both modes.

### Known limitation, stated plainly

In four of the eight palettes the accent is **byte-identical** to a status
colour:

| palette | accent `500` | equals |
| --- | --- | --- |
| `phosphor` | `#9DC98A` | `status.ok` |
| `amber` | `#D9B86A` | `status.warn` |
| `blueprint` | `#7BC4D4` | `status.info` |
| `steel` | `#8AAEDB` | `status.info` |

A same-hue ramp therefore *cannot* be unconfusable with status in those themes.
Capping series chroma at 0.55× accent means every step is visibly desaturated
against its status counterpart (`--ok` ≈ `oklch(80% 0.075 135)` vs `phosphor`
`--series-2` = `oklch(80% 0.041 135)`), so the ramp reads as a tinted-neutral
family while status is always a single flat fill. That is a mitigation, not a
proof. Dropping the top factor to ~0.40 would make it near-achromatic in every
theme if the confusion ever bites.

### Stable assignment

`src/lib/series-color.ts` hashes the entity id (FNV-1a) to a step, with linear
probing and id-sorted iteration.

Colours were previously keyed off `active.findIndex(...)`, so **unloading any
model reshuffled the colour of every other model**. Hashing fixes that. The
probing is a deliberate trade: with 5 ids into 5 buckets a pure hash produces all
distinct steps only `5!/5⁵ ≈ 3.8%` of the time, so guaranteed distinctness and
perfect stability are not simultaneously achievable. Distinctness wins — two
same-coloured bars in one chart is a worse failure than a colour changing between
visits. A model keeps its step unless another model hashes to the same bucket
*and* sorts earlier; `series-color.test.ts` documents both behaviours.

### Peers

Peer models are resident on another host. They previously got `--info` as a fill
plus an `--info-bg` track tint, which made them read as one more identity. They
now render as a `--fg-dim` hatch with no fill — colourless by construction, so it
can be neither a series step nor a status. Span geometry is kept (peers have real
time ranges; an empty track would discard data). Derived from `--fg-dim`, which
already flips per mode, so light mode needs no second rule.

## `g`-leader keyboard navigation

The sidebar's `D01` / `R02` / `L03` codes were decorative — nothing read them,
the letters weren't unique (`P06` Playground vs `P10` Policies), and the ordinals
renumbered whenever a nav item was hidden by backend capability. They are now
real bindings.

| | | | |
| --- | --- | --- | --- |
| `g d` Dashboard | `g r` Requests | `g l` Logs | `g s` System |
| `g m` Models | `g p` Playground | `g c` Config | `g k` API Keys |
| `g a` Attribution | `g o` Policies | `g e` Endpoints | `g ,` Settings |

`h` is deliberately unassigned so request detail's existing `H` never collides.

Sequence *matching* is native to `@tanstack/react-hotkeys` (`useHotkeySequence`);
no custom state machine is needed, and `ignoreInputs` defaults to `true` for
bare-letter sequences, so typing in the Playground composer is guarded for free.

`src/lib/nav-leader.ts` exists for two things matching does not cover:

- **The collision guard.** `g l` and `g k` overlap with the standalone `L`
  handler on request detail and the `k` case in the requests list. Propagation
  cannot solve it — the hotkey manager, sequence manager, and the requests-list
  listener all attach to `document`, and `stopPropagation` does not stop sibling
  listeners on the same node. The tracker runs in the **capture** phase so every
  bubble-phase consumer sees the correct pending state for the same keydown, and
  defers its reset with `queueMicrotask` (one DOM dispatch is one task, so the
  microtask flushes only after all handlers for that event have run).
- **The affordance.** A leader key is invisible modal state. The tracker toggles
  `data-leader-pending` on `<html>`; CSS dims `g` and lights the target glyph.
  No React render per keystroke.

Accessibility: **no `aria-keyshortcuts`.** That attribute is specified for key
*combinations*, so `"G D"` would be announced as two independent shortcuts.
Instead: two adjacent `<kbd>` elements (the correct markup for a sequence — one
`<kbd>` around both would mean a single keystroke), `aria-hidden` on the visual
pair, and an `sr-only` "shortcut g then d".

## Request detail

Rail is the single home for timing, because it renders at every width whereas
`.request-detail-sidecar` is `display:none` below 1500px.

Removed duplicates: the stats-strip endpoint cell (repeated the `h1` at 22px vs
20px, so the copy was louder than the original), the sidecar `PHASES` list (five
of six rows verbatim identical to the rail), and the sidecar `IN`/`OUT` token
tiles (which also *disagreed* with the strip — `toLocaleString` vs a compact
formatter, so a 24,000-token prompt read `24,000` and `24k` simultaneously).

Values that could not be correct, now gone or fixed:

- `queueMs` was initialised `null` and never assigned — the `queue` row could
  only ever render `—`. Removed from the type.
- `ttftMs` was assigned the prefill value verbatim, so `prefill` and `ttft`
  always printed the same number. Removed; the remaining row is labelled
  `prefill`, which is what llama.cpp's `prompt_ms` actually measures. Real TTFT
  needs queue and network time, which is not captured for proxied requests (the
  Playground measures it properly from its own request clock).
- `served` and `routed` contradicted each other ~30px apart — one fell back to
  `req.model`, the other to `—`. Model names now live only in the Model section.
- `ROUTING` fabricated values for unrouted requests: `authorization: default`
  asserted even when the `auth` row directly above showed `—`, and
  `target: llama_swap` asserted for requests with no target. The section now
  collapses to one honest line.

`RequestTokenTrace` had a hard-coded `w-full` bar with an infinite 4.2s gradient
sweep — animating forever on a request that finished minutes ago — while the
parent computed real `prefillMs`/`decodeMs` and passed neither. It now renders
the measured phase split, with the unaccounted remainder (queue, network,
teardown) showing as untinted track.

The headers table pinned nothing: every key got `--accent` equally, so
`sec-ch-ua-platform-version` read as loudly as `authorization`, and with the pane
capped at 50% height eight `sec-ch-ua-*` rows could push `content-type` below the
fold purely by serialization order. `groupHeaders()` now sorts meaningful headers
first and collapses browser boilerplate behind a toggle.

## Log viewer

`llama.cpp` was permanently `text-ok` green, so a fatal upstream error arrived
with a green badge — source identity wearing a status colour. It is now neutral.

`displayLevel = level ?? (source === 'upstream' ? 'DEBUG' : 'INFO')` fabricated
severity for any unprefixed line, and the invented value was visually identical
to a parsed one. Removed. In its place, `parseLogLevel()` now understands
llama.cpp's *actual* severity marker — the single letter between its uptime
timestamp and the component name (`4801.04.670.511 W srv alloc: …`) — so genuine
warnings surface instead of being flattened into a field of fake `DEBUG`.

`INFO` was `text-info` (blue), painting the most common level — the one meaning
"nothing to see here" — more brightly than `DEBUG`, and turning the gutter into a
solid blue column on any info-heavy stream. Only `WARN` and `ERROR` get colour
now.

### Reverted: collapsing repeated gutters

Rendering the timestamp and source only when they *changed* was tried and backed
out. The arrival timestamp is captured once per SSE event, and the initial
backlog arrives as a **single** event — so hundreds of consecutive lines shared a
value, rendered with empty gutters, and the whole upstream block lost its left
edge. The repetition is the lesser problem; de-emphasis carries the hierarchy
instead.

## Deliberately not done

Parts of the generic "modernise a UI" playbook would damage this app:

- **No font change.** Geist Sans + JetBrains Mono is right here.
- **All-caps mono micro-labels kept.** They are the house voice.
- **Density, left sidebar, and the multi-metric stat row kept.** This is an
  operator console. "Try top nav", "double the whitespace", "replace the
  equal-column row" is marketing-page advice.
- **No background imagery, noise, grain, or gradient surfaces.** Decoration on a
  telemetry surface.
- **No new accent, no glassmorphism, no added motion.** The motion budget was
  already right; this pass *removed* the one animation that misrepresented state.

## Known remaining item

The light-theme token block is duplicated between `:root[data-theme='light']`
and `@media (prefers-color-scheme: light)`, and **must be edited in both
places**. It cannot be merged: `theme-init-script.ts` *removes* `data-theme` when
the mode is `auto` (the default), so the media query is what applies light mode
for most users, while the attribute selector is what lets an explicit choice
override the OS. A real fix means changing the `data-theme` contract to always
carry the resolved mode, which touches the SSR and hydration paths. Both blocks
now carry a comment marking the constraint.
