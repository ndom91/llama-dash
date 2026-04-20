import { BookOpen, Play, Save } from 'lucide-react'
import type { usePlaygroundChat } from '../../lib/use-playground-chat'
import { Tooltip } from '../../components/Tooltip'
import { PlaygroundDropMenu } from './PlaygroundDropMenu'

type ChatState = ReturnType<typeof usePlaygroundChat>

type Props = {
  presets: ChatState['presets']
  savedRuns: ChatState['savedRuns']
  onSavePreset: (name: string) => void
  onApplyPreset: (id: string) => void
  onDeletePreset: (id: string) => void
  onSaveRun: (name: string) => void
  onLoadRun: (id: string) => void
  onDeleteRun: (id: string) => void
}

export function PlaygroundHeaderActions({
  presets,
  savedRuns,
  onSavePreset,
  onApplyPreset,
  onDeletePreset,
  onSaveRun,
  onLoadRun,
  onDeleteRun,
}: Props) {
  return (
    <>
      <PlaygroundDropMenu
        label="Presets"
        icon={<BookOpen className="icon-12" strokeWidth={2} />}
        items={presets.map((p) => ({
          id: p.id,
          label: p.name,
          sub: `${p.model || '—'} · t=${p.sampling.temperature.toFixed(2)}`,
        }))}
        onSelect={onApplyPreset}
        onDelete={onDeletePreset}
        onAdd={() => {
          const name = window.prompt('Preset name:')
          if (name?.trim()) onSavePreset(name.trim())
        }}
        addLabel="Save current as preset"
        emptyLabel="No presets yet."
      />
      <PlaygroundDropMenu
        label="Saved runs"
        icon={<Save className="icon-12" strokeWidth={2} />}
        items={savedRuns.map((r) => ({
          id: r.id,
          label: r.name,
          sub: `${r.messages.length} msgs · ${r.model || '—'}`,
        }))}
        onSelect={onLoadRun}
        onDelete={onDeleteRun}
        onAdd={() => {
          const name = window.prompt('Save run as:', `run-${new Date().toISOString().slice(11, 19)}`)
          if (name?.trim()) onSaveRun(name.trim())
        }}
        addLabel="Save current chat"
        emptyLabel="No saved runs."
      />
      <Tooltip label="Compare mode coming soon">
        <button type="button" className="btn btn-ghost btn-xs pg-run-all" disabled>
          <Play className="icon-12" strokeWidth={2} />
          Run all
        </button>
      </Tooltip>
    </>
  )
}
