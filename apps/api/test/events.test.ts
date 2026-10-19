// Core's events reach subscribers over server-sent events and webhooks as CloudEvents.
import { afterAll, expect, test } from 'bun:test'
import { EdgeEvent, Webhook } from '@safe-edge/contracts'
import { S1, raiseTier2, seed, startApi } from './support.ts'

/** Reads server-sent event frames (blank-line separated) as they arrive. */
function sseFrames(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  return {
    async next(): Promise<string> {
      while (!buffer.includes('\n\n')) {
        const { done, value } = await reader.read()
        if (done) throw new Error('the event stream closed')
        buffer += decoder.decode(value, { stream: true })
      }
      const end = buffer.indexOf('\n\n')
      const frame = buffer.slice(0, end)
      buffer = buffer.slice(end + 2)
      return frame
    },
    cancel: () => reader.cancel()
  }
}

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
    createdAt: seed.asOf
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
