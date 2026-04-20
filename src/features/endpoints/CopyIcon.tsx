import { Check, Copy } from 'lucide-react'

type Props = {
  copied: boolean
}

export function CopyIcon({ copied }: Props) {
  return copied ? (
    <Check size={13} strokeWidth={2} className="text-ok" />
  ) : (
    <Copy size={13} strokeWidth={2} className="text-fg-muted" />
  )
}
