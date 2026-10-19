import { bearing } from '@turf/bearing'
import { booleanIntersects } from '@turf/boolean-intersects'
import { booleanPointInPolygon } from '@turf/boolean-point-in-polygon'
import { destination } from '@turf/destination'
import { distance } from '@turf/distance'
import { lineString } from '@turf/helpers'
import { nearestPointOnLine } from '@turf/nearest-point-on-line'
import type { ThirdParty as ContractThirdParty, Dock, PlanHold } from '@safe-edge/contracts'
import type { Feature, Polygon, Position } from 'geojson'
import type { Station } from './stations.ts'

const meters = { units: 'meters' } as const
const DEG = Math.PI / 180
/** Step between the stand-offs tried when a station moves further out. */
const STAND_OFF_STEP_M = 1

/**
 * CAR 2016 regulation 143: a small unmanned surveillance aircraft stays 50 m from any person, vessel, vehicle or
 * structure not under the remote pilot's control. Measured horizontally, which is never more than the slant distance.
 */
export const SEPARATION_M = 50

/**
 * CAR 2016 regulation 143(1)(g): no flight "within 30 metres of any person during take-off or landing" without the
 * Director General's authorisation. Rule (f) already keeps 50 m from any person, so (g) only adds something if take-off
 * and landing are read as the moments 50 m gives way to 30 m: the planner keeps people 30 m from the dock and stations
 * 50 m from everyone.
 */
export const TAKEOFF_LANDING_SEPARATION_M = 30

/**
 * CAR 2016 regulation 143(1)(c), (d): no flight "over any assembly in the open air of more than 1,000 persons" nor
 * "within 150 metres of any assembly in the open air of more than 1,000 persons" without the Director General's
 * authorisation. The plan's authorisation covers designated areas only, so the planner keeps 150 m from every one.
 */
export const ASSEMBLY_M = 150

/** A person report counting more than 1,000 people: an assembly in the open air (reg. 143(1)(c), (d)). */
export function isAssembly(party: ThirdParty): boolean {
  return party.kind === 'person' && party.headcount !== null && party.headcount > 1000
}

/**
 * A person, vessel, vehicle or structure not under the remote pilot's control: the contracts' `ThirdParty`, whose
 * `source` may also name a map layer (`osm`), like the planner's other geometry inputs.
 */
export type ThirdParty = Omit<ContractThirdParty, 'source'> & { source: string }

/** A third party a stretch of the flight comes too close to, and how close it comes. */
export interface Nearby {
  party: ThirdParty
  m: number
}

export interface SeparationOptions {
  /** The water body the segment's edge encloses: a station only moves within it. */
  water: Feature<Polygon>
  /** Flight height, kept when a station moves. */
  altitudeM: number
  /** The slant range that gives the detail needed, without zoom. */
  rangeM: number
  /** The camera's zoom: at `zoom` × `rangeM` it sees the aim point at the same detail. */
  maxZoom: number
}

export interface Separation {
  /** The stations to fly, some moved further out with zoom. */
  stations: Station[]
  /** Stations that wait for people, vessels or vehicles to move away, with the nearest one's distance. */
  waiting: { station: Station; parties: ThirdParty[]; closestM: number }[]
  /** Stations left out: a structure stays put, so waiting would not clear it. */
  dropped: { station: Station; parties: ThirdParty[] }[]
}

/**
 * Checks each station against the third parties. A station within 50 m moves back along its line of sight, over the
 * water and at the same height, to the nearest stand-off (in 1 m steps) that clears them all, and the leg from the
 * previous clear station too where one does, zooming in so its aim point keeps the detail of `rangeM`. Where no
 * stand-off up to `maxZoom` × `rangeM` clears them, it takes the nearest stand-off that clears every structure and
 * waits there for people, vessels and vehicles to pass. A station no stand-off can clear of a structure is left out.
 */
export function keepSeparation(
  stations: Station[],
  thirdParties: ThirdParty[],
  options: SeparationOptions
): Separation {
  const near = (station: Station, parties: ThirdParty[]) =>
    parties
      .map((party) => ({ party, m: distanceTo(position(station), party.geometry) }))
      .filter((n) => n.m < SEPARATION_M)
  const structures = thirdParties.filter((p) => p.kind === 'structure')
  const movable = thirdParties.filter((p) => p.kind !== 'structure')
  const separation: Separation = { stations: [], waiting: [], dropped: [] }
  // The last station flown that is clear of everyone. The leg from it is flown too, so a stand-off should clear that
  // leg as well: stations moved just past 50 m around a party would otherwise pass closer between them.
  let previous: Station | null = null
  for (const station of stations) {
    const choices = [station, ...standOffs(station, options)]
    const clearAt = (s: Station) => near(s, thirdParties).length === 0
    const legClear = (s: Station) =>
      previous === null || nearby([position(previous), position(s)], thirdParties, SEPARATION_M).length === 0
    const clear = choices.find((s) => clearAt(s) && legClear(s)) ?? choices.find(clearAt)
    const clearOfStructures = choices.find((s) => near(s, structures).length === 0)
    if (clear) {
      separation.stations.push(clear)
      previous = clear
    } else if (clearOfStructures) {
      const close = near(clearOfStructures, movable)
      separation.stations.push(clearOfStructures)
      separation.waiting.push({
        station: clearOfStructures,
        parties: close.map((n) => n.party),
        closestM: Math.min(...close.map((n) => n.m))
      })
      previous = null
    } else {
      separation.dropped.push({ station, parties: near(station, structures).map((n) => n.party) })
      previous = null
    }
  }
  return separation
}

/** The station moved further out over the water, one step at a time, as far as the zoom allows. */
function standOffs(station: Station, { water, altitudeM, rangeM, maxZoom }: SeparationOptions): Station[] {
  const fromM = distance(station.aim, position(station), meters)
  const toM = Math.sqrt((rangeM * maxZoom) ** 2 - altitudeM ** 2)
  const away = bearing(station.aim, position(station))
  const moved: Station[] = []
  for (let outM = fromM + STAND_OFF_STEP_M; outM <= toM; outM += STAND_OFF_STEP_M) {
    const [lon, lat] = destination(station.aim, outM, away, meters).geometry.coordinates as [number, number]
    if (!booleanPointInPolygon([lon, lat], water)) break
    moved.push({
      ...station,
      pose: {
        lon,
        lat,
        altM: altitudeM,
        headingDeg: bearing([lon, lat], station.aim),
        gimbalPitchDeg: -Math.atan2(altitudeM, outM) / DEG,
        zoom: Math.max(1, Math.hypot(outM, altitudeM) / rangeM)
      }
    })
  }
  return moved
}

/** What makes a stop wait: its own stations and flight line, and the transit into it from the stop before. */
export interface StopConflicts {
  waiting: Separation['waiting']
  /** People, vessels and vehicles near its flight line between stations that are clear of them. */
  flightLine: Nearby[]
  /** The transit from the previous stop, named by its segment, and who is near it; null when it is clear. */
  transit: { from: string; to: string; near: Nearby[] } | null
}

/**
 * The hold for a stop that waits, hovering for up to `waitS` before station `before`. The planner never releases it:
 * core's `releasePlanHold` records the pilot's confirm-clear.
 */
export function separationHold(
  segmentId: string,
  { waiting, flightLine, transit }: StopConflicts,
  { waitS, before }: { waitS: number; before: Station }
): PlanHold {
  const parts = [
    ...(waiting.length > 0
      ? [
          `stations ${waiting.map((w) => w.station.id).join(', ')} are within ${SEPARATION_M} m of ${closest(waiting.flatMap((w) => w.parties.map((party) => ({ party, m: w.closestM }))))}`
        ]
      : []),
    ...(flightLine.length > 0 ? [`its flight line passes within ${SEPARATION_M} m of ${closest(flightLine)}`] : []),
    ...(transit
      ? [
          `the transit from ${transit.from} to ${transit.to} passes within ${SEPARATION_M} m of ${closest(transit.near)}`
        ]
      : [])
  ]
  return {
    kind: 'separation',
    segmentId,
    until: null,
    releasedBy: null,
    releasedAt: null,
    reason: `${parts.join('; ')}; the segment waits for the pilot or observer to confirm the path is clear; the plan budgets ${(waitS / 60).toFixed(1)} min of hover before ${before.id} for it, and a longer wait uses the reserve`
  }
}

/** A transit from or to the dock: where it starts and ends, named as people should read them. */
export interface DockTransit {
  from: string
  to: string
  leg: [Position, Position]
}

/**
 * How close a third party may come to the climb from the dock and the descent onto it: 30 m for a person (rule (g)
 * read as the moments 50 m gives way to 30 m), 50 m for a vessel, vehicle or structure (rule (e) has no take-off case),
 * and 150 m for an assembly of more than 1,000 persons.
 */
export function climbSeparationM(party: ThirdParty): number {
  if (isAssembly(party)) return ASSEMBLY_M
  return party.kind === 'person' ? TAKEOFF_LANDING_SEPARATION_M : SEPARATION_M
}

/**
 * The hold on the dock while a third party is too close to take-off and landing (see `climbSeparationM`) or within
 * 50 m of the transits from and to the dock. The pilot or observer confirms the dock and its transits clear before
 * take-off; core's `releasePlanHold` (at `dock`) records it. Null when nothing is that close.
 */
export function dockHold(dock: Dock, thirdParties: ThirdParty[], transits: DockTransit[]): PlanHold | null {
  const at: Position = [dock.position.lon, dock.position.lat]
  const byDock = thirdParties
    .map((party) => ({ party, m: distanceTo(at, party.geometry), limitM: climbSeparationM(party) }))
    .filter((n) => n.m < n.limitM)
  const clauses = [TAKEOFF_LANDING_SEPARATION_M, SEPARATION_M, ASSEMBLY_M].flatMap((limitM) => {
    const close = byDock.filter((n) => n.limitM === limitM)
    if (close.length === 0) return []
    const closestM = Math.min(...close.map((n) => n.m))
    return [
      `${named(close.map((n) => n.party))} ${close.length === 1 ? 'is' : 'are'} within ${limitM} m of ${dock.name}, closest ${closestM.toFixed(0)} m`
    ]
  })
  // Structures never come near a flown transit (it would be out of the route), and the ones named above are not repeated.
  const others = thirdParties.filter((p) => p.kind !== 'structure' && !byDock.some((n) => n.party === p))
  for (const { from, to, leg } of transits) {
    const close = nearby(leg, others, SEPARATION_M)
    if (close.length > 0)
      clauses.push(`the transit from ${from} to ${to} passes within ${SEPARATION_M} m of ${closest(close)}`)
  }
  if (clauses.length === 0) return null
  return {
    kind: 'separation',
    segmentId: null,
    until: null,
    releasedBy: null,
    releasedAt: null,
    reason: `${clauses.join('; ')}; take-off and landing wait for the pilot or observer to confirm the dock and the transits from and to it are clear (CAR 2016 reg. 143(1))`
  }
}

/** The rejection for stations left out near structures. */
export function separationReason(dropped: Separation['dropped'], everyStation: boolean, maxZoom: number): string {
  const which = everyStation ? 'every station is' : `stations ${dropped.map((d) => d.station.id).join(', ')} left out:`
  const rest = everyStation ? '' : '; the rest of the segment is planned'
  return `${which} within ${SEPARATION_M} m of ${named(dropped.flatMap((d) => d.parties))}, and no stand-off over the water within the camera's ${maxZoom}× zoom clears it${rest}`
}

/**
 * The parties within `limitM` of a point or a straight leg (`path` has one or two positions), measured horizontally,
 * which is never more than the slant distance.
 */
export function nearby(path: Position[], parties: ThirdParty[], limitM: number): Nearby[] {
  return parties.map((party) => ({ party, m: pathDistance(path, party.geometry) })).filter((n) => n.m < limitM)
}

/** The parties, each named once, and the closest distance among them. */
export function closest(nearby: Nearby[]): string {
  return `${named(nearby.map((n) => n.party))}, closest ${Math.min(...nearby.map((n) => n.m)).toFixed(0)} m`
}

function named(parties: ThirdParty[]): string {
  return [...new Set(parties)]
    .map(
      (p) =>
        `"${p.label}" (${p.kind}${p.headcount === null ? '' : `, ${p.headcount} people`}${p.observedAt ? `, seen ${p.observedAt}` : ''})`
    )
    .join(', ')
}

/** Horizontal distance in metres; 0 inside a polygon. */
function distanceTo(at: Position, geometry: ThirdParty['geometry']): number {
  if (geometry.type === 'Point') return distance(at, geometry.coordinates, meters)
  if (geometry.type === 'LineString') return nearestPointOnLine(geometry, at, meters).properties.pointDistance
  if (booleanPointInPolygon(at, geometry)) return 0
  return nearestPointOnLine({ type: 'MultiLineString', coordinates: geometry.coordinates }, at, meters).properties
    .pointDistance
}

/**
 * Horizontal distance in metres from a point or a straight leg to a geometry; 0 where they touch. Apart from crossing,
 * the nearest two polylines come is at a vertex of one of them, so checking each vertex against the other is exact.
 */
function pathDistance(path: Position[], geometry: ThirdParty['geometry']): number {
  if (path.length === 1) return distanceTo(path[0]!, geometry)
  const leg = lineString(path)
  if (geometry.type === 'Point') return nearestPointOnLine(leg, geometry.coordinates, meters).properties.pointDistance
  if (booleanIntersects(leg, geometry)) return 0
  const vertices = geometry.type === 'LineString' ? geometry.coordinates : geometry.coordinates.flat()
  return Math.min(
    ...path.map((at) => distanceTo(at, geometry)),
    ...vertices.map((v) => nearestPointOnLine(leg, v, meters).properties.pointDistance)
  )
}

function position(station: Station): Position {
  return [station.pose.lon, station.pose.lat]
}
