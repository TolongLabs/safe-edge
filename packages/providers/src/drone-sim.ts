import {
  HumanApproval,
  PatrolPlan,
  type Dock,
  type DroneDevice,
  type DroneProfile,
  type DroneProvider,
  type DroneStatus,
  type PatrolRun,
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

interface Flight {
  /** Take-off time, epoch milliseconds. */
  t0: number
  startWh: number
  legs: Leg[]
  queue: ProviderEvent[]
  /** The first undelivered event in `queue`. */
  next: number
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
  plan: PatrolPlan
  device: DeviceState
  flight: Flight | null
}

/**
 * A headless, deterministic drone provider (TRD "SDK and provider adapters": `drone-sim`). It flies an approved plan's
 * waypoints with #71's stated energy model (`assumedEnergyModel`): cruise speed and power along the ground, hover power
 * for 3 m/s climbs and descents, and a hover at each camera station, where it takes a frame at the station's zoom. No
 * wind. Each flight starts on a full battery, because the dock charges between flights. It refuses a dispatch that
 * could not land before the plan's window closes. Browser-safe: the Three.js scene subscribes to it with `onEvent`.
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
      const given = HumanApproval.safeParse(approval)
      if (!given.success) throw new ApprovalRequiredError(`${runId} needs a pilot's approval of ${plan.id} to fly`)
      if (plan.status !== 'approved') {
        throw new ApprovalRequiredError(
          `${plan.id} was scheduled ${plan.status}; schedule it again once a pilot approves it`
        )
      }
      const { planId, approvedBy, approvedAt } = given.data
      if (planId !== plan.id || approvedBy !== plan.approvedBy || approvedAt !== plan.approvedAt) {
        throw new ApprovalRequiredError(
          `${runId}'s approval does not match ${plan.id}'s: ${plan.approvedBy} approved it at ${plan.approvedAt}`
        )
      }
      // A separation hold waits for a person to confirm the path is clear (core's releasePlanHold). The sim does not
      // model the wait at the segment, so it flies only a plan whose holds were released.
      const held = plan.holds.filter((h) => h.kind === 'separation' && h.releasedBy === null)
      if (held.length > 0) {
        const segments = held.map((h) => h.segmentId ?? 'the dock').join(', ')
        throw new ApprovalRequiredError(
          `${plan.id} holds ${segments}: the pilot must confirm the path is clear, then schedule the released plan`
        )
      }
      const now = clock.now()
      const flight = flyPlan(run, Date.parse(now))
      // The agreed window: the drone must be back on the dock before it closes.
      const landsAt = new Date(flight.t0 + flight.legs.at(-1)!.endS * 1000).toISOString()
      if (Date.parse(landsAt) >= Date.parse(plan.window.end)) {
        throw new OutsideWindowError(
          `${plan.id} would land at ${landsAt}, after its window closes at ${plan.window.end}`
        )
      }
      run.flight = flight
      record.status = 'in_flight'
      record.dispatchedAt = now
      record.approval = given.data
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
      returnToDock(run, Date.parse(clock.now()))
    },

    onEvent(handler) {
      handlers.add(handler)
      return () => {
        handlers.delete(handler)
      }
    }
  }
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

/** The whole flight, decided at dispatch: take-off now, every waypoint, a frame at each station, landing. */
function flyPlan(run: Run, t0: number): Flight {
  const { plan, device, record } = run
  const waypoints = plan.waypoints
  const startWh = device.spec.drone.usableBatteryWh
  const event = eventFactory(record, t0)
  const track = new Track(device.spec.drone, poseOf(waypoints[0]!))
  const timed: { s: number; event: ProviderEvent }[] = [
    { s: 0, event: { type: 'takeoff', ...event(0), planId: plan.id, pose: track.pose } }
  ]
  for (let index = 1; index < waypoints.length; index++) {
    if (waypoints[index - 1]!.kind === 'station') track.hover(assumedEnergyModel.stationHoverS)
    const waypoint = waypoints[index]!
    track.fly(poseOf(waypoint))
    const { s, pose } = track
    if (index === waypoints.length - 1) {
      timed.push({
        s,
        event: { type: 'landed', ...event(s), outcome: 'completed', pose, remainingWh: startWh - track.wh }
      })
      break
    }
    timed.push({
      s,
      event: { type: 'waypoint', ...event(s), index, kind: waypoint.kind, segmentId: waypoint.segmentId, pose }
    })
    if (waypoint.kind === 'station') {
      timed.push({
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
    }
  }
  const legs = track.legs
  return { t0, startWh, legs, queue: inOrder([...timed, ...batterySamples(legs, startWh, event)]), next: 0 }
}

/**
 * A cancel in flight: drop what has not happened yet, fly straight over the dock at the current height, descend and
 * land. Battery samples continue on the way back.
 */
function returnToDock(run: Run, nowMs: number) {
  const flight = run.flight!
  const { dock, drone } = run.device.spec
  const s = (nowMs - flight.t0) / 1000
  const here = stateAt(flight.legs, s)
  const track = new Track(drone, here.pose, s, here.wh)
  track.fly({ ...dockPose(dock, here.pose.headingDeg), altM: here.pose.altM })
  track.fly(dockPose(dock, here.pose.headingDeg))
  const flown = flight.legs.filter((leg) => leg.startS < s).map((leg) => (leg.endS <= s ? leg : cut(leg, s, here)))
  flight.legs = [...flown, ...track.legs]
  const event = eventFactory(run.record, flight.t0)
  const landed: ProviderEvent = {
    type: 'landed',
    ...event(track.s),
    outcome: 'cancelled',
    pose: track.pose,
    remainingWh: flight.startWh - track.wh
  }
  const ahead = batterySamples(flight.legs, flight.startWh, event).filter((t) => Date.parse(t.event.at) > nowMs)
  flight.queue = [...flight.queue.slice(0, flight.next), ...inOrder([...ahead, { s: track.s, event: landed }])]
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
  const samples: { s: number; event: ProviderEvent }[] = []
  for (let s = BATTERY_SAMPLE_S; s < endS; s += BATTERY_SAMPLE_S) {
    const remainingWh = startWh - stateAt(legs, s).wh
    samples.push({ s, event: { type: 'battery', ...event(s), remainingWh, percent: (100 * remainingWh) / startWh } })
  }
  return samples
}

/** Stable by time, so events at the same moment keep the order they were made in. */
function inOrder(timed: { s: number; event: ProviderEvent }[]): ProviderEvent[] {
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
