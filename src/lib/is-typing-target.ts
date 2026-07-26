/**
 * True when a key event originated from (or bubbled through) an editable control.
 *
 * Checks the full composed path rather than just `event.target`, so a keystroke
 * inside a shadow root or a nested wrapper still counts as typing. Button-like
 * inputs are excluded — they can't swallow text, so a single-key shortcut fired
 * while one is focused is intentional.
 */
export function isTypingTarget(event: Event): boolean {
  const path = typeof event.composedPath === 'function' ? event.composedPath() : [event.target]
  for (const node of path) {
    if (node instanceof HTMLTextAreaElement || node instanceof HTMLSelectElement) return true
    if (node instanceof HTMLInputElement) {
      const type = node.type.toLowerCase()
      if (type !== 'button' && type !== 'submit' && type !== 'reset' && type !== 'checkbox' && type !== 'radio') {
        return true
      }
    }
    if (node instanceof HTMLElement && node.isContentEditable) return true
  }
  return false
}
