// #124: the automation core supports, running inside the API. On the wall clock an injected timer drives it (each test
// fires it by hand, no sleeps); on the scenario clock each setScenarioClock call runs the same pass.
import { describe, expect, test } from 'bun:test'
import { AuditEvent, Patrol, PatrolPlan, type CreatePatrolPlanRequest, type EdgeEvent } from '@safe-edge/contracts'
import { createDataGovMyClient, type WarningRow } from '@safe-edge/providers'
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

/** A clock the test moves, as the wall clock (no `set`) with the timer fired by hand, or the API's scenario clock. */
function startOn(mode: 'wall clock' | 'scenario clock') {
  if (mode === 'scenario clock') {
    const api = startApi()
    const moveTo = (now: string) =>
      json(api.request('post', '/scenario/clock', { token: 'tok_system', body: { now } })).then(() => undefined)
    return { api, moveTo }
  }
  let now = seed.asOf
  const timer = manualTimer()
  const api = startApi({ clock: { now: () => now }, every: timer.every })
  const moveTo = (iso: string) => {
    now = iso
    return timer.fire()
  }
  return { api, moveTo }
}

/** Plans the segments as the manager and approves the plan as the pilot. */
async function approvedPlan(api: Api, segmentIds: string[]) {
  const proposed = await json(
    api.request('post', '/patrol-plans', { token: 'tok_manager', body: planRequest(segmentIds) })
  )
  return PatrolPlan.parse(
    await json(api.request('post', `/patrol-plans/${proposed.id}/approve`, { token: 'tok_pilot' }))
  )
}

const startPatrol = async (api: Api, planId: string) =>
  Patrol.parse(
    await json(
      api.request('post', '/patrols', { token: 'tok_pilot', body: { planId, provider: 'sim', droneId: 'sim-1' } })
    )
  )

describe.each(['wall clock', 'scenario clock'] as const)('on the %s', (mode) => {
  test('a patrol the pilot starts through the API flies on drone-sim, and its frames and landing reach core', async () => {
    const { api, moveTo } = startOn(mode)
    const plan = await approvedPlan(api, [S1.segmentId, EXPIRING, 'seg_866518980_6'])
    await moveTo(plan.window.start)
    const patrol = await startPatrol(api, plan.id)
    const frames = await subscribe(api)

    // A second after the planned landing, the drone is back and core has completed the patrol.
    const landing = plan.waypoints.at(-1)!.eta
    await moveTo(new Date(Date.parse(landing) + 1000).toISOString())
    expect((await nextEvents(frames, 1)).map((e) => [e.type, e.data])).toEqual([
      ['edge.patrol.completed.v1', { patrolId: patrol.id, planId: plan.id, simulated: true }]
    ])
    const [done] = Patrol.array().parse(await json(api.request('get', '/patrols', { token: 'tok_manager' })))
    expect(done).toMatchObject({ id: patrol.id, status: 'completed' })
    const segments = new Map(seed.segments.map((s) => [s.id, s]))
    expect(done!.coverage).toEqual(
      plan.tasks.map((t) => ({ segmentId: t.segmentId, inspectedM: segments.get(t.segmentId)!.lengthM, unknownM: 0 }))
    )

    // S1's two fixed-viewpoint frames became observations, matched by the viewpoint IDs on the plan's stations.
    const audit = await auditOf(api)
    const observed = audit.filter((e) => e.action === 'recordObservation')
    expect(observed.map((e) => [e.actor.id, (e.after as { viewpointId: string }).viewpointId]).toSorted()).toEqual([
      ['usr_drone_sim', 'vp_866518980_11_1'],
      ['usr_drone_sim', 'vp_866518980_11_2']
    ])
    expect(observed.map((e) => (e.after as { patrolId: string }).patrolId)).toEqual([patrol.id, patrol.id])
    expect(audit.find((e) => e.action === 'completePatrol')).toMatchObject({ actor: { id: 'usr_drone_sim' } })
    expect(audit.filter((e) => e.action === 'runAutomation')).toEqual([])
  })
})

test('a failed automation step is recorded on the audit chain, readable over the API, and the API carries on', async () => {
  const { api, moveTo } = startOn('wall clock')
  // The seed's path crowd holds segment 9 until the pilot records its path clear.
  const plan = await approvedPlan(api, [EXPIRING, 'seg_866518980_9'])
  expect(plan.holds).toMatchObject([{ kind: 'separation', segmentId: 'seg_866518980_9', releasedBy: null }])
  await moveTo(plan.window.start)
  // Core lets the patrol start (the drone would wait at the held segment), but drone-sim does not model the wait.
  const patrol = await startPatrol(api, plan.id)
  // A confirmed flag re-plans the plan in flight, but no drone reports how far it got.
  const candidate = await json(raiseTier2(api))
  const decided = await api.request('post', `/candidates/${candidate.id}/decision`, {
    token: 'tok_manager',
    body: { decision: 'confirm', severity: 'high' }
  })
  expect(decided.status).toBe(200)

  const failures = AuditEvent.array().parse(
    await json(api.request('get', '/audit?subject=automation', { token: 'tok_manager' }))
  )
  expect(failures.map((e) => [e.action, e.actor.id, e.decision, e.after])).toEqual([
    [
      'runAutomation',
      'core.automation',
      'allowed',
      {
        id: 'automation',
        step: 'drone',
        error: `${plan.id} holds seg_866518980_9: the pilot must confirm the path is clear, then schedule the released plan`
      }
    ],
    [
      'runAutomation',
      'core.automation',
      'allowed',
      { id: 'automation', step: 'replan', error: `No drone this bridge flies reports ${patrol.id}'s progress` }
    ]
  ])
})

describe('the data.gov.my poll', () => {
  const START_MS = Date.parse('2026-10-20T21:10:00.000Z')
  /**
   * A labelled test fixture in the feed's own format: a thunderstorm warning for Petaling from 05:00 to 09:00 MYT on
   * 21 Oct, in force at 21:10Z on 20 Oct.
   */
  const petalingStorm: WarningRow = {
    warning_issue: { issued: '2026-10-21T04:35:00', title_bm: 'Amaran Ribut Petir', title_en: 'Thunderstorms Warning' },
    valid_from: '2026-10-21T05:00:00',
    valid_to: '2026-10-21T09:00:00',
    heading_en: 'THUNDERSTORMS WARNING',
    text_en:
      'Thunderstorms, heavy rain and strong winds are expected over the states of Selangor: Gombak, Petaling and Klang until 9:00 AM; Wednesday, 21 October 2026.',
    instruction_en: null,
    heading_bm: 'AMARAN RIBUT PETIR',
    text_bm: null,
    instruction_bm: null
  }

  /**
   * The wall-clock API with #72's data.gov.my client behind a fetch the test answers. The client's own clock stands
   * still until the test wakes the request it put to sleep for the rate limit.
   */
  function weatherApi(respond: () => Response) {
    let limiterMs = START_MS
    const requests: number[] = []
    let fellAsleep: (ms: number) => void = () => {}
    const asleep = new Promise<number>((resolve) => (fellAsleep = resolve))
    let wake = () => {}
    const weather = createDataGovMyClient({
      fetch: async () => {
        requests.push(limiterMs - START_MS)
        return respond()
      },
      clock: {
        now: () => limiterMs,
        sleep: (ms) => {
          fellAsleep(ms)
          return new Promise((resolve) => {
            wake = () => {
              limiterMs += ms
              resolve()
            }
          })
        }
      }
    })
    const timer = manualTimer()
    const api = startApi({ clock: { now: () => new Date(START_MS).toISOString() }, every: timer.every, weather })
    return { api, timer, requests, asleep, wake: () => wake() }
  }

  test('polls go through the rate-limited client: at most 4 requests in any minute', async () => {
    const { timer, requests, asleep, wake } = weatherApi(() => Response.json([]))
    // Six polls at once, faster than the API's 5-minute interval ever fires: the fifth request waits a minute.
    const polls = Array.from({ length: 6 }, () => timer.fire())
    expect(await asleep).toBe(60_000)
    expect(requests).toEqual([0, 0, 0, 0])
    wake()
    await Promise.all(polls)
    expect(requests).toEqual([0, 0, 0, 0, 60_000, 60_000])
  })

  test('a warning in force for Petaling re-plans the open plan as the system, once', async () => {
    const { api, timer } = weatherApi(() => Response.json([petalingStorm]))
    const open = PatrolPlan.parse(
      await json(api.request('post', '/patrol-plans', { token: 'tok_manager', body: planRequest([EXPIRING]) }))
    )
    const frames = await subscribe(api)
    await timer.fire()
    expect((await nextEvents(frames, 1)).map((e) => e.type)).toEqual(['edge.patrol.planned.v1'])

    const [, replanned] = await plansOf(api)
    expect(replanned!.replan).toMatchObject({
      trigger: {
        kind: 'weather_warning',
        warning: {
          kind: 'lightning_warning',
          observedAt: '2026-10-20T21:00:00.000Z',
          validTo: '2026-10-21T01:00:00.000Z',
          url: 'https://api.data.gov.my/weather/warning/',
          simulated: false,
          source: 'provider'
        }
      },
      supersedes: { planId: open.id, committedTasks: 0 }
    })
    expect(replanned!.holds.map((h) => [h.kind, h.until])).toContainEqual(['lightning', '2026-10-21T01:00:00.000Z'])

    // The re-plan already holds that warning, so the next poll changes nothing.
    await timer.fire()
    expect(await plansOf(api)).toHaveLength(2)
  })

  test('a failed poll is recorded on the audit chain', async () => {
    const { api, timer } = weatherApi(() => new Response('Service Unavailable', { status: 503 }))
    await timer.fire()
    const failures = AuditEvent.array().parse(
      await json(api.request('get', '/audit?subject=automation', { token: 'tok_manager' }))
    )
    expect(failures.map((e) => e.after)).toEqual([
      {
        id: 'automation',
        step: 'weather',
        error: 'https://api.data.gov.my/weather/warning/ answered 503: Service Unavailable'
      }
    ])
  })
})
