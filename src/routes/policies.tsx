import { createFileRoute } from '@tanstack/react-router'
import { PoliciesPage } from '../features/policies/PoliciesPage'

export const Route = createFileRoute('/policies')({ component: PoliciesRoute })

function PoliciesRoute() {
  const search = Route.useSearch() as { tab?: string }
  return <PoliciesPage searchTab={search.tab} />
}
