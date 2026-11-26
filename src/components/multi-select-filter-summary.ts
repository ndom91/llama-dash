import { isSetFilterActive, type SetFilter, setFilterIncludes } from '../lib/request-filters'

export type MultiSelectFilterOption = {
  value: string
  label: string
  /** Built-in buckets such as "No key" render italic and muted. */
  system?: boolean
}

export type MultiSelectFilterSummary = {
  label: string
  /** `checked/total`, or `0` when nothing is selected. Absent while the filter is off. */
  badge?: string
  tone: 'idle' | 'active' | 'empty'
}

/** Trigger text for a multi-select filter: names when few, "All except" when few are unchecked, else a count. */
export function summarizeSetFilter(
  options: readonly MultiSelectFilterOption[],
  value: SetFilter,
  noun: string,
  allLabel = `All ${noun}`,
): MultiSelectFilterSummary {
  if (!isSetFilterActive(value)) return { label: allLabel, tone: 'idle' }
  const checked = options.filter((o) => setFilterIncludes(value, o.value))
  const unchecked = options.filter((o) => !setFilterIncludes(value, o.value))
  if (checked.length === 0) return { label: `No ${noun}`, badge: '0', tone: 'empty' }
  const badge = `${checked.length}/${options.length}`
  const names = (list: readonly MultiSelectFilterOption[]) => list.map((o) => o.label).join(', ')
  let label: string
  if (unchecked.length === 0) label = allLabel
  else if (checked.length <= 2 && checked.length <= unchecked.length) label = names(checked)
  else if (unchecked.length <= 2) label = `All except ${names(unchecked)}`
  else if (checked.length <= 2) label = names(checked)
  else label = `${checked.length} of ${options.length} ${noun}`
  return { label, badge, tone: 'active' }
}
