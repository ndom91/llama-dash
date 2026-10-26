import { createFileRoute } from '@tanstack/react-router'
import { RequestDetailPage } from '../features/requests/RequestDetailPage'
import { RequestDetailPending } from '../features/requests/RequestDetailPending'

export const Route = createFileRoute('/requests/$id')({
  component: RequestDetailRoute,
  pendingComponent: RequestDetailPending,
})

function RequestDetailRoute() {
  const { id } = Route.useParams()
  return <RequestDetailPage id={id} />
}
