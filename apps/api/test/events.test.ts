// Core's events reach subscribers over server-sent events and webhooks as CloudEvents.
import { afterAll, expect, test } from 'bun:test'
import { AuditEvent, EdgeEvent, Webhook } from '@safe-edge/contracts'
import { S1, raiseTier2, seed, sseFrames, startApi } from './support.ts'

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

test('POST /v1/webhooks registers an integrator endpoint, and each subscribed event is POSTed to it as a CloudEvent', async () => {
  const deliveries: { contentType: string | null; event: EdgeEvent }[] = []
  const { promise: delivered, resolve } = Promise.withResolvers<void>()
  const receiver = Bun.serve({
    port: 0,
    async fetch(request) {
      deliveries.push({
        contentType: request.headers.get('content-type'),
        event: EdgeEvent.parse(await request.json())
      })
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
  expect(Webhook.parse(await registered.json())).toEqual({
    id: expect.stringMatching(/^whk_/),
    url,
    eventTypes: ['edge.pass.suspended.v1'],
    createdBy: 'usr_integrator',
    createdAt: seed.asOf,
    failures: []
  })

  const raised = await raiseTier2(api)
  expect(raised.status).toBe(201)
  await delivered
  expect(deliveries).toEqual([
    {
      contentType: 'application/cloudevents+json',
      event: expect.objectContaining({ type: 'edge.pass.suspended.v1', subject: `segments/${S1.segmentId}` })
    }
  ])
})

/** Polls `read` until it returns a value: a delivery fails on the API's own time, after the request that caused it. */
async function eventually<T>(read: () => Promise<T | undefined>): Promise<T> {
  for (;;) {
    const value = await read()
    if (value !== undefined) return value
    await Bun.sleep(5)
  }
}

test('a failed webhook delivery is recorded on the webhook and the audit chain, readable through the API', async () => {
  const failing = Bun.serve({ port: 0, fetch: () => new Response('down for maintenance', { status: 500 }) })
  afterAll(() => failing.stop(true))
  const closed = Bun.serve({ port: 0, fetch: () => new Response(null, { status: 204 }) })
  const unreachable = new URL('/hooks', closed.url).href
  await closed.stop(true)

  const api = startApi()
  const register = async (url: string) =>
    Webhook.parse(
      await (
        await api.request('post', '/webhooks', {
          token: 'tok_integrator',
          body: { url, eventTypes: ['edge.pass.suspended.v1'] }
        })
      ).json()
    )
  const erroring = await register(new URL('/hooks', failing.url).href)
  const gone = await register(unreachable)
  expect((await raiseTier2(api)).status).toBe(201)

  const webhooks = await eventually(async () => {
    const response = await api.request('get', '/webhooks', { token: 'tok_integrator' })
    const list = Webhook.array().parse(await response.json())
    return list.every((w) => w.failures.length > 0) ? list : undefined
  })
  const failure = { eventId: expect.stringMatching(/^evt_/), at: seed.asOf }
  expect(webhooks).toEqual([
    { ...erroring, failures: [{ ...failure, error: 'HTTP 500: down for maintenance' }] },
    { ...gone, failures: [{ ...failure, error: expect.any(String) }] }
  ])
  expect(webhooks[0]!.failures[0]!.eventId).toBe(webhooks[1]!.failures[0]!.eventId)

  const audit = AuditEvent.array().parse(await (await api.request('get', '/audit', { token: 'tok_manager' })).json())
  const recorded = audit.filter((e) => e.action === 'deliverWebhook')
  expect(recorded.map((e) => [e.subjectId, e.actor, e.decision, e.before, e.after])).toEqual(
    expect.arrayContaining(
      webhooks.map((w) => [
        w.id,
        { type: 'system', id: 'api.webhooks', role: 'system' },
        'allowed',
        { ...w, failures: [] },
        w
      ])
    )
  )
  expect(recorded).toHaveLength(2)
  // Only integrators read the registrations.
  expect((await api.request('get', '/webhooks', { token: 'tok_agent' })).status).toBe(403)
})
