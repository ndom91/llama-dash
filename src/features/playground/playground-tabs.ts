import { AudioLines, ImageIcon, MessageSquare, Mic, Volume2 } from 'lucide-react'

export type PlaygroundTab = 'chat' | 'image' | 'speech' | 'transcribe' | 'realtime'

export const PLAYGROUND_TABS: Array<{
  id: PlaygroundTab
  label: string
  icon: typeof MessageSquare
}> = [
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'image', label: 'Image', icon: ImageIcon },
  { id: 'speech', label: 'Speech', icon: Volume2 },
  { id: 'transcribe', label: 'Transcribe', icon: Mic },
  { id: 'realtime', label: 'Realtime', icon: AudioLines },
]

export function isPlaygroundTab(value: unknown): value is PlaygroundTab {
  return PLAYGROUND_TABS.some((tab) => tab.id === value)
}
