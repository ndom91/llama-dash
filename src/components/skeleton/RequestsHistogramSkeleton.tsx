const BAR_HEIGHTS = [
  18, 8, 12, 6, 24, 42, 15, 9, 30, 22, 35, 18, 27, 46, 33, 20, 38, 28, 51, 36, 24, 32, 43, 25, 19, 31, 48, 22, 34, 16,
  29, 40, 21, 12, 26, 37, 23, 45, 30, 17, 28, 39, 20, 32, 14, 25, 41, 19, 35, 24, 11, 28, 44, 33, 20, 36, 27, 18, 31,
  14,
]

export function RequestsHistogramSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="histogram">
        {BAR_HEIGHTS.map((height, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static decorative bars
          <div className="histogram-bar" key={index}>
            <span className="skel skel-block w-full rounded-t-sm" style={{ height }} />
          </div>
        ))}
      </div>
      <div className="histogram-labels px-4 pb-3">
        <span>-60m</span>
        <span>-40m</span>
        <span>-20m</span>
        <span>now</span>
      </div>
    </div>
  )
}
