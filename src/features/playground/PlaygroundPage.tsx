import { useNavigate } from '@tanstack/react-router'
import { Suspense, lazy, useCallback } from 'react'
import { PageHeader } from '../../components/PageHeader'
import { Tabs } from '../../components/Tabs'
import { usePlaygroundChat } from '../../lib/use-playground-chat'
import { PLAYGROUND_TABS, type PlaygroundTab, isPlaygroundTab } from './playground-tabs'

const PlaygroundChatTab = lazy(() => import('./PlaygroundChatTab').then((mod) => ({ default: mod.PlaygroundChatTab })))
const PlaygroundImage = lazy(() => import('./PlaygroundImage').then((mod) => ({ default: mod.PlaygroundImage })))
const PlaygroundSpeech = lazy(() => import('./PlaygroundSpeech').then((mod) => ({ default: mod.PlaygroundSpeech })))
const PlaygroundTranscribe = lazy(() =>
  import('./PlaygroundTranscribe').then((mod) => ({ default: mod.PlaygroundTranscribe })),
)

type Props = {
  searchTab?: string
}

export function PlaygroundPage({ searchTab }: Props) {
  const navigate = useNavigate()
  const tab: PlaygroundTab = isPlaygroundTab(searchTab) ? searchTab : 'chat'

  const setTab = useCallback(
    (nextTab: PlaygroundTab) => {
      navigate({
        to: '/playground',
        search: (prev: Record<string, unknown>) => ({ ...prev, tab: nextTab }),
        replace: true,
      })
    },
    [navigate],
  )

  const chat = usePlaygroundChat()

  return (
    <div className="content">
      <div className="page flex-1 min-h-0">
        <PageHeader
          kicker={`dsh · playground · ${tab}`}
          title="Playground"
          subtitle="Test prompts against loaded models · inspector visible · multi-model"
          variant="integrated"
        />

        <Tabs
          items={PLAYGROUND_TABS}
          value={tab}
          onChange={setTab}
          variant="accent"
          className="bg-surface-0 px-6"
          ariaLabel="Playground modes"
        />

        <Suspense fallback={<PlaygroundTabPending label={tab} />}>
          {tab === 'chat' ? <PlaygroundChatTab chat={chat} /> : null}
          {tab === 'image' ? <PlaygroundImage /> : null}
          {tab === 'speech' ? <PlaygroundSpeech /> : null}
          {tab === 'transcribe' ? <PlaygroundTranscribe /> : null}
        </Suspense>
      </div>
    </div>
  )
}

function PlaygroundTabPending({ label }: { label: string }) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center bg-surface-1 p-6">
      <div className="font-mono text-xs text-fg-dim">loading {label} workspace...</div>
    </div>
  )
}
