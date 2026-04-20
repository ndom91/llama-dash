import { createFileRoute } from '@tanstack/react-router'
import { EndpointsPage } from '../features/endpoints/EndpointsPage'

export const Route = createFileRoute('/endpoints')({ component: EndpointsPage })
