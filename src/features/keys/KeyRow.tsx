import { useNavigate } from '@tanstack/react-router'
import { Trash2 } from 'lucide-react'
import { CopyableCode } from '../../components/CopyableCode'
import { StatusDot } from '../../components/StatusDot'
import { Tooltip } from '../../components/Tooltip'
import type { ApiKeyItem } from '../../lib/api'
import { useDeleteApiKey, useRevokeApiKey } from '../../lib/queries'

type Props = {
  apiKey: ApiKeyItem
}

export function KeyRow({ apiKey }: Props) {
  const navigate = useNavigate()
  const revokeKey = useRevokeApiKey()
  const deleteKey = useDeleteApiKey()
  const isRevoked = apiKey.disabledAt != null

  return (
    <tr
      className={`clickable-row${isRevoked ? ' row-revoked' : ''}`}
      onClick={() => navigate({ to: '/keys/$id', params: { id: apiKey.id } })}
    >
      <td>
        <StatusDot tone={isRevoked ? 'idle' : 'ok'} live={!isRevoked} />
      </td>
      <td>
        <div className="max-w-[220px] overflow-hidden text-ellipsis whitespace-nowrap" title={apiKey.name}>
          {apiKey.name}
        </div>
      </td>
      <td className="mono">
        <div className="max-w-[100px] overflow-hidden text-ellipsis whitespace-nowrap" title={`${apiKey.keyPrefix}…`}>
          <CopyableCode text={`${apiKey.keyPrefix}…`} />
        </div>
      </td>
      <td className="hide-mobile">
        {apiKey.allowedModels.length === 0 ? (
          <span className="dim">all</span>
        ) : (
          <span className="mono" style={{ fontSize: 11 }}>
            {apiKey.allowedModels.join(', ')}
          </span>
        )}
      </td>
      <td className="num mono hide-mobile">{apiKey.rateLimitRpm ?? <span className="dim">—</span>}</td>
      <td className="num mono hide-mobile">{apiKey.rateLimitTpm ?? <span className="dim">—</span>}</td>
      <td className="hide-mobile" style={{ fontSize: 12, color: 'var(--fg-dim)' }}>
        {new Date(apiKey.createdAt).toLocaleDateString()}
      </td>
      <td className="num">
        {isRevoked ? (
          <Tooltip label="Delete permanently">
            <button
              type="button"
              className="btn btn-danger-ghost btn-xs"
              onClick={(e) => {
                e.stopPropagation()
                deleteKey.mutate(apiKey.id)
              }}
              disabled={deleteKey.isPending}
            >
              <Trash2 className="icon-btn-12" strokeWidth={2} />
              delete
            </button>
          </Tooltip>
        ) : (
          <Tooltip label="Revoke this key">
            <button
              type="button"
              className="btn btn-xs"
              onClick={(e) => {
                e.stopPropagation()
                revokeKey.mutate(apiKey.id)
              }}
              disabled={revokeKey.isPending}
            >
              {revokeKey.isPending ? 'revoking…' : 'revoke'}
            </button>
          </Tooltip>
        )}
      </td>
    </tr>
  )
}
