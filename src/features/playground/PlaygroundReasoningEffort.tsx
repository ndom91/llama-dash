import { useEffect } from 'react'
import { useModelReasoningEffort } from '../../lib/queries'
import { PlaygroundSessionSection } from './PlaygroundSessionSection'

type Props = {
  model: string
  running: boolean
  value: string | null
  onChange: (value: string | null) => void
}

// llama-server only reports the levels of a running model, so this appears
// after the model has loaded (for example after the first message).
export function PlaygroundReasoningEffort({ model, running, value, onChange }: Props) {
  const { data: levels } = useModelReasoningEffort(model, running)

  // A level saved for another model may not exist for this one.
  useEffect(() => {
    if (levels && value != null && !levels.includes(value)) onChange(null)
  }, [levels, value, onChange])

  if (!levels || levels.length === 0) return null

  return (
    <PlaygroundSessionSection label="reasoning effort">
      <select
        className="select-native w-full rounded-sm border border-border bg-surface-2 px-2 py-1.5 font-mono text-xs text-fg focus:border-accent focus:outline-none"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
      >
        <option value="">template default</option>
        {levels.map((level) => (
          <option key={level} value={level}>
            {level}
          </option>
        ))}
      </select>
    </PlaygroundSessionSection>
  )
}
