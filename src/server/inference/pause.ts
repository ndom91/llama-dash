import { publishAdminEvent } from '../admin/events.ts'
import { inferenceBackend } from './backend.ts'

// Pause state changes refresh /api/health, which drives the paused banner.
export function startInferencePauseWatcher() {
  inferenceBackend.watchPauseState?.((paused) => publishAdminEvent('system.changed', { paused }))
}
