import type { KeyboardEvent } from 'react'

/**
 * Focus ring for a clickable table row.
 *
 * `--shadow-focus` is a 2px accent ring, but `box-shadow` on a `<tr>` is not
 * painted by Chrome when the table uses `border-collapse: collapse` (`.dtable`
 * does). An `outline` is painted on rows, so we mirror the same 2px accent ring
 * with an inset outline. The negative offset keeps it inside the row so it
 * isn't clipped by the `overflow-auto` table wrappers, and the background shift
 * matches the existing `.dtable tbody tr:hover` treatment.
 */
export const clickableRowFocusClass =
  'focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent focus-visible:bg-surface-2'

/**
 * Props for a table row that activates on click. Rows carried `onClick` with no
 * keyboard equivalent, making these tables mouse-only.
 *
 * Deliberately no `role="button"`: a `<tr>` with `role="button"` is no longer a
 * row, which orphans its `<td>` cells (`cell` requires a `row` parent) and
 * costs screen readers the table structure — row/column position, header
 * association, "row 3 of 20". Losing that is worse than the row having no
 * explicit widget role, so we keep the native table semantics and only add
 * keyboard reachability and activation.
 */
export function clickableRowProps(onActivate: () => void) {
  return {
    tabIndex: 0,
    onClick: onActivate,
    onKeyDown: (event: KeyboardEvent) => {
      // Rows can contain their own buttons. Enter on a nested <button> fires a
      // click and bubbles the keydown here, which would run both actions, so
      // only activate when the row itself holds focus.
      if (event.target !== event.currentTarget) return
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        onActivate()
      }
    },
  }
}
