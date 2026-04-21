const SKEL_LINES: ReadonlyArray<{ key: string; indent: number; widths: ReadonlyArray<number> }> = [
  { key: 'a', indent: 0, widths: [90, 24, 160] },
  { key: 'b', indent: 1, widths: [40] },
  { key: 'c', indent: 2, widths: [60, 200] },
  { key: 'd', indent: 3, widths: [80, 120, 60] },
  { key: 'e', indent: 4, widths: [160] },
  { key: 'f', indent: 0, widths: [40, 80] },
  { key: 'g', indent: 1, widths: [120, 60, 100] },
  { key: 'h', indent: 2, widths: [200] },
  { key: 'i', indent: 3, widths: [60, 140] },
  { key: 'j', indent: 4, widths: [80, 40, 180] },
  { key: 'k', indent: 0, widths: [140, 60] },
  { key: 'l', indent: 1, widths: [40, 120] },
  { key: 'm', indent: 2, widths: [100, 80, 60] },
  { key: 'n', indent: 3, widths: [180] },
  { key: 'o', indent: 4, widths: [60, 40, 120] },
  { key: 'p', indent: 0, widths: [80, 160] },
  { key: 'q', indent: 1, widths: [120, 60] },
  { key: 'r', indent: 2, widths: [40, 200] },
  { key: 's', indent: 3, widths: [160, 80] },
  { key: 't', indent: 4, widths: [60, 100, 40] },
  { key: 'u', indent: 0, widths: [140] },
  { key: 'v', indent: 1, widths: [80, 60, 120] },
  { key: 'w', indent: 2, widths: [200, 40] },
  { key: 'x', indent: 3, widths: [60, 140, 80] },
]

type Props = {
  title: string
}

export function RequestBodySkeleton({ title }: Props) {
  return (
    <section className="panel !rounded-none !border-l-0 !border-r border-r-border !border-b-0 !bg-surface-1">
      <div className="panel-head">
        <span className="panel-title">{title}</span>
        <span className="panel-sub">· body</span>
      </div>
      <div className="skel-body-lines">
        {SKEL_LINES.map((line) => (
          <div key={line.key} className="skel-body-line" style={{ paddingLeft: line.indent * 12 + 16 }}>
            {line.widths.map((w) => (
              <span key={`${line.key}-${w}`} className="skel skel-text" style={{ width: w }} />
            ))}
          </div>
        ))}
      </div>
    </section>
  )
}
