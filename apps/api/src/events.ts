import type { Actor, EdgeEvent, RegisterWebhookRequest, Webhook, WebhookFailure } from '@safe-edge/contracts'
import { createEventQueue, type Clock, type Core, type IdGenerator } from '@safe-edge/core'
import { createHmac, randomBytes } from 'node:crypto'
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

/**
 * Webhook options from the environment. `SAFE_EDGE_WEBHOOK_ORIGINS` lists the allowed origins, comma-separated
 * (`https://hooks.example.org,https://ops.example.org:8443`); unset allows none. Loopback is allowed only when
 * `NODE_ENV` is `development` (bun run dev sets it) or `test` (bun test sets it), so a deployment without NODE_ENV
 * fails closed, and a loopback entry outside them is refused.
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
  return { origins, allowLoopback, retryDelaysMs: RETRY_DELAYS_MS }
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
async function tryDelivery(url: string, secret: string, event: EdgeEvent, body: string) {
  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      // A redirect is a failure, not a hop (Standard Webhooks), so an allowed host cannot bounce a delivery elsewhere.
      redirect: 'manual',
      signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
      headers: { 'content-type': 'application/cloudevents+json', ...signatureHeaders(secret, event.id, body) },
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
 */
export function createEventHub({
  clock,
  ids,
  options,
  command,
  recordStored
}: {
  clock: Clock
  ids: IdGenerator
  options: WebhookOptions
  command: Journal['command']
  recordStored: Core['recordStored']
}) {
  const webhooks = new Map<string, { webhook: Webhook; secret: string }>()
  // Every subscriber, and every webhook, sees events in the order they happened, a re-plan right after its cause.
  const events = createEventQueue()

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

  async function deliver(id: string, event: EdgeEvent): Promise<void> {
    const body = JSON.stringify(event)
    for (let n = 1; ; n++) {
      const { webhook, secret } = webhooks.get(id)!
      const failed = await tryDelivery(webhook.url, secret, event, body)
      if (failed === null) return
      const final = !failed.retry || n > options.retryDelaysMs.length
      fail(id, { eventId: event.id, attempt: n, error: failed.error, final })
      if (final) return
      await Bun.sleep(options.retryDelaysMs[n - 1]!)
    }
  }

  events.subscribe((event) => {
    for (const { webhook } of webhooks.values()) {
      if (webhook.eventTypes.includes(event.type)) void deliver(webhook.id, event)
    }
  })

  return {
    /**
     * Whether webhooks may point at `url`: its origin is on the allowlist, or it is loopback where that is allowed. The
     * allowlist is the guard against server-side request forgery: integrators reach only hosts the operator listed.
     */
    allows(url: string): boolean {
      const { origin, hostname } = new URL(url)
      return options.origins.includes(origin) || (options.allowLoopback && isLoopback(hostname))
    },
    subscribe: events.subscribe,
    /** Stores a webhook for `body`, signed with `secret`, as `actor` registered it. */
    register,
    list(): Webhook[] {
      return [...webhooks.values()].map((entry) => entry.webhook)
    },
    publish: events.publish
  }
}
