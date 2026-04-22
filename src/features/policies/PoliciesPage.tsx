import { PageHeader } from '../../components/PageHeader'
import { TopBar } from '../../components/TopBar'
import { RoutingPanel } from './RoutingPanel'

export function PoliciesPage() {
  return (
    <div className="main-col">
      <TopBar />
      <div className="content">
        <div className="page flex min-h-0 flex-1 flex-col bg-surface-1">
          <PageHeader
            kicker="dsh · policies"
            title="Policies"
            subtitle="proxy-layer request transforms"
            variant="integrated"
          />
          <div className="flex min-h-0 flex-1 flex-col">
            <RoutingPanel />
          </div>
        </div>
      </div>
    </div>
  )
}
