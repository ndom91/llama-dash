import { useRequestCount } from '../../lib/queries'
import type { RequestListQuery } from '../../lib/request-query-data'
import type { StatusFilter } from '../../lib/request-filters'

type Props = { filters: RequestListQuery; status: StatusFilter; loadedCount: number; errorCount: number }

export function RequestsMatchCount({ filters, status, loadedCount, errorCount }: Props) {
  const query = useRequestCount(filters, status)
  let matches = query.isError ? 'count unavailable' : 'counting matches…'
  if (query.data)
    matches = `${query.data.count.toLocaleString()} ${query.data.count === 1 ? 'match' : 'matches'}${query.isError ? ' at last update' : ''}`
  return (
    <>
      <span className="panel-sub">
        {loadedCount.toLocaleString()} loaded · {matches}
        {errorCount > 0 ? ` · ${errorCount.toLocaleString()} loaded ${errorCount === 1 ? 'error' : 'errors'}` : ''}
      </span>
      {query.isError ? (
        <button type="button" className="btn btn-xs" disabled={query.isFetching} onClick={() => void query.refetch()}>
          Retry count
        </button>
      ) : null}
    </>
  )
}
