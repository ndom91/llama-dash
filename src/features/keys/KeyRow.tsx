import { useNavigate } from '@tanstack/react-router'
import { Trash2 } from 'lucide-react'
import { CopyableCode } from '../../components/CopyableCode'
import { StatusDot } from '../../components/StatusDot'
import { Tooltip } from '../../components/Tooltip'
import type { ApiKeyItem } from '../../lib/api'
import { clickableRowFocusClass, clickableRowProps } from '../../lib/clickable-row-props'
import { cn } from '../../lib/cn'
import { useDeleteApiKey, useRevokeApiKey } from '../../lib/queries'

type Props = {
  apiKey: ApiKeyItem
  modelIds?: Array<string>
}

export function KeyRow({ apiKey, modelIds }: Props) {
  const navigate = useNavigate()
  const revokeKey = useRevokeApiKey()
  const deleteKey = useDeleteApiKey()
  const isRevoked = apiKey.disabledAt != null
  const isExpired = apiKey.expiresAt != null && new Date(apiKey.expiresAt) < new Date()
  const expiresSoon =
    !isExpired && apiKey.expiresAt != null && new Date(apiKey.expiresAt).getTime() - Date.now() < 7 * 86400_000
  const knownModelIds = modelIds ? new Set(modelIds) : null
  const availableModels = knownModelIds
    ? apiKey.allowedModels.filter((modelId) => knownModelIds.has(modelId))
    : apiKey.allowedModels
  const unavailableModelCount = knownModelIds ? apiKey.allowedModels.length - availableModels.length : 0

  return (
    <tr
      className={cn('clickable-row', isRevoked && 'row-revoked', clickableRowFocusClass)}
      {...clickableRowProps(() => navigate({ to: '/keys/$id', params: { id: apiKey.id } }))}
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
        {apiKey.modelAccessMode === 'all' ? (
          <span className="dim">all</span>
        ) : (
          <span className="mono" style={{ fontSize: 11 }}>
            {availableModels.length > 0 ? availableModels.join(', ') : 'no available models'}
            {unavailableModelCount > 0 ? (
              <span className="text-warn"> · +{unavailableModelCount} unavailable</span>
            ) : null}
          </span>
        )}
      </td>
      <td className="num mono hide-mobile">{apiKey.rateLimitRpm ?? <span className="dim">—</span>}</td>
      <td className="num mono hide-mobile">{apiKey.rateLimitTpm ?? <span className="dim">—</span>}</td>
      <td
        className="hide-mobile"
        style={{
          fontSize: 12,
          color: isExpired ? 'var(--color-error)' : expiresSoon ? 'var(--color-warn)' : 'var(--fg-dim)',
        }}
      >
        {apiKey.expiresAt ? new Date(apiKey.expiresAt).toLocaleDateString() : <span className="dim">Never</span>}
      </td>
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
              <Trash2 className="size-3 shrink-0" strokeWidth={2} />
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
