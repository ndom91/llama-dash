import { RequestsFilterField } from './RequestsFilterField'

type Props = {
  label: string
  header: string
  value: string
  placeholder: string
  onChange: (value: string) => void
}

export function RequestsAttributionFilterInput({ label, header, value, placeholder, onChange }: Props) {
  return (
    <RequestsFilterField label={label} hint={header}>
      <input
        className="h-8 rounded border border-border-strong bg-surface-2 px-2 font-mono text-xs text-fg outline-none transition-[border-color,box-shadow] duration-100 focus:border-accent focus:[box-shadow:var(--shadow-focus)]"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        data-1p-ignore
        data-lpignore="true"
        data-bwignore="true"
      />
    </RequestsFilterField>
  )
}
