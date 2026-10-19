// What the API owes webhook receivers and retrying clients across a crash (#149): pending webhook retries, answers kept
// by Idempotency-Key and the webhook allowlist. The API runs as its own process and is killed with SIGKILL, as a crash
// would, then started again on the same data directory.
import { afterAll, expect, test } from 'bun:test'
import { AuditEvent, EdgeEvent, RegisteredWebhook, Webhook } from '@safe-edge/contracts'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { eventually } from '../../../test/spawn.ts'
import { startApiProcess } from './process.ts'
import { Webhook as StandardWebhook } from 'standardwebhooks'
import { tier2Candidate } from './support.ts'

type ApiProcess = Awaited<ReturnType<typeof startApiProcess>>

/** The parsed body of a 2xx answer; anything else fails with the status and body. */
async function call<T>(
  api: ApiProcess,
  schema: { parse(value: unknown): T },
  ...[method, path, token, body, headers]: Parameters<ApiProcess['request']>
): Promise<T> {
  const response = await api.request(method, path, token, body, headers)
  if (!response.ok) throw new Error(`${method} ${path}: HTTP ${response.status}: ${await response.text()}`)
  return schema.parse(await response.json())
}

async function dataDir() {
  const dir = await mkdtemp(join(tmpdir(), 'safe-edge-api-'))
  afterAll(() => rm(dir, { recursive: true }))
  return dir
}

/** A webhook receiver that records each request and answers with `status`. */
function receiver(status: number) {
  const received: { at: number; headers: Record<string, string>; body: string }[] = []
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      received.push({ at: Date.now(), headers: Object.fromEntries(request.headers), body: await request.text() })
      return new Response(status === 204 ? null : 'busy', { status })
    }
  })
  afterAll(() => server.stop(true))
  return { url: server.url.href, origin: server.url.origin, received }
}

const webhooks = (api: ApiProcess) => call(api, Webhook.array(), 'get', '/webhooks', 'tok_integrator')
const audit = (api: ApiProcess) => call(api, AuditEvent.array(), 'get', '/audit', 'tok_gm')

test('a webhook whose origin left the allowlist is not delivered, and the refusal is recorded', async () => {
  const hooks = receiver(204)
  const dir = await dataDir()
  // In test, as in development, loopback receivers are on the allowlist.
  const first = await startApiProcess({ NODE_ENV: 'test', SAFE_EDGE_DATA_DIR: dir })
  await call(first, RegisteredWebhook, 'post', '/webhooks', 'tok_integrator', {
    url: hooks.url,
    eventTypes: ['edge.pass.suspended.v1', 'edge.candidate.decided.v1']
  })
  const raised = await first.request('post', '/candidates', 'tok_provider', tier2Candidate)
  expect(raised.status).toBe(201)
  const candidate = (await raised.json()) as { id: string }
  await eventually('The suspension reaching the receiver', () => (hooks.received.length === 1 ? true : undefined))
  await first.crash()

  // Deployed (no NODE_ENV), the API allows only the listed origins, and loopback is not one of them.
  const api = await startApiProcess({ SAFE_EDGE_DATA_DIR: dir })
  const decided = await api.request('post', `/candidates/${candidate.id}/decision`, 'tok_manager', {
    decision: 'reject',
    reason: 'A shadow'
  })
  expect(decided.status).toBe(200)
  const [listed] = await eventually('The refusal on the record', async () => {
    const list = await webhooks(api)
    return list[0]!.failures.length === 1 ? list : undefined
  })
  expect(listed!.failures).toEqual([
    {
      eventId: expect.stringMatching(/^evt_/),
      at: expect.any(String),
      attempt: 1,
      error: `Not delivered: ${hooks.origin} is not on the webhook allowlist (SAFE_EDGE_WEBHOOK_ORIGINS)`,
      final: true
    }
  ])
  // The refusal is decided before any request goes out: the receiver still has only the suspension.
  expect(hooks.received.map(({ body }) => EdgeEvent.parse(JSON.parse(body)).type)).toEqual(['edge.pass.suspended.v1'])
  const recorded = (await audit(api)).filter((e) => e.action === 'deliverWebhook')
  expect(recorded.map((e) => e.after)).toEqual([listed])
}, 30_000)

test('a pending webhook retry survives a kill, goes out when it was due, and its final failure is still recorded', async () => {
  const hooks = receiver(503)
  const dir = await dataDir()
  // Two retries: 2 s after the first failure, long enough to kill and restart in between, then 200 ms.
  const env = { NODE_ENV: 'test', SAFE_EDGE_DATA_DIR: dir, SAFE_EDGE_WEBHOOK_RETRY_DELAYS_MS: '2000,200' }
  const first = await startApiProcess(env)
  const hook = await call(first, RegisteredWebhook, 'post', '/webhooks', 'tok_integrator', {
    url: hooks.url,
    eventTypes: ['edge.pass.suspended.v1']
  })
  expect((await first.request('post', '/candidates', 'tok_provider', tier2Candidate)).status).toBe(201)
  await eventually('The first failed attempt on the record', async () =>
    (await webhooks(first))[0]!.failures.length === 1 ? true : undefined
  )
  await first.crash()
  const killedAt = Date.now()

  const api = await startApiProcess(env)
  const upAt = Date.now()
  const [listed] = await eventually(
    'The final failure on the record',
    async () => {
      const list = await webhooks(api)
      return list[0]!.failures.at(-1)?.final ? list : undefined
    },
    { timeoutMs: 15_000 }
  )

  // Three attempts at one message: each signed afresh with the secret given before the kill, under one webhook-id.
  expect(hooks.received).toHaveLength(3)
  const events = hooks.received.map(({ headers, body }) =>
    EdgeEvent.parse(new StandardWebhook(hook.secret).verify(body, headers))
  )
  expect(events.map((e) => e.type)).toEqual(Array<string>(3).fill('edge.pass.suspended.v1'))
  expect(new Set(events.map((e) => e.id)).size).toBe(1)
  // The retry the killed API owed went out from the restarted one, when it was due: 2 s after the first attempt, or
  // at once if the restart had taken longer than that.
  const [first1, second, third] = hooks.received.map((r) => r.at) as [number, number, number]
  expect(second).toBeGreaterThan(killedAt)
  expect(second - first1).toBeGreaterThanOrEqual(2000)
  expect(second).toBeLessThan(Math.max(first1 + 2000, upAt) + 1000)
  expect(third - second).toBeGreaterThanOrEqual(200)

  const failure = { eventId: events[0]!.id, at: expect.any(String), error: 'HTTP 503: busy' }
  expect(listed!.failures).toEqual([
    { ...failure, attempt: 1, final: false },
    { ...failure, attempt: 2, final: false },
    { ...failure, attempt: 3, final: true }
  ])
  const recorded = (await audit(api)).filter((e) => e.action === 'deliverWebhook')
  expect(recorded.map((e) => e.after)).toEqual(
    listed!.failures.map((_, n) => ({ ...listed, failures: listed!.failures.slice(0, n + 1) }))
  )

  // Given up means nothing is left pending: another restart sends nothing more.
  await api.crash()
  await startApiProcess(env)
  await Bun.sleep(500)
  expect(hooks.received).toHaveLength(3)
}, 40_000)
