import type { EdgeEvent, Webhook } from '@safe-edge/contracts'
import type { Clock } from '@safe-edge/core'

/**
 * Fans core's CloudEvents out to SSE subscribers and registered webhooks, in process. A webhook gets one structured
 * CloudEvents POST per matching event: no signature and no retries. A failed delivery (a non-2xx answer or a network
 * error) is added to the webhook's `failures` and handed to `onFailure` with the record before and after, so the API
 * can audit it.
 */
export function createEventHub({
  clock,
  onFailure
}: {
  clock: Clock
  onFailure: (before: Webhook, after: Webhook) => void
}) {
  const subscribers = new Set<(event: EdgeEvent) => void>()
  const webhooks = new Map<string, Webhook>()

  function fail(id: string, eventId: string, error: string): void {
    const before = webhooks.get(id)!
    const after: Webhook = { ...before, failures: [...before.failures, { eventId, at: clock.now(), error }] }
    webhooks.set(id, after)
    onFailure(before, after)
  }

  async function deliver(webhook: Webhook, event: EdgeEvent): Promise<void> {
    let response: Response
    try {
      response = await fetch(webhook.url, {
        method: 'POST',
        headers: { 'content-type': 'application/cloudevents+json' },
        body: JSON.stringify(event)
      })
    } catch (error) {
      // A network error (the endpoint cannot be reached) is the delivery's failure; anything else is a bug and throws.
      if (!(error instanceof TypeError)) throw error
      return fail(webhook.id, event.id, error.message)
    }
    if (!response.ok) fail(webhook.id, event.id, `HTTP ${response.status}: ${await response.text()}`)
  }

  return {
    subscribe(listener: (event: EdgeEvent) => void): () => void {
      subscribers.add(listener)
      return () => subscribers.delete(listener)
    },
    register(webhook: Webhook): void {
      webhooks.set(webhook.id, webhook)
    },
    list(): Webhook[] {
      return [...webhooks.values()]
    },
    publish(events: EdgeEvent[]): void {
      for (const event of events) {
        for (const listener of subscribers) listener(event)
        for (const webhook of webhooks.values()) {
          if (webhook.eventTypes.includes(event.type)) void deliver(webhook, event)
        }
      }
    }
  }
}
