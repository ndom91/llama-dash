import { useState } from 'react'
import {
  useConnectProvider,
  useDisconnectProvider,
  useProviderConnections,
  useTestProvider,
  useUpstreamCredentials,
} from '../../lib/queries'
import { PolicyPanel } from './CredentialVaultPanelContainer'
import { ProvidersPanel } from './ProvidersPanel'

export function ProvidersPanelContainer() {
  const { data: connections = [] } = useProviderConnections()
  const { data: credentialState } = useUpstreamCredentials()
  const connectMutation = useConnectProvider()
  const disconnectMutation = useDisconnectProvider()
  const testMutation = useTestProvider()
  const [lastTest, setLastTest] = useState<
    { targetId: string; ok: boolean; message: string; latencyMs: number; models: string[] } | undefined
  >(undefined)

  return (
    <PolicyPanel
      title="Providers"
      subtitle="connect a subscription API key — OpenAI and Anthropic surfaces wire together"
    >
      <ProvidersPanel
        connections={connections}
        vaultEnabled={credentialState?.vaultEnabled ?? false}
        connectPending={connectMutation.isPending}
        disconnectPending={disconnectMutation.isPending}
        testPending={testMutation.isPending}
        testResult={lastTest}
        onConnect={(body) => {
          connectMutation.mutate(body, {
            onSuccess: () => setLastTest(undefined),
          })
        }}
        onDisconnect={(targetId) => {
          disconnectMutation.mutate(targetId, {
            onSuccess: () => setLastTest(undefined),
          })
        }}
        onTest={(body) => {
          testMutation.mutate(body, {
            onSuccess: (result) =>
              setLastTest({
                targetId: body.targetId,
                ok: result.ok,
                message: result.message,
                latencyMs: result.latencyMs,
                models: result.models,
              }),
          })
        }}
      />
    </PolicyPanel>
  )
}
