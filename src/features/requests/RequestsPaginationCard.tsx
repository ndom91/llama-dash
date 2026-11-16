import { Tooltip } from '../../components/Tooltip'

export function RequestsPaginationCard({
  hasLocalFilters,
  hasNextPage,
  isFetching,
  isFetchingNextPage,
  isFetchNextPageError,
  onLoadMore,
}: {
  hasLocalFilters: boolean
  hasNextPage: boolean
  isFetching: boolean
  isFetchingNextPage: boolean
  isFetchNextPageError: boolean
  onLoadMore: () => void
}) {
  const exhausted = !hasNextPage && !isFetchingNextPage
  const button = (
    <button
      type="button"
      className={`btn btn-ghost btn-sm mt-2 ${exhausted ? 'cursor-not-allowed opacity-50' : ''}`}
      aria-disabled={exhausted || isFetching}
      aria-busy={isFetchingNextPage}
      onClick={() => {
        if (!exhausted && !isFetching) onLoadMore()
      }}
    >
      {isFetchNextPageError ? 'Retry loading older requests' : 'Load older requests'}
    </button>
  )

  return (
    <div className="mx-auto mt-6 mb-6 w-fit max-w-[calc(100%-2rem)] rounded-md border border-border bg-surface-2 px-5 py-4 text-center text-xs text-fg-muted">
      {exhausted ? (
        <div role="status">No more older requests available.</div>
      ) : isFetchNextPageError ? (
        <div>Could not load older requests.</div>
      ) : hasLocalFilters ? (
        <div>Filters apply to loaded requests.</div>
      ) : null}
      {exhausted ? (
        <Tooltip label="No more older requests available to load" side="top">
          {button}
        </Tooltip>
      ) : (
        button
      )}
    </div>
  )
}
