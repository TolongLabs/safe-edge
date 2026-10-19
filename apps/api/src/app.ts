import {
  failureStatus,
  operations,
  type Actor,
  type AgentDelta,
  type ApiError,
  type CoreOperationId,
  type OperationId,
  type OperationInput,
  type OperationOutput,
  type Dispatch,
  type OperationSpec,
  type Operations,
  type PatrolPlanner,
  type RegisteredWebhook,
  type UploadEvidenceRequest,
  type WorkOrderProvider
} from '@safe-edge/contracts'
import type Anthropic from '@anthropic-ai/sdk'
import { counterIds, createCore, type Clock, type Core, type Seed } from '@safe-edge/core'
import { Database } from 'bun:sqlite'
import type { EvidenceReader } from '@safe-edge/providers'
import { createSafeEdgeClient } from '@safe-edge/sdk'
import { Hono, type Context } from 'hono'
import { createMiddleware } from 'hono/factory'
import { streamSSE } from 'hono/streaming'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import * as z from 'zod'
import { createAgent } from './agent.ts'
import { createEventHub, newWebhookSecret, type WebhookOptions } from './events.ts'
import { createEvidenceStore } from './evidence.ts'
import { openJournal } from './journal.ts'
import { DEMO_TOKEN_PREFIX } from './tokens.ts'
import { forwardWorkOrders } from './work-orders.ts'

export interface ApiOptions {
  seed: Seed
  /** Needed only by `createPatrolPlan`. */
  planner?: PatrolPlanner
  clock: Clock
  /**
   * The SQLite file the API keeps its state in (journal.ts), replayed on start; `:memory:` keeps it for the life of
   * the process only. One API process per file.
   */
  store: string
  /** Opaque bearer token → the Actor it acts as. */
  tokens: ReadonlyMap<string, Actor>
  /** Interval of the SSE heartbeat comment. Keep it under Bun.serve's `idleTimeout` (10 s by default). */
  heartbeatMs: number
  /**
   * The work-order system that accepted findings go to (Procore), built with a reader for uploaded evidence. Without
   * it, work orders stay in Safe Edge.
   */
  workOrders?: (readEvidence: EvidenceReader) => WorkOrderProvider
  /**
   * The agent behind `/agent/*`: a Claude client and the API token it acts with, which must map to an agent actor.
   * Without it, those routes answer 501.
   */
  agent?: { claude: Anthropic; token: string }
  /** Where webhooks may point and how failed deliveries are retried. */
  webhooks: WebhookOptions
}

type Env = { Variables: { actor: Actor } }

/** Who records a hand-off the API cannot run: the API itself, as in work-orders.ts. */
const WORK_ORDERS: Actor = { type: 'system', id: 'api.work-orders', role: 'system', scopes: [] }
type ApiOperationId = { [K in OperationId]: Operations[K]['handledBy'] extends 'api' ? K : never }[OperationId]
type ApiHandlers = {
  [K in ApiOperationId]: (c: Context<Env>, input: OperationInput<K>) => Response | Promise<Response>
}

const fail = (c: Context, status: ContentfulStatusCode, error: ApiError['error'], message: string) =>
  c.json({ ok: false, error, message } satisfies ApiError, status)

/** The v1 REST API: one route per row of the operations table. Core's policy decides every access. */
export function createApp({
  seed,
  planner,
  clock: baseClock,
  store,
  tokens,
  heartbeatMs,
  workOrders,
  agent: agentOptions,
  webhooks
}: ApiOptions) {
  const app = new Hono<Env>().basePath('/v1')
  // Every change to the API's state goes through a journaled command, so a restart replays it (journal.ts). Core and
  // the API's own records (evidence, webhooks) draw IDs from the same counters.
  const db = new Database(store, { create: true, strict: true })
  const journal = openJournal(db, { seed, clock: baseClock, ids: counterIds() })
  const { clock, ids } = journal
  const unjournaled = createCore({ seed, clock, ids, planner })
  const core: Core = {
    dispatch: journal.command('dispatch', unjournaled.dispatch) as Dispatch,
    checkAccess: journal.command('checkAccess', unjournaled.checkAccess),
    recordStored: journal.command('recordStored', unjournaled.recordStored),
    tick: journal.command('tick', unjournaled.tick)
  }
  const hub = createEventHub({
    clock,
    ids,
    options: webhooks,
    command: journal.command,
    recordStored: core.recordStored
  })
  const evidence = createEvidenceStore({ clock, ids })
  const uploadEvidence = journal.command('uploadEvidence', (actor: Actor, body: UploadEvidenceRequest) => {
    const ref = evidence.put(body, actor)
    core.recordStored('uploadEvidence', actor, ref)
    return ref
  })
  const forwarder =
    workOrders &&
    forwardWorkOrders({ core, subscribe: hub.subscribe, provider: workOrders(async (ref) => evidence.bytes(ref)) })
  /** Core operations the API acts on once they succeed, besides publishing their events. */
  const afterDispatch: { [K in CoreOperationId]?: (data: OperationOutput<K>) => void } = {
    // A person cleared a failed hand-off; the API resumes it from the step that failed.
    retryWorkOrderHandOff: ({ workOrder, retried }) => {
      if (forwarder) return forwarder.retry(workOrder.id, retried.step)
      // This API runs without a work-order system, so the retry fails at once, on the record like any other failure.
      const body = { step: retried.step, message: 'This API instance has no work-order system configured' }
      const recorded = core.dispatch('recordWorkOrderExternalError', WORK_ORDERS, {
        params: { id: workOrder.id },
        body
      })
      if (!recorded.ok) throw new Error(recorded.message)
    }
  }
  app.get('/health', (c) => c.json({ status: 'ok' }))
  // Where getEvidenceUrl points. The signed query is the credential, so it takes no bearer token.
  app.get('/evidence/:id/content', (c) => {
    const { expires, signature } = c.req.query()
    const file = expires && signature ? evidence.read(c.req.param('id'), expires, signature) : undefined
    if (file === undefined) return fail(c, 401, 'unauthenticated', 'The evidence link is invalid or has expired')
    return c.body(file.bytes, 200, { 'content-type': file.ref.mediaType })
  })

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

  // Writes replay by caller, method, path and Idempotency-Key (draft-ietf-httpapi-idempotency-key-header). The caller
  // is the whole actor, role and scopes included: a replay skips the access check, so another token of the same person
  // must not share it. Server errors are not kept, so a retry runs again. Answers are kept in the store's
  // `idempotency` table, so they outlive a restart; requests still running are tracked in memory.
  db.run(
    'create table if not exists idempotency (scope text primary key, fingerprint text not null, ' +
      'status integer not null, headers text not null, body text not null)'
  )
  type Kept = { fingerprint: string; status: number; headers: string; body: string }
  const keptAnswer = db.query<Kept, [string]>(
    'select fingerprint, status, headers, body from idempotency where scope = ?'
  )
  const keepAnswer = db.query(
    'insert into idempotency (scope, fingerprint, status, headers, body) values (?, ?, ?, ?, ?)'
  )
  const running = new Map<string, string>()
  const idempotency = createMiddleware<Env>(async (c, next) => {
    const key = c.req.header('idempotency-key')
    if (key === undefined) return next()
    const scope = JSON.stringify([c.get('actor'), c.req.method, c.req.path, key])
    const fingerprint = new Bun.CryptoHasher('sha256').update(await c.req.text()).digest('hex')
    const kept = keptAnswer.get(scope)
    const seen = kept?.fingerprint ?? running.get(scope)
    if (seen !== undefined && seen !== fingerprint) {
      return fail(c, 422, 'idempotency_conflict', 'This Idempotency-Key was already used with a different body')
    }
    if (kept) return new Response(kept.body, { status: kept.status, headers: JSON.parse(kept.headers) })
    if (seen !== undefined)
      return fail(c, 409, 'idempotency_conflict', 'A request with this Idempotency-Key is still running')

    running.set(scope, fingerprint)
    await next()
    const body = await c.res.clone().text()
    running.delete(scope)
    if (c.res.status < 500) keepAnswer.run(scope, fingerprint, c.res.status, JSON.stringify([...c.res.headers]), body)
  })

  // The agent calls this same app in process with its own token, so every call passes auth, policy, validation,
  // idempotency and the event hub like any other client's.
  const agent = agentOptions && createAgentFor(agentOptions)
  function createAgentFor({ claude, token }: { claude: Anthropic; token: string }) {
    if (tokens.get(token)?.type !== 'agent') throw new Error('The agent token must map to an agent actor')
    const client = createSafeEdgeClient({
      transport: 'http',
      baseUrl: 'http://safe-edge.internal/v1',
      token,
      fetch: async (url, init) => app.fetch(new Request(url, init))
    })
    return createAgent({ claude, context: { client, now: clock.now } })
  }
  const noAgent = (c: Context) => fail(c, 501, 'not_implemented', 'This API instance runs without the agent')

  const apiHandlers: ApiHandlers = {
    uploadEvidence: (c, { body }) => c.json(uploadEvidence(c.get('actor'), body), 201),
    getEvidenceUrl: (c, { params }) => {
      const url = evidence.url(params.id, c.req.url)
      return url ? c.json(url, 200) : fail(c, 404, 'not_found', `No evidence ${params.id}`)
    },
    triageImages: (c) => fail(c, 501, 'not_implemented', 'Claude vision triage arrives with #74'),
    askAgent: (c, { body }) => {
      if (agent === undefined) return noAgent(c)
      return streamSSE(
        c,
        async (stream) => {
          // Claude can think and call tools for longer than Bun's idle timeout before it writes text, so the stream
          // opens with a comment and keeps a heartbeat, as /events does.
          await stream.write(': connected\n\n')
          const heartbeat = setInterval(() => void stream.write(': heartbeat\n\n'), heartbeatMs)
          try {
            const result = await agent.ask(body.question, (text) =>
              stream.writeSSE({ event: 'delta', data: JSON.stringify({ text } satisfies AgentDelta) })
            )
            if (result.ok) await stream.writeSSE({ event: 'answer', data: JSON.stringify(result.answer) })
            else await stream.writeSSE({ event: 'stopped', data: JSON.stringify(result) })
          } finally {
            clearInterval(heartbeat)
          }
        },
        async (error, stream) => {
          console.error('safe-edge agent: ask failed', error)
          await stream.writeSSE({ event: 'error', data: JSON.stringify({ message: error.message }) })
        }
      )
    },
    draftInbox: async (c, { body }) => {
      if (agent === undefined) return noAgent(c)
      // Looked up as the person asking, so an unknown candidate is their 404, and only stored IDs reach the prompt.
      const actor = c.get('actor')
      const found = core.dispatch('getCandidate', actor, { params: { id: body.candidateId } })
      if (!found.ok) return c.json(found, failureStatus(found))
      const { candidate } = found.data
      const findings = core.dispatch('listFindings', actor, { query: { segmentId: candidate.segmentId } })
      if (!findings.ok) throw new Error(`listFindings refused ${actor.id}: ${findings.message}`)
      const finding = findings.data.find((f) => f.candidateId === candidate.id) ?? null
      const result = await agent.draftInbox(candidate, finding)
      return result.ok ? c.json(result.draft, 200) : c.json(result, 502)
    },
    draftMonthlyReport: async (c, { body }) => {
      if (agent === undefined) return noAgent(c)
      const result = await agent.draftMonthlyReport(body.month)
      return result.ok ? c.json(result.report, 200) : c.json(result, 502)
    },
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
    listWebhooks: (c) => c.json(hub.list(), 200),
    registerWebhook: (c, { body }) => {
      if (!hub.allows(body.url)) {
        const message = `url: ${new URL(body.url).origin} is not on the webhook allowlist (SAFE_EDGE_WEBHOOK_ORIGINS)`
        return fail(c, 400, 'invalid_input', message)
      }
      const secret = newWebhookSecret()
      const webhook = hub.register(c.get('actor'), body, secret)
      return c.json({ ...webhook, secret } satisfies RegisteredWebhook, 201)
    }
  }

  const serve = (operationId: OperationId, op: OperationSpec) => async (c: Context<Env>) => {
    const actor = c.get('actor')
    const body = op.body ? readJson(await c.req.text()) : undefined
    const raw = { params: c.req.param(), query: c.req.query(), body }

    // Policy before validation, so a refused caller learns nothing about the input and the refusal is audited.
    const refused = core.checkAccess(operationId, actor, {
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
    if (!result.ok) return c.json(result, failureStatus(result))
    hub.publish(result.events)
    afterDispatch[operationId as CoreOperationId]?.(result.data as never)
    return c.json(result.data as object, result.status)
  }

  for (const [operationId, op] of Object.entries(operations) as [OperationId, OperationSpec][]) {
    if (op.handledBy === 'memory') continue
    const path = op.path.replaceAll(/\{(\w+)\}/g, ':$1')
    // A streamed response cannot be stored for replay, so streams skip the idempotency middleware.
    if (op.method === 'get' || op.stream) app.on(op.method.toUpperCase(), path, authenticate, serve(operationId, op))
    else app.on(op.method.toUpperCase(), path, authenticate, idempotency, serve(operationId, op))
  }
  // Every command is registered by now, so the journal can rebuild the state the last process left.
  journal.replay()
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
