import { bearing } from '@turf/bearing'
import { booleanIntersects } from '@turf/boolean-intersects'
import { destination } from '@turf/destination'
import { distance } from '@turf/distance'
import { lineString, point, polygon } from '@turf/helpers'
import { PatrolPlan, type Dock, type DroneProfile, type PriorityScore, type Waypoint } from '@safe-edge/contracts'
import type { MultiPolygon, Polygon, Position } from 'geojson'
import { rankingPriority, scorePriority, type ScoreInputs } from './score.ts'
import type { Edge, Segment } from './segments.ts'
import { planStations, type Rejection, type SegmentTask, type Station } from './stations.ts'

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

/** A hard limit on the plan, never a score penalty. */
export interface Geofence {
  id: string
  /** `no_fly`: the aircraft never enters it. `no_capture` (homes, playgrounds): no camera frame may cover it. */
  kind: 'no_fly' | 'no_capture'
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
  /** Flight height above the edge, at most `altitudeCapM`. */
  altitudeM: number
  /** The cap agreed with air traffic control. */
  altitudeCapM: number
  /** Waypoint times start at `window.start`. */
  window: PatrolPlan['window']
  geofences: Geofence[]
}

interface Candidate {
  task: SegmentTask
  /** The stations left after no-capture zones, in flight-line order. */
  stations: Station[]
  priority: PriorityScore
  rank: number
  /** Flying from the first station to the last and hovering at each. */
  energyWh: number
}

interface Stop {
  candidate: Candidate
  /** Flown from its last station to its first. */
  reversed: boolean
}

interface Insertion extends Stop {
  /** Route position: 0 is straight after take-off. */
  index: number
  addedWh: number
  blockedBy: Geofence[]
}

/**
 * Scores the selected segments and builds a battery-aware route from the dock and back (TRD "Patrol planner" steps 2
 * and 3). Greedy insertion adds, at its cheapest place in the route, the task with the highest priority per added
 * watt-hour, while the whole route, return included, stays within the usable battery minus the reserve. Geofences
 * are hard limits. The plan comes back `proposed`: only a pilot's approval lets it fly.
 */
export function planPatrol(input: PatrolPlanInput): PatrolPlan {
  const { dock, drone, altitudeM, altitudeCapM, geofences } = input
  if (!dock.droneProfileIds.includes(drone.id)) throw new Error(`dock ${dock.id} does not take drone ${drone.id}`)
  if (altitudeM > altitudeCapM) throw new RangeError(`altitude ${altitudeM} m is above the ${altitudeCapM} m cap`)

  const flyS = (a: Position, b: Position) => distance(a, b, meters) / drone.cruiseSpeedMps
  const flyWh = (a: Position, b: Position) => (drone.cruisePowerW * flyS(a, b)) / 3600
  const hoverWh = (drone.hoverPowerW * assumedEnergyModel.stationHoverS) / 3600
  const climbS = Math.abs(altitudeM - dock.position.altM) / assumedEnergyModel.verticalSpeedMps
  const climbWh = (drone.hoverPowerW * climbS) / 3600
  const dockAt: Position = [dock.position.lon, dock.position.lat]

  const noFly = geofences.filter((g) => g.kind === 'no_fly')
  const noCapture = geofences.filter((g) => g.kind === 'no_capture')
  const legBlockers = memo((a: Position, b: Position) => {
    const path = samePosition(a, b) ? point(a) : lineString([a, b])
    return noFly.filter((zone) => booleanIntersects(path, zone.geometry))
  })

  const stationPlan = planStations({ ...input, camera: drone.camera })
  const rejected: Rejection[] = [...stationPlan.rejected]
  const pending: Candidate[] = []
  for (const task of stationPlan.tasks) {
    const { segmentId } = task
    const framed = task.stations.map((station) => ({
      station,
      zones: noCapture.filter((zone) => booleanIntersects(frame(station, task.footprint), zone.geometry))
    }))
    const stations = framed.filter((f) => f.zones.length === 0).map((f) => f.station)
    const excluded = framed.filter((f) => f.zones.length > 0)
    if (excluded.length > 0) {
      const zones = labels(excluded.flatMap((f) => f.zones))
      const reason =
        stations.length === 0
          ? `every station's frame would cover no-capture zone ${zones}`
          : `stations ${excluded.map((f) => f.station.id).join(', ')} left out: their frames would cover no-capture zone ${zones}; the rest of the segment is planned`
      rejected.push({ segmentId, code: 'geofence', reason })
      if (stations.length === 0) continue
    }
    const crossed = stations.slice(1).flatMap((s, i) => legBlockers(position(stations[i]!), position(s)))
    if (crossed.length > 0) {
      rejected.push({ segmentId, code: 'geofence', reason: `its flight line enters no-fly zone ${labels(crossed)}` })
      continue
    }
    const priority = scorePriority(segmentId, input)
    const flownWh = stations.slice(1).reduce((wh, s, i) => wh + flyWh(position(stations[i]!), position(s)), 0)
    pending.push({
      task,
      stations,
      priority,
      rank: rankingPriority(priority),
      energyWh: flownWh + stations.length * hoverWh
    })
  }

  const route: Stop[] = []
  const budgetWh = drone.usableBatteryWh - drone.reserveWh
  let usedWh = 2 * climbWh
  const insertions = (candidate: Candidate): Insertion[] =>
    Array.from({ length: route.length + 1 }, (_, index) => {
      const before = index === 0 ? dockAt : ends(route[index - 1]!)[1]
      const after = index === route.length ? dockAt : ends(route[index]!)[0]
      return [false, true].map((reversed): Insertion => {
        const [entry, exit] = ends({ candidate, reversed })
        return {
          candidate,
          reversed,
          index,
          addedWh: flyWh(before, entry) + candidate.energyWh + flyWh(exit, after) - flyWh(before, after),
          blockedBy: [...legBlockers(before, entry), ...legBlockers(exit, after)]
        }
      })
    }).flat()

  for (;;) {
    const best = pending
      .flatMap(insertions)
      .filter((ins) => ins.blockedBy.length === 0 && usedWh + ins.addedWh <= budgetWh)
      .reduce<Insertion | null>((a, b) => (a && !betterInsertion(b, a) ? a : b), null)
    if (!best) break
    route.splice(best.index, 0, { candidate: best.candidate, reversed: best.reversed })
    usedWh += best.addedWh
    pending.splice(pending.indexOf(best.candidate), 1)
  }

  for (const candidate of pending) {
    const options = insertions(candidate)
    const clear = options.filter((o) => o.blockedBy.length === 0)
    rejected.push(
      clear.length === 0
        ? {
            segmentId: candidate.task.segmentId,
            code: 'geofence',
            reason: `every straight transit to it crosses no-fly zone ${labels(options.flatMap((o) => o.blockedBy))}`
          }
        : {
            segmentId: candidate.task.segmentId,
            code: 'battery',
            reason: `needs ${Math.min(...clear.map((o) => o.addedWh)).toFixed(1)} Wh more; ${(budgetWh - usedWh).toFixed(1)} Wh is left above the ${drone.reserveWh} Wh reserve`
          }
    )
  }

  const flown = route.flatMap((stop) =>
    ordered(stop, stop.candidate.stations).map((station) => ({ station, segmentId: stop.candidate.task.segmentId }))
  )
  const waypoints: Waypoint[] = []
  let clockS = 0
  let energyWh = 0
  const startMs = Date.parse(input.window.start)
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
  if (flown.length > 0) {
    const out = bearing(dockAt, position(flown[0]!.station))
    const home = bearing(position(flown.at(-1)!.station), dockAt)
    const atDock = (altM: number, headingDeg: number) =>
      ({ altM, headingDeg, gimbalPitchDeg: 0, viewpointId: null, segmentId: null }) as const
    let from = dockAt
    const fly = (to: Position) => {
      clockS += flyS(from, to)
      energyWh += flyWh(from, to)
      from = to
    }
    arrive('takeoff', dockAt, atDock(dock.position.altM, out))
    clockS += climbS
    energyWh += climbWh
    arrive('transit', dockAt, atDock(altitudeM, out))
    for (const { station, segmentId } of flown) {
      fly(position(station))
      arrive('station', from, { ...station.pose, viewpointId: null, segmentId })
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

  return PatrolPlan.parse({
    id: input.id,
    createdAt: input.now,
    status: 'proposed',
    dockId: dock.id,
    returnDockId: dock.id,
    droneProfileId: drone.id,
    context: input.context,
    window: input.window,
    altitudeCapM,
    holds: [],
    tasks: route.map((stop) => ({
      segmentId: stop.candidate.task.segmentId,
      flightLine: { type: 'LineString', coordinates: ordered(stop, stop.candidate.task.flightLine.coordinates) },
      stations: ordered(stop, stop.candidate.stations).map((s) => ({ ...s.pose, viewpointId: null })),
      priority: stop.candidate.priority,
      energyWh: stop.candidate.energyWh
    })),
    waypoints,
    route: {
      type: 'LineString',
      coordinates: waypoints.length > 0 ? waypoints.map((w) => [w.lon, w.lat, w.altM]) : [ground, ground]
    },
    energyWh,
    reserveWh: drone.usableBatteryWh - energyWh,
    rejected,
    approvedBy: null,
    approvedAt: null,
    simulated: [dock, drone, ...input.segments, ...input.context, ...geofences].some((r) => r.simulated),
    source: 'system'
  })
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
