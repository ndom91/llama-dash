import { useNavigate } from '@tanstack/react-router'
import { useCallback } from 'react'
import { PageHeader } from '../../components/PageHeader'
import { TopBar } from '../../components/TopBar'
import { cn } from '../../lib/cn'
import { usePlaygroundChat } from '../../lib/use-playground-chat'
import { PlaygroundChatTab } from './PlaygroundChatTab'
import { PlaygroundHeaderActions } from './PlaygroundHeaderActions'
import { PlaygroundImage } from './PlaygroundImage'
import { PlaygroundSpeech } from './PlaygroundSpeech'
import { PLAYGROUND_TABS, type PlaygroundTab, isPlaygroundTab } from './playground-tabs'
import { PlaygroundTranscribe } from './PlaygroundTranscribe'

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
    <div className="main-col">
      <TopBar />
      <div className="content">
        <div className="page pg-page">
          <PageHeader
            kicker="dsh · playground · compare"
            title="Playground"
            subtitle="Test prompts against loaded models · inspector visible · multi-model"
            variant="integrated"
            action={
              tab === 'chat' ? (
                <PlaygroundHeaderActions
                  presets={chat.presets}
                  savedRuns={chat.savedRuns}
                  onSavePreset={chat.savePreset}
                  onApplyPreset={chat.applyPreset}
                  onDeletePreset={chat.deletePreset}
                  onSaveRun={chat.saveRun}
                  onLoadRun={chat.loadRun}
                  onDeleteRun={chat.deleteRun}
                />
              ) : undefined
            }
          />

          <div className="pg-tab-bar pg-tab-bar-integrated">
            {PLAYGROUND_TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={cn('pg-tab', tab === item.id && 'pg-tab-active')}
                onClick={() => setTab(item.id)}
              >
                <item.Icon className="icon-12" strokeWidth={2} />
                {item.label}
              </button>
            ))}
          </div>

          {tab === 'chat' ? <PlaygroundChatTab chat={chat} /> : null}
          {tab === 'image' ? <PlaygroundImage /> : null}
          {tab === 'speech' ? <PlaygroundSpeech /> : null}
          {tab === 'transcribe' ? <PlaygroundTranscribe /> : null}
        </div>
      </div>
    </div>
  )
}
