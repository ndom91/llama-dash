import { PageHeader } from '../../components/PageHeader'
import { TopBar } from '../../components/TopBar'
import { AliasPanel } from './AliasPanel'
import { RequestLimitsPanel } from './RequestLimitsPanel'

export function PoliciesPage() {
  return (
    <div className="main-col">
      <TopBar />
      <div className="content">
        <div className="page min-h-full bg-surface-1">
          <PageHeader
            kicker="dsh · policies"
            title="Policies"
            subtitle="proxy-layer request transforms"
            variant="integrated"
          />
          <AliasPanel />
          <RequestLimitsPanel />
        </div>
      </div>
    </div>
  )
}
