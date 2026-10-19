import {
  operations,
  type Actor,
  type ApiError,
  type CoreOperationId,
  type OperationId,
  type OperationInput,
  type OperationSpec,
  type Operations
} from '@safe-edge/contracts'
import type { Clock, Core, IdGenerator } from '@safe-edge/core'
import { Hono, type Context } from 'hono'
import { createMiddleware } from 'hono/factory'
import { streamSSE } from 'hono/streaming'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import * as z from 'zod'
import { createEventHub } from './events.ts'
import { DEMO_TOKEN_PREFIX } from './tokens.ts'

export interface ApiOptions {
  core: Core
  clock: Clock
  /** The core's ID generator, shared so API-owned records (evidence, webhooks) get IDs from the same counters. */
  ids: IdGenerator
  /** Opaque bearer token → the Actor it acts as. */
  tokens: ReadonlyMap<string, Actor>
  /** Interval of the SSE heartbeat comment. Keep it under Bun.serve's `idleTimeout` (10 s by default). */
  heartbeatMs: number
}

type Env = { Variables: { actor: Actor } }
type ApiOperationId = { [K in OperationId]: Operations[K]['handledBy'] extends 'api' ? K : never }[OperationId]
type ApiHandlers = {
  [K in ApiOperationId]: (c: Context<Env>, input: OperationInput<K>) => Response | Promise<Response>
}

const fail = (c: Context, status: ContentfulStatusCode, error: ApiError['error'], message: string) =>
  c.json({ ok: false, error, message } satisfies ApiError, status)

/** The v1 REST API: one route per row of the operations table. Core's policy decides every access. */
export function createApp({ core, tokens, heartbeatMs }: ApiOptions) {
  const app = new Hono<Env>().basePath('/v1')
  const hub = createEventHub()
  app.get('/health', (c) => c.json({ status: 'ok' }))

  const authenticate = createMiddleware<Env>(async (c, next) => {
    const unauthenticated = (message: string) =>
      c.json({ ok: false, error: 'unauthenticated', message } satisfies ApiError, 401, { 'WWW-Authenticate': 'Bearer' })
    const token = /^Bearer (\S+)$/i.exec(c.req.header('authorization') ?? '')?.[1]
    if (token === undefined) return unauthenticated('Send Authorization: Bearer <token>')
    if (token.startsWith(DEMO_TOKEN_PREFIX)) {
      return unauthenticated('Demo-mode tokens work only in the in-browser demo; the API rejects them')
    }
    const actor = tokens.get(token)
    if (actor === undefined) return unauthenticated('Unknown bearer token')
    c.set('actor', actor)
    await next()
  })

  const apiHandlers: ApiHandlers = {
    uploadEvidence: (c) => fail(c, 501, 'not_implemented', 'todo'),
    getEvidenceUrl: (c) => fail(c, 501, 'not_implemented', 'todo'),
    triageImages: (c) => fail(c, 501, 'not_implemented', 'Claude vision triage arrives with #74'),
    askAgent: (c) => fail(c, 501, 'not_implemented', 'The scoped agent arrives with #75'),
    streamEvents: (c) =>
      streamSSE(c, async (stream) => {
        stream.onAbort(
          hub.subscribe(
            (event) => void stream.writeSSE({ id: event.id, event: event.type, data: JSON.stringify(event) })
          )
        )
        // The first write sends the headers, so the client knows it is subscribed. Comments are not events.
        await stream.write(': connected\n\n')
        while (!stream.aborted) {
          await stream.sleep(heartbeatMs)
          await stream.write(': heartbeat\n\n')
        }
      }),
    registerWebhook: (c) => fail(c, 501, 'not_implemented', 'todo')
  }

  const serve = (operationId: OperationId, op: OperationSpec) => async (c: Context<Env>) => {
    const actor = c.get('actor')
    const body = op.body ? readJson(await c.req.text()) : undefined
    const raw = { params: c.req.param(), query: c.req.query(), body }

    // Policy before validation, so a refused caller learns nothing about the input and the refusal is audited.
    const refused = core.authorize(operationId, actor, {
      params: raw.params,
      body: body === NOT_JSON ? undefined : body
    })
    if (refused) return c.json(refused, 403)
    if (body === NOT_JSON) return fail(c, 400, 'invalid_input', 'The body is not JSON')

    const input: Record<string, unknown> = {}
    for (const part of ['params', 'query', 'body'] as const) {
      const schema = op[part]
      if (schema === undefined) continue
      const parsed = schema.safeParse(raw[part])
      if (!parsed.success) return fail(c, 400, 'invalid_input', `${part}: ${z.prettifyError(parsed.error)}`)
      input[part] = parsed.data
    }

    if (op.handledBy === 'api') return apiHandlers[operationId as ApiOperationId](c, input as never)
    const result = core.dispatch(operationId as CoreOperationId, actor, input as never)
    if (!result.ok) return 'rule' in result ? c.json(result, 403) : c.json(result, 404)
    hub.publish(result.events)
    return c.json(result.data as object, result.status)
  }

  for (const [operationId, op] of Object.entries(operations) as [OperationId, OperationSpec][]) {
    if (op.handledBy === 'memory') continue
    app.on(op.method.toUpperCase(), op.path.replaceAll(/\{(\w+)\}/g, ':$1'), authenticate, serve(operationId, op))
  }
  return app
}

const NOT_JSON = Symbol('not JSON')

/** An empty body reads as undefined, so the operation's schema reports it. */
function readJson(text: string): unknown {
  if (text === '') return undefined
  try {
    return JSON.parse(text)
  } catch (error) {
    if (error instanceof SyntaxError) return NOT_JSON
    throw error
  }
}
