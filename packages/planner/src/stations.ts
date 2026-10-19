import { along } from '@turf/along'
import { bearing } from '@turf/bearing'
import { distance } from '@turf/distance'
import { lineString } from '@turf/helpers'
import { kinks } from '@turf/kinks'
import { length } from '@turf/length'
import { lineIntersect } from '@turf/line-intersect'
import { lineOffset } from '@turf/line-offset'
import { nearestPointOnLine } from '@turf/nearest-point-on-line'
import type { CameraProfile, CameraStation, PatrolPlan } from '@safe-edge/contracts'
import type { LineString, Position } from 'geojson'
import type { Edge, Segment } from './segments.ts'

const meters = { units: 'meters' } as const
const DEG = Math.PI / 180

/**
 * The contracts' camera station without a viewpoint. `altM` is the height above the water edge (flat terrain), and
 * `headingDeg` runs -180 to 180 from the station to its aim point.
 */
export type StationPose = Omit<CameraStation, 'viewpointId'>

export interface Station {
  /** `stn_<osmId>_<segment index>_<index>` */
  id: string
  index: number
  /** The `[lon, lat]` point on the segment the camera points at. */
  aim: Position
  pose: StationPose
}

export interface SegmentTask {
  /** `task_<osmId>_<segment index>` */
  id: string
  segmentId: string
  /** The segment offset over the water by the stand-off. */
  flightLine: LineString
  /** Horizontal distance from the flight line to the edge. */
  standOffM: number
  /** First-order frame size at the aim point, on a plane facing the camera. */
  footprint: { alongEdgeM: number; acrossEdgeM: number }
  /** Largest gap between aim points along the edge. */
  spacingM: number
  stations: Station[]
}

/** A segment, or some of its stations, left out of a plan: the contracts' `PatrolPlan.rejected` item. */
export type Rejection = PatrolPlan['rejected'][number]

export interface StationPlanInput {
  /** The edges the segments came from, to check flight lines against. */
  edges: Edge[]
  /** The selected segments. */
  segments: Segment[]
  /** The drone's camera. The aircraft yaws to face the edge, so the image's horizontal axis runs along it. */
  camera: CameraProfile
  /** Slant distance from the camera to its aim point on the edge, set by the detail the camera must resolve. */
  rangeM: number
  /** Share of each frame that the next frame along the edge repeats, from 0 up to but excluding 1. */
  forwardOverlap: number
  /** Flight height above the water edge. */
  altitudeM: number
}

export interface StationPlan {
  tasks: SegmentTask[]
  rejected: Rejection[]
}

/**
 * Plans an offset flight line and camera stations for each selected segment. Stand-off and pitch follow from the
 * camera's range and the flight height; station spacing is the footprint along the edge times (1 − forward overlap).
 */
export function planStations({
  edges,
  segments,
  camera,
  rangeM,
  forwardOverlap,
  altitudeM
}: StationPlanInput): StationPlan {
  const { hfovDeg, vfovDeg } = camera
  if (!(hfovDeg > 0 && hfovDeg < 180 && vfovDeg > 0 && vfovDeg < 180)) {
    throw new RangeError('camera fields of view must be between 0 and 180 degrees')
  }
  if (!(forwardOverlap >= 0 && forwardOverlap < 1)) {
    throw new RangeError(`forward overlap ${forwardOverlap} must be at least 0 and below 1`)
  }
  if (!(altitudeM >= 0 && altitudeM < rangeM)) {
    throw new RangeError(`altitude ${altitudeM} m must be at least 0 and below the camera range ${rangeM} m`)
  }

  const standOffM = Math.sqrt(rangeM ** 2 - altitudeM ** 2)
  const footprint = {
    alongEdgeM: 2 * rangeM * Math.tan((hfovDeg / 2) * DEG),
    acrossEdgeM: 2 * rangeM * Math.tan((vfovDeg / 2) * DEG)
  }
  const spacingM = footprint.alongEdgeM * (1 - forwardOverlap)

  const plan: StationPlan = { tasks: [], rejected: [] }
  for (const segment of segments) {
    const edge = edges.find((e) => e.assetId === segment.assetId)
    if (!edge) throw new Error(`segment ${segment.id} has no edge ${segment.assetId}`)
    const flightLine = offsetFlightLine(segment, edge, standOffM)
    if (kinks(flightLine).features.length > 0) {
      plan.rejected.push({
        segmentId: segment.id,
        code: 'flight_line',
        reason: `the flight line ${standOffM.toFixed(1)} m off the edge folds over itself`
      })
    } else if (lineIntersect(flightLine, edge.geometry).features.length > 0) {
      plan.rejected.push({
        segmentId: segment.id,
        code: 'flight_line',
        reason: `the flight line ${standOffM.toFixed(1)} m off the edge crosses the edge: the water is too narrow`
      })
    } else {
      plan.tasks.push({
        id: segment.id.replace(/^seg_/, 'task_'),
        segmentId: segment.id,
        flightLine,
        standOffM,
        footprint,
        spacingM,
        stations: stationsAlong(segment, flightLine, spacingM, altitudeM)
      })
    }
  }
  return plan
}

/**
 * Offsets the segment over the water with Turf `lineOffset`, which moves a line to the right of travel for a positive
 * distance. The segment is offset together with the edge one stand-off beyond each end, so each end becomes the corner
 * join with the neighbouring segment's flight line instead of overshooting it at a sharp corner.
 */
function offsetFlightLine(segment: Segment, edge: Edge, standOffM: number): LineString {
  const edgeLine = lineString(edge.geometry.coordinates)
  const edgeLengthM = length(edgeLine, meters)
  const closed = samePosition(edge.geometry.coordinates[0]!, edge.geometry.coordinates.at(-1)!)
  const beyond = (position: Position, byM: number): Position[] => {
    const atM = nearestPointOnLine(edgeLine, position, meters).properties.lineDistance
    if (closed) return [along(edgeLine, (atM + byM + edgeLengthM) % edgeLengthM, meters).geometry.coordinates]
    const clamped = Math.min(Math.max(atM + byM, 0), edgeLengthM)
    return clamped !== atM ? [along(edgeLine, clamped, meters).geometry.coordinates] : []
  }
  const coords = segment.geometry.coordinates
  const before = beyond(coords[0]!, -standOffM)
  const after = beyond(coords.at(-1)!, standOffM)
  const offsetM = segment.waterSide === 'right' ? standOffM : -standOffM
  const offset = offsetWithoutFolds([...before, ...coords, ...after], offsetM, before.length + 1)
  return { type: 'LineString', coordinates: offset.slice(before.length, offset.length - after.length) }
}

/**
 * Where vertices sit closer together than the offset on a curve, `lineOffset`'s corner joins cross and an offset
 * sub-segment runs backwards, folding the line into a loop. Drops an interior vertex at each fold and offsets again.
 * The first and last `keep` vertices (a segment's ends and their neighbours) are never dropped.
 */
function offsetWithoutFolds(coords: Position[], offsetM: number, keep: number): Position[] {
  const offset = lineOffset(lineString(coords), offsetM, meters).geometry.coordinates
  const fold = offset.findIndex((p, i) => {
    const next = offset[i + 1]
    if (!next) return false
    const [a, b] = [coords[i]!, coords[i + 1]!]
    return (next[0]! - p[0]!) * (b[0]! - a[0]!) + (next[1]! - p[1]!) * (b[1]! - a[1]!) < 0
  })
  const drop = [fold, fold + 1].find((i) => fold >= 0 && i >= keep && i < coords.length - keep)
  return drop === undefined ? offset : offsetWithoutFolds(coords.toSpliced(drop, 1), offsetM, keep)
}

function samePosition(a: Position, b: Position): boolean {
  return a[0] === b[0] && a[1] === b[1]
}

/** Evenly spaced aim points from one end of the segment to the other, each seen from the nearest flight-line point. */
function stationsAlong(segment: Segment, flightLine: LineString, spacingM: number, altitudeM: number): Station[] {
  const intervals = Math.ceil(segment.lengthM / spacingM)
  return Array.from({ length: intervals + 1 }, (_, index): Station => {
    const aim = along(segment.geometry, (segment.lengthM * index) / intervals, meters).geometry.coordinates
    const [lon, lat] = nearestPointOnLine(flightLine, aim, meters).geometry.coordinates as [number, number]
    return {
      id: `${segment.id.replace(/^seg_/, 'stn_')}_${index}`,
      index,
      aim,
      pose: {
        lon,
        lat,
        altM: altitudeM,
        headingDeg: bearing([lon, lat], aim),
        gimbalPitchDeg: -Math.atan2(altitudeM, distance([lon, lat], aim, meters)) / DEG
      }
    }
  })
}
