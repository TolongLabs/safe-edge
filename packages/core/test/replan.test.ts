import { describe, expect, test } from 'bun:test'
import type { ContextSnapshot, CreatePatrolPlanRequest, EdgeEvent, PatrolPlan } from '@safe-edge/contracts'
import { createReplanSubscriber } from '../src/index.ts'
import { S1, playS1toRepair, raiseOnS1, startCore, type Harness } from './support.ts'

// Every segment of the park lake. S1's pass is valid for months, so with no flag it ranks below segments whose pass
// was never issued, and the 90 Wh seed drone leaves it out for battery.
const LAKE = Array.from({ length: 21 }, (_, i) => `seg_866518980_${i}`)
const COMMITTED = 2
const RETEST = { dockId: 'dock_elmina_roof', droneProfileId: 'drn_assumed', altitudeCapM: 60 }

const request = (h: Harness, segmentIds: string[]): CreatePatrolPlanRequest => ({
  dockId: 'dock_elmina_roof',
  droneProfileId: 'drn_assumed',
  segmentIds,
  context: [],
  notBefore: h.now(),
  altitudeCapM: 60
})

const subscriberFor = (h: Harness) =>
  createReplanSubscriber({
    dispatch: h.core.dispatch,
    clock: { now: h.now },
    committedTasks: () => COMMITTED,
    retest: RETEST
  })

/**
 * A plan for the morning of 1 Nov, approved and in flight. The drone provider reports that the first two stops are
 * flown or in progress.
 */
function inFlight(h: Harness, segmentIds = LAKE) {
  h.setNow('2026-10-31T21:00:00.000Z')
  const plan = h.call('createPatrolPlan', 'usr_manager', { body: request(h, segmentIds) }).data
  h.call('approvePatrolPlan', 'usr_pilot', { params: { id: plan.id } })
  h.setNow(plan.window.start)
  h.call('startPatrol', 'usr_pilot', { body: { planId: plan.id, provider: 'sim', droneId: 'sim-1' } })
  return plan
}

/** The plans the events announce, read back as the manager. */
function planned(h: Harness, events: EdgeEvent[]): PatrolPlan[] {
  const plans = h.call('listPatrolPlans', 'usr_manager', {}).data
  return events.flatMap((e) =>
    e.type === 'edge.patrol.planned.v1' ? [plans.find((p) => p.id === e.data.planId)!] : []
  )
}

/** The committed stops and every waypoint up to the last committed station are exactly as first planned. */
function expectCommittedPrefixKept(before: PatrolPlan, after: PatrolPlan) {
  expect(after.replan?.supersedes).toEqual({ planId: before.id, committedTasks: COMMITTED })
  expect(after.tasks.slice(0, COMMITTED)).toEqual(before.tasks.slice(0, COMMITTED))
  const lastCommitted = before.tasks[COMMITTED - 1]!.segmentId
  const flown = before.waypoints.findLastIndex((w) => w.segmentId === lastCommitted) + 1
  expect(after.waypoints.slice(0, flown)).toEqual(before.waypoints.slice(0, flown))
  expect(after.waypoints.at(-1)).toMatchObject({ kind: 'landing', lon: before.waypoints[0]!.lon })
  expect(after).toMatchObject({ status: 'proposed', approvedBy: null, window: before.window })
  expect(after.reserveWh).toBeGreaterThanOrEqual(25)
}

const segmentsOf = (plan: PatrolPlan) => plan.tasks.map((t) => t.segmentId)

/** The uncommitted segments are all held back for the weather, so the drone comes home after its committed stops. */
function expectGrounded(before: PatrolPlan, after: PatrolPlan) {
  expect(segmentsOf(after)).toEqual(segmentsOf(before).slice(0, COMMITTED))
  const committed = new Set(segmentsOf(after))
  const held = after.rejected.filter((r) => r.code === 'weather_hold').map((r) => r.segmentId)
  expect(held.toSorted()).toEqual(LAKE.filter((id) => !committed.has(id)).toSorted())
}

// Labelled fixtures in the shape of the real feeds (see `data/elmina/weather/` for real snapshots).
const heavyRain = (observedAt: string): ContextSnapshot => ({
  kind: 'rainfall',
  value: 45,
  text: null,
  observedAt,
  validTo: null,
  publisher: 'JPS Public Infobanjir',
  stationId: '27880',
  url: 'https://publicinfobanjir.water.gov.my/hujan/data-hujan/?state=SEL&lang=en',
  simulated: true,
  source: 'fixture'
})

describe('PLAN-4: each trigger re-plans the uncommitted part of a route in flight', () => {
  test('heavy rain: the drone comes home after its committed stops', () => {
    const h = startCore()
    const plan = inFlight(h)
    const reading = heavyRain(h.now())
    const [replanned] = planned(h, subscriberFor(h).onTrigger({ kind: 'heavy_rain', reading }))

    expectCommittedPrefixKept(plan, replanned!)
    expectGrounded(plan, replanned!)
    expect(replanned!.replan?.trigger).toEqual({ kind: 'heavy_rain', reading })
    expect(replanned!.context).toEqual([reading])
    expect(replanned!.rejected.find((r) => r.code === 'weather_hold')?.reason).toStartWith(
      `rain 45 mm/h at JPS Public Infobanjir station 27880 (observed ${reading.observedAt}) is above the dock's 2 mm/h limit`
    )
  })

  test('a data.gov.my thunderstorm warning: the drone comes home after its committed stops', () => {
    const h = startCore()
    const plan = inFlight(h)
    const warning: ContextSnapshot = {
      kind: 'lightning_warning',
      value: null,
      text: 'Thunderstorms Warning: Thunderstorms, heavy rain and strong winds are expected over the states of Selangor: Petaling until 10:00 AM',
      observedAt: '2026-10-31T22:00:00.000Z',
      validTo: '2026-11-01T02:00:00.000Z',
      publisher: 'data.gov.my (MET Malaysia)',
      stationId: null,
      url: 'https://api.data.gov.my/weather/warning/',
      simulated: true,
      source: 'fixture'
    }
    const [replanned] = planned(h, subscriberFor(h).onTrigger({ kind: 'weather_warning', warning }))

    expectCommittedPrefixKept(plan, replanned!)
    expectGrounded(plan, replanned!)
    expect(replanned!.replan?.trigger).toEqual({ kind: 'weather_warning', warning })
  })

  test('a newly confirmed flag: the flagged segment joins the route', () => {
    const h = startCore()
    const plan = inFlight(h)
    expect(plan.rejected).toContainEqual(expect.objectContaining({ segmentId: S1.segmentId, code: 'battery' }))

    const raised = raiseOnS1(h, 'usr_drone_sim', {
      inventoryItemId: S1.inventoryItemId,
      itemStatus: 'missing',
      class: 'inventory_item',
      rationale: 'Fence panel 4 is missing by the playground path'
    })
    const decided = h.call('decideCandidate', 'usr_manager', {
      params: { id: raised.data.id },
      body: { decision: 'confirm', severity: 'high' }
    })
    const [replanned] = planned(h, decided.events.flatMap(subscriberFor(h).onEvent))

    expectCommittedPrefixKept(plan, replanned!)
    expect(replanned!.replan?.trigger).toEqual({
      kind: 'flag_confirmed',
      segmentId: S1.segmentId,
      findingId: decided.data.finding!.id
    })
    expect(segmentsOf(replanned!).slice(COMMITTED)).toContain(S1.segmentId)
    expect(replanned!.tasks.find((t) => t.segmentId === S1.segmentId)!.priority.reviewedFlag).toBe(1)
  })

  test('a pass entering its last 30 days: its segment joins the route', () => {
    const h = startCore()
    const expiring = 'seg_866518980_12' // valid to 2026-12-01T02:00Z
    const plan = inFlight(
      h,
      LAKE.filter((id) => id !== expiring)
    )
    const ticked = h.core.tick('2026-11-01T02:00:00.000Z')
    expect(ticked.map((e) => e.type)).toEqual(['edge.pass.expiring.v1'])
    const [replanned] = planned(h, ticked.flatMap(subscriberFor(h).onEvent))

    expectCommittedPrefixKept(plan, replanned!)
    expect(replanned!.replan?.trigger).toEqual({
      kind: 'pass_expiring',
      segmentId: expiring,
      passId: 'pass_866518980_12',
      validTo: '2026-12-01T02:00:00.000Z'
    })
    expect(segmentsOf(replanned!).slice(COMMITTED)).toContain(expiring)
  })

  test('a completed repair: its segment joins the route for a re-test', () => {
    const h = startCore()
    const story = playS1toRepair(h, 'submitted')
    const plan = inFlight(
      h,
      LAKE.filter((id) => id !== S1.segmentId)
    )
    h.call('startWorkOrder', 'usr_installer', { params: { id: story.workOrderId } })
    const completed = h.call('completeWorkOrder', 'usr_installer', {
      params: { id: story.workOrderId },
      body: { evidence: [], note: 'Panel replaced, fence extended 1.5 m to the headwall' }
    })
    const [replanned] = planned(h, completed.events.flatMap(subscriberFor(h).onEvent))

    expectCommittedPrefixKept(plan, replanned!)
    expect(replanned!.replan?.trigger).toEqual({
      kind: 'repair_completed',
      segmentId: S1.segmentId,
      findingId: story.findingId,
      workOrderId: story.workOrderId
    })
    expect(segmentsOf(replanned!).slice(COMMITTED)).toContain(S1.segmentId)
  })
})

describe('PLAN-4: plans that have not flown, and patrols the triggers queue', () => {
  test('heavy rain before launch re-plans the whole route for the next dry morning; only the newest plan re-plans', () => {
    const h = startCore()
    h.setNow('2026-10-31T21:00:00.000Z')
    const plan = h.call('createPatrolPlan', 'usr_manager', { body: request(h, LAKE) }).data
    const subscriber = subscriberFor(h)
    const reading = heavyRain('2026-10-31T21:30:00.000Z')
    h.setNow('2026-10-31T21:45:00.000Z')
    const [replanned] = planned(h, subscriber.onTrigger({ kind: 'heavy_rain', reading }))

    expect(replanned!.replan?.supersedes).toEqual({ planId: plan.id, committedTasks: 0 })
    expect(replanned!.window).toMatchObject({ reason: 'next_dry_window' })
    expect(Date.parse(replanned!.window.start)).toBeGreaterThan(Date.parse(plan.window.end))
    expect(replanned!.holds.map((x) => x.kind)).toEqual(['weather'])

    // The same reading again changes nothing; a new trigger re-plans the newest plan, not the one it superseded.
    expect(subscriber.onTrigger({ kind: 'heavy_rain', reading })).toEqual([])
    const [again] = planned(h, subscriber.onTrigger({ kind: 'heavy_rain', reading: heavyRain(h.now()) }))
    expect(again!.replan?.supersedes?.planId).toBe(replanned!.id)
    const stale = h.attempt('createPatrolPlan', 'usr_manager', {
      body: {
        ...request(h, LAKE),
        replan: { trigger: { kind: 'heavy_rain', reading }, supersedes: { planId: plan.id, committedTasks: 0 } }
      }
    })
    expect(stale).toMatchObject({ ok: false, rule: 'invalid_transition' })
  })

  test('a completed repair with no plan open queues a re-test patrol of its segment, as the system', () => {
    const h = startCore()
    const story = playS1toRepair(h, 'submitted')
    h.call('startWorkOrder', 'usr_installer', { params: { id: story.workOrderId } })
    const completed = h.call('completeWorkOrder', 'usr_installer', {
      params: { id: story.workOrderId },
      body: { evidence: [], note: 'Panel replaced, fence extended 1.5 m to the headwall' }
    })
    const [retest] = planned(h, completed.events.flatMap(subscriberFor(h).onEvent))

    expect(retest).toMatchObject({ dockId: RETEST.dockId, status: 'proposed', approvedBy: null })
    expect(segmentsOf(retest!)).toEqual([S1.segmentId])
    expect(retest!.replan).toEqual({
      trigger: {
        kind: 'repair_completed',
        segmentId: S1.segmentId,
        findingId: story.findingId,
        workOrderId: story.workOrderId
      },
      supersedes: null
    })
    expect(h.audit().at(-1)).toMatchObject({
      action: 'createPatrolPlan',
      actor: { type: 'system', id: 'core.replan' },
      decision: 'allowed'
    })
  })
})
