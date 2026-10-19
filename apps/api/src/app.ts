import {
  failureStatus,
  operations,
  type Actor,
  type AgentDelta,
  type ApiError,
  type CoreOperationId,
  type OperationId,
  type OperationInput,
  type OperationSpec,
  type Operations,
  type Webhook,
  type WorkOrderProvider
} from '@safe-edge/contracts'
import type Anthropic from '@anthropic-ai/sdk'
import { APIUserAbortError } from '@anthropic-ai/sdk'
import type { Clock, Core, IdGenerator } from '@safe-edge/core'
import type { EvidenceReader } from '@safe-edge/providers'
import { createSafeEdgeClient } from '@safe-edge/sdk'
import { Hono, type Context } from 'hono'
import { createMiddleware } from 'hono/factory'
import { streamSSE } from 'hono/streaming'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import * as z from 'zod'
import { createAgent } from './agent.ts'
import { createEventHub } from './events.ts'
import { createEvidenceStore } from './evidence.ts'
import { DEMO_TOKEN_PREFIX } from './tokens.ts'
import { forwardWorkOrders } from './work-orders.ts'

export interface ApiOptions {
  core: Core
  clock: Clock
  /** The core's ID generator, shared so API-owned records (evidence, webhooks) get IDs from the same counters. */
  ids: IdGenerator
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
}

type Env = { Variables: { actor: Actor } }

/** Who delivers webhooks and records their failures: the API itself. */
const WEBHOOKS: Actor = { type: 'system', id: 'api.webhooks', role: 'system', scopes: [] }
type ApiOperationId = { [K in OperationId]: Operations[K]['handledBy'] extends 'api' ? K : never }[OperationId]
type ApiHandlers = {
  [K in ApiOperationId]: (c: Context<Env>, input: OperationInput<K>) => Response | Promise<Response>
}

const fail = (c: Context, status: ContentfulStatusCode, error: ApiError['error'], message: string) =>
  c.json({ ok: false, error, message } satisfies ApiError, status)

/** The v1 REST API: one route per row of the operations table. Core's policy decides every access. */
export function createApp({ core, clock, ids, tokens, heartbeatMs, workOrders, agent: agentOptions }: ApiOptions) {
  const app = new Hono<Env>().basePath('/v1')
  // A failed webhook delivery is the API's own write to the webhook, on the audit chain like any other.
  const hub = createEventHub({
    clock,
    onFailure: (before, after) => core.recordStored('deliverWebhook', WEBHOOKS, after, before)
  })
  const evidence = createEvidenceStore({ clock, ids })
  if (workOrders) {
    const provider = workOrders(async (ref) => evidence.bytes(ref))
    forwardWorkOrders({ core, subscribe: hub.subscribe, provider })
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
  // must not share it. Server errors are not kept, so a retry runs again. In memory, like the core.
  const replays = new Map<
    string,
    { fingerprint: string; response?: { status: number; headers: Headers; body: string } }
  >()
  const idempotency = createMiddleware<Env>(async (c, next) => {
    const key = c.req.header('idempotency-key')
    if (key === undefined) return next()
    const scope = JSON.stringify([c.get('actor'), c.req.method, c.req.path, key])
    const fingerprint = new Bun.CryptoHasher('sha256').update(await c.req.text()).digest('hex')
    const seen = replays.get(scope)
    if (seen && seen.fingerprint !== fingerprint) {
      return fail(c, 422, 'idempotency_conflict', 'This Idempotency-Key was already used with a different body')
    }
    if (seen?.response) return new Response(seen.response.body, seen.response)
    if (seen) return fail(c, 409, 'idempotency_conflict', 'A request with this Idempotency-Key is still running')

    replays.set(scope, { fingerprint })
    await next()
    if (c.res.status >= 500) replays.delete(scope)
    else {
      const response = { status: c.res.status, headers: new Headers(c.res.headers), body: await c.res.clone().text() }
      replays.set(scope, { fingerprint, response })
    }
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
    uploadEvidence: (c, { body }) => {
      const ref = evidence.put(body, c.get('actor'))
      core.recordStored('uploadEvidence', c.get('actor'), ref)
      return c.json(ref, 201)
    },
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
          // A person who hangs up (closes the panel) cancels the run: the abort reaches the request open to Claude.
          const hungUp = new AbortController()
          stream.onAbort(() => hungUp.abort())
          // Claude can think and call tools for longer than Bun's idle timeout before it writes text, so the stream
          // opens with a comment and keeps a heartbeat, as /events does.
          await stream.write(': connected\n\n')
          const heartbeat = setInterval(() => void stream.write(': heartbeat\n\n'), heartbeatMs)
          try {
            const result = await agent.ask(
              body.question,
              (text) => stream.writeSSE({ event: 'delta', data: JSON.stringify({ text } satisfies AgentDelta) }),
              hungUp.signal
            )
            if (result.ok) await stream.writeSSE({ event: 'answer', data: JSON.stringify(result.answer) })
            else await stream.writeSSE({ event: 'stopped', data: JSON.stringify(result) })
          } catch (error) {
            // Nobody is listening for the answer, so the cancelled run is not an error.
            if (hungUp.signal.aborted && error instanceof APIUserAbortError) return
            throw error
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
      const webhook: Webhook = {
        id: ids.next('whk'),
        ...body,
        createdBy: c.get('actor').id,
        createdAt: clock.now(),
        failures: []
      }
      hub.register(webhook)
      core.recordStored('registerWebhook', c.get('actor'), webhook)
      return c.json(webhook, 201)
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
    return c.json(result.data as object, result.status)
  }

  for (const [operationId, op] of Object.entries(operations) as [OperationId, OperationSpec][]) {
    if (op.handledBy === 'memory') continue
    const path = op.path.replaceAll(/\{(\w+)\}/g, ':$1')
    // A streamed response cannot be stored for replay, so streams skip the idempotency middleware.
    if (op.method === 'get' || op.stream) app.on(op.method.toUpperCase(), path, authenticate, serve(operationId, op))
    else app.on(op.method.toUpperCase(), path, authenticate, idempotency, serve(operationId, op))
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
