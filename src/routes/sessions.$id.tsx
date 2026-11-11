import { createFileRoute } from '@tanstack/react-router'
import { SessionPage } from '../features/requests/SessionPage'
import { SessionPagePending } from '../features/requests/SessionPagePending'

export const Route = createFileRoute('/sessions/$id')({
  ssr: false,
  component: SessionRoute,
  pendingComponent: SessionPagePending,
})

function SessionRoute() {
  const { id } = Route.useParams()
  return <SessionPage id={id} />
}
