/**
 * Identity ("series") colors for per-entity visualizations.
 *
 * Status colors (--ok / --warn / --err / --info) report *state* and must never
 * be used to tell *things* apart — a model painted --err because of its list
 * position is indistinguishable from a model that is actually failing. The
 * --series-* ramp in styles.css exists to carry identity instead: it is derived
 * from the active accent hue at a capped chroma, so it follows all theme
 * palettes while reading as a tinted-neutral family rather than as signal.
 */

export const SERIES_STEPS = 5

/** FNV-1a 32-bit. Stable across runs, platforms, and process restarts. */
function hash32(value: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/**
 * Maps entity ids to series steps (0-indexed).
 *
 * Hash-primary, so an entity keeps its step across re-renders and across
 * changes in API ordering — the previous implementation keyed off array
 * position, which meant a model's color changed whenever a *different* model
 * loaded or unloaded.
 *
 * Linear probing then guarantees that up to SERIES_STEPS concurrent entities
 * are visually distinct. This is a deliberate trade: with 5 ids into 5 buckets
 * a pure hash collides ~96% of the time (only 5!/5^5 ≈ 3.8% of draws are all
 * distinct), so perfect global stability and guaranteed distinctness are not
 * simultaneously achievable. Distinctness wins, because two same-colored bars
 * in one chart is a worse failure than a color changing between visits. Ids are
 * sorted first so the assignment never depends on input order.
 */
export function assignSeriesSteps(ids: ReadonlyArray<string>): Map<string, number> {
  const assigned = new Map<string, number>()
  const taken = new Set<number>()

  for (const id of [...ids].sort()) {
    if (taken.size === SERIES_STEPS) taken.clear()
    let step = hash32(id) % SERIES_STEPS
    while (taken.has(step)) step = (step + 1) % SERIES_STEPS
    taken.add(step)
    assigned.set(id, step)
  }

  return assigned
}

/** CSS custom-property reference for a series step. */
export function seriesVar(step: number): string {
  return `var(--series-${(step % SERIES_STEPS) + 1})`
}
