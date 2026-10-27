import type { CSSProperties } from 'react'
import { Tooltip } from '../../components/Tooltip'
import type { ApiUsageDay } from '../../lib/api'
import { cn } from '../../lib/cn'
import { UsageLegendSwatch } from './UsageLegendSwatch'
import { formatAxisTokens, formatUsageDay, type UsageChartMode, usageChartBars } from './usageUtils'

type Props = {
  daily: Array<ApiUsageDay>
  mode: UsageChartMode
  showTodayLabel?: boolean
}

const CHART_PX = 168
/** Left gutter for the y-axis labels; the date row is indented by the same amount. */
const GUTTER = 'pl-11'
/** Generated tokens are the headline series; prompt tokens are context for it. */
export const GENERATED_SERIES = 'var(--accent)'
export const PROMPT_SERIES = 'color-mix(in srgb, var(--fg-dim) 45%, transparent)'

/**
 * Per-day tokens. In `all` mode prompt is stacked on generated, with generated
 * on the baseline; `generated` mode drops prompt and rescales so generated
 * counts stay readable when prompt tokens dwarf them. Linear scale against a
 * "nice numbers" axis, so bar tops line up with the gridline labels.
 */
export function UsageDailyChart({ daily, mode, showTodayLabel = true }: Props) {
  const { scale, bars } = usageChartBars(daily, mode)
  const labelEvery = daily.length <= 7 ? 1 : daily.length <= 30 ? 7 : 15

  return (
    <div className="px-4 pt-4 pb-3">
      <div
        className={cn('relative', GUTTER)}
        style={{ height: CHART_PX, '--usage-chart-height': `${CHART_PX}px` } as CSSProperties}
      >
        {scale.ticks.map((tick) => {
          const bottom = (tick / scale.max) * CHART_PX
          return (
            <div key={tick} className="pointer-events-none absolute inset-x-0" style={{ bottom }} aria-hidden="true">
              <div
                className={cn(
                  'ml-11 border-t',
                  tick === 0 ? 'border-border' : 'border-dashed border-border opacity-60',
                )}
              />
              <span className="absolute left-0 w-9 -translate-y-1/2 text-right font-mono text-[10px] leading-none tabular-nums text-fg-faint">
                {formatAxisTokens(tick)}
              </span>
            </div>
          )
        })}
        <div
          className={cn(
            'absolute inset-y-0 right-0 left-11 flex items-end',
            daily.length === 1 && 'justify-center',
            daily.length > 45 ? 'gap-px' : 'gap-[2px]',
          )}
        >
          {daily.map((d, i) => {
            const total = mode === 'generated' ? d.completionTokens : d.promptTokens + d.completionTokens
            const promptPx = bars[i].prompt * CHART_PX
            const generatedPx = bars[i].generated * CHART_PX
            const label = (
              <div className="flex flex-col gap-0.5 font-mono text-[11px] tabular-nums">
                <span className="text-fg">{formatUsageDay(d.day, { weekday: 'short' })} · UTC</span>
                <span>{d.completionTokens.toLocaleString('en')} output</span>
                <span>{d.promptTokens.toLocaleString('en')} input</span>
                <span className="text-fg-dim">{d.requests.toLocaleString('en')} requests</span>
              </div>
            )
            return (
              <div key={d.day} className={cn('flex h-full min-w-0 flex-1 items-end', daily.length === 1 && 'max-w-24')}>
                <Tooltip label={label} side="top">
                  <div
                    className="group relative flex w-full shrink-0 cursor-default flex-col justify-end before:absolute before:bottom-0 before:left-0 before:h-(--usage-chart-height) before:w-full before:content-['']"
                    role="img"
                    aria-label={`${d.day}: ${total} ${mode === 'generated' ? 'output ' : ''}tokens`}
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
              </div>
            )
          })}
        </div>
      </div>
      <div className={cn('mt-2 flex font-mono text-[10px] tabular-nums text-fg-faint', GUTTER)}>
        {daily.map((d, i) => {
          const fromEnd = daily.length - 1 - i
          const show = fromEnd % labelEvery === 0
          return (
            <span key={d.day} className="relative min-w-0 flex-1">
              {show ? (
                <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap">
                  {fromEnd === 0 && showTodayLabel ? 'today' : formatUsageDay(d.day)}
                </span>
              ) : null}
            </span>
          )
        })}
      </div>
      <div className="h-3" />
      {/* On phones the panel head only has room for the mode switch; the legend moves here. */}
      <div className="mt-1 hidden items-center gap-3 max-[520px]:flex">
        <UsageLegendSwatch color={GENERATED_SERIES} label="output" />
        {mode === 'all' ? <UsageLegendSwatch color={PROMPT_SERIES} label="input" /> : null}
      </div>
    </div>
  )
}
