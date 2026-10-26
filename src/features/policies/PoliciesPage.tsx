import { useNavigate } from '@tanstack/react-router'
import { useCallback } from 'react'
import { PageHeader } from '../../components/PageHeader'
import { Tabs } from '../../components/Tabs'
import { useUpstreamCredentials } from '../../lib/queries'
import { CredentialVaultPanelContainer } from './CredentialVaultPanelContainer'
import { McpRelayPanelContainer } from './McpRelayPanelContainer'
import { POLICY_TABS, type PolicyTab, isPolicyTab } from './policy-tabs'
import { RoutingPanel } from './RoutingPanel'

type Props = {
  searchTab?: string
}

export function PoliciesPage({ searchTab }: Props) {
  const navigate = useNavigate()
  const tab: PolicyTab = isPolicyTab(searchTab) ? searchTab : 'routing'
  const { data: credentialState } = useUpstreamCredentials()

  const setTab = useCallback(
    (nextTab: PolicyTab) => {
      navigate({
        to: '/policies',
        search: (prev: Record<string, unknown>) => ({ ...prev, tab: nextTab }),
        replace: true,
      })
    },
    [navigate],
  )

  return (
    <div className="content">
      <div className="page flex min-h-0 flex-1 flex-col bg-surface-1">
        <PageHeader
          kicker={`dsh · policies · ${tab}`}
          title="Policies"
          subtitle="Routing, credentials, and agent-facing relays"
          variant="integrated"
        />
        <Tabs
          items={POLICY_TABS}
          value={tab}
          onChange={setTab}
          variant="accent"
          className="bg-surface-0 px-6"
          ariaLabel="Policy sections"
        />
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="contents" hidden={tab !== 'routing'}>
            <RoutingPanel credentials={credentialState?.credentials ?? []} />
          </div>
          <div className="contents" hidden={tab !== 'credentials'}>
            <CredentialVaultPanelContainer />
          </div>
          <div className="contents" hidden={tab !== 'mcp-relays'}>
            <McpRelayPanelContainer />
          </div>
        </div>
      </div>
    </div>
  )
}
