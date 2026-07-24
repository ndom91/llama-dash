/**
 * Copy text to the clipboard. Prefer the async Clipboard API; fall back to a
 * hidden textarea + execCommand for non-secure contexts (e.g. http://LAN-IP)
 * where navigator.clipboard.writeText is unavailable or rejects.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof text !== 'string') return false

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // Fall through to legacy path.
    }
  }

  if (typeof document === 'undefined') return false
  return copyWithExecCommand(text)
}

function copyWithExecCommand(text: string): boolean {
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.top = '0'
    ta.style.left = '0'
    ta.style.width = '1px'
    ta.style.height = '1px'
    ta.style.padding = '0'
    ta.style.border = 'none'
    ta.style.outline = 'none'
    ta.style.boxShadow = 'none'
    ta.style.background = 'transparent'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.focus()
    ta.select()
    ta.setSelectionRange(0, ta.value.length)
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}
