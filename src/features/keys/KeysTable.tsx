import type { ApiKeyItem } from '../../lib/api'
import { KeyRow } from './KeyRow'

export function KeysTable({ keys, modelIds }: { keys: Array<ApiKeyItem>; modelIds?: Array<string> }) {
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
          <th className="hide-mobile">expires</th>
          <th className="hide-mobile">created</th>
          <th style={{ width: 90 }} className="num">
            actions
          </th>
        </tr>
      </thead>
      <tbody>
        {keys.map((k) => (
          <KeyRow key={k.id} apiKey={k} modelIds={modelIds} />
        ))}
      </tbody>
    </table>
  )
}
