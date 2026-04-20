import { createFileRoute } from '@tanstack/react-router'
import { KeyDetailPage } from '../features/keys/KeyDetailPage'

export const Route = createFileRoute('/keys/$id')({ component: KeyDetailRoute })

function KeyDetailRoute() {
  const { id } = Route.useParams()
  return <KeyDetailPage id={id} />
}
