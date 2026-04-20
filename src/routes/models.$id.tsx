import { createFileRoute } from '@tanstack/react-router'
import { ModelDetailPage } from '../features/models/ModelDetailPage'

export const Route = createFileRoute('/models/$id')({ component: ModelDetailRoute })

function ModelDetailRoute() {
  const { id } = Route.useParams()
  return <ModelDetailPage id={id} />
}
