import { useCreateMcpRelay, useDeleteMcpRelay, useMcpRelays, useUpstreamCredentials } from '../../lib/queries'
import { PolicyPanel } from './CredentialVaultPanelContainer'
import { McpRelayPanel } from './McpRelayPanel'

export function McpRelayPanelContainer() {
  const { data: relays = [] } = useMcpRelays()
  const { data: credentialState } = useUpstreamCredentials()
  const createMcpRelayMutation = useCreateMcpRelay()
  const deleteMcpRelayMutation = useDeleteMcpRelay()

  return (
    <PolicyPanel title="MCP Relays" subtitle="explicit agent endpoints · provider credentials stay server-side">
      <McpRelayPanel
        relays={relays}
        credentials={credentialState?.credentials ?? []}
        createPending={createMcpRelayMutation.isPending}
        deletePending={deleteMcpRelayMutation.isPending}
        onCreate={(body) => createMcpRelayMutation.mutate(body)}
        onDelete={(id) => deleteMcpRelayMutation.mutate(id)}
      />
    </PolicyPanel>
  )
}
