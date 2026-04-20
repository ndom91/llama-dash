import { REQUESTS_COL_WIDTHS } from './requestsListUtils'

export function RequestsVirtualColgroup() {
  return (
    <colgroup>
      {REQUESTS_COL_WIDTHS.map((w, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static column list
        <col key={i} style={{ width: w }} />
      ))}
    </colgroup>
  )
}
