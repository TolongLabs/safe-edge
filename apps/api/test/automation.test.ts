// #124: the automation core supports, running inside the API. On the wall clock an injected timer drives it (each test
// fires it by hand, no sleeps); on the scenario clock each setScenarioClock call runs the same pass.
import { expect, test } from 'bun:test'
import { AuditEvent, PatrolPlan, type CreatePatrolPlanRequest, type EdgeEvent } from '@safe-edge/contracts'
import { S1, manualTimer, nextEvents, raiseTier2, seed, sseFrames, startApi, type Api } from './support.ts'

/** The seeded passes: S1's is valid to 2027-04-15, `_12` valid to 2026-12-01, `_5` expiring to 2026-11-12. */
const SOON = 'seg_866518980_12'
const EXPIRING = 'seg_866518980_5'
/** `_5`'s validTo, when `_12` is within 30 days of its own and every seeded patrol interval has long run out. */
const NOV_12 = '2026-11-12T02:00:00.000Z'

async function json(response: Promise<Response>) {
  const r = await response
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`)
  return r.json()
}

const auditOf = async (api: Api) =>
  AuditEvent.array().parse(await json(api.request('get', '/audit', { token: 'tok_gm' })))

const plansOf = async (api: Api) =>
  PatrolPlan.array().parse(await json(api.request('get', '/patrol-plans', { token: 'tok_manager' })))

const planRequest = (segmentIds: string[]): CreatePatrolPlanRequest => ({
  dockId: 'dock_elmina_roof',
  droneProfileId: 'drn_assumed',
  segmentIds,
  context: [],
  notBefore: seed.asOf,
  altitudeCapM: 60
})

async function subscribe(api: Api) {
  const stream = await api.request('get', '/events', { token: 'tok_manager' })
  const frames = sseFrames(stream.body!)
  expect(await frames.next()).toBe(': connected')
  return frames
}

/** What one pass at 12 Nov does: `_5` expired and `_12` expiring, then a missed patrol on each pass still standing. */
function expectNovemberPass(events: EdgeEvent[]) {
  expect(events.map((e) => [e.type, 'segmentId' in e.data ? e.data.segmentId : null])).toEqual([
    ['edge.pass.expired.v1', EXPIRING],
    ['edge.pass.expiring.v1', SOON],
    ['edge.candidate.raised.v1', S1.segmentId],
    ['edge.pass.suspended.v1', S1.segmentId],
    ['edge.candidate.raised.v1', SOON],
    ['edge.pass.suspended.v1', SOON]
  ])
}

test('on the wall clock a timer runs tick and the missed-patrol check as the system, streamed live and audited', async () => {
  let now = '2026-10-20T00:00:00.000Z'
  const timer = manualTimer()
  const api = startApi({ clock: { now: () => now }, every: timer.every })
  const frames = await subscribe(api)

  // Nothing is due yet: the timer fires and writes nothing.
  await timer.fire()
  expect(await auditOf(api)).toEqual([])

  now = NOV_12
  await timer.fire()
  expectNovemberPass(await nextEvents(frames, 6))
  const audit = await auditOf(api)
  expect(audit.map((e) => [e.action, e.actor.id, e.subjectId])).toEqual([
    ['tick', 'core.tick', 'pass_866518980_5'],
    ['tick', 'core.tick', 'pass_866518980_12'],
    ['reportMissedPatrol', 'core.automation', 'cand_1'],
    ['reportMissedPatrol', 'core.automation', 'pass_866518980_11'],
    ['reportMissedPatrol', 'core.automation', 'cand_2'],
    ['reportMissedPatrol', 'core.automation', 'pass_866518980_12']
  ])
  expect(audit.every((e) => e.at === NOV_12 && e.actor.type === 'system')).toBe(true)

  // A missed patrol suspends the pass, so the next pass finds nothing more to do.
  await timer.fire()
  expect(await auditOf(api)).toEqual(audit)
})

test('on the scenario clock, setting the clock runs the same pass instead of a timer', async () => {
  const api = startApi()
  const frames = await subscribe(api)
  await json(api.request('post', '/scenario/clock', { token: 'tok_system', body: { now: NOV_12 } }))
  expectNovemberPass(await nextEvents(frames, 6))
  expect((await auditOf(api)).map((e) => e.action)).toEqual([
    'setScenarioClock',
    'tick',
    'tick',
    'reportMissedPatrol',
    'reportMissedPatrol',
    'reportMissedPatrol',
    'reportMissedPatrol'
  ])
})

test("a confirmed flag re-plans the open plan as the system, streamed right after the manager's decision", async () => {
  const api = startApi()
  const open = PatrolPlan.parse(
    await json(api.request('post', '/patrol-plans', { token: 'tok_manager', body: planRequest([EXPIRING]) }))
  )
  const candidate = await json(raiseTier2(api))
  const frames = await subscribe(api)
  const decision = await json(
    api.request('post', `/candidates/${candidate.id}/decision`, {
      token: 'tok_manager',
      body: { decision: 'confirm', severity: 'high' }
    })
  )
  const events = await nextEvents(frames, 3)
  expect(events.map((e) => e.type)).toEqual([
    'edge.candidate.decided.v1',
    'edge.work_order.drafted.v1',
    'edge.patrol.planned.v1'
  ])

  const [, replanned] = await plansOf(api)
  expect(replanned).toMatchObject({
    id: 'plan_2',
    status: 'proposed',
    replan: {
      trigger: { kind: 'flag_confirmed', segmentId: S1.segmentId, findingId: decision.finding.id },
      supersedes: { planId: open.id, committedTasks: 0 }
    }
  })
  expect(replanned!.tasks.map((t) => t.segmentId).toSorted()).toEqual([S1.segmentId, EXPIRING].toSorted())
  expect((await auditOf(api)).find((e) => e.subjectId === 'plan_2')).toMatchObject({
    action: 'createPatrolPlan',
    actor: { type: 'system', id: 'core.replan' }
  })
})
