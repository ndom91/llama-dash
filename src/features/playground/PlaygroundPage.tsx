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
        <div className="page flex-1 min-h-0">
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

          <div className="flex gap-0 border-b border-border bg-surface-0 px-6">
            {PLAYGROUND_TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={cn(
                  'mb-[-1px] inline-flex items-center gap-1.5 border-b-2 border-transparent px-3.5 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-muted transition-colors duration-150 hover:bg-surface-3 hover:text-fg',
                  tab === item.id && 'border-accent bg-surface-2 text-accent',
                )}
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
