import { KeyRound, Route, Waypoints } from 'lucide-react'

export type PolicyTab = 'routing' | 'credentials' | 'mcp-relays'

export const POLICY_TABS: Array<{
  id: PolicyTab
  label: string
  icon: typeof Route
}> = [
  { id: 'routing', label: 'Routing', icon: Route },
  { id: 'credentials', label: 'Credentials', icon: KeyRound },
  { id: 'mcp-relays', label: 'MCP Relays', icon: Waypoints },
]

export function isPolicyTab(value: unknown): value is PolicyTab {
  return value === 'routing' || value === 'credentials' || value === 'mcp-relays'
}
