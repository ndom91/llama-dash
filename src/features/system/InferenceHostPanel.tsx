import type { InferenceHardware } from '../../lib/api'
import { MetaRow } from './MetaRow'
import { SystemPanel } from './SystemPanel'

function formatBytes(bytes: number): string {
  return `${(bytes / 1024 ** 3).toFixed(1)} GiB`
}

function joinValues(values: Array<string | null>): string {
  return values.filter((value): value is string => value != null && value !== '').join(' · ') || '—'
}

function acceleratorLabel(accelerator: InferenceHardware['accelerators'][number]): string {
  return joinValues([accelerator.vendor, accelerator.model, accelerator.architecture])
}

function acceleratorMeta(accelerator: InferenceHardware['accelerators'][number]): string {
  return joinValues([
    accelerator.memory.capacity_bytes == null
      ? null
      : `${accelerator.memory.kind} ${formatBytes(accelerator.memory.capacity_bytes)}`,
    accelerator.driver?.name == null
      ? null
      : `${accelerator.driver.name}${accelerator.driver.version ? ` ${accelerator.driver.version}` : ''}`,
    accelerator.power_limit_watts == null ? null : `${accelerator.power_limit_watts} W limit`,
  ])
}

export function InferenceHostPanel({ hardware }: { hardware: InferenceHardware }) {
  const os = joinValues([
    hardware.operating_system.name,
    hardware.operating_system.version,
    hardware.operating_system.kernel,
  ])
  const environment = joinValues([hardware.environment.kind, hardware.environment.name, hardware.environment.version])
  const cpuTopology = joinValues([
    hardware.cpu.socket_count == null ? null : `${hardware.cpu.socket_count} socket`,
    hardware.cpu.physical_core_count == null ? null : `${hardware.cpu.physical_core_count} physical`,
    hardware.cpu.logical_thread_count == null ? null : `${hardware.cpu.logical_thread_count} logical`,
  ])

  return (
    <SystemPanel title="Inference Host" aside="startup snapshot · llama-swap">
      <MetaRow label="captured" value={hardware.captured_at} />
      <MetaRow label="architecture" value={hardware.architecture.name} />
      <MetaRow label="operating system" value={os} />
      <MetaRow label="environment" value={environment} />
      <MetaRow label="cpu" value={joinValues([hardware.cpu.vendor, hardware.cpu.model])} />
      <MetaRow label="cpu topology" value={cpuTopology} />
      <MetaRow label="system memory" value={formatBytes(hardware.memory.capacity_bytes)} />
      {hardware.accelerators.length === 0 ? <MetaRow label="accelerators" value="none detected" /> : null}
      {hardware.accelerators.map((accelerator) => (
        <MetaRow
          key={accelerator.index}
          label={`${accelerator.kind} ${accelerator.index}`}
          value={`${acceleratorLabel(accelerator)}${acceleratorMeta(accelerator) === '—' ? '' : ` (${acceleratorMeta(accelerator)})`}`}
        />
      ))}
    </SystemPanel>
  )
}
