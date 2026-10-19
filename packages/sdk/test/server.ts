// Starts the real v1 API (apps/api, #54) on a free port with an injectable clock, so the http transport is proven
// against the server it will meet. Bearer tokens `tok_<userId>` map to the seeded users. Each request's token and
// Idempotency-Key are recorded so the tests can check what the transport sends.
import { actorFor, counterIds, createCore } from '@safe-edge/core'
import { createApp } from '../../../apps/api/src/app.ts'
import { elminaSeed } from '../src/index.ts'

export interface Received {
  method: string
  path: string
  authorization: string | null
  idempotencyKey: string | null
}

export function startApi() {
  let now = elminaSeed.asOf
  const clock = { now: () => now }
  const ids = counterIds()
  const core = createCore({ seed: elminaSeed, clock, ids })
  const tokens = new Map(elminaSeed.users.map((u) => [`tok_${u.id}`, actorFor(u)]))
  const app = createApp({ core, clock, ids, tokens, heartbeatMs: 5_000 })
  const received: Received[] = []

  const server = Bun.serve({
    port: 0,
    fetch(request) {
      received.push({
        method: request.method,
        path: new URL(request.url).pathname,
        authorization: request.headers.get('authorization'),
        idempotencyKey: request.headers.get('idempotency-key')
      })
      return app.fetch(request)
    }
  })

  return {
    baseUrl: new URL('/v1', server.url).href,
    tokenFor: (userId: string) => `tok_${userId}`,
    received,
    setNow: (iso: string) => {
      now = iso
    },
    stop: () => server.stop(true)
  }
}
