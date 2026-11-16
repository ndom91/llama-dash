import { useId } from 'react'
import type { RangeDraft } from './requestTimeframePickerUtils'

type Props = {
  draft: RangeDraft
  custom: boolean
  rolling: boolean
  errorId?: string
  onChange: (draft: RangeDraft) => void
}
const inputClass =
  'h-7 min-w-0 w-full rounded-none border border-border bg-surface-0 px-2 font-mono text-[11px] text-fg outline-none placeholder:text-fg-dim focus:border-accent read-only:text-fg-dim max-[350px]:px-1'

export function RequestsRangeFields({ draft, custom, rolling, errorId, onChange }: Props) {
  const id = useId()
  return (
    <div className="grid grid-cols-[38px_minmax(0,1fr)_54px] items-center gap-x-2 gap-y-1.5 border-t border-border px-3.5 py-3 max-[350px]:grid-cols-[24px_minmax(0,1fr)_46px] max-[350px]:gap-x-1 max-[350px]:px-2">
      {(['from', 'to'] as const).map((side) => (
        <div key={side} className="contents">
          <label htmlFor={`${id}-${side}-day`} className="font-mono text-[9px] tracking-[0.12em] text-fg-dim uppercase">
            {side}
          </label>
          <input
            id={`${id}-${side}-day`}
            aria-label={`${side === 'from' ? 'From' : 'To'} date`}
            aria-describedby={errorId}
            type="text"
            autoComplete="off"
            spellCheck={false}
            value={!custom && rolling && side === 'to' ? 'now' : draft[`${side}Day`]}
            placeholder={side === 'from' ? 'Select start day' : 'Select end day'}
            readOnly={!custom}
            onChange={(event) => onChange({ ...draft, [`${side}Day`]: event.target.value })}
            className={inputClass}
          />
          <input
            aria-label={`${side === 'from' ? 'From' : 'To'} time`}
            aria-describedby={errorId}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            spellCheck={false}
            value={draft[`${side}Time`]}
            placeholder="—"
            readOnly={!custom}
            onChange={(event) => onChange({ ...draft, [`${side}Time`]: event.target.value })}
            className={inputClass}
          />
        </div>
      ))}
    </div>
  )
}
