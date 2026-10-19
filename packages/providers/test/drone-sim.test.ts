// drone-sim through the DroneProvider port, wired to core by the bridge a transport hosts: the plan comes from
// `@safe-edge/planner` over real Elmina segments (through its Elmina adapter), the pilot approves it through
// core's dispatch, the sim flies it, and its observations go back through dispatch (`POST /observations`) until core
// completes the patrol.
import { describe, expect, test } from 'bun:test'
import {
  ProviderEvent,
  type DroneStatus,
  type EdgeEvent,
  type Observation,
  type PatrolPlan
} from '@safe-edge/contracts'
import type { ThirdParty } from '@safe-edge/planner'
import { plannerWith, seed, startCore } from '../../core/test/support.ts'
import { ApprovalRequiredError, OutsideWindowError, bridgeDrone, createDroneSim } from '../src/index.ts'

// S1 (two fixed viewpoints) and two other lake segments: real Elmina geometry from the seed.
const SEGMENT_IDS = [seed.story.s1.segmentId, 'seg_866518980_5', 'seg_866518980_6']
const APPROVED_AT = '2026-10-21T22:00:00.000Z'
const NOT_BEFORE = '2026-10-21T23:30:00.000Z'

/** One core (core's own test harness, driven as seeded users) and one sim sharing its clock. */
async function start({ thirdParties = [] }: { thirdParties?: ThirdParty[] } = {}) {
  const h = startCore({ planner: await plannerWith({ thirdParties }) })
  const [dock] = h.call('listDocks', 'usr_pilot', {}).data
  const [drone] = h.call('listDroneProfiles', 'usr_pilot', {}).data
  const sim = createDroneSim({
    clock: { now: h.now },
    devices: [{ id: 'sim-1', name: 'Simulated dock aircraft', dock: dock!, drone: drone! }]
  })
  const events: ProviderEvent[] = []
  sim.onEvent((event) => events.push(ProviderEvent.parse(event)))

  const plan = (segmentIds = SEGMENT_IDS): PatrolPlan =>
    h.call('createPatrolPlan', 'usr_manager', {
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
    h.setNow(APPROVED_AT)
    return h.call('approvePatrolPlan', 'usr_pilot', { params: { id: planId } }).data
  }
  return { ...h, sim, events, drone: drone!, plan, approve }
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

describe('drone-sim honours the plan: its zoom and its window', () => {
  test("each frame is taken at its station's zoom, with the far bank's stations standing off from S1's path crowd", async () => {
    const h = await start()
    // Across the lake from the seed's S1 path crowd, the stations stand further off and zoom in to keep 50 m.
    const approved = h.approve(h.plan(['seg_866518980_7']).id)
    expect(approved.holds).toEqual([])
    const run = await h.sim.schedulePatrol(approved)
    h.setNow(approved.window.start)
    await h.sim.dispatchPatrol(run.id, {
      planId: approved.id,
      approvedBy: approved.approvedBy!,
      approvedAt: approved.approvedAt!
    })
    h.setNow(approved.window.end)
    h.sim.tick()

    const frames = h.events.flatMap((e) => (e.type === 'observation' ? [e] : []))
    const stations = approved.waypoints.filter((w) => w.kind === 'station')
    expect(frames.map((e) => e.zoom)).toEqual(stations.map((w) => w.zoom))
    expect(frames.some((e) => e.zoom > 1)).toBe(true)
    expect(h.events.at(-1)).toMatchObject({ type: 'landed', outcome: 'completed' })
  })

  test('it refuses to fly a plan it could not land before the window closes', async () => {
    const h = await start()
    const approved = h.approve(h.plan().id)
    const approval = { planId: approved.id, approvedBy: approved.approvedBy!, approvedAt: approved.approvedAt! }
    const flightMs = Date.parse(approved.waypoints.at(-1)!.eta) - Date.parse(approved.window.start)
    const run = await h.sim.schedulePatrol(approved)

    // Dispatched a second later than the last moment it could still land before the window ends.
    h.setNow(new Date(Date.parse(approved.window.end) - flightMs + 1000).toISOString())
    const lateLanding = new Date(Date.parse(h.now()) + flightMs).toISOString()
    // Core refuses to start that patrol too, as an audited outside_window denial.
    const startInCore = () =>
      h.attempt('startPatrol', 'usr_pilot', { body: { planId: approved.id, provider: 'sim', droneId: 'sim-1' } })
    expect(startInCore()).toMatchObject({
      ok: false,
      rule: 'outside_window',
      message: `${approved.id} would land at ${lateLanding}, after its window closes at ${approved.window.end}`
    })
    const late = h.sim.dispatchPatrol(run.id, approval)
    await expect(late).rejects.toThrow(OutsideWindowError)
    await expect(late).rejects.toThrow(
      `${approved.id} would land at ${lateLanding}, after its window closes at ${approved.window.end}`
    )
    expect(await h.sim.getStatus('sim-1')).toMatchObject({ state: 'docked', batteryPercent: 100 })
    expect(h.events).toEqual([])

    // The run stays scheduled: with a second to spare it flies, and lands inside the window.
    h.setNow(new Date(Date.parse(approved.window.end) - flightMs - 1000).toISOString())
    expect(startInCore()).toMatchObject({ ok: true, data: { status: 'in_flight' } })
    await h.sim.dispatchPatrol(run.id, approval)
    h.setNow(approved.window.end)
    h.sim.tick()
    const landed = h.events.at(-1)!
    expect(landed).toMatchObject({ type: 'landed', outcome: 'completed' })
    expect(Date.parse(landed.at)).toBeLessThan(Date.parse(approved.window.end))
  })
})

type Harness = Awaited<ReturnType<typeof start>>

/**
 * Plan, approve as the pilot, start the patrol in core, and hand it to the bridge, which schedules and dispatches it on
 * the sim with the approval core recorded. Then step the shared clock one second at a time, as the scenario player
 * does, until the drone lands. `cancelAfterFrames` cancels mid-flight.
 */
async function flyApprovedPlan(h: Harness, { cancelAfterFrames }: { cancelAfterFrames?: number } = {}) {
  const approved = h.approve(h.plan().id)
  h.setNow(approved.window.start)
  const patrol = h.call('startPatrol', 'usr_pilot', {
    body: { planId: approved.id, provider: 'sim', droneId: 'sim-1' }
  }).data
  const published: EdgeEvent[] = []
  const bridge = bridgeDrone({
    provider: h.sim,
    dispatch: h.core.dispatch,
    actor: h.actor('usr_drone_sim'),
    publish: (events) => published.push(...events),
    onFailure: (error) => {
      throw error
    }
  })
  const run = await bridge.fly(patrol)
  let cancelled: { at: string; status: DroneStatus; committed: number } | null = null
  const deadline = Date.parse(approved.window.end)
  for (let t = Date.parse(approved.window.start); !h.events.some((e) => e.type === 'landed');) {
    if (t > deadline) throw new Error('the drone never landed')
    t += 1000
    h.setNow(new Date(t).toISOString())
    h.sim.tick()
    const frames = h.events.filter((e) => e.type === 'observation').length
    if (cancelled === null && cancelAfterFrames !== undefined && frames >= cancelAfterFrames) {
      const status = await h.sim.getStatus(run.deviceId)
      cancelled = { at: h.now(), status, committed: bridge.committedTasks(patrol) }
      await h.sim.cancelPatrol(run.id)
    }
  }
  const segments = new Map(approved.tasks.map((t) => [t.segmentId, h.segment(t.segmentId).segment]))
  const recorded = h
    .audit()
    .filter((e) => e.action === 'recordObservation')
    .map((e) => e.after as Observation)
  const completed = () => h.call('listPatrols', 'usr_manager', {}).data.find((p) => p.id === patrol.id)!
  return { approved, run, patrol, cancelled, published, segments, recorded, completed }
}

describe('drone-sim flies an approved plan and feeds core', () => {
  test("it flies the planner's route on the planner's timeline, and its observations complete the patrol", async () => {
    const h = await start()
    const { approved, patrol, segments, recorded, published, completed } = await flyApprovedPlan(h)
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

    // One frame per camera station, in route order. The planner gave S1's first and last stations its two fixed
    // viewpoints' IDs; the frames carry them, and those two frames became observations on the patrol.
    const frames: (string | null)[] = h.events.flatMap((e) => (e.type === 'observation' ? [e.segmentId] : []))
    expect(frames).toEqual(waypoints.filter((w) => w.kind === 'station').map((w) => w.segmentId))
    const s1 = seed.story.s1.segmentId
    const s1Stations = approved.tasks.find((t) => t.segmentId === s1)!.stations.map((s) => s.viewpointId)
    expect([s1Stations[0], s1Stations.at(-1)].toSorted()).toEqual(['vp_866518980_11_1', 'vp_866518980_11_2'])
    expect(s1Stations.slice(1, -1).every((id) => id === null)).toBe(true)
    expect(
      approved.tasks.filter((t) => t.segmentId !== s1).flatMap((t) => t.stations.map((s) => s.viewpointId))
    ).toEqual(approved.tasks.filter((t) => t.segmentId !== s1).flatMap((t) => t.stations.map(() => null)))
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
    expect(done).toMatchObject({ id: patrol.id, status: 'completed', completedAt: h.now() })
    expect(Date.parse(h.now()) - Date.parse(landed.at)).toBeLessThan(1000)
    expect(done.coverage).toEqual(
      approved.tasks.map((t) => ({
        segmentId: t.segmentId,
        inspectedM: segments.get(t.segmentId)!.lengthM,
        unknownM: 0
      }))
    )
    expect(published.map((e) => e.type)).toEqual(['edge.patrol.completed.v1'])
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
    // The first frame was the first stop's, so the bridge reports that stop committed when a re-plan asks.
    expect(cancelled!.committed).toBe(1)
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

    // Only the first station was seen: it stands for its share of the first stop's segment. The rest of every planned
    // segment is unknown, never inspected, and gets a field check.
    expect(completed()).toMatchObject({ id: patrol.id, status: 'completed' })
    const [first, ...rest] = approved.tasks
    const firstLengthM = h.segment(first!.segmentId).segment.lengthM
    expect(completed().coverage[0]).toEqual({
      segmentId: first!.segmentId,
      inspectedM: firstLengthM / first!.stations.length,
      unknownM: firstLengthM - firstLengthM / first!.stations.length
    })
    expect(completed().coverage.slice(1)).toEqual(
      rest.map((t) => ({ segmentId: t.segmentId, inspectedM: 0, unknownM: h.segment(t.segmentId).segment.lengthM }))
    )
    const checks = h.call('listTasks', 'usr_manager', { query: { status: 'open' } }).data
    expect(checks.map((t) => [t.kind, t.segmentId]).toSorted()).toEqual(
      approved.tasks.map((t) => ['field_check', t.segmentId]).toSorted()
    )
    await expect(h.sim.cancelPatrol(run.id)).rejects.toThrow('already cancelled')
  })
})
