import { useEffect } from 'react'
import { isTypingTarget } from './is-typing-target'

export const LEADER_KEY = 'g'
export const LEADER_TIMEOUT_MS = 1200

const MODIFIER_KEYS = new Set(['Shift', 'Control', 'Alt', 'Meta'])

/** Epoch ms until which a leader press is still live. 0 means not pending. */
let pendingUntil = 0

/**
 * Whether the leader key is currently armed.
 *
 * Synchronous and side-effect free, so it is safe to call from inside another
 * keydown handler. Single-key shortcuts that collide with a leader target must
 * consult this and bail — `g l` would otherwise fire both the sequence and the
 * standalone `L` binding on request detail. `stopPropagation` cannot solve this:
 * the hotkey manager, the sequence manager, and the requests-list listener all
 * attach to `document`, and stopping propagation does not stop sibling listeners
 * on the same node.
 */
export function isLeaderPending(): boolean {
  return pendingUntil > Date.now()
}

function setPending(on: boolean) {
  pendingUntil = on ? Date.now() + LEADER_TIMEOUT_MS : 0
  // Drives the pending affordance from CSS. An attribute toggle costs no React
  // render, which matters for something that fires on every keystroke.
  document.documentElement.toggleAttribute('data-leader-pending', on)
}

/**
 * Mount once, near the app root.
 *
 * Tracks pending-leader state in the CAPTURE phase so every bubble-phase
 * consumer observes the correct value for the same keydown. The reset is
 * deferred with `queueMicrotask` for the same reason: a full DOM dispatch
 * (capture → target → bubble) is one task, so the microtask flushes only after
 * every handler for that event has run.
 *
 * This does not do sequence *matching* — `useHotkeySequence` from
 * @tanstack/react-hotkeys handles that natively. This exists solely for the
 * collision guard and the visual affordance.
 */
export function useLeaderPendingTracker() {
  useEffect(() => {
    let expiry: ReturnType<typeof setTimeout> | undefined

    const cancel = () => {
      clearTimeout(expiry)
      setPending(false)
    }

    function onKeyDown(event: KeyboardEvent) {
      // A bare modifier press neither arms nor disarms the leader, matching how
      // the sequence matcher ignores modifier-only keydowns.
      if (MODIFIER_KEYS.has(event.key)) return
      if (isTypingTarget(event) || event.key === 'Escape') {
        cancel()
        return
      }

      const wasPending = isLeaderPending()

      if (!wasPending && event.key.toLowerCase() === LEADER_KEY && !event.metaKey && !event.ctrlKey && !event.altKey) {
        clearTimeout(expiry)
        setPending(true)
        expiry = setTimeout(() => setPending(false), LEADER_TIMEOUT_MS)
        return
      }

      if (wasPending) {
        clearTimeout(expiry)
        queueMicrotask(() => setPending(false))
      }
    }

    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      cancel()
    }
  }, [])
}
