import { useState } from 'react'
import { NumberInput } from '../../components/NumberInput'
import { useUpdateSystemThresholds } from '../../lib/queries'
import type { SystemThresholds, ThresholdMetric } from '../../lib/schemas/system-thresholds'

const ROWS: Array<{ metric: ThresholdMetric; label: string; prefix: string; unit: string }> = [
  { metric: 'gpuTempC', label: 'gpu temp', prefix: '≥', unit: '°C' },
  { metric: 'gpuMemPercent', label: 'gpu memory', prefix: '≥', unit: '%' },
  { metric: 'ramPercent', label: 'system ram', prefix: '≥', unit: '%' },
  { metric: 'cpuPercent', label: 'cpu (5m avg)', prefix: '≥', unit: '%' },
  { metric: 'queueDropped', label: 'queue dropped', prefix: '>', unit: '' },
]

export function SystemThresholdsPanel({ thresholds }: { thresholds: SystemThresholds | undefined }) {
  const [draft, setDraft] = useState<SystemThresholds | null>(null)
  const update = useUpdateSystemThresholds()
  const editing = draft != null

  const save = () => {
    if (!draft) return
    update.mutate(draft, { onSuccess: () => setDraft(null) })
  }

  return (
    <div className="border-t border-border">
      <div className="mb-2 flex h-10 items-center border-b border-border px-4 font-mono text-[10px] uppercase tracking-[0.18em] text-fg-faint">
        <span>thresholds</span>
        {thresholds ? (
          <span className="ml-auto flex gap-2 normal-case tracking-normal">
            {editing ? (
              <>
                <button type="button" className="text-fg-dim hover:text-fg" onClick={() => setDraft(null)}>
                  cancel
                </button>
                <button
                  type="button"
                  className="text-accent hover:underline"
                  disabled={update.isPending}
                  onClick={save}
                >
                  save
                </button>
              </>
            ) : (
              <button type="button" className="text-accent hover:underline" onClick={() => setDraft(thresholds)}>
                edit
              </button>
            )}
          </span>
        ) : null}
      </div>
      <dl className="m-0 px-4 pb-3">
        {ROWS.map((row) => (
          <div key={row.metric} className="flex h-7 items-center gap-2 font-mono text-[11px]">
            <dt className="text-fg-muted">{row.label}</dt>
            <dd className="m-0 ml-auto tabular-nums text-fg">
              {editing ? (
                <NumberInput
                  inputSize="s"
                  className="w-20"
                  prefix={row.prefix}
                  suffix={row.unit || undefined}
                  value={draft[row.metric]}
                  min={0}
                  onChange={(event) => {
                    const value = Number(event.target.value)
                    if (Number.isFinite(value)) setDraft({ ...draft, [row.metric]: value })
                  }}
                />
              ) : thresholds ? (
                `${row.prefix} ${thresholds[row.metric]}${row.unit}`
              ) : (
                '—'
              )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
