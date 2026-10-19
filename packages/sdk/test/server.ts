// A minimal stand-in for the v1 API (#54), built only from core and the contracts, so the http transport is tested
// over real HTTP: bearer tokens map to seeded users, routes come from the operations table, a denial is a 403 Denial.
// It records each request's Idempotency-Key and does nothing else with it; #54 owns replay.
import { operations, type CoreOperationId, type OperationSpec } from '@safe-edge/contracts'
import { actorFor, counterIds, createCore } from '@safe-edge/core'
import * as z from 'zod'
import { elminaSeed } from '../src/index.ts'

export interface Received {
  method: string
  path: string
  authorization: string | null
  idempotencyKey: string | null
}

export function startTestApi() {
  let now = elminaSeed.asOf
  const core = createCore({ seed: elminaSeed, clock: { now: () => now }, ids: counterIds() })
  const actors = new Map(elminaSeed.users.map((u) => [`tok_${u.id}`, actorFor(u)]))
  const routes = (Object.keys(operations) as (keyof typeof operations)[])
    .filter((id): id is CoreOperationId => operations[id].handledBy === 'core')
    .map((id) => {
      const op: OperationSpec = operations[id]
      return { id, op, pattern: new RegExp(`^/v1${op.path.replace(/\{(\w+)\}/g, '(?<$1>[^/]+)')}$`) }
    })
  const received: Received[] = []
  const fail = (status: number, error: string, message: string) =>
    Response.json({ ok: false, error, message }, { status })

  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      const url = new URL(request.url)
      const authorization = request.headers.get('authorization')
      received.push({
        method: request.method,
        path: url.pathname,
        authorization,
        idempotencyKey: request.headers.get('idempotency-key')
      })
      const actor = actors.get(authorization?.replace(/^Bearer /, '') ?? '')
      if (!actor) return fail(401, 'unauthenticated', 'Unknown bearer token')

      for (const { id, op, pattern } of routes) {
        const match = op.method.toUpperCase() === request.method ? pattern.exec(url.pathname) : null
        if (!match) continue
        const input = {
          params: { ...match.groups },
          query: Object.fromEntries(url.searchParams),
          body: op.body ? await request.json() : undefined
        }
        for (const part of ['params', 'query', 'body'] as const) {
          const parsed = op[part]?.safeParse(input[part])
          if (parsed && !parsed.success) return fail(400, 'invalid_input', z.prettifyError(parsed.error))
        }
        const result = core.dispatch(id, actor, input as never)
        if (!result.ok) return Response.json(result, { status: 'rule' in result ? 403 : 404 })
        return Response.json(result.data, { status: result.status })
      }
      return fail(404, 'not_found', `No route ${request.method} ${url.pathname}`)
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
