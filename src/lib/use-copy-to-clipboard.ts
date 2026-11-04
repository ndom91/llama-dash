import { useCallback, useState } from 'react'

export function useCopyToClipboard(resetMs: number) {
  const [copied, setCopied] = useState(false)

  const copy = useCallback(
    (text: string) =>
      navigator.clipboard.writeText(text).then(
        () => {
          setCopied(true)
          setTimeout(() => setCopied(false), resetMs)
        },
        () => {},
      ),
    [resetMs],
  )

  return { copied, copy }
}
