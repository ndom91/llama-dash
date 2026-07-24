/**
 * Primary "this model is the active inference target" state strings.
 * llama-swap /running uses "ready"; llama.cpp router /models status uses "loaded".
 */
export function isPrimaryRunningState(state: string): boolean {
  return state === 'ready' || state === 'loaded'
}
