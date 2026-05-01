import { useState } from 'react'
import { CodeBlock } from '../../components/CodeBlock'
import { CopyIcon } from './CopyIcon'

type Props = {
  text: string
  inline?: boolean
  filename?: string
  lang?: string
}

export function CopyBlock({ text, inline, filename, lang }: Props) {
  const [copied, setCopied] = useState(false)

  const copy = () => {
    navigator.clipboard.writeText(text).then(
      () => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      },
      () => {},
    )
  }

  if (inline) {
    return (
      <button
        type="button"
        className="group justify-between inline-flex items-center gap-2 px-3 py-1.25 rounded bg-surface-3 border border-border font-mono text-sm text-fg cursor-pointer transition-colors hover:bg-surface-4 hover:border-border-strong"
        onClick={copy}
      >
        <code className="[font:inherit]" translate="no">
          {text}
        </code>
        <CopyIcon copied={copied} />
      </button>
    )
  }

  return <CodeBlock text={text} filename={filename} lang={lang} />
}
