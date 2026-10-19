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
import { assumedEnergyModel, type ThirdParty } from '@safe-edge/planner'
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
})

/** People at the water's edge by segment 9 (as in core's flight-holds test): no stand-off clears them by 50 m. */
const peopleBySegment9: ThirdParty = {
  id: 'obs_people_edge',
  kind: 'person',
  label: 'people at the water edge',
  geometry: { type: 'Point', coordinates: [101.514434, 3.179979] },
  observedAt: '2026-10-21T21:50:00.000Z',
  headcount: null,
  simulated: true,
  source: 'fixture'
}
const HELD = 'seg_866518980_9'

/**
 * A plan whose segment 9 waits for the people by it, approved, its dock hold released (the seed's path crowd is beside
 * the transits from and to the dock, #150) and dispatched at its window's start. `waitFrom` is when the drone, flying
 * the plan, has reached the waypoint before segment 9's first station and hovered there for its frame: where it waits.
 */
async function heldFlight({
  thirdParties = [peopleBySegment9],
  segmentIds = [...SEGMENT_IDS, HELD],
  held = HELD
}: { thirdParties?: ThirdParty[]; segmentIds?: string[]; held?: string } = {}) {
  const h = await start({ thirdParties })
  const approved = h.approve(h.plan(segmentIds).id)
  expect(approved.holds.map((x) => [x.kind, x.segmentId, x.releasedBy])).toEqual([
    ['separation', null, null],
    ['separation', held, null]
  ])
  const approval = { planId: approved.id, approvedBy: approved.approvedBy!, approvedAt: approved.approvedAt! }
  const release = (segmentId: string) =>
    h.call('releasePlanHold', 'usr_pilot', { params: { id: approved.id, segmentId } }).data
  h.setNow(approved.window.start)

  // Take-off waits on the dock until the pilot records the dock and its transits clear.
  const onDock = await h.sim.schedulePatrol(approved)
  await expect(h.sim.dispatchPatrol(onDock.id, approval)).rejects.toThrow(
    `${approved.id} holds the dock: the pilot must confirm it clear before take-off`
  )
  await h.sim.cancelPatrol(onDock.id)

  const dockClear = release('dock')
  const run = await h.sim.schedulePatrol(dockClear)
  await h.sim.dispatchPatrol(run.id, approval)
  const first = dockClear.waypoints.findIndex((w) => w.segmentId === held)
  const before = dockClear.waypoints[first - 1]!
  const waitFrom = Date.parse(before.eta) + (before.kind === 'station' ? assumedEnergyModel.stationHoverS * 1000 : 0)
  const at = (ms: number) => {
    h.setNow(new Date(ms).toISOString())
    h.sim.tick()
  }
  return { ...h, plan: dockClear, run, approval, release, before, waitFrom, at }
}

const heldEvents = (events: ProviderEvent[], held = HELD) =>
  events.filter((e) => (e.type === 'waypoint' || e.type === 'observation') && e.segmentId === held)

/** People on the footbridge between the banks, 9 m from the transit from segment 8 to segment 5 (as in #150's test). */
const peopleOnFootbridge: ThirdParty = {
  id: 'obs_people_footbridge',
  kind: 'person',
  label: 'people on footbridge way/909868199',
  geometry: { type: 'Point', coordinates: [101.5130697, 3.1791843] },
  observedAt: '2026-10-21T21:50:00.000Z',
  headcount: null,
  simulated: true,
  source: 'fixture'
}

describe('drone-sim waits at a separation hold', () => {
  test('it hovers before the held segment until the pilot releases it, and the hover costs battery and time', async () => {
    const h = await heldFlight()
    const budgetMs = 120_000
    // Five minutes at the waiting point, three more than the plan budgets for the pilot to see the path clear.
    const releasedAt = h.waitFrom + 5 * 60_000
    h.at(releasedAt - 1000)
    expect(heldEvents(h.events)).toEqual([])
    const waiting = await h.sim.getStatus('sim-1')
    expect(waiting).toMatchObject({ state: 'in_flight', runId: h.run.id })
    expect(waiting.pose).toMatchObject({ lon: h.before.lon, lat: h.before.lat, altM: h.before.altM })
    h.at(releasedAt)
    expect((await h.sim.getStatus('sim-1')).batteryWh).toBeLessThan(waiting.batteryWh)

    h.release(HELD)
    await h.sim.updatePatrol(
      h.run.id,
      h.call('getPatrolPlan', 'usr_pilot', { params: { id: h.plan.id } }).data,
      h.approval
    )
    h.at(Date.parse(h.plan.window.end))
    const held = heldEvents(h.events)
    expect(held.length).toBeGreaterThan(0)
    expect(held.every((e) => Date.parse(e.at) > releasedAt)).toBe(true)
    // It flew the rest of the plan as planned, but late by the wait beyond the budget, and on that much less battery.
    const extraS = (releasedAt - h.waitFrom - budgetMs) / 1000
    const landed = h.events.at(-1)!
    if (landed.type !== 'landed') throw new Error('the drone did not land')
    expect(landed.outcome).toBe('completed')
    // To the millisecond the ETAs are rounded to.
    expect(
      Math.abs(Date.parse(landed.at) - Date.parse(h.plan.waypoints.at(-1)!.eta) - extraS * 1000)
    ).toBeLessThanOrEqual(1)
    expect(landed.remainingWh).toBeCloseTo(h.plan.reserveWh - (h.drone.hoverPowerW * extraS) / 3600, 6)
    expect(h.events.filter((e) => e.type === 'observation')).toHaveLength(
      h.plan.waypoints.filter((w) => w.kind === 'station').length
    )
  })

  test('nobody releases it: the drone waits while the rest of the plan still fits its reserve and window, then comes home', async () => {
    const h = await heldFlight()
    // The longest wait the plan allows: its budget, plus what is left of the reserve above the drone's own, or of the
    // window after the planned landing, whichever runs out first.
    const energyS = ((h.plan.reserveWh - h.drone.reserveWh) * 3600) / h.drone.hoverPowerW
    const windowS = (Date.parse(h.plan.window.end) - Date.parse(h.plan.waypoints.at(-1)!.eta)) / 1000
    const leaves = h.waitFrom + 120_000 + Math.min(energyS, windowS) * 1000
    h.at(leaves - 1000)
    const waiting = (await h.sim.getStatus('sim-1')).pose
    expect(waiting).toMatchObject({ lon: h.before.lon, lat: h.before.lat, altM: h.before.altM })
    // From the climb over the dock, home is straight down.
    h.at(leaves + 500)
    expect((await h.sim.getStatus('sim-1')).pose.altM).toBeLessThan(waiting.altM)

    // A release after it left changes nothing: it is on its way home.
    h.release(HELD)
    await h.sim.updatePatrol(
      h.run.id,
      h.call('getPatrolPlan', 'usr_pilot', { params: { id: h.plan.id } }).data,
      h.approval
    )
    h.at(Date.parse(h.plan.window.end))
    expect(heldEvents(h.events)).toEqual([])
    const landed = h.events.at(-1)!
    if (landed.type !== 'landed') throw new Error('the drone did not land')
    const dock = h.call('listDocks', 'usr_pilot', {}).data[0]!
    expect(landed).toMatchObject({ outcome: 'hold_timeout', pose: { lon: dock.position.lon, lat: dock.position.lat } })
    expect(landed.remainingWh).toBeGreaterThanOrEqual(h.drone.reserveWh)
    expect(Date.parse(landed.at)).toBeLessThan(Date.parse(h.plan.window.end))
  })

  test('a stop held for the transit into it waits at the stop before, clear of the people beside the transit', async () => {
    const h = await heldFlight({
      thirdParties: [peopleOnFootbridge],
      segmentIds: ['seg_866518980_8', 'seg_866518980_5'],
      held: 'seg_866518980_5'
    })
    expect(h.plan.holds[1]!.reason).toStartWith(
      'the transit from seg_866518980_8 to seg_866518980_5 passes within 50 m'
    )
    expect(h.before.segmentId).toBe('seg_866518980_8')
    const releasedAt = h.waitFrom + 60_000
    h.at(releasedAt)
    expect(heldEvents(h.events, 'seg_866518980_5')).toEqual([])
    expect((await h.sim.getStatus('sim-1')).pose).toMatchObject({ lon: h.before.lon, lat: h.before.lat })

    h.release('seg_866518980_5')
    await h.sim.updatePatrol(
      h.run.id,
      h.call('getPatrolPlan', 'usr_pilot', { params: { id: h.plan.id } }).data,
      h.approval
    )
    h.at(Date.parse(h.plan.window.end))
    expect(heldEvents(h.events, 'seg_866518980_5').every((e) => Date.parse(e.at) > releasedAt)).toBe(true)
    // A minute's wait, a minute inside the plan's budget: it lands a minute before the plan's ETA.
    const landed = h.events.at(-1)!
    expect(landed).toMatchObject({ type: 'landed', outcome: 'completed' })
    expect(Math.abs(Date.parse(landed.at) - Date.parse(h.plan.waypoints.at(-1)!.eta) + 60_000)).toBeLessThanOrEqual(1)
  })

  test('a re-plan in flight whose way home passes people waits before the transit home until the dock is clear', async () => {
    const h = await start()
    const approved = h.approve(h.plan(['seg_866518980_5', 'seg_866518980_6']).id)
    expect(approved.holds).toEqual([])
    const approval = (p: PatrolPlan) => ({ planId: p.id, approvedBy: p.approvedBy!, approvedAt: p.approvedAt! })
    h.setNow(approved.window.start)
    const run = await h.sim.schedulePatrol(approved)
    await h.sim.dispatchPatrol(run.id, approval(approved))
    const firstStation = approved.waypoints.find((w) => w.kind === 'station')!
    h.setNow(firstStation.eta)
    h.sim.tick()

    // Segment 7 joins the route; its transit home passes the seed's path crowd, so the re-plan holds the dock.
    const proposed = h.call('createPatrolPlan', 'usr_manager', {
      body: {
        dockId: approved.dockId,
        droneProfileId: approved.droneProfileId,
        segmentIds: ['seg_866518980_5', 'seg_866518980_6', 'seg_866518980_7'],
        context: [],
        notBefore: h.now(),
        altitudeCapM: 60,
        replan: {
          trigger: {
            kind: 'pass_expiring',
            segmentId: 'seg_866518980_7',
            passId: 'pass_866518980_7',
            validTo: '2026-11-20T00:00:00.000Z'
          },
          supersedes: { planId: approved.id, committedTasks: 1 }
        }
      }
    }).data
    const replanned = h.call('approvePatrolPlan', 'usr_pilot', { params: { id: proposed.id } }).data
    expect(replanned.holds.map((x) => [x.segmentId, x.releasedBy])).toEqual([[null, null]])
    expect(replanned.holds[0]!.reason).toStartWith('the transit from seg_866518980_7 to Dock')
    await h.sim.updatePatrol(run.id, replanned, approval(replanned))

    // It flies the re-plan's stops, then hovers at the last station for the pilot to see the way home clear.
    const lastStation = replanned.waypoints.findLast((w) => w.kind === 'station')!
    const waitFrom = Date.parse(lastStation.eta) + assumedEnergyModel.stationHoverS * 1000
    h.setNow(new Date(waitFrom + 90_000).toISOString())
    h.sim.tick()
    expect(h.events.some((e) => e.type === 'landed')).toBe(false)
    expect((await h.sim.getStatus('sim-1')).pose).toMatchObject({ lon: lastStation.lon, lat: lastStation.lat })
    const frames = h.events.flatMap((e) => (e.type === 'observation' ? [`${e.waypointIndex} ${e.segmentId}`] : []))
    expect(frames).toEqual(replanned.waypoints.flatMap((w, i) => (w.kind === 'station' ? [`${i} ${w.segmentId}`] : [])))

    const released = h.call('releasePlanHold', 'usr_pilot', { params: { id: replanned.id, segmentId: 'dock' } }).data
    await h.sim.updatePatrol(run.id, released, approval(released))
    h.setNow(approved.window.end)
    h.sim.tick()
    // The plan budgets no wait for the dock: it lands the 90 s it waited after the re-plan's ETA.
    const landed = h.events.at(-1)!
    expect(landed).toMatchObject({ type: 'landed', outcome: 'completed' })
    expect(Math.abs(Date.parse(landed.at) - Date.parse(replanned.waypoints.at(-1)!.eta) - 90_000)).toBeLessThanOrEqual(
      1
    )
  })
})

describe('drone-sim honours the plan: its zoom and its window', () => {
  test("each frame is taken at its station's zoom, with the far bank's stations standing off from S1's path crowd", async () => {
    const h = await start()
    // Across the lake from the seed's S1 path crowd, the stations stand further off and zoom in to keep 50 m.
    const approved = h.approve(h.plan(['seg_866518980_7']).id)
    // The transit back to the dock passes the crowd (#150): the pilot records the dock and its transits clear.
    expect(approved.holds.map((x) => [x.kind, x.segmentId])).toEqual([['separation', null]])
    const released = h.call('releasePlanHold', 'usr_pilot', { params: { id: approved.id, segmentId: 'dock' } }).data
    const run = await h.sim.schedulePatrol(released)
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
      cancelled = { at: h.now(), status, committed: bridge.committedTasks(patrol, approved) }
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
