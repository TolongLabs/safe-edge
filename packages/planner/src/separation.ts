import { bearing } from '@turf/bearing'
import { booleanPointInPolygon } from '@turf/boolean-point-in-polygon'
import { destination } from '@turf/destination'
import { distance } from '@turf/distance'
import { nearestPointOnLine } from '@turf/nearest-point-on-line'
import type { PlanHold } from '@safe-edge/contracts'
import type { Feature, LineString, Point, Polygon, Position } from 'geojson'
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

/** A person, vessel, vehicle or structure not under the remote pilot's control. */
export interface ThirdParty {
  id: string
  kind: 'person' | 'vessel' | 'vehicle' | 'structure'
  /** As people should read it, e.g. "3 people on the lakeside footway" or "footbridge way/926280618". */
  label: string
  geometry: Point | LineString | Polygon
  /** When it was seen; `null` for a mapped structure. */
  observedAt: string | null
  simulated: boolean
  source: string
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
 * water and at the same height, to the nearest stand-off (in 1 m steps) that clears them all, zooming in so its aim
 * point keeps the detail of `rangeM`. Where no stand-off up to `maxZoom` × `rangeM` clears them, it takes the nearest
 * stand-off that clears every structure and waits there for people, vessels and vehicles to pass. A station no
 * stand-off can clear of a structure is left out.
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
  for (const station of stations) {
    const choices = [station, ...standOffs(station, options)]
    const clear = choices.find((s) => near(s, thirdParties).length === 0)
    const clearOfStructures = choices.find((s) => near(s, structures).length === 0)
    if (clear) {
      separation.stations.push(clear)
    } else if (clearOfStructures) {
      const close = near(clearOfStructures, movable)
      separation.stations.push(clearOfStructures)
      separation.waiting.push({
        station: clearOfStructures,
        parties: close.map((n) => n.party),
        closestM: Math.min(...close.map((n) => n.m))
      })
    } else {
      separation.dropped.push({ station, parties: near(station, structures).map((n) => n.party) })
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

/** The hold for a segment whose stations wait. The planner never releases it: core's `releasePlanHold` records the pilot's confirm-clear. */
export function separationHold(segmentId: string, waiting: Separation['waiting']): PlanHold {
  const closestM = Math.min(...waiting.map((w) => w.closestM))
  return {
    kind: 'separation',
    segmentId,
    until: null,
    releasedBy: null,
    releasedAt: null,
    reason: `stations ${waiting.map((w) => w.station.id).join(', ')} are within ${SEPARATION_M} m of ${named(waiting.flatMap((w) => w.parties))}, closest ${closestM.toFixed(0)} m; the segment waits for the pilot or observer to confirm the path is clear`
  }
}

/** The rejection for stations left out near structures. */
export function separationReason(dropped: Separation['dropped'], everyStation: boolean, maxZoom: number): string {
  const which = everyStation ? 'every station is' : `stations ${dropped.map((d) => d.station.id).join(', ')} left out:`
  const rest = everyStation ? '' : '; the rest of the segment is planned'
  return `${which} within ${SEPARATION_M} m of ${named(dropped.flatMap((d) => d.parties))}, and no stand-off over the water within the camera's ${maxZoom}× zoom clears it${rest}`
}

function named(parties: ThirdParty[]): string {
  return [...new Set(parties)]
    .map((p) => `"${p.label}" (${p.kind}${p.observedAt ? `, seen ${p.observedAt}` : ''})`)
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

function position(station: Station): Position {
  return [station.pose.lon, station.pose.lat]
}
