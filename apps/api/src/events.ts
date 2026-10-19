import type { EdgeEvent, Webhook } from '@safe-edge/contracts'

/**
 * Fans core's CloudEvents out to SSE subscribers and registered webhooks, in process. A webhook gets one structured
 * CloudEvents POST per matching event: no signature and no retries; a failed delivery is logged.
 */
export function createEventHub() {
  const subscribers = new Set<(event: EdgeEvent) => void>()
  const webhooks: Webhook[] = []

  return {
    subscribe(listener: (event: EdgeEvent) => void): () => void {
      subscribers.add(listener)
      return () => subscribers.delete(listener)
    },
    register(webhook: Webhook): void {
      webhooks.push(webhook)
    },
    publish(events: EdgeEvent[]): void {
      for (const event of events) {
        for (const listener of subscribers) listener(event)
        for (const webhook of webhooks) if (webhook.eventTypes.includes(event.type)) deliver(webhook, event)
      }
    }
  }
}

function deliver(webhook: Webhook, event: EdgeEvent): void {
  fetch(webhook.url, {
    method: 'POST',
    headers: { 'content-type': 'application/cloudevents+json' },
    body: JSON.stringify(event)
  }).then(
    (response) => {
      if (!response.ok) console.error(`Webhook ${webhook.id} answered ${event.id} with HTTP ${response.status}`)
    },
    (error: unknown) => console.error(`Webhook ${webhook.id} could not receive ${event.id} at ${webhook.url}`, error)
  )
}
