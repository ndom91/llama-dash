import { Check, Copy } from 'lucide-react'
import { useState } from 'react'

export function CopyableCode({ text }: { text: string }) {
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

  return (
    <button
      type="button"
      className="group inline-flex items-center gap-[5px] px-1.5 py-px rounded-sm bg-surface-3 border border-border font-mono text-[length:inherit] text-fg-muted cursor-pointer transition-[background,border-color] duration-150 hover:bg-surface-4 hover:border-border-strong hover:text-fg focus-visible:shadow-focus"
      onClick={copy}
      title="Click to copy"
    >
      <code className="[font:inherit]" translate="no">
        {text}
      </code>
      {copied ? (
        <Check
          className="shrink-0 opacity-100 text-ok transition-opacity duration-150"
          size={12}
          strokeWidth={2}
          aria-hidden="true"
        />
      ) : (
        <Copy
          className="shrink-0 opacity-50 transition-opacity duration-150 group-hover:opacity-80"
          size={12}
          strokeWidth={2}
          aria-hidden="true"
        />
      )}
    </button>
  )
}
