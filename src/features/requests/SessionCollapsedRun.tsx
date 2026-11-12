import { useState, type ReactNode } from 'react'

export function SessionCollapsedRun({
  summary,
  className,
  anchors,
  children,
}: {
  summary: ReactNode
  className: string
  anchors: string[]
  children: () => ReactNode
}) {
  const [opened, setOpened] = useState(false)
  return (
    <details
      className={className}
      onToggle={(event) => {
        if (event.currentTarget.open) setOpened(true)
      }}
    >
      <summary>{summary}</summary>
      {opened ? children() : anchors.map((id) => <span key={id} id={id} />)}
    </details>
  )
}
