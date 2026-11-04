import { createFileRoute } from '@tanstack/react-router'
import { RouteLogsSkeleton } from '../components/skeleton/RouteLogsSkeleton'
import { LogsPage } from '../features/logs/LogsPage'

type LogsSearch = { q?: string }

export const Route = createFileRoute('/logs')({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): LogsSearch => ({
    q: typeof search.q === 'string' && search.q ? search.q : undefined,
  }),
  component: LogsPage,
  pendingComponent: RouteLogsSkeleton,
})
