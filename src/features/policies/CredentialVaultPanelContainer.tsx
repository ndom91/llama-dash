import { useMemo } from 'react'
import type { RoutingRule } from '../../lib/api'
import {
  useCreateUpstreamCredential,
  useDeleteUpstreamCredential,
  useMcpRelays,
  useRoutingRules,
  useUpstreamCredentials,
} from '../../lib/queries'
import { CredentialVaultPanel } from './CredentialVaultPanel'
import { PolicyPanel } from './PolicyPanel'

const INITIAL_RULES: RoutingRule[] = []

export function CredentialVaultPanelContainer() {
  const { data: rules = INITIAL_RULES } = useRoutingRules()
  const { data: mcpRelays = [] } = useMcpRelays()
  const { data: credentialState, error: credentialError } = useUpstreamCredentials()
  const createCredentialMutation = useCreateUpstreamCredential()
  const deleteCredentialMutation = useDeleteUpstreamCredential()
  const credentialUsage = useMemo(() => credentialUsageById(rules, mcpRelays), [rules, mcpRelays])

  return (
    <PolicyPanel title="Credentials" subtitle="encrypted provider secrets · placeholders for routing rules and relays">
      <CredentialVaultPanel
        credentials={credentialState?.credentials ?? []}
        vaultEnabled={credentialState?.vaultEnabled ?? false}
        vaultStatus={credentialState?.vaultStatus ?? 'missing_key'}
        errorMessage={credentialError?.message}
        createPending={createCredentialMutation.isPending}
        deletePending={deleteCredentialMutation.isPending}
        usageById={credentialUsage}
        onCreate={(body) => createCredentialMutation.mutate(body)}
        onDelete={(id) => deleteCredentialMutation.mutate(id)}
      />
    </PolicyPanel>
  )
}

function credentialUsageById(
  rules: RoutingRule[],
  relays: Array<{ credentialBindings: Array<{ credentialId: string }> }>,
): Map<string, { routingRules: number; mcpRelays: number }> {
  const usage = new Map<string, { routingRules: number; mcpRelays: number }>()
  const record = (credentialId: string, kind: 'routingRules' | 'mcpRelays') => {
    const current = usage.get(credentialId) ?? { routingRules: 0, mcpRelays: 0 }
    current[kind] += 1
    usage.set(credentialId, current)
  }
  for (const rule of rules) {
    const ids = new Set((rule.credentialBindings ?? []).map((binding) => binding.credentialId))
    if (rule.target.type === 'direct' && rule.target.credentialId) ids.add(rule.target.credentialId)
    for (const id of ids) record(id, 'routingRules')
  }
  for (const relay of relays) {
    for (const binding of relay.credentialBindings) record(binding.credentialId, 'mcpRelays')
  }
  return usage
}
