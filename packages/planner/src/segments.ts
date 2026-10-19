import { along } from '@turf/along'
import { bearing } from '@turf/bearing'
import { booleanPointInPolygon } from '@turf/boolean-point-in-polygon'
import { distance } from '@turf/distance'
import { lineString } from '@turf/helpers'
import { length } from '@turf/length'
import { lineIntersect } from '@turf/line-intersect'
import { nearestPointOnLine } from '@turf/nearest-point-on-line'
import type { Feature, LineString, MultiPolygon, Point, Polygon, Position } from 'geojson'

const meters = { units: 'meters' } as const
/** Split points closer than this to each other, or to a vertex, are one point. */
const SNAP_M = 0.5

export type AssetKind = 'drain' | 'pond' | 'lake' | 'retention_pond' | 'river_edge'

/** A water edge to inspect: a pond or lake shoreline (a closed ring) or an open bank line. */
export interface Edge {
  assetId: string
  osmId: number
  kind: AssetKind
  name: string
  /** `[lon, lat]` positions. A closed ring repeats its first position last. */
  geometry: LineString
  /** The side of the line, in its direction of travel, that is water. Flight lines go on this side. */
  waterSide: 'left' | 'right'
  simulated: boolean
  source: string
}

/** Something on or across an edge (a bridge, a path, a wall, a gate) that ends one inspection segment. */
export interface Obstruction {
  id: string
  geometry: Point | LineString | Polygon
  simulated: boolean
  source: string
}

/** Land held by one owner. An edge splits where it crosses into another owner's area or out of every area. */
export interface OwnerArea {
  owner: string
  geometry: Polygon | MultiPolygon
  simulated: boolean
  source: string
}

export type SplitCause =
  | { reason: 'edge_end' }
  | { reason: 'bend'; turnDeg: number }
  | { reason: 'obstruction'; obstructionId: string }
  | { reason: 'ownership' }

/** One inspection segment of an edge, in the edge's direction of travel. */
export interface Segment {
  /** `seg_<osmId>_<index>`, numbered along the edge. */
  id: string
  assetId: string
  osmId: number
  kind: AssetKind
  index: number
  geometry: LineString
  lengthM: number
  waterSide: 'left' | 'right'
  /** `null` where no owner area covers the segment: ownership unknown. */
  owner: string | null
  /** Why the segment starts and ends where it does. */
  split: { start: SplitCause[]; end: SplitCause[] }
  simulated: boolean
  source: string
}

export interface SplitInput {
  edges: Edge[]
  obstructions: Obstruction[]
  ownerAreas: OwnerArea[]
  /** Split once the heading has turned more than this from the segment's first heading. */
  maxBendDeg: number
  /** A point obstruction (a gate) within this distance of an edge splits it. */
  pointObstructionToleranceM: number
}

interface Split {
  segmentIndex: number
  atM: number
  position: Position
  cause: SplitCause
}

interface Vertex {
  position: Position
  atM: number
  causes: SplitCause[]
}

/** Splits each edge at obstructions, ownership changes and bends. */
export function splitEdges(input: SplitInput): Segment[] {
  return input.edges.flatMap((edge) => splitEdge(edge, input))
}

function splitEdge(edge: Edge, input: SplitInput): Segment[] {
  const coords = edge.geometry.coordinates
  const line = lineString(coords)
  const closed = samePosition(coords[0]!, coords.at(-1)!)
  const ringLengthM = length(line, meters)

  const splits = [...obstructionSplits(line, input), ...ownershipSplits(line, closed, ringLengthM, input.ownerAreas)]
  let vertices = insertSplits(closed ? coords.slice(0, -1) : coords, splits)
  if (!closed) {
    markBends(vertices, input.maxBendDeg)
  } else {
    const last = vertices.at(-1)!
    if (vertices.length > 1 && ringLengthM - last.atM <= SNAP_M) vertices[0]!.causes.push(...vertices.pop()!.causes)
    // Start the ring at a real split point so its seam is not arbitrary; with none, at its sharpest turn.
    const firstSplit = vertices.findIndex((v) => v.causes.length > 0)
    const seam = firstSplit >= 0 ? firstSplit : sharpestTurn(vertices)
    vertices = [...vertices.slice(seam), ...vertices.slice(0, seam)]
    vertices.push({ ...vertices[0]!, atM: ringLengthM }) // shares `causes` with the first vertex
    const endHeading = markBends(vertices, input.maxBendDeg)
    if (firstSplit < 0) vertices[0]!.causes.push({ reason: 'bend', turnDeg: turn(endHeading, heading(vertices, 0)) })
  }

  const pieces: Vertex[][] = []
  let start = 0
  for (let i = 1; i < vertices.length; i++) {
    if (vertices[i]!.causes.length > 0 || i === vertices.length - 1) {
      pieces.push(vertices.slice(start, i + 1))
      start = i
    }
  }

  return pieces.map((piece, index): Segment => {
    const geometry: LineString = { type: 'LineString', coordinates: piece.map((v) => v.position) }
    const lengthM = length(lineString(geometry.coordinates), meters)
    const ownerArea = ownerAreaAt(along(geometry, lengthM / 2, meters).geometry.coordinates, input.ownerAreas)
    const ends = (v: Vertex): SplitCause[] => (v.causes.length > 0 || closed ? v.causes : [{ reason: 'edge_end' }])
    return {
      id: `seg_${edge.osmId}_${index}`,
      assetId: edge.assetId,
      osmId: edge.osmId,
      kind: edge.kind,
      index,
      geometry,
      lengthM,
      waterSide: edge.waterSide,
      owner: ownerArea?.owner ?? null,
      split: { start: ends(piece[0]!), end: ends(piece.at(-1)!) },
      simulated: edge.simulated || (ownerArea?.simulated ?? false),
      source: edge.source
    }
  })
}

function obstructionSplits(line: Feature<LineString>, input: SplitInput): Split[] {
  return input.obstructions.flatMap((obstruction) => {
    const cause: SplitCause = { reason: 'obstruction', obstructionId: obstruction.id }
    if (obstruction.geometry.type === 'Point') {
      const near = nearestPointOnLine(line, obstruction.geometry, meters)
      return near.properties.pointDistance <= input.pointObstructionToleranceM ? [splitAt(near, cause)] : []
    }
    return lineIntersect(line, obstruction.geometry).features.map((p) =>
      splitAt(nearestPointOnLine(line, p, meters), cause)
    )
  })
}

/** Where the edge crosses an owner area's boundary and the owner on either side differs. */
function ownershipSplits(line: Feature<LineString>, closed: boolean, lineLengthM: number, areas: OwnerArea[]): Split[] {
  const ownerAt = (atM: number) => {
    const onLine = closed ? (atM + lineLengthM) % lineLengthM : Math.min(Math.max(atM, 0), lineLengthM)
    return ownerAreaAt(along(line, onLine, meters).geometry.coordinates, areas)?.owner ?? null
  }
  return areas.flatMap((area) =>
    lineIntersect(line, area.geometry).features.flatMap((p) => {
      const near = nearestPointOnLine(line, p, meters)
      const atM = near.properties.lineDistance
      return ownerAt(atM - SNAP_M) === ownerAt(atM + SNAP_M) ? [] : [splitAt(near, { reason: 'ownership' })]
    })
  )
}

function ownerAreaAt(position: Position, areas: OwnerArea[]): OwnerArea | undefined {
  return areas.find((area) => booleanPointInPolygon(position, area.geometry))
}

function splitAt(near: ReturnType<typeof nearestPointOnLine>, cause: SplitCause): Split {
  return {
    segmentIndex: near.properties.segmentIndex,
    atM: near.properties.lineDistance,
    position: near.geometry.coordinates,
    cause
  }
}

/** Inserts split points as vertices, merging any that fall within `SNAP_M` of the vertex before them. */
function insertSplits(coords: Position[], splits: Split[]): Vertex[] {
  const vertices: Vertex[] = []
  let atM = 0
  coords.forEach((position, i) => {
    if (i > 0) atM += distance(coords[i - 1]!, position, meters)
    vertices.push({ position, atM, causes: [] })
    const inSegment = splits.filter((s) => s.segmentIndex === i).sort((a, b) => a.atM - b.atM)
    vertices.push(...inSegment.map((s) => ({ position: s.position, atM: s.atM, causes: [s.cause] })))
  })
  const merged: Vertex[] = []
  for (const v of vertices) {
    const prev = merged.at(-1)
    if (prev && v.atM - prev.atM <= SNAP_M) prev.causes.push(...v.causes)
    else merged.push(v)
  }
  return merged
}

/**
 * Marks a bend wherever the heading has turned more than `maxBendDeg` from the current segment's first heading.
 * Returns the last segment's first heading.
 */
function markBends(vertices: Vertex[], maxBendDeg: number): number {
  let reference = heading(vertices, 0)
  for (let i = 1; i < vertices.length - 1; i++) {
    const out = heading(vertices, i)
    const turnDeg = turn(reference, out)
    if (vertices[i]!.causes.length === 0 && Math.abs(turnDeg) > maxBendDeg) {
      vertices[i]!.causes.push({ reason: 'bend', turnDeg })
    }
    if (vertices[i]!.causes.length > 0) reference = out
  }
  return reference
}

/** Index of the vertex with the sharpest turn in a ring given without its closing vertex. */
function sharpestTurn(ring: Vertex[]): number {
  const turns = ring.map((_, i) => {
    const before = bearing(ring.at(i - 1)!.position, ring[i]!.position)
    return Math.abs(turn(before, bearing(ring[i]!.position, ring[(i + 1) % ring.length]!.position)))
  })
  return turns.indexOf(Math.max(...turns))
}

/** Heading in degrees from vertex `i` to the next. */
function heading(vertices: Vertex[], i: number): number {
  return bearing(vertices[i]!.position, vertices[i + 1]!.position)
}

/** Signed turn from one heading to another, in -180..180 degrees. */
function turn(from: number, to: number): number {
  return ((to - from + 540) % 360) - 180
}

function samePosition(a: Position, b: Position): boolean {
  return a[0] === b[0] && a[1] === b[1]
}
