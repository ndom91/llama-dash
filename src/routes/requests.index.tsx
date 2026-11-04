import { createFileRoute } from '@tanstack/react-router'
import { RouteRequestsSkeleton } from '../components/skeleton/RouteRequestsSkeleton'
import { RequestsPage } from '../features/requests/RequestsPage'
import { validateRequestsSearch } from '../features/requests/requestsSearch'

export const Route = createFileRoute('/requests/')({
  ssr: false,
  component: RequestsPage,
  pendingComponent: RouteRequestsSkeleton,
  validateSearch: validateRequestsSearch,
})
