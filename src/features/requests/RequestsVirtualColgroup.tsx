import { REQUESTS_COL_WIDTHS } from './requestsListUtils'

export function RequestsVirtualColgroup({ widths = REQUESTS_COL_WIDTHS }: { widths?: readonly (number | string)[] }) {
  return (
    <colgroup>
      {widths.map((w, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static column list
        <col key={i} style={{ width: w }} />
      ))}
    </colgroup>
  )
}
