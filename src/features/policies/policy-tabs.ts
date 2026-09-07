import { KeyRound, Route, Shrink, Waypoints } from 'lucide-react'

export type PolicyTab = 'routing' | 'compression' | 'credentials' | 'mcp-relays'

export const POLICY_TABS: Array<{
  id: PolicyTab
  label: string
  icon: typeof Route
}> = [
  { id: 'routing', label: 'Routing', icon: Route },
  { id: 'compression', label: 'Compression', icon: Shrink },
  { id: 'credentials', label: 'Credentials', icon: KeyRound },
  { id: 'mcp-relays', label: 'MCP Relays', icon: Waypoints },
]

export function isPolicyTab(value: unknown): value is PolicyTab {
  return value === 'routing' || value === 'compression' || value === 'credentials' || value === 'mcp-relays'
}
