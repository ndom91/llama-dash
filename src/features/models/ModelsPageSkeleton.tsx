const ROWS = Array.from({ length: 7 }, (_, index) => `model-skel-${index}`)

export function ModelsPageSkeleton() {
  return (
    <table className="dtable">
      <thead>
        <tr>
          <th style={{ width: 18 }} aria-label="state" />
          <th className="mono" style={{ minWidth: 180 }}>
            id
          </th>
          <th>name</th>
          <th style={{ width: 72 }} className="hide-mobile">
            kind
          </th>
          <th style={{ width: 130 }} className="hide-mobile">
            state
          </th>
          <th style={{ width: 110 }} className="num hide-mobile">
            action
          </th>
        </tr>
      </thead>
      <tbody>
        {ROWS.map((row) => (
          <tr key={row}>
            <td>
              <span className="skel skel-text" style={{ width: 8, height: 8, borderRadius: 999 }} />
            </td>
            <td className="mono">
              <span className="skel skel-text" style={{ width: 150 }} />
            </td>
            <td>
              <span className="skel skel-text" style={{ width: '58%' }} />
            </td>
            <td className="hide-mobile">
              <span className="skel skel-text" style={{ width: 34 }} />
            </td>
            <td className="hide-mobile">
              <span className="skel skel-text" style={{ width: 70 }} />
            </td>
            <td className="num hide-mobile">
              <span className="skel skel-text" style={{ width: 54, height: 24 }} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
