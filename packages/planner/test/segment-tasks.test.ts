import { describe, expect, test } from 'bun:test'
import { bearing } from '@turf/bearing'
import { booleanPointInPolygon } from '@turf/boolean-point-in-polygon'
import { distance } from '@turf/distance'
import { lineString, polygon } from '@turf/helpers'
import { length } from '@turf/length'
import { nearestPointOnLine } from '@turf/nearest-point-on-line'
import { join } from 'node:path'
import type { CameraProfile } from '@safe-edge/contracts'
import { loadElmina, planStations, splitEdges } from '../src/index.ts'

const repoRoot = join(import.meta.dir, '../../..')
const readJson = (path: string) => Bun.file(join(repoRoot, path)).json()

const meters = { units: 'meters' } as const
const MAX_BEND_DEG = 40
const turn = (from: number, to: number) => ((to - from + 540) % 360) - 180

const LAKE = 866518980
// OSM footways tagged bridge=yes that cross the Central Park lake.
const LAKE_BRIDGES = ['way/1343835669', 'way/1346147881', 'way/926275999', 'way/926276000', 'way/926280618']

describe('splitting real Elmina water edges', async () => {
  const elmina = await loadElmina(readJson)
  const segments = splitEdges({ ...elmina, maxBendDeg: MAX_BEND_DEG, pointObstructionToleranceM: 3 })
  const lake = segments.filter((s) => s.osmId === LAKE)

  test('the lake splits on both banks of every footbridge', () => {
    const crossings = lake.flatMap((s) =>
      s.split.start.flatMap((c) => (c.reason === 'obstruction' ? [c.obstructionId] : []))
    )
    expect(crossings.toSorted()).toEqual(LAKE_BRIDGES.flatMap((id) => [id, id]))
  })

  test('the lake splits where it crosses into and out of the custodian area', () => {
    const [custodian] = elmina.ownerAreas
    const changes = lake.filter((s) => s.split.start.some((c) => c.reason === 'ownership'))
    expect(changes).toHaveLength(2)
    for (const s of changes) expect(s.owner).not.toBe(lake.at(s.index - 1)!.owner)
    expect(new Set(lake.map((s) => s.owner))).toEqual(new Set([custodian!.owner, null]))
    expect(lake.filter((s) => s.owner !== null).every((s) => s.simulated)).toBe(true)
  })

  test('no segment turns more than the bend limit, and every segment boundary has a cause', () => {
    for (const segment of segments) {
      const c = segment.geometry.coordinates
      const firstHeading = bearing(c[0]!, c[1]!)
      for (let i = 1; i < c.length - 1; i++) {
        expect(Math.abs(turn(firstHeading, bearing(c[i]!, c[i + 1]!)))).toBeLessThanOrEqual(MAX_BEND_DEG)
      }
      expect(segment.split.start.length).toBeGreaterThan(0)
      expect(segment.split.end.length).toBeGreaterThan(0)
      for (const cause of [...segment.split.start, ...segment.split.end]) {
        if (cause.reason === 'bend') expect(Math.abs(cause.turnDeg)).toBeGreaterThan(MAX_BEND_DEG)
      }
    }
  })

  test('segments run end to end around each edge without gaps', () => {
    for (const edge of elmina.edges) {
      const pieces = segments.filter((s) => s.assetId === edge.assetId)
      expect(pieces.length).toBeGreaterThan(1)
      pieces.forEach((s, i) => {
        expect(s.id).toBe(`seg_${edge.osmId}_${i}`)
        expect(s.geometry.coordinates[0]).toEqual(pieces.at(i - 1)!.geometry.coordinates.at(-1)!)
      })
      const total = pieces.reduce((sum, s) => sum + s.lengthM, 0)
      expect(total).toBeCloseTo(length(lineString(edge.geometry.coordinates), { units: 'meters' }), 0)
    }
  })
})

describe('camera stations for the selected lake and retention-pond segments', async () => {
  const elmina = await loadElmina(readJson)
  const selected = splitEdges({ ...elmina, maxBendDeg: MAX_BEND_DEG, pointObstructionToleranceM: 3 })
  // An assumed camera for the test, not a chosen aircraft.
  const camera: CameraProfile = { hfovDeg: 70, vfovDeg: 55, imageWidthPx: 4000, imageHeightPx: 3000, maxZoom: 1 }
  const capture = { camera, rangeM: 15, forwardOverlap: 0.6 }
  const plan = planStations({ edges: elmina.edges, segments: selected, ...capture, altitudeM: 9 })
  const STAND_OFF_M = 12 // sqrt(15² − 9²)
  const SPACING_M = 8.4 // 2 × 15 × tan(35°) = 21.01 m footprint along the edge, × (1 − 0.6)

  test('returns stations for every selected segment', () => {
    expect(plan.rejected).toEqual([])
    expect(plan.tasks.map((t) => t.segmentId)).toEqual(selected.map((s) => s.id))
    for (const task of plan.tasks) expect(task.stations.length).toBeGreaterThan(0)
  })

  test('spaces stations by the footprint and forward overlap, from one end of the segment to the other', () => {
    for (const task of plan.tasks) {
      const segment = selected.find((s) => s.id === task.segmentId)!
      expect(task.footprint.alongEdgeM).toBeCloseTo(21.01, 2)
      expect(task.spacingM).toBeCloseTo(SPACING_M, 2)
      expect(task.stations).toHaveLength(Math.ceil(segment.lengthM / SPACING_M) + 1)
      const edge = lineString(segment.geometry.coordinates)
      const atM = task.stations.map((st) => nearestPointOnLine(edge, st.aim, meters).properties.lineDistance)
      expect(atM[0]).toBeCloseTo(0, 1)
      expect(atM.at(-1)).toBeCloseTo(segment.lengthM, 1)
      for (let i = 1; i < atM.length; i++) expect(atM[i]! - atM[i - 1]!).toBeLessThanOrEqual(SPACING_M)
    }
  })

  test('flies each station over the water on the offset line, facing the edge', () => {
    for (const task of plan.tasks) {
      const segment = selected.find((s) => s.id === task.segmentId)!
      const water = polygon([elmina.edges.find((e) => e.assetId === segment.assetId)!.geometry.coordinates])
      const flightLine = lineString(task.flightLine.coordinates)
      const segmentLine = lineString(segment.geometry.coordinates)
      expect(task.standOffM).toBeCloseTo(STAND_OFF_M, 6)
      for (const { pose, aim } of task.stations) {
        const position = [pose.lon, pose.lat]
        expect(booleanPointInPolygon(position, water)).toBe(true)
        expect(nearestPointOnLine(flightLine, position, meters).properties.pointDistance).toBeLessThan(0.01)
        // Turf offsets in degrees, about 0.15% short across a meridian at 3°N.
        expect(nearestPointOnLine(segmentLine, position, meters).properties.pointDistance).toBeGreaterThan(
          STAND_OFF_M - 0.05
        )
        const horizontalM = distance(position, aim, meters)
        expect(pose.altM).toBe(9)
        expect(pose.headingDeg).toBeCloseTo(bearing(position, aim), 6)
        expect(pose.gimbalPitchDeg).toBeCloseTo((-Math.atan2(9, horizontalM) * 180) / Math.PI, 6)
      }
    }
  })

  test('rejects, with a reason, segments where the stand-off does not fit over the water', () => {
    // A 20 m range at 12 m altitude stands 16 m off; the lake is narrower than that between two footbridges.
    const wide = planStations({ edges: elmina.edges, segments: selected, ...capture, rangeM: 20, altitudeM: 12 })
    expect(wide.rejected.length).toBeGreaterThan(0)
    for (const { segmentId, code, reason } of wide.rejected) {
      const segment = selected.find((s) => s.id === segmentId)!
      expect(code).toBe('flight_line')
      expect(reason).toContain('crosses the edge')
      expect(segment.osmId).toBe(LAKE)
      const ends = [...segment.split.start, ...segment.split.end]
      expect(ends.some((c) => c.reason === 'obstruction' && LAKE_BRIDGES.includes(c.obstructionId))).toBe(true)
    }
    const planned = [...wide.tasks.map((t) => t.segmentId), ...wide.rejected.map((r) => r.segmentId)]
    expect(planned.toSorted()).toEqual(selected.map((s) => s.id).toSorted())
  })
})
