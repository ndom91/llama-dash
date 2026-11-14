// Last known upstream pause state. Kept free of imports so the proxy can read
// it without loading the inference backend.
let pausedState: boolean | null = null
let listener: ((paused: boolean | null) => void) | null = null

/** Whether inference is paused upstream, or null when unknown. */
export function inferencePaused(): boolean | null {
  return pausedState
}

export function setInferencePaused<T extends boolean | null>(paused: T): T {
  if (paused !== pausedState) {
    pausedState = paused
    listener?.(paused)
  }
  return paused
}

export function onInferencePausedChange(callback: (paused: boolean | null) => void) {
  listener = callback
}
