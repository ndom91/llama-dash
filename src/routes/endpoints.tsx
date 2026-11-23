import { createFileRoute } from '@tanstack/react-router'
import { EndpointsPage } from '../features/endpoints/EndpointsPage'
import { validateEndpointsSearch } from '../features/endpoints/endpointsSearch'

export const Route = createFileRoute('/endpoints')({
  component: EndpointsPage,
  validateSearch: validateEndpointsSearch,
})
