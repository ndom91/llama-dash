import { Tooltip } from '../../components/Tooltip'
import type { ApiUsageDay } from '../../lib/api'
import { cn } from '../../lib/cn'
import { UsageLegendSwatch } from './UsageLegendSwatch'
import { formatTokens, formatUsageDay, type UsageChartMode, usageChartBars } from './usageUtils'

type Props = {
  daily: Array<ApiUsageDay>
  mode: UsageChartMode
}

const CHART_PX = 168
/** Generated tokens are the headline series; prompt tokens are context for it. */
export const GENERATED_SERIES = 'var(--accent)'
export const PROMPT_SERIES = 'color-mix(in srgb, var(--fg-dim) 45%, transparent)'

/**
 * Per-day tokens. In `all` mode prompt is stacked on generated, with generated
 * on the baseline; `generated` mode drops prompt and rescales so generated
 * counts stay readable when prompt tokens dwarf them. Linear scale so bar
 * height reads as magnitude.
 */
export function UsageDailyChart({ daily, mode }: Props) {
  const { peak, bars } = usageChartBars(daily, mode)
  const labelEvery = daily.length <= 7 ? 1 : daily.length <= 30 ? 7 : 15

  return (
    <div className="px-4 pt-3 pb-3">
      <div className="relative" style={{ height: CHART_PX }}>
        <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-border" />
        <div className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-border opacity-60" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 border-t border-border" />
        <span className="pointer-events-none absolute top-1 left-0 rounded-sm bg-surface-1/80 px-1 font-mono text-[10px] tabular-nums text-fg-faint">
          {peak > 0 ? formatTokens(peak) : ''}
        </span>
        <div className={cn('absolute inset-0 flex items-end', daily.length > 45 ? 'gap-px' : 'gap-[2px]')}>
          {daily.map((d, i) => {
            const total = mode === 'generated' ? d.completionTokens : d.promptTokens + d.completionTokens
            const promptPx = bars[i].prompt * CHART_PX
            const generatedPx = bars[i].generated * CHART_PX
            const label = (
              <div className="flex flex-col gap-0.5 font-mono text-[11px] tabular-nums">
                <span className="text-fg">{formatUsageDay(d.day, { weekday: 'short' })} · UTC</span>
                <span>{d.completionTokens.toLocaleString('en')} generated</span>
                <span>{d.promptTokens.toLocaleString('en')} prompt</span>
                <span className="text-fg-dim">{d.requests.toLocaleString('en')} requests</span>
              </div>
            )
            return (
              <Tooltip key={d.day} label={label} side="top">
                <div
                  className="group flex h-full min-w-0 flex-1 cursor-default flex-col justify-end"
                  role="img"
                  aria-label={`${d.day}: ${total} ${mode === 'generated' ? 'generated ' : ''}tokens`}
                >
                  {total === 0 ? (
                    <div className="h-px w-full bg-fg-faint opacity-40" />
                  ) : (
                    <>
                      {promptPx > 0 ? (
                        <div
                          className="w-full rounded-t-[2px] transition-opacity group-hover:opacity-80"
                          style={{ height: Math.max(promptPx, 2), background: PROMPT_SERIES }}
                        />
                      ) : null}
                      {generatedPx > 0 ? (
                        <div
                          className={cn(
                            'w-full transition-opacity group-hover:opacity-80',
                            promptPx > 0 ? 'mt-px' : 'rounded-t-[2px]',
                          )}
                          style={{ height: Math.max(generatedPx, 2), background: GENERATED_SERIES }}
                        />
                      ) : null}
                    </>
                  )}
                </div>
              </Tooltip>
            )
          })}
        </div>
      </div>
      <div className="mt-1.5 flex font-mono text-[10px] tabular-nums text-fg-faint">
        {daily.map((d, i) => {
          const fromEnd = daily.length - 1 - i
          const show = fromEnd % labelEvery === 0
          return (
            <span key={d.day} className="relative min-w-0 flex-1">
              {show ? (
                <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap">
                  {fromEnd === 0 ? 'today' : formatUsageDay(d.day)}
                </span>
              ) : null}
            </span>
          )
        })}
      </div>
      <div className="h-3" />
      {/* On phones the panel head only has room for the mode switch; the legend moves here. */}
      <div className="mt-1 hidden items-center gap-3 max-[520px]:flex">
        <UsageLegendSwatch color={GENERATED_SERIES} label="generated" />
        {mode === 'all' ? <UsageLegendSwatch color={PROMPT_SERIES} label="prompt" /> : null}
      </div>
    </div>
  )
}
