import type { InferenceHardware } from '../../lib/api'
import { MetaRow } from './MetaRow'
import { SystemPanel } from './SystemPanel'

function joinValues(values: Array<string | number | null>): string {
  return values.filter((value) => value != null && value !== '').join(' · ') || '—'
}

export function InferenceHostPanel({ hardware }: { hardware: InferenceHardware | null }) {
  if (!hardware) {
    return (
      <SystemPanel title="Inference Host">
        <p className="m-0 py-2 font-mono text-[11px] text-fg-faint">hardware snapshot unavailable</p>
      </SystemPanel>
    )
  }
  const topology = joinValues([
    hardware.cpu.socket_count == null ? null : `${hardware.cpu.socket_count} socket`,
    hardware.cpu.physical_core_count == null ? null : `${hardware.cpu.physical_core_count} physical`,
    hardware.cpu.logical_thread_count == null ? null : `${hardware.cpu.logical_thread_count} logical`,
  ])

  return (
    <SystemPanel title="Inference Host" aside="startup snapshot">
      <dl className="m-0">
        <MetaRow label="cpu" value={joinValues([hardware.cpu.model ?? hardware.cpu.vendor])} />
        <MetaRow label="topology" value={topology} />
        {hardware.accelerators.length === 0 ? <MetaRow label="accelerators" value="none detected" /> : null}
        {hardware.accelerators.map((accelerator) => (
          <MetaRow
            key={accelerator.index}
            label={`${accelerator.kind} ${accelerator.index}`}
            value={joinValues([
              accelerator.vendor,
              accelerator.model,
              accelerator.architecture,
              accelerator.driver?.name ?? null,
            ])}
          />
        ))}
        <MetaRow
          label="os"
          value={joinValues([
            hardware.operating_system.name,
            hardware.operating_system.version,
            hardware.operating_system.kernel,
          ])}
        />
        <MetaRow
          label="environment"
          value={joinValues([hardware.environment.kind, hardware.environment.name, hardware.environment.version])}
        />
        <MetaRow label="captured" value={hardware.captured_at.replace('T', ' ').slice(0, 16)} />
      </dl>
    </SystemPanel>
  )
}
