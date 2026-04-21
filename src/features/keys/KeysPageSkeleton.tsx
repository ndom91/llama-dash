const ROWS = Array.from({ length: 6 }, (_, index) => `key-skel-${index}`)

export function KeysPageSkeleton() {
  return (
    <table className="dtable">
      <thead>
        <tr>
          <th style={{ width: 18 }} aria-label="status" />
          <th>name</th>
          <th className="mono">prefix</th>
          <th className="hide-mobile">models</th>
          <th className="num hide-mobile">rpm</th>
          <th className="num hide-mobile">tpm</th>
          <th className="hide-mobile">created</th>
          <th style={{ width: 90 }} className="num">
            actions
          </th>
        </tr>
      </thead>
      <tbody>
        {ROWS.map((row) => (
          <tr key={row}>
            <td>
              <span className="skel skel-text" style={{ width: 8, height: 8, borderRadius: 999 }} />
            </td>
            <td>
              <span className="skel skel-text" style={{ width: '44%' }} />
            </td>
            <td className="mono">
              <span className="skel skel-text" style={{ width: 88 }} />
            </td>
            <td className="hide-mobile">
              <span className="skel skel-text" style={{ width: 64 }} />
            </td>
            <td className="num hide-mobile">
              <span className="skel skel-text" style={{ width: 32 }} />
            </td>
            <td className="num hide-mobile">
              <span className="skel skel-text" style={{ width: 40 }} />
            </td>
            <td className="hide-mobile">
              <span className="skel skel-text" style={{ width: 72 }} />
            </td>
            <td className="num">
              <span className="skel skel-text" style={{ width: 52, height: 24 }} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
