import { createFileRoute } from '@tanstack/react-router'
import { SessionPage } from '../features/requests/SessionPage'
import { SessionPagePending } from '../features/requests/SessionPagePending'

export const Route = createFileRoute('/sessions/$id')({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { show?: string } => ({
    show: typeof search.show === 'string' ? search.show : undefined,
  }),
  component: SessionRoute,
  pendingComponent: SessionPagePending,
})

function SessionRoute() {
  const { id } = Route.useParams()
  return <SessionPage id={id} />
}
