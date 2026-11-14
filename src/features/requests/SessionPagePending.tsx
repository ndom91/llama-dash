import { SkeletonLine } from '../../components/skeleton/SkeletonFrame'

export function SessionPagePending() {
  return (
    <div className="content md:overflow-hidden" role="status" aria-label="Loading session history">
      <span className="sr-only">Loading session history…</span>
      <div className="page min-h-full min-w-0 md:h-full md:min-h-0" aria-hidden="true">
        <div className="page-header page-header-default hidden shrink-0 items-start justify-between gap-4 md:flex">
          <div className="page-header-copy flex min-w-0 flex-1 flex-col gap-1">
            <SkeletonLine width={150} height={10} className="max-w-full" />
            <SkeletonLine width={250} height={24} className="mt-0.5 max-w-full" />
            <SkeletonLine width={320} height={12} className="max-w-full" />
          </div>
          <div className="flex shrink-0 gap-2">
            {[1, 2, 3, 4].map((item) => (
              <SkeletonLine key={item} width={80} height={28} />
            ))}
          </div>
        </div>
        <div className="border-b border-border px-3.5 py-3 md:hidden">
          <SkeletonLine width={78} height={10} className="my-3" />
          <SkeletonLine width="75%" height={22} className="mt-2 max-w-full" />
          <SkeletonLine width="90%" height={12} className="mt-3 max-w-full" />
        </div>
        <div className="flex items-center justify-between gap-2 border-b border-border px-3.5 py-2 md:hidden">
          <SkeletonLine width="55%" height={10} />
          <div className="flex gap-1">
            <SkeletonLine width={42} height={36} />
            <SkeletonLine width={62} height={36} />
          </div>
        </div>
        <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_300px] max-lg:grid-cols-1 md:min-h-0 md:grid-rows-[auto_minmax(0,1fr)] lg:grid-rows-1">
          <main className="min-w-0 md:min-h-0 md:overflow-hidden">
            <div className="session-split-heading hidden md:grid">
              <span>
                <SkeletonLine width={65} height={9} />
              </span>
              <span>
                <SkeletonLine width={90} height={9} />
              </span>
            </div>
            {EXCHANGE_VARIANTS.map((variant, index) => (
              <SessionExchangeSkeleton key={variant.id} variant={index} />
            ))}
          </main>
          <aside className="space-y-4 border-l border-border bg-surface-0 p-4 max-lg:hidden">
            <SkeletonLine width={70} height={10} />
            {['client', 'model', 'requests', 'tokens', 'cache', 'input', 'cost'].map((item) => (
              <div key={item} className="flex justify-between gap-3 border-b border-dashed border-border py-2">
                <SkeletonLine width={70} height={10} />
                <SkeletonLine width={100} height={10} />
              </div>
            ))}
            <SkeletonLine width={90} height={10} />
            {['one', 'two', 'three', 'four', 'five'].map((item) => (
              <SkeletonLine key={item} width="100%" height={8} />
            ))}
          </aside>
          <div className="hidden border-b border-border bg-surface-0 px-4 py-3 max-lg:md:order-first max-lg:md:block">
            <SkeletonLine width={170} height={12} />
          </div>
        </div>
      </div>
    </div>
  )
}

type EntryKind = 'sent' | 'thinking' | 'assistant' | 'tool'

type Entry = { kind: EntryKind; label: number | string; lines?: string[] }

type ExchangeVariant = {
  id: string
  meta: [number, number, number, number, number]
  entries: Entry[]
  footer: number
  mobile: { header: number; label: number; lines: string[] }
}

// Fixed table instead of Math.random() so SSR and hydration render the same markup.
const EXCHANGE_VARIANTS: ExchangeVariant[] = [
  {
    id: 'a',
    meta: [32, 58, 65, 75, 55],
    entries: [
      { kind: 'sent', label: 120 },
      { kind: 'thinking', label: 104 },
      { kind: 'assistant', label: 128, lines: ['72%', '55%'] },
      { kind: 'tool', label: '60%' },
    ],
    footer: 65,
    mobile: { header: 160, label: 95, lines: ['95%', '70%'] },
  },
  {
    id: 'b',
    meta: [28, 64, 58, 62, 48],
    entries: [
      { kind: 'sent', label: 96 },
      { kind: 'assistant', label: 136, lines: ['84%', '66%', '38%'] },
    ],
    footer: 58,
    mobile: { header: 140, label: 110, lines: ['88%', '92%', '45%'] },
  },
  {
    id: 'c',
    meta: [34, 52, 70, 80, 60],
    entries: [
      { kind: 'sent', label: 132 },
      { kind: 'thinking', label: 88 },
      { kind: 'tool', label: '48%' },
      { kind: 'tool', label: '66%' },
      { kind: 'assistant', label: 112, lines: ['64%'] },
    ],
    footer: 72,
    mobile: { header: 172, label: 82, lines: ['78%'] },
  },
  {
    id: 'd',
    meta: [30, 60, 62, 70, 52],
    entries: [
      { kind: 'sent', label: 110 },
      { kind: 'thinking', label: 116 },
      { kind: 'assistant', label: 120, lines: ['78%', '48%'] },
    ],
    footer: 62,
    mobile: { header: 150, label: 100, lines: ['96%', '62%'] },
  },
  {
    id: 'e',
    meta: [32, 56, 68, 66, 58],
    entries: [
      { kind: 'sent', label: 124 },
      { kind: 'tool', label: '54%' },
      { kind: 'assistant', label: 140, lines: ['90%', '74%', '52%'] },
      { kind: 'tool', label: '42%' },
    ],
    footer: 68,
    mobile: { header: 164, label: 90, lines: ['84%', '90%', '58%'] },
  },
  {
    id: 'f',
    meta: [26, 62, 60, 78, 50],
    entries: [
      { kind: 'sent', label: 100 },
      { kind: 'assistant', label: 118, lines: ['58%'] },
    ],
    footer: 60,
    mobile: { header: 146, label: 105, lines: ['66%'] },
  },
  {
    id: 'g',
    meta: [34, 54, 66, 72, 56],
    entries: [
      { kind: 'sent', label: 128 },
      { kind: 'thinking', label: 96 },
      { kind: 'assistant', label: 124, lines: ['68%', '82%'] },
      { kind: 'tool', label: '70%' },
    ],
    footer: 64,
    mobile: { header: 158, label: 92, lines: ['92%', '74%'] },
  },
  {
    id: 'h',
    meta: [30, 66, 56, 64, 54],
    entries: [
      { kind: 'sent', label: 114 },
      { kind: 'tool', label: '58%' },
      { kind: 'tool', label: '46%' },
      { kind: 'assistant', label: 130, lines: ['76%', '44%'] },
    ],
    footer: 70,
    mobile: { header: 168, label: 98, lines: ['86%', '52%'] },
  },
  {
    id: 'i',
    meta: [28, 58, 64, 68, 50],
    entries: [
      { kind: 'sent', label: 106 },
      { kind: 'thinking', label: 108 },
      { kind: 'assistant', label: 116, lines: ['80%', '62%', '30%'] },
    ],
    footer: 66,
    mobile: { header: 154, label: 88, lines: ['94%', '80%', '40%'] },
  },
]

export function SessionExchangeSkeleton({ variant = 0 }: { variant?: number }) {
  const { meta, entries, footer, mobile } = EXCHANGE_VARIANTS[variant % EXCHANGE_VARIANTS.length]
  return (
    <div aria-hidden="true">
      <div className="session-split-row hidden md:grid">
        <div className="session-split-meta flex flex-col items-start gap-2">
          <SkeletonLine width={meta[0]} height={14} />
          <SkeletonLine width={meta[1]} height={14} />
          <SkeletonLine width={meta[2]} height={10} />
          <SkeletonLine width={meta[3]} height={5} />
          <SkeletonLine width={meta[4]} height={10} />
        </div>
        <div className="session-conversation flex min-w-0 flex-col gap-2">
          {entries.map((entry, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list, kinds repeat
            <div key={index} className="session-entry">
              <SkeletonLine width={20} height={20} />
              <div className="min-w-0 space-y-2">
                <SkeletonLine width={entry.label} height={10} />
                {entry.lines ? (
                  <div className="space-y-2 border-l border-border-strong pl-3.5">
                    {entry.lines.map((width, lineIndex) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton lines
                      <SkeletonLine key={lineIndex} width={width} height={12} />
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          ))}
          <SkeletonLine width={footer} height={18} className="ml-auto" />
        </div>
      </div>
      <div className="space-y-4 px-3.5 py-4 md:hidden">
        <div className="flex items-center gap-2">
          <span className="h-px flex-1 bg-border" />
          <SkeletonLine width={mobile.header} height={12} />
          <span className="h-px flex-1 bg-border" />
        </div>
        <SkeletonLine width={mobile.label} height={10} />
        <div className="space-y-2 border-l border-border pl-4">
          {mobile.lines.map((width, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton lines
            <SkeletonLine key={index} width={width} height={12} />
          ))}
        </div>
        <SkeletonLine width="100%" height={36} />
      </div>
    </div>
  )
}
