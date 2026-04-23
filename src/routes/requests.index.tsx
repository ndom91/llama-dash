import { createFileRoute } from '@tanstack/react-router'
import { RequestsPage } from '../features/requests/RequestsPage'

type RequestsSearch = { model?: string; session?: string }

export const Route = createFileRoute('/requests/')({
  component: RequestsRoute,
  validateSearch: (search: Record<string, unknown>): RequestsSearch => ({
    model: typeof search.model === 'string' ? search.model : undefined,
    session: typeof search.session === 'string' ? search.session : undefined,
  }),
})

function RequestsRoute() {
  const { model, session } = Route.useSearch()
  return <RequestsPage modelParam={model} sessionParam={session} />
}
