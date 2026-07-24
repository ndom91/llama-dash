import { useNavigate } from '@tanstack/react-router'
import { Suspense, lazy, useCallback, useEffect, useState } from 'react'
import { PageHeader } from '../../components/PageHeader'
import { Tabs } from '../../components/Tabs'
import { usePlaygroundChat } from '../../lib/use-playground-chat'
import { PLAYGROUND_TABS, type PlaygroundTab, isPlaygroundTab } from './playground-tabs'

type PlaygroundConfig = {
  image: boolean
  speech: boolean
  transcribe: boolean
}

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
  const [config, setConfig] = useState<PlaygroundConfig>({ image: true, speech: true, transcribe: true })

  const allowedTabs = PLAYGROUND_TABS.filter((t) => {
    if (t.id === 'image') return config.image
    if (t.id === 'speech') return config.speech
    if (t.id === 'transcribe') return config.transcribe
    return true
  })

  const isValidTab = (t: PlaygroundTab) => allowedTabs.some((tab) => tab.id === t)
  const tab: PlaygroundTab = isPlaygroundTab(searchTab) && isValidTab(searchTab) ? searchTab : 'chat'

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

  useEffect(() => {
    fetch('/api/playground-config')
      .then((res) => res.json() as Promise<PlaygroundConfig>)
      .then(setConfig)
      .catch(() => {})
  }, [])

  return (
    <div className="content">
      <div className="page flex-1 min-h-0">
        <PageHeader title="Playground" variant="integrated" />

        {allowedTabs.length > 1 && (
          <Tabs
            items={allowedTabs}
            value={tab}
            onChange={setTab}
            variant="accent"
            className="bg-surface-0 px-6"
            ariaLabel="Playground modes"
          />
        )}

        <Suspense fallback={<PlaygroundTabPending label={tab} />}>
          {tab === 'chat' ? <PlaygroundChatTab chat={chat} /> : null}
          {tab === 'image' ? config.image && <PlaygroundImage /> : null}
          {tab === 'speech' ? config.speech && <PlaygroundSpeech /> : null}
          {tab === 'transcribe' ? config.transcribe && <PlaygroundTranscribe /> : null}
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
