// Core's events reach subscribers over server-sent events and webhooks as CloudEvents.
import { expect, test } from 'bun:test'
import { EdgeEvent } from '@safe-edge/contracts'
import { S1, startApi, type Api } from './support.ts'

/** S1: the drone reports fence panel 4 missing, a Tier 2 candidate on a segment whose pass is valid. */
const raiseTier2 = (api: Api) =>
  api.request('post', '/candidates', {
    token: 'tok_provider',
    body: {
      segmentId: S1.segmentId,
      observationIds: [],
      inventoryItemId: S1.inventoryItemId,
      itemStatus: 'missing',
      class: 'inventory_item',
      score: 0.9,
      uncertainty: 'low',
      gridCell: 'B3',
      rationale: 'Fence panel 4 is missing by the playground path',
      model: null,
      simulated: true
    }
  })

/** Reads server-sent event frames (blank-line separated) as they arrive. */
function sseFrames(body: ReadableStream<Uint8Array>) {
  const reader = body.pipeThrough(new TextDecoderStream()).getReader()
  let buffer = ''
  return {
    async next(): Promise<string> {
      while (!buffer.includes('\n\n')) {
        const { done, value } = await reader.read()
        if (done) throw new Error('the event stream closed')
        buffer += value
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
