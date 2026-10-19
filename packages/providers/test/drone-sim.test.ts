// drone-sim through the DroneProvider port, wired to core the way a transport would: the plan comes from
// `@safe-edge/planner` over real Elmina segments (through the SDK's Elmina adapter), the pilot approves it through
// core's dispatch, the sim flies it, and its observations go back through dispatch (`POST /observations`) until core
// completes the patrol.
import { describe, expect, test } from 'bun:test'
import {
  ProviderEvent,
  operations,
  type Actor,
  type CoreOperationId,
  type DispatchResult,
  type DispatchSuccess,
  type DroneStatus,
  type Observation,
  type OperationInput,
  type PatrolPlan,
  type Pose,
  type Segment
} from '@safe-edge/contracts'
import { actorFor, counterIds, createCore, type Seed } from '@safe-edge/core'
import type { ThirdParty } from '@safe-edge/planner'
import { createElminaPlanner } from '@safe-edge/sdk'
import { distance } from '@turf/distance'
import { join } from 'node:path'
import { ApprovalRequiredError, createDroneSim } from '../src/index.ts'

const repoRoot = join(import.meta.dir, '../../..')
const seed = (await Bun.file(join(repoRoot, 'data/elmina/fixtures/seed.json')).json()) as Seed

// S1 (two fixed viewpoints) and two other lake segments: real Elmina geometry from the seed.
const SEGMENT_IDS = [seed.story.s1.segmentId, 'seg_866518980_5', 'seg_866518980_6']
const APPROVED_AT = '2026-10-21T22:00:00.000Z'
const NOT_BEFORE = '2026-10-21T23:30:00.000Z'

/** One core and one sim sharing a clock, driven as seeded users. */
async function start({ thirdParties = [] }: { thirdParties?: ThirdParty[] } = {}) {
  let now = seed.asOf
  const clock = { now: () => now }
  const planner = await createElminaPlanner((path) => Bun.file(join(repoRoot, path)).json(), { thirdParties })
  const core = createCore({ seed, clock, ids: counterIds(), planner })
  const actor = (userId: string): Actor => actorFor(seed.users.find((u) => u.id === userId)!)
  const attempt = <K extends CoreOperationId>(op: K, userId: string, input: OperationInput<K>): DispatchResult<K> =>
    core.dispatch(op, actor(userId), input)
  const call = <K extends CoreOperationId>(op: K, userId: string, input: OperationInput<K>): DispatchSuccess<K> => {
    const result = attempt(op, userId, input)
    if (!result.ok) throw new Error(`${op} as ${userId} failed: ${JSON.stringify(result)}`)
    operations[op].response.parse(result.data)
    return result
  }
  const [dock] = call('listDocks', 'usr_pilot', {}).data
  const [drone] = call('listDroneProfiles', 'usr_pilot', {}).data
  const sim = createDroneSim({
    clock,
    devices: [{ id: 'sim-1', name: 'Simulated dock aircraft', dock: dock!, drone: drone! }]
  })
  const events: ProviderEvent[] = []
  sim.onEvent((event) => events.push(ProviderEvent.parse(event)))

  const plan = (segmentIds = SEGMENT_IDS): PatrolPlan =>
    call('createPatrolPlan', 'usr_manager', {
      body: {
        dockId: dock!.id,
        droneProfileId: drone!.id,
        segmentIds,
        context: [],
        notBefore: NOT_BEFORE,
        altitudeCapM: 60
      }
    }).data
  const approve = (planId: string): PatrolPlan => {
    now = APPROVED_AT
    return call('approvePatrolPlan', 'usr_pilot', { params: { id: planId } }).data
  }
  return {
    core,
    sim,
    events,
    drone: drone!,
    attempt,
    call,
    plan,
    approve,
    now: () => now,
    setNow: (iso: string) => {
      now = iso
    }
  }
}

describe('drone-sim refuses to fly without a human approval', () => {
  test('a proposed plan, a missing approval and an approval the pilot never gave are all refused', async () => {
    const h = await start()
    const proposed = h.plan()
    const run = await h.sim.schedulePatrol(proposed)
    expect(run).toMatchObject({ planId: proposed.id, deviceId: 'sim-1', status: 'scheduled', approval: null })

    // Nobody approved the plan in core, so whatever approval is offered, the sim does not fly it.
    const offered = { planId: proposed.id, approvedBy: 'usr_manager', approvedAt: h.now() }
    await expect(h.sim.dispatchPatrol(run.id, offered)).rejects.toThrow(ApprovalRequiredError)
    await h.sim.cancelPatrol(run.id)

    const approved = h.approve(proposed.id)
    const second = await h.sim.schedulePatrol(approved)
    await expect(h.sim.dispatchPatrol(second.id, undefined as never)).rejects.toThrow(ApprovalRequiredError)
    // The agent cannot approve in core (agents_draft_only), and the sim does not take its word either.
    const forged = { planId: approved.id, approvedBy: 'usr_agent', approvedAt: approved.approvedAt! }
    await expect(h.sim.dispatchPatrol(second.id, forged)).rejects.toThrow(ApprovalRequiredError)
    expect(h.attempt('approvePatrolPlan', 'usr_agent', { params: { id: approved.id } })).toMatchObject({
      ok: false,
      rule: 'agents_draft_only'
    })

    h.setNow('2026-10-22T03:00:00.000Z')
    expect(await h.sim.getStatus('sim-1')).toMatchObject({ state: 'docked', runId: null, batteryPercent: 100 })
    expect(h.events).toEqual([])
  })

  test('a separation hold flies only after the pilot records the path clear', async () => {
    // People at the water's edge by segment 9 (as in core's flight-holds test): no stand-off clears them by 50 m.
    const people: ThirdParty = {
      id: 'obs_people_edge',
      kind: 'person',
      label: 'people at the water edge',
      geometry: { type: 'Point', coordinates: [101.514434, 3.179979] },
      observedAt: '2026-10-21T21:50:00.000Z',
      simulated: true,
      source: 'fixture'
    }
    const h = await start({ thirdParties: [people] })
    const approved = h.approve(h.plan([...SEGMENT_IDS, 'seg_866518980_9']).id)
    expect(approved.holds.map((x) => [x.kind, x.segmentId, x.releasedBy])).toEqual([
      ['separation', 'seg_866518980_9', null]
    ])
    const approval = { planId: approved.id, approvedBy: approved.approvedBy!, approvedAt: approved.approvedAt! }
    const held = await h.sim.schedulePatrol(approved)
    await expect(h.sim.dispatchPatrol(held.id, approval)).rejects.toThrow('confirm the path is clear')
    await h.sim.cancelPatrol(held.id)

    const released = h.call('releasePlanHold', 'usr_pilot', {
      params: { id: approved.id, segmentId: 'seg_866518980_9' }
    }).data
    const run = await h.sim.schedulePatrol(released)
    await h.sim.dispatchPatrol(run.id, approval)
    h.sim.tick()
    expect(h.events.map((e) => e.type)).toEqual(['takeoff'])
  })
})

type Harness = Awaited<ReturnType<typeof start>>

/** The S1 viewpoint a frame was taken from: same place and height, within a metre. */
function viewpointAt(segment: Segment, pose: Pose) {
  return segment.viewpoints.find(
    (v) =>
      distance([v.pose.lon, v.pose.lat], [pose.lon, pose.lat], { units: 'meters' }) < 1 &&
      Math.abs(v.pose.altM - pose.altM) < 1
  )
}

/**
 * What a transport hosting the sim does with its events: a frame at a fixed viewpoint becomes an observation on the
 * patrol (core needs the viewpoint), and landing completes the patrol. A segment counts as inspected only when every
 * one of its stations was captured; otherwise its whole length stays unknown.
 */
function bridge(h: Harness, plan: PatrolPlan, patrolId: string) {
  const segments = new Map(
    plan.tasks.map((t) => [
      t.segmentId,
      h.call('getSegment', 'usr_manager', { params: { id: t.segmentId } }).data.segment
    ])
  )
  const frames = new Map<string, number>()
  const recorded: Observation[] = []
  let completed: DispatchSuccess<'completePatrol'> | null = null
  h.sim.onEvent((event) => {
    if (event.type === 'observation') {
      frames.set(event.segmentId, (frames.get(event.segmentId) ?? 0) + 1)
      const viewpoint = viewpointAt(segments.get(event.segmentId)!, event.pose)
      if (!viewpoint) return
      const { segmentId, captureSource, image, pose, quality, privacyAction, simulated } = event
      const body = {
        patrolId,
        segmentId,
        viewpointId: viewpoint.id,
        captureSource,
        image,
        pose,
        quality,
        privacyAction
      }
      recorded.push(
        h.call('recordObservation', 'usr_drone_sim', { body: { ...body, capturedAt: event.at, simulated } }).data
      )
    }
    if (event.type === 'landed') {
      const coverage = plan.tasks.map(({ segmentId, stations }) => {
        const { lengthM } = segments.get(segmentId)!
        const whole = frames.get(segmentId) === stations.length
        return { segmentId, inspectedM: whole ? lengthM : 0, unknownM: whole ? 0 : lengthM }
      })
      completed = h.call('completePatrol', 'usr_drone_sim', { params: { id: patrolId }, body: { coverage } })
    }
  })
  return { segments, recorded, completed: () => completed! }
}

/**
 * Plan, approve as the pilot, start the patrol in core, schedule and dispatch it on the sim, then step the shared clock
 * one second at a time, as the scenario player does, until the drone lands. `cancelAfterFrames` cancels mid-flight.
 */
async function flyApprovedPlan(h: Harness, { cancelAfterFrames }: { cancelAfterFrames?: number } = {}) {
  const approved = h.approve(h.plan().id)
  const run = await h.sim.schedulePatrol(approved)
  h.setNow(approved.window.start)
  const patrol = h.call('startPatrol', 'usr_pilot', {
    body: { planId: approved.id, provider: 'sim', droneId: run.deviceId }
  }).data
  const link = bridge(h, approved, patrol.id)
  await h.sim.dispatchPatrol(run.id, {
    planId: approved.id,
    approvedBy: approved.approvedBy!,
    approvedAt: approved.approvedAt!
  })
  let cancelled: { at: string; status: DroneStatus } | null = null
  const deadline = Date.parse(approved.window.end)
  for (let t = Date.parse(approved.window.start); !h.events.some((e) => e.type === 'landed');) {
    if (t > deadline) throw new Error('the drone never landed')
    t += 1000
    h.setNow(new Date(t).toISOString())
    h.sim.tick()
    const frames = h.events.filter((e) => e.type === 'observation').length
    if (cancelled === null && cancelAfterFrames !== undefined && frames >= cancelAfterFrames) {
      cancelled = { at: h.now(), status: await h.sim.getStatus(run.deviceId) }
      await h.sim.cancelPatrol(run.id)
    }
  }
  return { approved, run, patrol, cancelled, ...link }
}

describe('drone-sim flies an approved plan and feeds core', () => {
  test("it flies the planner's route on the planner's timeline, and its observations complete the patrol", async () => {
    const h = await start()
    const { approved, patrol, segments, recorded, completed } = await flyApprovedPlan(h)
    const waypoints = approved.waypoints
    expect(approved.tasks.map((t) => t.segmentId).toSorted()).toEqual(SEGMENT_IDS.toSorted())

    // Take-off, every waypoint in order, landing. The sim's own flight model lands on the plan's ETAs.
    expect(h.events[0]).toMatchObject({ type: 'takeoff', planId: approved.id, at: waypoints[0]!.eta })
    const reached = h.events.flatMap((e) => (e.type === 'waypoint' ? [[e.index, e.kind, e.at]] : []))
    expect(reached).toEqual(waypoints.slice(1, -1).map((w, i) => [i + 1, w.kind, w.eta]))
    const landed = h.events.at(-1)!
    expect(landed).toMatchObject({ type: 'landed', outcome: 'completed', at: waypoints.at(-1)!.eta })

    // Its battery model is the planner's: it lands with exactly the reserve the plan budgeted.
    if (landed.type !== 'landed') throw new Error('unreachable')
    expect(landed.remainingWh).toBeCloseTo(approved.reserveWh, 9)
    const battery = h.events.flatMap((e) => (e.type === 'battery' ? [e] : []))
    expect(battery.map((e) => Date.parse(e.at) - Date.parse(waypoints[0]!.eta))).toEqual(
      battery.map((_, i) => (i + 1) * 10_000)
    )
    expect(battery.every((e, i) => e.remainingWh < (battery[i - 1]?.remainingWh ?? Infinity))).toBe(true)
    expect(battery.at(-1)!.remainingWh).toBeGreaterThan(h.drone.reserveWh)

    // One frame per camera station, in route order; S1's two fixed viewpoints became observations on the patrol.
    const frames: (string | null)[] = h.events.flatMap((e) => (e.type === 'observation' ? [e.segmentId] : []))
    expect(frames).toEqual(waypoints.filter((w) => w.kind === 'station').map((w) => w.segmentId))
    const s1 = seed.story.s1.segmentId
    expect(recorded.map((o) => [o.segmentId, o.viewpointId, o.patrolId]).toSorted()).toEqual(
      segments
        .get(s1)!
        .viewpoints.map((v) => [s1, v.id, patrol.id])
        .toSorted()
    )
    const trail = h.call('listAudit', 'usr_manager', { query: { subject: s1 } }).data
    expect(trail.filter((e) => e.action === 'recordObservation').map((e) => e.actor.id)).toEqual([
      'usr_drone_sim',
      'usr_drone_sim'
    ])

    // Landing, delivered on the next clock step, completed the patrol in core: every segment fully seen, no field checks.
    const done = completed()
    expect(done.data).toMatchObject({ id: patrol.id, status: 'completed', completedAt: h.now() })
    expect(Date.parse(h.now()) - Date.parse(landed.at)).toBeLessThan(1000)
    expect(done.data.coverage).toEqual(
      approved.tasks.map((t) => ({
        segmentId: t.segmentId,
        inspectedM: segments.get(t.segmentId)!.lengthM,
        unknownM: 0
      }))
    )
    expect(done.events.map((e) => e.type)).toEqual(['edge.patrol.completed.v1'])
    expect(h.call('listTasks', 'usr_manager', { query: { status: 'open' } }).data).toEqual([])
    expect(await h.sim.getStatus('sim-1')).toMatchObject({ state: 'docked', runId: null, pose: landed.pose })
  })

  test('the same plan on the same clock gives the same event stream', async () => {
    const first = await start()
    await flyApprovedPlan(first)
    const second = await start()
    await flyApprovedPlan(second)
    expect(second.events).toEqual(first.events)
  })

  test('a cancelled flight goes straight back to the dock, and what it missed becomes field checks', async () => {
    const h = await start()
    const { approved, run, patrol, cancelled, completed } = await flyApprovedPlan(h, { cancelAfterFrames: 1 })
    expect(cancelled!.status).toMatchObject({ state: 'in_flight', runId: run.id })
    expect(cancelled!.status.batteryWh).toBeLessThan(h.drone.usableBatteryWh)

    const after = h.events.filter((e) => Date.parse(e.at) > Date.parse(cancelled!.at))
    expect(new Set(after.map((e) => e.type))).toEqual(new Set(['battery', 'landed']))
    expect(h.events.filter((e) => e.type === 'observation')).toHaveLength(1)
    const landed = h.events.at(-1)!
    if (landed.type !== 'landed') throw new Error('the last event is not the landing')
    const dock = h.call('listDocks', 'usr_pilot', {}).data[0]!
    expect(landed).toMatchObject({ outcome: 'cancelled', pose: { lon: dock.position.lon, lat: dock.position.lat } })
    expect(landed.pose.altM).toBe(dock.position.altM)
    expect(landed.remainingWh).toBeGreaterThan(approved.reserveWh)
    expect(Date.parse(landed.at)).toBeLessThan(Date.parse(approved.waypoints.at(-1)!.eta))

    // Nothing was fully seen, so every planned segment is unknown, never inspected, and gets a field check.
    expect(completed().data).toMatchObject({ id: patrol.id, status: 'completed' })
    expect(completed().data.coverage.every((c) => c.inspectedM === 0 && c.unknownM > 0)).toBe(true)
    const checks = h.call('listTasks', 'usr_manager', { query: { status: 'open' } }).data
    expect(checks.map((t) => [t.kind, t.segmentId]).toSorted()).toEqual(
      approved.tasks.map((t) => ['field_check', t.segmentId]).toSorted()
    )
    await expect(h.sim.cancelPatrol(run.id)).rejects.toThrow('already cancelled')
  })
})
