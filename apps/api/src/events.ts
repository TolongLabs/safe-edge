import type { Actor, RegisterWebhookRequest, Webhook, WebhookFailure } from '@safe-edge/contracts'
import { createEventQueue, type Clock, type Core, type IdGenerator } from '@safe-edge/core'
import { createHmac, randomBytes } from 'node:crypto'
import type { Database } from 'bun:sqlite'
import type { Journal } from './journal.ts'

const SECRET_PREFIX = 'whsec_'
/** Standard Webhooks recommends a 15 to 30 s request timeout. */
const ATTEMPT_TIMEOUT_MS = 15_000
/** A receiver's error page is kept short on the webhook record and the audit chain. */
const ERROR_BODY_CHARS = 500
/** Failed attempts kept on the record, newest last, so a dead endpoint cannot grow it (and its audit copies) forever. */
const KEPT_FAILURES = 20

export interface WebhookOptions {
  /** Origins (scheme, host and port) webhooks may be registered for. */
  origins: readonly string[]
  /** Whether loopback hosts may be registered without being listed: in development and test only. */
  allowLoopback: boolean
  /** The wait before each retry; its length bounds the retries. */
  retryDelaysMs: readonly number[]
}

/** localhost (and its subdomains), 127.0.0.0/8 and ::1, as `URL` normalizes them. */
const isLoopback = (hostname: string) =>
  hostname === 'localhost' ||
  hostname.endsWith('.localhost') ||
  hostname === '[::1]' ||
  /^127(\.\d{1,3}){3}$/.test(hostname)

/** The bounded backoff after a failed delivery: five retries, doubling from 2 s, about a minute in all. */
const RETRY_DELAYS_MS = [2_000, 4_000, 8_000, 16_000, 32_000]

/** `SAFE_EDGE_WEBHOOK_RETRY_DELAYS_MS`: comma-separated whole milliseconds; unset, the backoff above. */
function retryDelays(listed: string | undefined): number[] {
  if (listed === undefined) return RETRY_DELAYS_MS
  const entries = listed.split(',').map((entry) => entry.trim())
  if (!entries.every((entry) => /^\d+$/.test(entry))) {
    throw new Error(`SAFE_EDGE_WEBHOOK_RETRY_DELAYS_MS lists whole milliseconds such as 2000,4000, not "${listed}"`)
  }
  return entries.map(Number)
}

/**
 * Webhook options from the environment. `SAFE_EDGE_WEBHOOK_ORIGINS` lists the allowed origins, comma-separated
 * (`https://hooks.example.org,https://ops.example.org:8443`); unset allows none. Loopback is allowed only when
 * `NODE_ENV` is `development` (bun run dev sets it) or `test` (bun test sets it), so a deployment without NODE_ENV
 * fails closed, and a loopback entry outside them is refused. `SAFE_EDGE_WEBHOOK_RETRY_DELAYS_MS` sets the waits before
 * each retry (`2000,4000,8000,16000,32000` when unset).
 */
export function webhookOptions(env: Record<string, string | undefined>): WebhookOptions {
  const allowLoopback = env.NODE_ENV === 'development' || env.NODE_ENV === 'test'
  const origins = (env.SAFE_EDGE_WEBHOOK_ORIGINS ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '')
  for (const entry of origins) {
    const url = URL.parse(entry)
    if (url?.origin !== entry) {
      throw new Error(`SAFE_EDGE_WEBHOOK_ORIGINS: "${entry}" is not an origin such as https://hooks.example.org`)
    }
    if (!allowLoopback && isLoopback(url.hostname)) {
      throw new Error(`SAFE_EDGE_WEBHOOK_ORIGINS: ${entry} is loopback, which only development and test allow`)
    }
  }
  return { origins, allowLoopback, retryDelaysMs: retryDelays(env.SAFE_EDGE_WEBHOOK_RETRY_DELAYS_MS) }
}

/** A new Standard Webhooks signing secret: `whsec_` and the base64 of 32 random bytes (the spec allows 24 to 64). */
export const newWebhookSecret = () => `${SECRET_PREFIX}${randomBytes(32).toString('base64')}`

/**
 * The Standard Webhooks headers (standardwebhooks.com, spec 1.0.0) for one attempt: `webhook-id` stays the event's ID
 * on every attempt, `webhook-timestamp` is the attempt's wall-clock time in seconds (receivers check it against their
 * own clock, so it is not the API's injected clock), and `webhook-signature` is `v1,` and the base64 HMAC-SHA256 of
 * `<id>.<timestamp>.<body>` under the secret's decoded bytes.
 */
function signatureHeaders(secret: string, id: string, body: string) {
  const timestamp = String(Math.floor(Date.now() / 1000))
  const key = Buffer.from(secret.slice(SECRET_PREFIX.length), 'base64')
  const signature = createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest('base64')
  return { 'webhook-id': id, 'webhook-timestamp': timestamp, 'webhook-signature': `v1,${signature}` }
}

/** Why an attempt failed, and whether waiting could help: a network error, a timeout, 408, 429 or a 5xx. */
async function tryDelivery(url: string, secret: string, eventId: string, body: string) {
  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      // A redirect is a failure, not a hop (Standard Webhooks), so an allowed host cannot bounce a delivery elsewhere.
      redirect: 'manual',
      signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
      headers: { 'content-type': 'application/cloudevents+json', ...signatureHeaders(secret, eventId, body) },
      body
    })
  } catch (error) {
    // Unreachable (TypeError) or too slow (TimeoutError) is the attempt's failure; anything else is a bug and throws.
    const timedOut = error instanceof DOMException && error.name === 'TimeoutError'
    if (!(error instanceof TypeError) && !timedOut) throw error
    return { error: error.message, retry: true }
  }
  if (response.ok) return null
  const text = (await response.text()).slice(0, ERROR_BODY_CHARS)
  const { status } = response
  return { error: `HTTP ${status}: ${text}`, retry: status >= 500 || status === 408 || status === 429 }
}

/** Who delivers webhooks and records their failures: the API itself. */
const WEBHOOKS: Actor = { type: 'system', id: 'api.webhooks', role: 'system', scopes: [] }

/**
 * Fans core's CloudEvents out to SSE subscribers and registered webhooks, in process. A webhook gets one structured
 * CloudEvents POST per matching event, signed with its secret, and retried after each wait in `retryDelaysMs` while
 * the failure is one waiting could fix. Registering and each failed attempt are journaled commands (journal.ts), and
 * both go on the audit chain through `recordStored`. The secrets stay here: no record or response but the
 * registration's carries one.
 *
 * A retry waits in the store's `webhook_retries` table, written in the same transaction as the failure before it, so
 * a restart picks it up at the time it was due (`resume`). A delivered or abandoned retry leaves the table. A first
 * attempt still in flight when the process dies is lost: nothing has failed yet, so nothing is pending.
 */
export function createEventHub({
  clock,
  ids,
  options,
  command,
  atomic,
  db,
  recordStored
}: {
  clock: Clock
  ids: IdGenerator
  options: WebhookOptions
  command: Journal['command']
  atomic: Journal['atomic']
  db: Database
  recordStored: Core['recordStored']
}) {
  const webhooks = new Map<string, { webhook: Webhook; secret: string }>()
  // Every subscriber, and every webhook, sees events in the order they happened, a re-plan right after its cause.
  const events = createEventQueue()

  db.run(
    'create table if not exists webhook_retries (webhook_id text not null, event_id text not null, body text not null, ' +
      'attempt integer not null, due_at integer not null, primary key (webhook_id, event_id))'
  )
  type Retry = { webhookId: string; eventId: string; body: string; attempt: number; dueAt: number }
  const pending = db.query<Retry, []>(
    'select webhook_id as webhookId, event_id as eventId, body, attempt, due_at as dueAt from webhook_retries'
  )
  const keepRetry = db.query('insert or replace into webhook_retries values (?, ?, ?, ?, ?)')
  const dropRetry = db.query('delete from webhook_retries where webhook_id = ? and event_id = ?')

  const register = command('registerWebhook', (actor: Actor, body: RegisterWebhookRequest, secret: string): Webhook => {
    const webhook: Webhook = { id: ids.next('whk'), ...body, createdBy: actor.id, createdAt: clock.now(), failures: [] }
    webhooks.set(webhook.id, { webhook, secret })
    recordStored('registerWebhook', actor, webhook)
    return webhook
  })

  const fail = command(
    'deliverWebhook',
    (id: string, { eventId, attempt, error, final }: Omit<WebhookFailure, 'at'>) => {
      const entry = webhooks.get(id)
      if (entry === undefined) throw new Error(`No webhook ${id}`)
      const before = entry.webhook
      const failures = [...before.failures, { eventId, at: clock.now(), attempt, error, final }]
      entry.webhook = { ...before, failures: failures.slice(-KEPT_FAILURES) }
      recordStored('deliverWebhook', WEBHOOKS, entry.webhook, before)
    }
  )

  /**
   * Whether webhooks may point at `url`: its origin is on the allowlist, or it is loopback where that is allowed. The
   * allowlist is the guard against server-side request forgery: integrators reach only hosts the operator listed.
   */
  const allows = (url: string) => {
    const { origin, hostname } = new URL(url)
    return options.origins.includes(origin) || (options.allowLoopback && isLoopback(hostname))
  }

  /** Records a failed attempt, and the retry it leaves pending until `dueAt` (none once final), in one transaction. */
  const record = (id: string, failure: Omit<WebhookFailure, 'at'>, body: string, dueAt: number) =>
    atomic(
      () => fail(id, failure),
      () => {
        if (failure.final) dropRetry.run(id, failure.eventId)
        else keepRetry.run(id, failure.eventId, body, failure.attempt + 1, dueAt)
      }
    )

  /** Makes attempt `n` at `dueAt` (wall-clock milliseconds), and each retry after it, until one lands or it is final. */
  async function deliver(id: string, eventId: string, body: string, n: number, dueAt: number): Promise<void> {
    for (; ; n++) {
      // Waiting comes first, so even a first attempt starts after the write that published its event has committed.
      await Bun.sleep(Math.max(0, dueAt - Date.now()))
      const entry = webhooks.get(id)
      if (entry === undefined) throw new Error(`A delivery is pending for ${id}, which is not a webhook`)
      const { webhook, secret } = entry
      // Checked before every attempt, not only at registration: an origin the operator has since taken off the list
      // gets nothing more, and the refusal goes on the record as the delivery's final failure.
      if (!allows(webhook.url)) {
        const error = `Not delivered: ${new URL(webhook.url).origin} is not on the webhook allowlist (SAFE_EDGE_WEBHOOK_ORIGINS)`
        record(id, { eventId, attempt: n, error, final: true }, body, 0)
        return
      }
      const failed = await tryDelivery(webhook.url, secret, eventId, body)
      if (failed === null) {
        // Only a retry has a row: the first attempt's failure wrote it.
        if (n > 1) dropRetry.run(id, eventId)
        return
      }
      const final = !failed.retry || n > options.retryDelaysMs.length
      dueAt = final ? 0 : Date.now() + options.retryDelaysMs[n - 1]!
      record(id, { eventId, attempt: n, error: failed.error, final }, body, dueAt)
      if (final) return
    }
  }

  events.subscribe((event) => {
    for (const { webhook } of webhooks.values()) {
      if (webhook.eventTypes.includes(event.type)) void deliver(webhook.id, event.id, JSON.stringify(event), 1, 0)
    }
  })

  return {
    allows,
    subscribe: events.subscribe,
    /** Stores a webhook for `body`, signed with `secret`, as `actor` registered it. */
    register,
    list(): Webhook[] {
      return [...webhooks.values()].map((entry) => entry.webhook)
    },
    publish: events.publish,
    /**
     * Picks up the retries the last process left pending, each at the time it was due, or at once if that has passed.
     * Call it once the journal has replayed, so every webhook is back.
     */
    resume() {
      for (const retry of pending.all()) {
        if (!webhooks.has(retry.webhookId)) {
          throw new Error(`${db.filename} holds a retry for ${retry.webhookId}, which the journal never registered`)
        }
        void deliver(retry.webhookId, retry.eventId, retry.body, retry.attempt, retry.dueAt)
      }
    }
  }
}
