import { ImageIcon, MessageSquare, Mic, Volume2 } from 'lucide-react'

export type PlaygroundTab = 'chat' | 'image' | 'speech' | 'transcribe'

export const PLAYGROUND_TABS: Array<{
  id: PlaygroundTab
  label: string
  Icon: typeof MessageSquare
}> = [
  { id: 'chat', label: 'Chat', Icon: MessageSquare },
  { id: 'image', label: 'Image', Icon: ImageIcon },
  { id: 'speech', label: 'Speech', Icon: Volume2 },
  { id: 'transcribe', label: 'Transcribe', Icon: Mic },
]

export function isPlaygroundTab(value: unknown): value is PlaygroundTab {
  return value === 'chat' || value === 'image' || value === 'speech' || value === 'transcribe'
}
