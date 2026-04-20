import { PageHeader } from '../../components/PageHeader'
import { TopBar } from '../../components/TopBar'
import { AliasPanel } from './AliasPanel'
import { RequestLimitsPanel } from './RequestLimitsPanel'

export function PoliciesPage() {
  return (
    <div className="main-col">
      <TopBar />
      <div className="content">
        <div className="page policies-page">
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
