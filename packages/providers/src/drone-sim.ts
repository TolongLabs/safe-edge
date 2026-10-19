import {
  HumanApproval,
  PatrolPlan,
  type Dock,
  type DroneDevice,
  type DroneProfile,
  type DroneProvider,
  type DroneStatus,
  type PatrolRun,
  type PlanHold,
  type Pose,
  type ProviderEvent,
  type Waypoint
} from '@safe-edge/contracts'
import { assumedEnergyModel } from '@safe-edge/planner'
import { distance } from '@turf/distance'
import { ApprovalRequiredError, OutsideWindowError } from './errors.ts'

/** Seconds of flight between `battery` events. */
const BATTERY_SAMPLE_S = 10
/** The sim has no camera: its frames carry no image and nominal quality, and every event is `simulated`. */
const NOMINAL_QUALITY = { sharpness: 1, alignmentResidualPx: null, occlusion: 0 }
const meters = { units: 'meters' } as const

/** A simulated aircraft on its dock. Its battery and speed figures are the drone profile's stated assumptions. */
export interface SimDevice {
  id: string
  name: string
  dock: Dock
  drone: DroneProfile
}

export interface DroneSimOptions {
  /** The scenario clock, shared with core: the same calls at the same times give the same events. */
  clock: { now(): string }
  devices: SimDevice[]
}

export interface DroneSim extends DroneProvider {
  /**
   * Delivers, in time order, every event due by `clock.now()`. Call it on each clock step. Every other method catches
   * up first, so status and run state always match the clock. The stream only moves forward; build a new sim to rewind.
   */
  tick(): void
}

/** A straight piece of flight. Position, altitude and energy change linearly along it. */
interface Leg {
  startS: number
  endS: number
  from: Pose
  to: Pose
  startWh: number
  endWh: number
}

/** An event of the flight at `s` seconds after take-off. */
interface Timed {
  s: number
  event: ProviderEvent
}

/**
 * A separation hold the drone waits for before `index` (a plan waypoint index): a held segment's first station, or the
 * transit home for the dock. It hovers from `fromS` and, unless the pilot releases the hold before `untilS`, flies home
 * then: after `untilS`, the rest of the plan would no longer land inside the window with the drone's reserve.
 */
interface Wait {
  index: number
  segmentId: string | null
  fromS: number
  untilS: number
}

interface Flight {
  /** Take-off time, epoch milliseconds. */
  t0: number
  startWh: number
  /** The flight as decided so far, to its landing. */
  legs: Leg[]
  /** Its take-off, waypoint, frame and landing events, in order. Battery samples come from the legs. */
  route: Timed[]
  /** Every event in time order: delivered up to `next`, decided after it. */
  queue: ProviderEvent[]
  next: number
  wait: Wait | null
}

interface DeviceState {
  spec: SimDevice
  pose: Pose
  batteryWh: number
  /** The scheduled or in-flight run holding the device. */
  run: Run | null
}

interface Run {
  record: PatrolRun
  /** The plan the drone flies: the one dispatched, a later version of it (holds released), or an approved re-plan. */
  plan: PatrolPlan
  device: DeviceState
  flight: Flight | null
}

/**
 * A headless, deterministic drone provider (TRD "SDK and provider adapters": `drone-sim`). It flies an approved plan's
 * waypoints with #71's stated energy model (`assumedEnergyModel`): cruise speed and power along the ground, hover power
 * for 3 m/s climbs and descents, and a hover at each camera station, where it takes a frame at the station's zoom. No
 * wind. Each flight starts on a full battery, because the dock charges between flights. It refuses a dispatch that
 * could not land before the plan's window closes. Before a segment whose separation hold is unreleased, and before the
 * transit home while the dock's is, it hovers until the pilot releases the hold (`updatePatrol` with the released
 * plan), for as long as the rest of the plan still fits; then it comes home. An approved re-plan replaces the rest of
 * the route in flight. Browser-safe: the Three.js scene subscribes to it with `onEvent`.
 */
export function createDroneSim({ clock, devices }: DroneSimOptions): DroneSim {
  const fleet = new Map<string, DeviceState>(
    devices.map((spec) => [
      spec.id,
      { spec, pose: dockPose(spec.dock, 0), batteryWh: spec.drone.usableBatteryWh, run: null }
    ])
  )
  const runs = new Map<string, Run>()
  const handlers = new Set<(event: ProviderEvent) => void>()
  const tick = () => {
    const nowMs = Date.parse(clock.now())
    const due: ProviderEvent[] = []
    for (const run of runs.values()) {
      const flight = run.flight
      while (flight && flight.next < flight.queue.length && Date.parse(flight.queue[flight.next]!.at) <= nowMs) {
        due.push(flight.queue[flight.next++]!)
      }
    }
    // Runs on different devices interleave by time; `toSorted` is stable, so each run keeps its own order.
    for (const event of due.toSorted((a, b) => Date.parse(a.at) - Date.parse(b.at))) {
      if (event.type === 'landed') {
        const run = runs.get(event.runId)!
        if (run.record.status === 'in_flight') run.record.status = 'completed'
        run.device.run = null
        run.device.pose = event.pose
        run.device.batteryWh = event.remainingWh
      }
      for (const handler of handlers) handler(structuredClone(event))
    }
  }

  const runState = (id: string) => {
    const run = runs.get(id)
    if (!run) throw new Error(`No simulated run ${id}`)
    return run
  }

  /** The pilot approval `approval` must be, exactly as core recorded it on `plan`. */
  const checkApproval = (runId: string, plan: PatrolPlan, approval: HumanApproval) => {
    const given = HumanApproval.safeParse(approval)
    if (!given.success) throw new ApprovalRequiredError(`${runId} needs a pilot's approval of ${plan.id} to fly`)
    if (plan.status !== 'approved') {
      throw new ApprovalRequiredError(`${plan.id} is ${plan.status}; a pilot must approve it before the drone flies it`)
    }
    const { planId, approvedBy, approvedAt } = given.data
    if (planId !== plan.id || approvedBy !== plan.approvedBy || approvedAt !== plan.approvedAt) {
      throw new ApprovalRequiredError(
        `${runId}'s approval does not match ${plan.id}'s: ${plan.approvedBy} approved it at ${plan.approvedAt}`
      )
    }
    return given.data
  }

  return {
    tick,

    async listDevices() {
      return [...fleet.values()].map(({ spec }): DroneDevice => ({
        id: spec.id,
        provider: 'sim',
        name: spec.name,
        dockId: spec.dock.id,
        droneProfileId: spec.drone.id,
        simulated: true,
        source: 'provider'
      }))
    },

    async getStatus(deviceId) {
      tick()
      const device = fleet.get(deviceId)
      if (!device) throw new Error(`No simulated device ${deviceId}`)
      const at = clock.now()
      const flight = device.run?.flight
      let status: Pick<DroneStatus, 'state' | 'runId' | 'pose' | 'batteryWh'>
      if (flight) {
        const here = stateAt(flight.legs, (Date.parse(at) - flight.t0) / 1000)
        status = {
          state: 'in_flight',
          runId: device.run!.record.id,
          pose: here.pose,
          batteryWh: flight.startWh - here.wh
        }
      } else {
        status = { state: 'docked', runId: null, pose: device.pose, batteryWh: device.batteryWh }
      }
      const percent = (100 * status.batteryWh) / device.spec.drone.usableBatteryWh
      return structuredClone({ deviceId, ...status, batteryPercent: percent, at, simulated: true })
    },

    async schedulePatrol(input) {
      tick()
      const plan = PatrolPlan.parse(input)
      if (plan.waypoints.length === 0) throw new Error(`${plan.id} has no waypoints: every segment was rejected`)
      const device = [...fleet.values()].find(
        (d) => d.run === null && d.spec.dock.id === plan.dockId && d.spec.drone.id === plan.droneProfileId
      )
      if (!device) throw new Error(`No idle simulated device on ${plan.dockId} flies ${plan.droneProfileId}`)
      const record: PatrolRun = {
        id: `simrun_${runs.size + 1}`,
        planId: plan.id,
        deviceId: device.spec.id,
        status: 'scheduled',
        scheduledAt: clock.now(),
        dispatchedAt: null,
        approval: null,
        simulated: true,
        source: 'provider'
      }
      const run: Run = { record, plan, device, flight: null }
      runs.set(record.id, run)
      device.run = run
      return structuredClone(record)
    },

    async dispatchPatrol(runId, approval) {
      tick()
      const run = runState(runId)
      const { plan, record } = run
      if (record.status !== 'scheduled') throw new Error(`${runId} is ${record.status}, not scheduled`)
      const approved = checkApproval(runId, plan, approval)
      // Take-off and landing at the dock, and the transits from and to it, wait on the ground for the pilot to record
      // the dock clear (core's startPatrol refuses the same start). Held segments wait in flight.
      if (dockHold(plan)) {
        throw new ApprovalRequiredError(`${plan.id} holds the dock: the pilot must confirm it clear before take-off`)
      }
      const now = clock.now()
      const t0 = Date.parse(now)
      const at = { plan, spec: run.device.spec, record, t0 }
      checkFits(at, new Track(at.spec.drone, poseOf(plan.waypoints[0]!)), 1)
      const track = new Track(at.spec.drone, poseOf(plan.waypoints[0]!))
      const route: Timed[] = [
        { s: 0, event: { type: 'takeoff', ...eventFactory(record, t0)(0), planId: plan.id, pose: track.pose } }
      ]
      const wait = flyRoute(at, track, 1, route, { wait: true })
      run.flight = { t0, startWh: at.spec.drone.usableBatteryWh, legs: track.legs, route, queue: [], next: 0, wait }
      requeue(run, -Infinity)
      record.status = 'in_flight'
      record.dispatchedAt = now
      record.approval = approved
    },

    async updatePatrol(runId, input, approval) {
      tick()
      const run = runState(runId)
      if (run.record.status === 'scheduled') throw new Error(`${runId} is scheduled, not in flight`)
      // Landed, or cancelled and on its way home: a newer plan comes too late to change the flight.
      if (run.record.status !== 'in_flight') return
      const plan = PatrolPlan.parse(input)
      const approved = checkApproval(runId, plan, approval)
      const nowMs = Date.parse(clock.now())
      if (plan.id === run.plan.id) release(run, plan, nowMs)
      else switchTo(run, plan, nowMs)
      run.record.approval = approved
    },

    async cancelPatrol(runId) {
      tick()
      const run = runState(runId)
      const { record, device } = run
      if (record.status === 'scheduled') {
        record.status = 'cancelled'
        device.run = null
        return
      }
      if (record.status !== 'in_flight') throw new Error(`${runId} is already ${record.status}`)
      record.status = 'cancelled'
      // Drop what has not happened yet, fly straight over the dock at the current height, descend and land.
      const nowMs = Date.parse(clock.now())
      const flight = run.flight!
      const track = keepUntil(flight, device.spec.drone, (nowMs - flight.t0) / 1000)
      flyHome(track, device.spec.dock)
      flight.route.push(landing(record, flight, track, 'cancelled'))
      flight.legs.push(...track.legs)
      flight.wait = null
      requeue(run, nowMs)
    },

    onEvent(handler) {
      handlers.add(handler)
      return () => {
        handlers.delete(handler)
      }
    }
  }
}

/** Where a run's flight is decided: its plan, its aircraft, and its take-off time. */
interface FlightContext {
  plan: PatrolPlan
  spec: SimDevice
  record: PatrolRun
  t0: number
}

/**
 * The plan's waypoints are unchanged and its holds may be released. If the drone waits, or will wait, at a hold the
 * pilot has now released, it goes on from there at once (or does not stop on its way to it); once it has turned home
 * at the end of its wait, a release changes nothing.
 */
function release(run: Run, plan: PatrolPlan, nowMs: number) {
  if (JSON.stringify(plan.waypoints) !== JSON.stringify(run.plan.waypoints)) {
    throw new Error(`${plan.id}'s route changed after ${run.record.id} took off; a changed route needs a re-plan`)
  }
  run.plan = plan
  const flight = run.flight!
  const wait = flight.wait
  if (wait === null || holdBefore(plan, wait.index) !== null) return
  const nowS = (nowMs - flight.t0) / 1000
  if (nowS >= wait.untilS) return
  const track = keepUntil(flight, run.device.spec.drone, Math.max(nowS, wait.fromS))
  flight.wait = flyRoute(context(run), track, wait.index, flight.route, { wait: true })
  flight.legs.push(...track.legs)
  requeue(run, nowMs)
}

/**
 * An approved re-plan (#72) keeps the route's first `committedTasks` stops, and every waypoint up to their last
 * station, as they were, and replaces the rest. The drone keeps flying that prefix if it is still on it, then flies the
 * re-plan's waypoints after it. Past it (on its way to, or at, a stop the re-plan does not keep), it flies back along
 * the waypoints it came by to the prefix's last one, so it flies only legs a plan routed, then on. It refuses a re-plan
 * that does not keep its prefix, and one it could not fly from here inside the re-plan's window with its reserve.
 */
function switchTo(run: Run, next: PatrolPlan, nowMs: number) {
  const current = run.plan
  const { drone } = run.device.spec
  const kept = next.replan?.supersedes?.committedTasks
  if (kept === undefined) {
    throw new Error(`${next.id} is not a re-plan, so ${run.record.id} cannot switch to it from ${current.id} in flight`)
  }
  const currentEnd = prefixEnd(current, kept)
  const nextEnd = prefixEnd(next, kept)
  const prefix = (plan: PatrolPlan, end: number) => JSON.stringify(plan.waypoints.slice(0, end))
  if (kept > 0 && prefix(current, currentEnd) !== prefix(next, nextEnd)) {
    throw new Error(`${next.id} does not keep the first ${kept} stops of ${current.id}, which ${run.record.id} flies`)
  }
  const flight = run.flight!
  const nowS = (nowMs - flight.t0) / 1000
  const reached = flight.route.findLast(
    (t) => t.s <= nowS && (t.event.type === 'waypoint' || t.event.type === 'takeoff')
  )!
  const reachedIndex = reached.event.type === 'waypoint' ? reached.event.index : 0
  // Committed stops were reached, so the decided route reaches the prefix's last waypoint.
  const prefixLast = flight.route.find((t) => t.event.type === 'waypoint' && t.event.index === currentEnd - 1)!
  const hoverS = current.waypoints[currentEnd - 1]!.kind === 'station' ? assumedEnergyModel.stationHoverS : 0
  const leaveS = prefixLast.s + hoverS
  const at = { ...context(run), plan: next }

  // Still on the prefix: finish it (its last waypoint, and the frame there). Past it: back the way it came.
  const onPrefix = reachedIndex < currentEnd - 1 || nowS < leaveS
  const fromS = onPrefix ? leaveS : nowS
  const back = onPrefix ? [] : current.waypoints.slice(currentEnd - 1, reachedIndex + 1).toReversed()
  const flyBack = (track: Track) => {
    for (const waypoint of back) track.fly(poseOf(waypoint))
  }
  const here = stateAt(flight.legs, fromS)
  const trial = new Track(drone, here.pose, fromS, here.wh)
  flyBack(trial)
  if (nowMs < Date.parse(next.window.start)) {
    throw new OutsideWindowError(`${next.id} flies from ${next.window.start}; it is ${new Date(nowMs).toISOString()}`)
  }
  checkFits(at, trial, nextEnd)

  const track = keepUntil(flight, drone, fromS)
  flyBack(track)
  run.plan = next
  run.record.planId = next.id
  flight.wait = flyRoute(at, track, nextEnd, flight.route, { wait: true })
  flight.legs.push(...track.legs)
  requeue(run, nowMs)
}

/**
 * Throws unless the drone, flying the plan's waypoints from `from` on from `track` without waiting at any hold, lands
 * before the plan's window closes (`OutsideWindowError`) with at least the drone's reserve.
 */
function checkFits(at: FlightContext, track: Track, from: number) {
  const { plan, spec, record, t0 } = at
  flyRoute(at, track, from, [], { wait: false })
  const landsAt = new Date(t0 + track.s * 1000).toISOString()
  if (Date.parse(landsAt) >= Date.parse(plan.window.end)) {
    throw new OutsideWindowError(`${plan.id} would land at ${landsAt}, after its window closes at ${plan.window.end}`)
  }
  const leftWh = spec.drone.usableBatteryWh - track.wh
  if (leftWh < spec.drone.reserveWh) {
    throw new Error(
      `${record.id} would land ${plan.id} with ${leftWh.toFixed(1)} Wh, under the drone's ${spec.drone.reserveWh} Wh reserve`
    )
  }
}

/**
 * The waypoint index after a route's first `stops` stops: past their last station. With none, past the take-off and
 * the climb (the first station's index).
 */
function prefixEnd(plan: PatrolPlan, stops: number): number {
  if (stops > plan.tasks.length) throw new Error(`${plan.id} has ${plan.tasks.length} stops, not ${stops}`)
  if (stops === 0) return plan.waypoints.findIndex((w) => w.kind === 'station')
  const segmentId = plan.tasks[stops - 1]!.segmentId
  return plan.waypoints.findLastIndex((w) => w.segmentId === segmentId) + 1
}

/** The unreleased separation hold of the dock: its climb, its descent and the transits from and to it. */
function dockHold(plan: PatrolPlan): PlanHold | undefined {
  return plan.holds.find((h) => h.kind === 'separation' && h.segmentId === null && h.releasedBy === null)
}

/**
 * The unreleased separation hold the drone must wait for before waypoint `index`: a segment's hold before the
 * segment's first station (where the transit into it starts), and the dock's before the transit home.
 */
function holdBefore(plan: PatrolPlan, index: number): PlanHold | null {
  const waypoint = plan.waypoints[index]!
  if (waypoint.kind === 'station') {
    if (plan.waypoints[index - 1]!.segmentId === waypoint.segmentId) return null
    const held = plan.holds.find(
      (h) => h.kind === 'separation' && h.segmentId === waypoint.segmentId && h.releasedBy === null
    )
    return held ?? null
  }
  const home = index === plan.waypoints.length - 2 && index > 1 && waypoint.kind === 'transit'
  return (home && dockHold(plan)) || null
}

/**
 * Flies the plan's waypoints from `from` on (the drone is at waypoint `from - 1`, its frame taken), adding legs to
 * `track` and events to `route`. With `wait`, the drone hovers before a waypoint an unreleased separation hold keeps it
 * from: until the last moment the rest of the plan, flown without another wait, would still land before the window
 * closes with the drone's reserve, then straight home. Returns that wait, or null when it lands at the end of the plan.
 */
function flyRoute(
  at: FlightContext,
  track: Track,
  from: number,
  route: Timed[],
  { wait }: { wait: boolean }
): Wait | null {
  const { plan, spec, record, t0 } = at
  const event = eventFactory(record, t0)
  const waypoints = plan.waypoints
  for (let index = from; index < waypoints.length; index++) {
    const hold = wait ? holdBefore(plan, index) : null
    if (hold) {
      const fromS = track.s
      const rest = new Track(spec.drone, track.pose, track.s, track.wh)
      flyRoute(at, rest, index, [], { wait: false })
      const energyS = ((spec.drone.usableBatteryWh - spec.drone.reserveWh - rest.wh) * 3600) / spec.drone.hoverPowerW
      const windowS = (Date.parse(plan.window.end) - t0) / 1000 - rest.s
      const untilS = fromS + Math.max(0, Math.min(energyS, windowS))
      track.hover(untilS - fromS)
      flyHome(track, spec.dock)
      route.push({ s: track.s, event: landingEvent(event, track, spec.drone.usableBatteryWh, 'hold_timeout') })
      return { index, segmentId: hold.segmentId, fromS, untilS }
    }
    const waypoint = waypoints[index]!
    track.fly(poseOf(waypoint))
    const { s, pose } = track
    if (index === waypoints.length - 1) {
      route.push({ s, event: landingEvent(event, track, spec.drone.usableBatteryWh, 'completed') })
      return null
    }
    route.push({
      s,
      event: { type: 'waypoint', ...event(s), index, kind: waypoint.kind, segmentId: waypoint.segmentId, pose }
    })
    if (waypoint.kind === 'station') {
      route.push({
        s,
        event: {
          type: 'observation',
          ...event(s),
          waypointIndex: index,
          segmentId: waypoint.segmentId!,
          viewpointId: waypoint.viewpointId,
          zoom: waypoint.zoom,
          captureSource: 'drone',
          image: null,
          pose,
          quality: NOMINAL_QUALITY,
          privacyAction: 'none'
        }
      })
      track.hover(assumedEnergyModel.stationHoverS)
    }
  }
  throw new Error(`${plan.id} has no landing waypoint`)
}

function context(run: Run): FlightContext {
  return { plan: run.plan, spec: run.device.spec, record: run.record, t0: run.flight!.t0 }
}

/** Keeps the flight up to `s` seconds after take-off, dropping what was decided after, and returns a track from there. */
function keepUntil(flight: Flight, drone: DroneProfile, s: number): Track {
  const here = stateAt(flight.legs, s)
  flight.legs = flight.legs.filter((leg) => leg.startS < s).map((leg) => (leg.endS <= s ? leg : cut(leg, s, here)))
  flight.route = flight.route.filter((t) => t.s <= s)
  return new Track(drone, here.pose, s, here.wh)
}

/** Straight over the dock at the current height, then down onto it. */
function flyHome(track: Track, dock: Dock) {
  track.fly({ ...dockPose(dock, track.pose.headingDeg), altM: track.pose.altM })
  track.fly(dockPose(dock, track.pose.headingDeg))
}

function landing(record: PatrolRun, flight: Flight, track: Track, outcome: 'completed' | 'cancelled'): Timed {
  return { s: track.s, event: landingEvent(eventFactory(record, flight.t0), track, flight.startWh, outcome) }
}

function landingEvent(
  event: ReturnType<typeof eventFactory>,
  track: Track,
  startWh: number,
  outcome: Extract<ProviderEvent, { type: 'landed' }>['outcome']
): ProviderEvent {
  return { type: 'landed', ...event(track.s), outcome, pose: track.pose, remainingWh: startWh - track.wh }
}

/** Rebuilds the undelivered queue from the decided flight: its route events and battery samples after `afterMs`. */
function requeue(run: Run, afterMs: number) {
  const flight = run.flight!
  const event = eventFactory(run.record, flight.t0)
  const ahead = [...flight.route, ...batterySamples(flight.legs, flight.startWh, event)].filter(
    (t) => Date.parse(t.event.at) > afterMs
  )
  flight.queue = [...flight.queue.slice(0, flight.next), ...inOrder(ahead)]
}

/** Builds legs from a start pose, time and energy, with the planner's energy model. */
class Track {
  readonly legs: Leg[] = []

  constructor(
    private readonly drone: DroneProfile,
    public pose: Pose,
    public s = 0,
    public wh = 0
  ) {}

  /** Straight to `to`: cruise speed and power over the ground distance, hover power for any climb or descent. */
  fly(to: Pose) {
    const groundS = distance([this.pose.lon, this.pose.lat], [to.lon, to.lat], meters) / this.drone.cruiseSpeedMps
    const verticalS = Math.abs(to.altM - this.pose.altM) / assumedEnergyModel.verticalSpeedMps
    this.add(to, groundS + verticalS, (this.drone.cruisePowerW * groundS + this.drone.hoverPowerW * verticalS) / 3600)
  }

  hover(seconds: number) {
    this.add(this.pose, seconds, (this.drone.hoverPowerW * seconds) / 3600)
  }

  private add(to: Pose, durationS: number, wh: number) {
    this.legs.push({
      startS: this.s,
      endS: this.s + durationS,
      from: this.pose,
      to,
      startWh: this.wh,
      endWh: this.wh + wh
    })
    this.s += durationS
    this.wh += wh
    this.pose = to
  }
}

function eventFactory(record: PatrolRun, t0: number) {
  return (s: number) => ({
    runId: record.id,
    deviceId: record.deviceId,
    at: new Date(t0 + s * 1000).toISOString(),
    simulated: true
  })
}

function batterySamples(legs: Leg[], startWh: number, event: ReturnType<typeof eventFactory>) {
  const endS = legs.at(-1)!.endS
  const samples: Timed[] = []
  for (let s = BATTERY_SAMPLE_S; s < endS; s += BATTERY_SAMPLE_S) {
    const remainingWh = startWh - stateAt(legs, s).wh
    samples.push({ s, event: { type: 'battery', ...event(s), remainingWh, percent: (100 * remainingWh) / startWh } })
  }
  return samples
}

/** Stable by time, so events at the same moment keep the order they were made in. */
function inOrder(timed: Timed[]): ProviderEvent[] {
  return timed.toSorted((a, b) => a.s - b.s).map((t) => t.event)
}

function stateAt(legs: Leg[], s: number): { pose: Pose; wh: number } {
  const leg = legs.find((l) => s <= l.endS) ?? legs.at(-1)!
  const f = leg.endS === leg.startS ? 1 : Math.min(1, Math.max(0, (s - leg.startS) / (leg.endS - leg.startS)))
  const lerp = (a: number, b: number) => a + f * (b - a)
  return {
    pose: {
      lon: lerp(leg.from.lon, leg.to.lon),
      lat: lerp(leg.from.lat, leg.to.lat),
      altM: lerp(leg.from.altM, leg.to.altM),
      headingDeg: leg.to.headingDeg,
      pitchDeg: leg.to.pitchDeg
    },
    wh: lerp(leg.startWh, leg.endWh)
  }
}

function cut(leg: Leg, s: number, here: { pose: Pose; wh: number }): Leg {
  return { ...leg, endS: s, to: here.pose, endWh: here.wh }
}

function poseOf(w: Waypoint): Pose {
  return { lon: w.lon, lat: w.lat, altM: w.altM, headingDeg: w.headingDeg, pitchDeg: w.gimbalPitchDeg }
}

function dockPose(dock: Dock, headingDeg: number): Pose {
  return { lon: dock.position.lon, lat: dock.position.lat, altM: dock.position.altM, headingDeg, pitchDeg: 0 }
}
