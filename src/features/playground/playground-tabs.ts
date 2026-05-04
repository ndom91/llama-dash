import { ImageIcon, MessageSquare, Mic, Volume2 } from 'lucide-react'

export type PlaygroundTab = 'chat' | 'image' | 'speech' | 'transcribe'

export const PLAYGROUND_TABS: Array<{
  id: PlaygroundTab
  label: string
  icon: typeof MessageSquare
}> = [
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'image', label: 'Image', icon: ImageIcon },
  { id: 'speech', label: 'Speech', icon: Volume2 },
  { id: 'transcribe', label: 'Transcribe', icon: Mic },
]

export function isPlaygroundTab(value: unknown): value is PlaygroundTab {
  return value === 'chat' || value === 'image' || value === 'speech' || value === 'transcribe'
}
