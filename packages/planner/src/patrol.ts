import { bearing } from '@turf/bearing'
import { booleanIntersects } from '@turf/boolean-intersects'
import { destination } from '@turf/destination'
import { distance } from '@turf/distance'
import { lineString, multiLineString, point, polygon } from '@turf/helpers'
import { nearestPointOnLine } from '@turf/nearest-point-on-line'
import {
  PatrolPlan,
  type ContextSnapshot,
  type Dock,
  type DroneProfile,
  type PatrolTask,
  type PlanHold,
  type PlanReplan,
  type PriorityScore,
  type Waypoint
} from '@safe-edge/contracts'
import type { Feature, LineString, MultiPolygon, Point, Polygon, Position } from 'geojson'
import { rankingPriority, scorePriority, type ScoreInputs } from './score.ts'
import {
  ASSEMBLY_M,
  closest,
  dockHold,
  isAssembly,
  keepSeparation,
  nearby,
  SEPARATION_M,
  separationHold,
  separationReason,
  type DockTransit,
  type Nearby,
  type Separation,
  type ThirdParty
} from './separation.ts'
import type { Edge, Segment } from './segments.ts'
import { planStations, type Rejection, type SegmentTask, type SegmentViewpoint, type Station } from './stations.ts'
import { flightWindow, weatherBlockers } from './window.ts'

const meters = { units: 'meters' } as const

/**
 * A stated assumption, not an aircraft figure, until an aircraft is chosen (TRD "Patrol planner" step 6). Horizontal
 * flight runs at the drone profile's cruise speed and draws its cruise power. Climbs and descents run at
 * `verticalSpeedMps` on hover power, and the aircraft hovers `stationHoverS` at each camera station to capture. No wind,
 * payload, temperature or battery-ageing effects.
 */
export const assumedEnergyModel = {
  label:
    'Assumed energy model, not an aircraft figure: cruise power at cruise speed, hover power for 3 m/s climbs and a 3 s hover per station, no wind',
  verticalSpeedMps: 3,
  stationHoverS: 3
} as const

/**
 * CAR 2016 regulation 143(1)(a), (b): no flight "over any designated area" or "within 150 metres of any designated
 * area" without the Director General's authorisation, where (3) a designated area is "any area which is used for
 * residential, commercial, industrial or recreational purposes".
 */
export const DESIGNATED_AREA_M = 150

/** A hard limit on the plan, never a score penalty. */
export interface Geofence {
  id: string
  /**
   * `no_fly`: the aircraft never enters it. `no_capture` (homes, playgrounds): no camera frame may cover it.
   * `designated_area` (CAR 2016 reg. 143(3)): without an `authorisation`, the aircraft stays more than 150 m from it.
   */
  kind: 'no_fly' | 'no_capture' | 'designated_area'
  label: string
  geometry: Polygon | MultiPolygon
  simulated: boolean
  source: string
}

export interface PatrolPlanInput extends ScoreInputs {
  /** `plan_…`, from core's ID generator. `now` (from core's clock) becomes `createdAt`. */
  id: string
  /** The edges the segments came from. */
  edges: Edge[]
  /** The selected segments, from `splitEdges`. */
  segments: Segment[]
  /** The patrol takes off from and lands back on this dock. */
  dock: Dock
  drone: DroneProfile
  /** Camera slant range and forward overlap: see `planStations`. */
  rangeM: number
  forwardOverlap: number
  /** The segments' fixed viewpoints: the station nearest each carries its ID (see `planStations`). */
  viewpoints: SegmentViewpoint[]
  /** Flight height above the edge, at most `altitudeCapM`. */
  altitudeM: number
  /** The cap agreed with air traffic control. */
  altitudeCapM: number
  /** The launch is no earlier than this. The window opens at the next first light at the dock, or later for weather. */
  notBefore: string
  /** How long the agreed window stays open after first light. The route must land before it closes. */
  windowMinutes: number
  geofences: Geofence[]
  /** The Director General's authorisation to fly over and within 150 m of designated areas, or null without one. */
  authorisation: FlightAuthorisation | null
  /** People, vessels, vehicles and structures not under the pilot's control, from observations or the map. */
  thirdParties: ThirdParty[]
  /**
   * How long the drone may hover before a held segment for the pilot or observer to confirm its path is clear. It counts
   * against the battery and the window like flying does.
   */
  separationWaitS: number
}

/** An authorisation from the Director General of Civil Aviation (CAR 2016 reg. 143(1), applied for under reg. 189). */
export interface FlightAuthorisation {
  /** Its reference, as the pilot should quote it. */
  ref: string
  simulated: boolean
  source: string
}

interface Candidate {
  task: SegmentTask
  /** The stations left after no-capture zones and separation, in flight-line order. */
  stations: Station[]
  /** Stations that wait for a clear pass. */
  waiting: Separation['waiting']
  /** People, vessels and vehicles near its flight line between stations that are clear of them. */
  flightLine: Nearby[]
  priority: PriorityScore
  rank: number
  /** Flying from the first station to the last and hovering at each, without a wait for a clear path. */
  energyWh: number
  durationS: number
}

interface Stop {
  candidate: Candidate
  /** Flown from its last station to its first. */
  reversed: boolean
}

/**
 * What keeps a leg out of the route: a zone it may not enter or come near, a structure within 50 m, or an assembly of
 * more than 1,000 persons within 150 m.
 */
type Blocker = { zone: Geofence } | { party: Nearby }

interface Insertion extends Stop {
  /** Route position: 0 is straight after take-off. */
  index: number
  addedWh: number
  addedS: number
  blockedBy: Blocker[]
}

/**
 * Scores the selected segments and builds a battery-aware route from the dock and back inside a flight window (TRD
 * "Patrol planner" steps 2 to 4). The window opens at first light, or later when the weather gate holds the launch
 * (see `flightWindow`). Greedy insertion adds, at its cheapest place in the route, the task with the highest priority
 * per added watt-hour, while the whole route, return included, stays within the usable battery minus the reserve and
 * lands before the window closes. Geofences are hard limits. Stations keep 50 m from third parties, standing further
 * off with zoom or waiting for a clear pass (see `keepSeparation`). The plan comes back `proposed`: only a pilot's
 * approval lets it fly.
 */
export function planPatrol(input: PatrolPlanInput): PatrolPlan {
  return planFresh(input, null)
}

/** A plan from take-off, with its window and launch holds from the weather gate. */
export function planFresh(input: PatrolPlanInput, replan: PlanReplan | null): PatrolPlan {
  const { window, holds } = flightWindow({
    at: [input.dock.position.lon, input.dock.position.lat],
    notBefore: input.notBefore,
    windowMinutes: input.windowMinutes,
    rainLimitMmPerH: input.dock.rainLimitMmPerH,
    context: input.context
  })
  return buildPlan(input, { window, holds, replan, committed: null })
}

/** How a route starts: from take-off, or after the committed stops of a plan being re-planned. */
export interface RouteStart {
  window: PatrolPlan['window']
  holds: PlanHold[]
  replan: PlanReplan | null
  /** Stops already flown or in progress, kept exactly as planned; null for a route that starts at take-off. */
  committed: {
    tasks: PatrolTask[]
    /** Every waypoint up to and including the last committed station. */
    waypoints: Waypoint[]
    rejected: Rejection[]
    simulated: boolean
  } | null
}

export function buildPlan(input: PatrolPlanInput, start: RouteStart): PatrolPlan {
  const { dock, drone, altitudeM, altitudeCapM, geofences } = input
  const { window, committed } = start
  const holds = [...start.holds]
  if (!dock.droneProfileIds.includes(drone.id)) throw new Error(`dock ${dock.id} does not take drone ${drone.id}`)
  if (altitudeM > altitudeCapM) throw new RangeError(`altitude ${altitudeM} m is above the ${altitudeCapM} m cap`)

  const flyS = (a: Position, b: Position) => distance(a, b, meters) / drone.cruiseSpeedMps
  const flyWh = (a: Position, b: Position) => (drone.cruisePowerW * flyS(a, b)) / 3600
  const hoverWh = (drone.hoverPowerW * assumedEnergyModel.stationHoverS) / 3600
  const climbS = Math.abs(altitudeM - dock.position.altM) / assumedEnergyModel.verticalSpeedMps
  const climbWh = (drone.hoverPowerW * climbS) / 3600
  const dockAt: Position = [dock.position.lon, dock.position.lat]
  const startMs = Date.parse(window.start)

  // The route goes on from the dock after the climb, or from the last committed station after its hover.
  const lastCommitted = committed?.waypoints.at(-1)
  const from: Position = lastCommitted ? [lastCommitted.lon, lastCommitted.lat] : dockAt
  const departS = lastCommitted
    ? (Date.parse(lastCommitted.eta) - startMs) / 1000 + assumedEnergyModel.stationHoverS
    : climbS
  const departWh = lastCommitted ? lastCommitted.energyWh + hoverWh : climbWh

  const noFly = geofences.filter((g) => g.kind === 'no_fly')
  const noCapture = geofences.filter((g) => g.kind === 'no_capture')
  const designated = geofences.filter((g) => g.kind === 'designated_area')
  // Without an authorisation, a designated area keeps the aircraft 150 m away, as a no-fly zone would.
  const keptFrom = [...noFly, ...(input.authorisation ? [] : designated)]
  // People, vessels and vehicles move away, so a leg near them waits for the pilot or observer to see it clear. A
  // structure stays put, and the plan keeps clear of an assembly rather than wait for it to break up: no leg flies within
  // 50 m of a structure or 150 m of an assembly, and one that close to the dock keeps every patrol on the ground.
  const movable = input.thirdParties.filter((p) => p.kind !== 'structure')
  const structures = input.thirdParties.filter((p) => p.kind === 'structure')
  const assemblies = input.thirdParties.filter(isAssembly)
  const keptClear = (path: Position[]) => [
    ...nearby(path, structures, SEPARATION_M),
    ...nearby(path, assemblies, ASSEMBLY_M)
  ]
  const byDock = committed ? [] : keptClear([dockAt])
  const legBlockers = memo((a: Position, b: Position): Blocker[] => {
    const path = samePosition(a, b) ? point(a) : lineString([a, b])
    return [
      ...keptFrom
        .filter((zone) => within(path, zone, zone.kind === 'designated_area' ? DESIGNATED_AREA_M : 0))
        .map((zone) => ({ zone })),
      ...keptClear(samePosition(a, b) ? [a] : [a, b]).map((party) => ({ party }))
    ]
  })
  const legNear = memo((a: Position, b: Position) => nearby(samePosition(a, b) ? [a] : [a, b], movable, SEPARATION_M))

  const committedIds = new Set(committed?.tasks.map((t) => t.segmentId))
  const open = input.segments.filter((s) => !committedIds.has(s.id))
  // A drone already flying returns after its committed stops while rain above the dock's limit or lightning holds.
  const grounding = committed
    ? weatherBlockers(input.context, dock.rainLimitMmPerH, Math.max(startMs + departS * 1000, Date.parse(input.now)))
    : []
  const stationPlan = planStations({
    ...input,
    segments: grounding.length > 0 || byDock.length > 0 ? [] : open,
    camera: drone.camera
  })
  const waterOf = (segmentId: string) => {
    const { assetId } = input.segments.find((s) => s.id === segmentId)!
    return polygon([input.edges.find((e) => e.assetId === assetId)!.geometry.coordinates])
  }
  const rejected: Rejection[] = [...stationPlan.rejected]
  if (grounding.length > 0) {
    const reason = `${groundingReason(grounding, dock.rainLimitMmPerH)}; the drone returns to the dock after its committed stops`
    rejected.push(...open.map((s) => ({ segmentId: s.id, code: 'weather_hold' as const, reason })))
  }
  if (byDock.length > 0) {
    const { code, reason } = keptOut(
      byDock.map((party) => ({ party })),
      `the climb from ${dock.name}`,
      'enters'
    )
    const grounded = `${reason}; no patrol can take off or land there`
    rejected.push(...open.map((s) => ({ segmentId: s.id, code, reason: grounded })))
  }
  const pending: Candidate[] = []
  for (const task of stationPlan.tasks) {
    const { segmentId } = task
    const framed = task.stations.map((station) => ({
      station,
      zones: noCapture.filter((zone) => booleanIntersects(frame(station, task.footprint), zone.geometry))
    }))
    const framedIn = framed.filter((f) => f.zones.length === 0).map((f) => f.station)
    const excluded = framed.filter((f) => f.zones.length > 0)
    if (excluded.length > 0) {
      const zones = labels(excluded.flatMap((f) => f.zones))
      const reason =
        framedIn.length === 0
          ? `every station's frame would cover no-capture zone ${zones}`
          : `stations ${excluded.map((f) => f.station.id).join(', ')} left out: their frames would cover no-capture zone ${zones}; the rest of the segment is planned`
      rejected.push({ segmentId, code: 'geofence', reason })
      if (framedIn.length === 0) continue
    }
    const { stations, waiting, dropped } = keepSeparation(framedIn, input.thirdParties, {
      water: waterOf(task.segmentId),
      altitudeM,
      rangeM: input.rangeM,
      maxZoom: drone.camera.maxZoom
    })
    if (dropped.length > 0) {
      const reason = separationReason(dropped, stations.length === 0, drone.camera.maxZoom)
      rejected.push({ segmentId, code: 'separation_hold', reason })
      if (stations.length === 0) continue
    }
    const legs =
      stations.length === 1 ? [[stations[0]!, stations[0]!]] : stations.slice(1).map((s, i) => [stations[i]!, s])
    const crossed = legs.flatMap(([a, b]) => legBlockers(position(a!), position(b!)))
    if (crossed.length > 0) {
      rejected.push({ segmentId, ...keptOut(crossed, 'its flight line', 'enters') })
      continue
    }
    const priority = scorePriority(segmentId, input)
    const flownWh = stations.slice(1).reduce((wh, s, i) => wh + flyWh(position(stations[i]!), position(s)), 0)
    const flownS = stations.slice(1).reduce((t, s, i) => t + flyS(position(stations[i]!), position(s)), 0)
    // Legs between stations that are clear themselves can still pass close; the parties waiting stations name already
    // hold the segment.
    const waitedFor = new Set(waiting.flatMap((w) => w.parties))
    pending.push({
      task,
      stations,
      waiting,
      flightLine: stations
        .slice(1)
        .flatMap((s, i) => legNear(position(stations[i]!), position(s)))
        .filter((n) => !waitedFor.has(n.party)),
      priority,
      rank: rankingPriority(priority),
      energyWh: flownWh + stations.length * hoverWh,
      durationS: flownS + stations.length * assumedEnergyModel.stationHoverS
    })
  }

  const route: Stop[] = []
  // A stop waits once for a clear path, before the first part of it that is too close: the transit into it from the
  // stop before, a station or its flight line. The transits from and to the dock are the dock's (see `dockHold`).
  const waitS = input.separationWaitS
  const waitWh = (drone.hoverPowerW * waitS) / 3600
  const transitNear = (stop: Stop, previous: Position, fromDock: boolean) =>
    fromDock ? [] : legNear(previous, ends(stop)[0])
  const waits = (stop: Stop, previous: Position, fromDock: boolean) =>
    stop.candidate.waiting.length > 0 ||
    stop.candidate.flightLine.length > 0 ||
    transitNear(stop, previous, fromDock).length > 0
      ? 1
      : 0
  const budgetWh = drone.usableBatteryWh - drone.reserveWh
  // So far: flying up to the start of the route, straight home from there, and the descent.
  let usedWh = departWh + flyWh(from, dockAt) + climbWh
  // The route must land before the window closes.
  const windowS = (Date.parse(window.end) - startMs) / 1000
  let usedS = departS + flyS(from, dockAt) + climbS
  const insertions = (candidate: Candidate): Insertion[] =>
    Array.from({ length: route.length + 1 }, (_, index) => {
      const before = index === 0 ? from : ends(route[index - 1]!)[1]
      const fromDock = index === 0 && !committed
      const next = route[index]
      const after = next ? ends(next)[0] : dockAt
      return [false, true].map((reversed): Insertion => {
        const stop = { candidate, reversed }
        const [entry, exit] = ends(stop)
        // Its own wait, and the next stop's, whose transit now comes from this one.
        const addedWaits =
          waits(stop, before, fromDock) + (next ? waits(next, exit, false) - waits(next, before, fromDock) : 0)
        return {
          candidate,
          reversed,
          index,
          addedWh:
            flyWh(before, entry) + candidate.energyWh + flyWh(exit, after) - flyWh(before, after) + addedWaits * waitWh,
          addedS:
            flyS(before, entry) + candidate.durationS + flyS(exit, after) - flyS(before, after) + addedWaits * waitS,
          blockedBy: [...legBlockers(before, entry), ...legBlockers(exit, after)]
        }
      })
    }).flat()

  for (;;) {
    const best = pending
      .flatMap(insertions)
      .filter((ins) => ins.blockedBy.length === 0 && usedWh + ins.addedWh <= budgetWh && usedS + ins.addedS <= windowS)
      .reduce<Insertion | null>((a, b) => (a && !betterInsertion(b, a) ? a : b), null)
    if (!best) break
    route.splice(best.index, 0, { candidate: best.candidate, reversed: best.reversed })
    usedWh += best.addedWh
    usedS += best.addedS
    pending.splice(pending.indexOf(best.candidate), 1)
  }

  for (const candidate of pending) {
    const { segmentId } = candidate.task
    const options = insertions(candidate)
    const clear = options.filter((o) => o.blockedBy.length === 0)
    // An insertion the battery could take was left out because the window closes first.
    const charged = clear.filter((o) => usedWh + o.addedWh <= budgetWh)
    rejected.push(
      clear.length === 0
        ? {
            segmentId,
            ...keptOut(
              options.flatMap((o) => o.blockedBy),
              'every straight transit to it',
              'crosses'
            )
          }
        : charged.length > 0
          ? {
              segmentId,
              code: 'outside_window',
              reason: `needs ${(Math.min(...charged.map((o) => o.addedS)) / 60).toFixed(1)} min more; ${((windowS - usedS) / 60).toFixed(1)} min left before the window closes at ${window.end}`
            }
          : {
              segmentId,
              code: 'battery',
              reason: `needs ${Math.min(...clear.map((o) => o.addedWh)).toFixed(1)} Wh more; ${(budgetWh - usedWh).toFixed(1)} Wh is left above the ${drone.reserveWh} Wh reserve`
            }
    )
  }

  // Every route that flies takes off from the dock (unless it is already flying) and lands back on it.
  if (committed || route.length > 0) {
    const segmentOf = (stop: Stop) => stop.candidate.task.segmentId
    const last = route.at(-1)
    const back: DockTransit = {
      from: last ? segmentOf(last) : committed!.tasks.at(-1)!.segmentId,
      to: dock.name,
      leg: [last ? ends(last)[1] : from, dockAt]
    }
    const transits: DockTransit[] = committed
      ? [back]
      : [{ from: dock.name, to: segmentOf(route[0]!), leg: [dockAt, ends(route[0]!)[0]] }, back]
    const hold = dockHold(dock, input.thirdParties, transits)
    if (hold) holds.push(hold)
  }

  // A held stop waits at the last waypoint before the first leg that is too close, where the drone is clear of them.
  const waitsBefore = new Set<string>()
  const held = new Set<Stop>()
  route.forEach((stop, i) => {
    const { candidate } = stop
    const previous = i === 0 ? from : ends(route[i - 1]!)[1]
    const fromDock = i === 0 && !committed
    if (!waits(stop, previous, fromDock)) return
    const transit = transitNear(stop, previous, fromDock)
    const waitingIds = new Set(candidate.waiting.map((w) => w.station.id))
    const stations = ordered(stop, candidate.stations)
    const first = stations.find(
      (s, k) =>
        waitingIds.has(s.id) ||
        (k === 0 ? transit.length > 0 : legNear(position(stations[k - 1]!), position(s)).length > 0)
    )!
    waitsBefore.add(first.id)
    held.add(stop)
    // A transit into a stop comes from the stop before it, or from the last committed one.
    const previousSegment = () =>
      i === 0 ? committed!.tasks.at(-1)!.segmentId : route[i - 1]!.candidate.task.segmentId
    holds.push(
      separationHold(
        candidate.task.segmentId,
        {
          waiting: candidate.waiting,
          flightLine: candidate.flightLine,
          transit: transit.length > 0 ? { from: previousSegment(), to: candidate.task.segmentId, near: transit } : null
        },
        { waitS, before: first }
      )
    )
  })

  const flown = route.flatMap((stop) =>
    ordered(stop, stop.candidate.stations).map((station) => ({ station, segmentId: stop.candidate.task.segmentId }))
  )
  const waypoints: Waypoint[] = [...(committed?.waypoints ?? [])]
  let clockS = 0
  let energyWh = 0
  const arrive = (
    kind: Waypoint['kind'],
    at: Position,
    pose: Omit<Waypoint, 'lon' | 'lat' | 'kind' | 'eta' | 'energyWh'>
  ) =>
    waypoints.push({
      lon: at[0]!,
      lat: at[1]!,
      ...pose,
      kind,
      eta: new Date(startMs + clockS * 1000).toISOString(),
      energyWh
    })
  // A drone already flying always comes home; a route from take-off flies only when it has stops.
  if (committed || flown.length > 0) {
    const home = bearing(flown.length > 0 ? position(flown.at(-1)!.station) : from, dockAt)
    const atDock = (altM: number, headingDeg: number) =>
      ({ altM, headingDeg, gimbalPitchDeg: 0, zoom: 1, viewpointId: null, segmentId: null }) as const
    let at = from
    const fly = (to: Position) => {
      clockS += flyS(at, to)
      energyWh += flyWh(at, to)
      at = to
    }
    if (committed) {
      clockS = departS
      energyWh = departWh
    } else {
      const out = bearing(dockAt, position(flown[0]!.station))
      arrive('takeoff', dockAt, atDock(dock.position.altM, out))
      clockS += climbS
      energyWh += climbWh
      arrive('transit', dockAt, atDock(altitudeM, out))
    }
    for (const { station, segmentId } of flown) {
      if (waitsBefore.has(station.id)) {
        clockS += waitS
        energyWh += waitWh
      }
      fly(position(station))
      arrive('station', at, { ...station.pose, viewpointId: station.viewpointId, segmentId })
      clockS += assumedEnergyModel.stationHoverS
      energyWh += hoverWh
    }
    fly(dockAt)
    arrive('transit', dockAt, atDock(altitudeM, home))
    clockS += climbS
    energyWh += climbWh
    arrive('landing', dockAt, atDock(dock.position.altM, home))
  }
  const ground = [...dockAt, dock.position.altM]
  // What the authorisation covers on this route; without one, the route keeps 150 m from every designated area.
  const routeLine = input.authorisation && waypoints.length > 0 && lineString(waypoints.map((w) => [w.lon, w.lat]))
  const overflown = routeLine ? designated.filter((zone) => within(routeLine, zone, DESIGNATED_AREA_M)) : []

  return PatrolPlan.parse({
    id: input.id,
    createdAt: input.now,
    status: 'proposed',
    dockId: dock.id,
    returnDockId: dock.id,
    droneProfileId: drone.id,
    context: input.context,
    window,
    altitudeCapM,
    holds,
    tasks: [
      ...(committed?.tasks ?? []),
      ...route.map((stop) => ({
        segmentId: stop.candidate.task.segmentId,
        flightLine: { type: 'LineString', coordinates: ordered(stop, stop.candidate.task.flightLine.coordinates) },
        stations: ordered(stop, stop.candidate.stations).map((s) => ({ ...s.pose, viewpointId: s.viewpointId })),
        priority: stop.candidate.priority,
        energyWh: stop.candidate.energyWh + (held.has(stop) ? waitWh : 0)
      }))
    ],
    waypoints,
    route: {
      type: 'LineString',
      coordinates: waypoints.length > 0 ? waypoints.map((w) => [w.lon, w.lat, w.altM]) : [ground, ground]
    },
    energyWh,
    reserveWh: drone.usableBatteryWh - energyWh,
    rejected: [...(committed?.rejected ?? []), ...rejected],
    authorisation:
      input.authorisation && overflown.length > 0
        ? {
            ref: input.authorisation.ref,
            reason: `the route flies over or within ${DESIGNATED_AREA_M} m of designated area ${labels(overflown)} (CAR 2016 reg. 143(1)(a), (b))`,
            simulated: input.authorisation.simulated
          }
        : null,
    replan: start.replan,
    approvedBy: null,
    approvedAt: null,
    simulated:
      committed?.simulated === true ||
      [dock, drone, ...input.segments, ...input.context, ...geofences, ...input.thirdParties].some(
        (r) => r.simulated
      ) ||
      input.authorisation?.simulated === true,
    source: 'system'
  })
}

/** Why a drone in flight must come home: the readings and warnings that ground it. */
function groundingReason(grounding: ContextSnapshot[], rainLimitMmPerH: number): string {
  return grounding
    .map((c) =>
      c.kind === 'rainfall'
        ? `rain ${c.value} mm/h at ${c.publisher}${c.stationId ? ` station ${c.stationId}` : ''} (observed ${c.observedAt}) is above the dock's ${rainLimitMmPerH} mm/h limit`
        : `lightning warning from ${c.publisher} is in force until ${c.validTo}`
    )
    .join('; ')
}

/** Highest priority per added watt-hour; on a tie, the cheaper insertion. */
function betterInsertion(a: Insertion, b: Insertion): boolean {
  const ratioA = a.candidate.rank / a.addedWh
  const ratioB = b.candidate.rank / b.addedWh
  return ratioA > ratioB || (ratioA === ratioB && a.addedWh < b.addedWh)
}

/** Where a stop is entered and left. */
function ends(stop: Stop): [Position, Position] {
  const first = position(stop.candidate.stations[0]!)
  const last = position(stop.candidate.stations.at(-1)!)
  return stop.reversed ? [last, first] : [first, last]
}

function ordered<T>(stop: Stop, items: T[]): T[] {
  return stop.reversed ? items.toReversed() : items
}

function position(station: Station): Position {
  return [station.pose.lon, station.pose.lat]
}

/**
 * The station's first-order frame on the ground (as `SegmentTask.footprint`): a rectangle centred on the aim point,
 * `alongEdgeM` wide across the line of sight and `acrossEdgeM` deep along it. An oblique frame reaches further back.
 */
function frame(station: Station, footprint: SegmentTask['footprint']) {
  const heading = station.pose.headingDeg
  const move = (from: Position, byM: number, deg: number) =>
    destination(from, Math.abs(byM), byM < 0 ? deg + 180 : deg, meters).geometry.coordinates
  const corner = (along: number, deep: number) =>
    move(
      move(station.aim, (deep * footprint.acrossEdgeM) / 2, heading),
      (along * footprint.alongEdgeM) / 2,
      heading + 90
    )
  const ring = [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)]
  return polygon([[...ring, ring[0]!]])
}

/**
 * Why a flight line, transit or climb is out: a no-fly zone it enters or crosses; else the designated areas it comes
 * within 150 m of without an authorisation and the assemblies it comes within 150 m of; else the structures it comes
 * within 50 m of.
 */
function keptOut(
  blockers: Blocker[],
  what: string,
  verb: 'enters' | 'crosses'
): { code: 'geofence' | 'authorisation' | 'separation_hold'; reason: string } {
  const zones = blockers.flatMap((b) => ('zone' in b ? [b.zone] : []))
  const parties = blockers.flatMap((b) => ('party' in b ? [b.party] : []))
  const assemblies = parties.filter((n) => isAssembly(n.party))
  const noFly = zones.filter((z) => z.kind === 'no_fly')
  if (noFly.length > 0) return { code: 'geofence', reason: `${what} ${verb} no-fly zone ${labels(noFly)}` }
  const unauthorised = [
    ...(zones.length > 0
      ? [
          `${what} comes within ${DESIGNATED_AREA_M} m of designated area ${labels(zones)} without the Director General's authorisation (CAR 2016 reg. 143(1)(a), (b))`
        ]
      : []),
    ...(assemblies.length > 0
      ? [
          `${what} comes within ${ASSEMBLY_M} m of ${closest(assemblies)}, an assembly in the open air of more than 1,000 persons (CAR 2016 reg. 143(1)(c), (d))`
        ]
      : [])
  ]
  if (unauthorised.length > 0) return { code: 'authorisation', reason: unauthorised.join('; ') }
  return {
    code: 'separation_hold',
    reason: `${what} comes within ${SEPARATION_M} m of ${closest(parties)}, which waiting would not clear`
  }
}

/**
 * Whether a path comes within `m` metres of a zone (`m` = 0: touches it). Apart from crossing, the nearest two
 * polylines come is at a vertex of one of them, so checking each vertex against the other line is exact.
 */
function within(path: Feature<Point | LineString>, zone: Geofence, m: number): boolean {
  const rings = zone.geometry.type === 'Polygon' ? zone.geometry.coordinates : zone.geometry.coordinates.flat()
  const vertices = path.geometry.type === 'Point' ? [path.geometry.coordinates] : path.geometry.coordinates
  if (!boxesMeet(vertices, rings.flat(), m)) return false
  if (booleanIntersects(path, zone.geometry)) return true
  if (m === 0) return false
  const edge = multiLineString(rings)
  if (vertices.some((v) => nearestPointOnLine(edge, v, meters).properties.pointDistance <= m)) return true
  if (path.geometry.type === 'Point') return false
  const line = path.geometry
  return rings.flat().some((v) => nearestPointOnLine(line, v, meters).properties.pointDistance <= m)
}

/** Whether the bounding boxes of two sets of points come within `m` metres (a cheap test before the exact one). */
function boxesMeet(a: Position[], b: Position[], m: number): boolean {
  const box = (ps: Position[]) => {
    const lons = ps.map((p) => p[0]!)
    const lats = ps.map((p) => p[1]!)
    return [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)] as const
  }
  const [aWest, aSouth, aEast, aNorth] = box(a)
  const [bWest, bSouth, bEast, bNorth] = box(b)
  // A degree of latitude is at least 110.5 km; dividing by less errs towards the exact test.
  const dLat = m / 110_000
  const dLon = dLat / Math.cos(((aSouth + aNorth) / 2) * (Math.PI / 180))
  return aWest <= bEast + dLon && bWest <= aEast + dLon && aSouth <= bNorth + dLat && bSouth <= aNorth + dLat
}

function labels(zones: Geofence[]): string {
  return [...new Set(zones.map((z) => `"${z.label}"`))].join(', ')
}

function samePosition(a: Position, b: Position): boolean {
  return a[0] === b[0] && a[1] === b[1]
}

function memo<R>(fn: (a: Position, b: Position) => R): (a: Position, b: Position) => R {
  const cache = new Map<string, R>()
  return (a, b) => {
    const key = `${a[0]},${a[1]};${b[0]},${b[1]}`
    if (!cache.has(key)) cache.set(key, fn(a, b))
    return cache.get(key)!
  }
}
