export function shouldLoadNextRequestPage({
  lastIndex,
  rowCount,
  hasNextPage,
  isFetching,
  isFetchNextPageError,
  hasLocalFilters,
}: {
  lastIndex: number | undefined
  rowCount: number
  hasNextPage: boolean | undefined
  isFetching: boolean
  isFetchNextPageError: boolean
  hasLocalFilters: boolean
}) {
  return (
    lastIndex !== undefined &&
    lastIndex >= rowCount - 20 &&
    !!hasNextPage &&
    !isFetching &&
    !isFetchNextPageError &&
    !hasLocalFilters
  )
}
