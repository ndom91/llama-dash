type AdminEventType = 'request.completed' | 'model.changed' | 'gpu.updated' | 'system.changed'

type AdminEvent = {
  id: number
  type: AdminEventType
  data: unknown
}

type Subscriber = (event: AdminEvent) => void

let nextEventId = 1
const subscribers = new Set<Subscriber>()

export function publishAdminEvent(type: AdminEventType, data: unknown = {}) {
  const event = { id: nextEventId++, type, data }
  for (const subscriber of subscribers) subscriber(event)
}

export function subscribeAdminEvents(subscriber: Subscriber) {
  subscribers.add(subscriber)
  return () => subscribers.delete(subscriber)
}

export function formatSseEvent(event: AdminEvent) {
  return `id: ${event.id}\nevent: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`
}
