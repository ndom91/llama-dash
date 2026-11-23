import { getRouteApi } from '@tanstack/react-router'
import { useMemo } from 'react'
import { useModels } from '../../lib/queries'
import { ClientChip } from './ClientChip'
import { CodeExample } from './CodeExample'
import { EndpointModelPicker } from './EndpointModelPicker'
import { ENDPOINT_TYPES, type EndpointType, endpointTypeInfo, modelsForType, placeholderModel } from './endpointTypes'
import type { ConnectSearch } from './connectSearch'
import { MissingModelHint } from './MissingModelHint'
import { RequestTypeCard } from './RequestTypeCard'
import { StepLabel } from './StepLabel'
import { clientSupports, ENDPOINT_CLIENTS, firstClientFor, typesForClient } from './snippets'

const route = getRouteApi('/connect')

type Props = {
  baseUrl: string
  apiKey: string
}

export function EndpointExamples({ baseUrl, apiKey }: Props) {
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const { data: models } = useModels()

  const type = search.type ?? 'text'
  const info = endpointTypeInfo(type)
  const modelIdsByType = useMemo(
    () =>
      Object.fromEntries(ENDPOINT_TYPES.map((t) => [t.id, modelsForType(models, t.id).map((m) => m.id)])) as Record<
        EndpointType,
        Array<string>
      >,
    [models],
  )
  const typeModelIds = modelIdsByType[type]
  // Until models arrive, don't flash every type as unsupported.
  const modelsLoaded = models !== undefined

  // URL values are hints: an unsupported client or unknown model falls back.
  const client = search.client && clientSupports(search.client, type) ? search.client : firstClientFor(type)
  const model =
    search.model && typeModelIds.includes(search.model) ? search.model : (typeModelIds[0] ?? placeholderModel(type))

  const update = (next: ConnectSearch) => {
    void navigate({ search: (prev) => ({ ...prev, ...next }), replace: true })
  }

  const selectType = (next: EndpointType) => {
    update({ type: next, client: clientSupports(client, next) ? client : firstClientFor(next), model: undefined })
  }

  return (
    <section className="@container flex flex-col gap-3 border-t border-border px-6 py-5 max-md:px-3">
      <StepLabel step={1}>What are you calling</StepLabel>
      <div className="flex gap-2 overflow-x-auto pb-1 @min-[640px]:grid @min-[640px]:grid-cols-3 @min-[640px]:overflow-visible @min-[640px]:pb-0 @min-[1320px]:grid-cols-6">
        {ENDPOINT_TYPES.map((t) => (
          <RequestTypeCard
            key={t.id}
            info={t}
            modelIds={modelIdsByType[t.id]}
            loading={!modelsLoaded}
            selected={t.id === type}
            onSelect={() => selectType(t.id)}
          />
        ))}
      </div>

      <StepLabel step={2} className="mt-3">
        From where
      </StepLabel>
      <div className="flex flex-wrap items-center gap-1.5">
        {ENDPOINT_CLIENTS.map((c) => (
          <ClientChip
            key={c.id}
            label={c.label}
            icon={c.icon}
            selected={c.id === client}
            available={clientSupports(c.id, type)}
            supportedTypes={typesForClient(c.id)}
            onSelect={() => update({ client: c.id })}
          />
        ))}
        <EndpointModelPicker
          className="ml-auto"
          modelIds={typeModelIds}
          loading={!modelsLoaded}
          value={model}
          onChange={(next) => update({ model: next })}
        />
      </div>

      {modelsLoaded && typeModelIds.length === 0 ? <MissingModelHint info={info} /> : null}
      <CodeExample type={type} client={client} baseUrl={baseUrl} apiKey={apiKey} model={model} />
    </section>
  )
}
