import { createFileRoute } from '@tanstack/react-router'
import { SessionPage } from '../features/requests/SessionPage'

export const Route = createFileRoute('/sessions/$id')({
  ssr: false,
  component: SessionRoute,
})

function SessionRoute() {
  const { id } = Route.useParams()
  return <SessionPage id={id} />
}
