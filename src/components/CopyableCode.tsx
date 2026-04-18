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
    <button type="button" className="copyable-code" onClick={copy} title="Click to copy">
      <code translate="no">{text}</code>
      {copied ? (
        <Check className="copyable-icon copied" size={12} strokeWidth={2} aria-hidden="true" />
      ) : (
        <Copy className="copyable-icon" size={12} strokeWidth={2} aria-hidden="true" />
      )}
    </button>
  )
}
