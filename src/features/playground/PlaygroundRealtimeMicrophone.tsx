import type { RealtimeInputDevice } from '../../lib/use-playground-realtime'
import { PlaygroundKVRow } from './PlaygroundKVRow'
import { PlaygroundRealtimeLevelMeter } from './PlaygroundRealtimeLevelMeter'
import { PlaygroundSessionSection } from './PlaygroundSessionSection'
import { PlaygroundToggle } from './PlaygroundToggle'

type Props = {
  devices: Array<RealtimeInputDevice>
  deviceId: string
  setDeviceId: (value: string) => void
  voiceProcessing: boolean
  setVoiceProcessing: (value: boolean) => void
  micLabel: string | null
  inputLevel: number
}

export function PlaygroundRealtimeMicrophone({
  devices,
  deviceId,
  setDeviceId,
  voiceProcessing,
  setVoiceProcessing,
  micLabel,
  inputLevel,
}: Props) {
  // Browsers hide device names until the mic has been allowed once.
  const unlabelled = devices.length > 0 && devices.every((device) => !device.label)
  const savedMissing = deviceId !== '' && !devices.some((device) => device.deviceId === deviceId)

  return (
    <PlaygroundSessionSection label="microphone">
      <select
        className="select-native w-full rounded-sm border border-border bg-surface-2 px-2 py-1.5 font-mono text-xs text-fg focus:border-accent focus:outline-none"
        value={deviceId}
        onChange={(e) => setDeviceId(e.target.value)}
        aria-label="Microphone input"
      >
        <option value="">system default</option>
        {devices.map((device, index) => (
          <option key={device.deviceId} value={device.deviceId}>
            {device.label || `microphone ${index + 1}`}
          </option>
        ))}
        {savedMissing ? <option value={deviceId}>saved input (not connected)</option> : null}
      </select>
      {unlabelled ? (
        <p className="m-0 text-[11px] leading-4 text-fg-dim">Connect once and allow the mic to see device names.</p>
      ) : null}
      <PlaygroundKVRow
        k="voice processing"
        v={<PlaygroundToggle value={voiceProcessing} onChange={setVoiceProcessing} labels={['off', 'on']} />}
      />
      <p className="m-0 text-[11px] leading-4 text-fg-dim">
        Echo cancellation, noise suppression and auto gain. Turn off if your voice comes through silent.
      </p>
      {micLabel ? (
        <div className="flex min-w-0 items-center gap-2 pt-1 font-mono text-[11px] text-fg-dim">
          <PlaygroundRealtimeLevelMeter level={inputLevel} threshold={null} active />
          <span className="truncate" translate="no">
            {micLabel}
          </span>
        </div>
      ) : null}
    </PlaygroundSessionSection>
  )
}
