import type { EdgeEvent } from '@safe-edge/contracts'

export interface EventQueue {
  /** Calls `listener` with every event published from now on. Returns the unsubscribe function. */
  subscribe(listener: (event: EdgeEvent) => void): () => void
  publish(events: EdgeEvent[]): void
}

/**
 * Delivers published events to every listener in the order they happened, in both transports. An event a listener
 * publishes while another is being delivered (a re-plan reacting to a decision) waits until that one has reached every
 * listener.
 */
export function createEventQueue(): EventQueue {
  const listeners = new Set<(event: EdgeEvent) => void>()
  const queue: EdgeEvent[] = []
  let delivering = false
  return {
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    publish(events) {
      queue.push(...events)
      if (delivering) return
      delivering = true
      try {
        for (let event = queue.shift(); event !== undefined; event = queue.shift()) {
          for (const listener of listeners) listener(event)
        }
      } finally {
        delivering = false
      }
    }
  }
}
