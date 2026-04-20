import { createFileRoute } from '@tanstack/react-router'
import { RequestsPage } from '../features/requests/RequestsPage'

type RequestsSearch = { model?: string }

export const Route = createFileRoute('/requests/')({
  component: RequestsRoute,
  validateSearch: (search: Record<string, unknown>): RequestsSearch => ({
    model: typeof search.model === 'string' ? search.model : undefined,
  }),
})

function RequestsRoute() {
  const { model } = Route.useSearch()
  return <RequestsPage modelParam={model} />
}
