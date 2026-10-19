// Core's events reach subscribers over server-sent events and webhooks as CloudEvents.
import { afterAll, expect, test } from 'bun:test'
import { AuditEvent, EdgeEvent, RegisteredWebhook, Webhook } from '@safe-edge/contracts'
import { Webhook as StandardWebhook } from 'standardwebhooks'
import { S1, raiseTier2, seed, sseFrames, startApi, type Api } from './support.ts'

test('GET /v1/events streams the CloudEvents of a Tier 2 candidate between heartbeats', async () => {
  const api = startApi({ heartbeatMs: 50 })
  const response = await api.request('get', '/events', { token: 'tok_gm' })
  expect(response.status).toBe(200)
  expect(response.headers.get('content-type')).toStartWith('text/event-stream')
  const frames = sseFrames(response.body!)
  expect(await frames.next()).toBe(': connected')
  expect(await frames.next()).toBe(': heartbeat')

  const raised = await raiseTier2(api)
  expect(raised.status).toBe(201)
  const candidate = (await raised.json()) as { id: string; tier: number }
  expect(candidate.tier).toBe(2)

  const events: EdgeEvent[] = []
  while (events.length < 2) {
    const frame = await frames.next()
    if (frame === ': heartbeat') continue
    const fields = Object.fromEntries(
      frame.split('\n').map((line) => [line.slice(0, line.indexOf(':')), line.slice(line.indexOf(':') + 2)])
    )
    const event = EdgeEvent.parse(JSON.parse(fields.data!))
    expect(fields).toEqual({ event: event.type, id: event.id, data: expect.any(String) })
    events.push(event)
  }
  await frames.cancel()

  expect(events.map((e) => [e.type, e.subject, e.data])).toEqual([
    [
      'edge.candidate.raised.v1',
      `segments/${S1.segmentId}`,
      { candidateId: candidate.id, segmentId: S1.segmentId, tier: 2, simulated: true }
    ],
    [
      'edge.pass.suspended.v1',
      `segments/${S1.segmentId}`,
      {
        passId: `pass_${S1.segmentId.slice('seg_'.length)}`,
        segmentId: S1.segmentId,
        candidateId: candidate.id,
        simulated: true
      }
    ]
  ])
})

test('POST /v1/webhooks returns a signing secret once, and each subscribed event arrives signed per Standard Webhooks', async () => {
  const deliveries: { headers: Record<string, string>; body: string }[] = []
  const { promise: delivered, resolve } = Promise.withResolvers<void>()
  const receiver = Bun.serve({
    port: 0,
    async fetch(request) {
      deliveries.push({ headers: Object.fromEntries(request.headers), body: await request.text() })
      resolve()
      return new Response(null, { status: 204 })
    }
  })
  afterAll(() => receiver.stop(true))

  const api = startApi()
  const url = new URL('/hooks/safe-edge', receiver.url).href
  const registered = await api.request('post', '/webhooks', {
    token: 'tok_integrator',
    body: { url, eventTypes: ['edge.pass.suspended.v1'] }
  })
  expect(registered.status).toBe(201)
  const { secret, ...webhook } = RegisteredWebhook.parse(await registered.json())
  expect(webhook).toEqual({
    id: expect.stringMatching(/^whk_/),
    url,
    eventTypes: ['edge.pass.suspended.v1'],
    createdBy: 'usr_integrator',
    createdAt: seed.asOf,
    failures: []
  })
  // 32 random bytes, serialized as the spec asks: whsec_ and base64.
  expect(Buffer.from(secret.replace(/^whsec_/, ''), 'base64')).toHaveLength(32)
  // The secret is shown once: the list and the audit chain never carry it.
  const listed = await api.request('get', '/webhooks', { token: 'tok_integrator' })
  expect(await listed.json()).toEqual([webhook])
  const audit = await (await api.request('get', '/audit', { token: 'tok_manager' })).text()
  expect(audit).not.toContain(secret)

  const raised = await raiseTier2(api)
  expect(raised.status).toBe(201)
  await delivered
  expect(deliveries).toHaveLength(1)
  const [{ headers, body }] = deliveries as [(typeof deliveries)[0]]
  expect(headers['content-type']).toBe('application/cloudevents+json')
  // The reference library checks the signature over id, timestamp and the raw body, and the timestamp's freshness.
  const event = EdgeEvent.parse(new StandardWebhook(secret).verify(body, headers))
  expect(event).toMatchObject({ type: 'edge.pass.suspended.v1', subject: `segments/${S1.segmentId}` })
  expect(headers['webhook-id']).toBe(event.id)
  expect(() => new StandardWebhook(`whsec_${Buffer.alloc(32).toString('base64')}`).verify(body, headers)).toThrow(
    'No matching signature found'
  )
})

/** Polls `read` until it returns a value: a delivery fails on the API's own time, after the request that caused it. */
async function eventually<T>(read: () => Promise<T | undefined>): Promise<T> {
  for (;;) {
    const value = await read()
    if (value !== undefined) return value
    await Bun.sleep(5)
  }
}

/** Registers a webhook for `eventTypes` at `url` as the integrator, returning it with its secret. */
async function register(api: Api, url: string, eventTypes: EdgeEvent['type'][] = ['edge.pass.suspended.v1']) {
  const response = await api.request('post', '/webhooks', { token: 'tok_integrator', body: { url, eventTypes } })
  expect(response.status).toBe(201)
  return RegisteredWebhook.parse(await response.json())
}

/** The webhooks once `done` holds for every one of them, as the integrator lists them. */
const webhooksWhen = (api: Api, done: (webhook: Webhook) => boolean) =>
  eventually(async () => {
    const response = await api.request('get', '/webhooks', { token: 'tok_integrator' })
    const list = Webhook.array().parse(await response.json())
    return list.every(done) ? list : undefined
  })

const gaveUp = (webhook: Webhook) => webhook.failures.at(-1)?.final === true

test('a delivery that meets a 503 is retried with the same webhook-id until it lands, and each failed attempt is recorded', async () => {
  const attempts: { headers: Record<string, string>; body: string }[] = []
  const receiver = Bun.serve({
    port: 0,
    async fetch(request) {
      attempts.push({ headers: Object.fromEntries(request.headers), body: await request.text() })
      return attempts.length < 3 ? new Response('busy', { status: 503 }) : new Response(null, { status: 204 })
    }
  })
  afterAll(() => receiver.stop(true))

  const api = startApi({ webhooks: { retryDelaysMs: [5, 10, 20] } })
  const { secret, ...webhook } = await register(api, receiver.url.href)
  expect((await raiseTier2(api)).status).toBe(201)
  await eventually(async () => (attempts.length === 3 ? true : undefined))

  // Every attempt is signed afresh for the same message, so a receiver deduplicates on webhook-id.
  const ids = attempts.map(({ headers, body }) => EdgeEvent.parse(new StandardWebhook(secret).verify(body, headers)).id)
  expect(new Set(ids).size).toBe(1)
  expect(attempts.map((a) => a.headers['webhook-id'])).toEqual([ids[0], ids[0], ids[0]])

  const [listed] = await webhooksWhen(api, (w) => w.failures.length === 2)
  const failure = { eventId: ids[0], at: seed.asOf, error: 'HTTP 503: busy', final: false }
  expect(listed).toEqual({
    ...webhook,
    failures: [
      { ...failure, attempt: 1 },
      { ...failure, attempt: 2 }
    ]
  })
  const audit = AuditEvent.array().parse(await (await api.request('get', '/audit', { token: 'tok_manager' })).json())
  expect(audit.filter((e) => e.action === 'deliverWebhook').map((e) => e.after)).toEqual([
    { ...webhook, failures: [{ ...failure, attempt: 1 }] },
    listed
  ])
  // The third attempt landed, so nothing more is sent or recorded.
  await Bun.sleep(50)
  expect(attempts).toHaveLength(3)
})

test('a delivery is retried on 5xx and network errors up to the bound, a 4xx is not, and every failed attempt is recorded and audited', async () => {
  const failing = Bun.serve({ port: 0, fetch: () => new Response('down for maintenance', { status: 500 }) })
  const refusing = Bun.serve({ port: 0, fetch: () => new Response('no such hook', { status: 404 }) })
  afterAll(() => {
    failing.stop(true)
    refusing.stop(true)
  })
  const closed = Bun.serve({ port: 0, fetch: () => new Response(null, { status: 204 }) })
  const unreachable = new URL('/hooks', closed.url).href
  await closed.stop(true)

  const api = startApi({ webhooks: { retryDelaysMs: [5, 10] } })
  const strip = ({ secret: _, ...webhook }: RegisteredWebhook) => webhook
  const erroring = strip(await register(api, new URL('/hooks', failing.url).href))
  const gone = strip(await register(api, unreachable))
  const refused = strip(await register(api, new URL('/hooks', refusing.url).href))
  expect((await raiseTier2(api)).status).toBe(201)

  const webhooks = await webhooksWhen(api, gaveUp)
  const attempt = (n: number, error: string) => ({
    eventId: expect.stringMatching(/^evt_/),
    at: seed.asOf,
    attempt: n,
    error,
    final: n === 3
  })
  expect(webhooks).toEqual([
    { ...erroring, failures: [1, 2, 3].map((n) => attempt(n, 'HTTP 500: down for maintenance')) },
    { ...gone, failures: [1, 2, 3].map((n) => attempt(n, expect.stringContaining('Unable to connect'))) },
    // A 4xx is the receiver's answer, not a fault to wait out: recorded once, as final.
    { ...refused, failures: [{ ...attempt(1, 'HTTP 404: no such hook'), final: true }] }
  ])

  const audit = AuditEvent.array().parse(await (await api.request('get', '/audit', { token: 'tok_manager' })).json())
  const recorded = audit.filter((e) => e.action === 'deliverWebhook')
  expect(recorded).toHaveLength(7)
  for (const event of recorded) {
    expect(event).toMatchObject({ actor: { type: 'system', id: 'api.webhooks', role: 'system' }, decision: 'allowed' })
  }
  // The last record of each webhook is its final state.
  for (const webhook of webhooks) {
    expect(recorded.findLast((e) => e.subjectId === webhook.id)!.after).toEqual(webhook)
  }
  // Only integrators read the registrations.
  expect((await api.request('get', '/webhooks', { token: 'tok_agent' })).status).toBe(403)
})

test('registration is refused for a URL whose origin is not on the allowlist, and for loopback outside dev and test', async () => {
  const api = startApi({ webhooks: { origins: ['https://hooks.sdp.example'], allowLoopback: false } })
  const attempt = (url: string) =>
    api.request('post', '/webhooks', { token: 'tok_integrator', body: { url, eventTypes: ['edge.pass.issued.v1'] } })

  expect((await attempt('https://hooks.sdp.example/safe-edge')).status).toBe(201)
  for (const [url, origin] of [
    ['https://hooks.sdp.example.attacker.test/safe-edge', 'https://hooks.sdp.example.attacker.test'],
    ['http://hooks.sdp.example/safe-edge', 'http://hooks.sdp.example'],
    ['https://hooks.sdp.example:8443/safe-edge', 'https://hooks.sdp.example:8443'],
    ['http://169.254.169.254/latest/meta-data', 'http://169.254.169.254'],
    ['http://localhost:8080/hooks', 'http://localhost:8080'],
    ['http://127.0.0.1:8080/hooks', 'http://127.0.0.1:8080'],
    ['http://[::1]:8080/hooks', 'http://[::1]:8080']
  ]) {
    const response = await attempt(url!)
    expect({ url, status: response.status, body: await response.json() }).toEqual({
      url,
      status: 400,
      body: {
        ok: false,
        error: 'invalid_input',
        message: `url: ${origin} is not on the webhook allowlist (SAFE_EDGE_WEBHOOK_ORIGINS)`
      }
    })
  }
  // Only the allowed registration was stored.
  const listed = Webhook.array().parse(
    await (await api.request('get', '/webhooks', { token: 'tok_integrator' })).json()
  )
  expect(listed.map((w) => w.url)).toEqual(['https://hooks.sdp.example/safe-edge'])
})
