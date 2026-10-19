import type { LineString } from 'geojson'
import { LineMaterial } from 'three/addons/lines/LineMaterial.js'
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js'
import { toLocal } from './frame.ts'

export type PassState = 'none' | 'valid' | 'expiring' | 'expired' | 'suspended'

/** What the scene needs to draw a segment and fill its card. */
export interface SegmentView {
  id: string
  name: string
  geometry: LineString
  state: PassState
  /** The asset's custodian, by name. */
  owner: string
  lastPatrolledAt: string | null
  validTo: string | null
}

/** The pass-state foreground colours from docs/DESIGN.md (Light). */
export const passStateColours: Record<PassState, number> = {
  valid: 0x237446,
  expiring: 0x94500e,
  suspended: 0xb02e28,
  expired: 0x5b6763,
  none: 0x5d6b66
}

/** Colour alone never carries a state: segments without a valid pass are drawn dashed. */
const DASHED: ReadonlySet<PassState> = new Set(['none', 'expired'])
const WIDTH_M = 8
/** Just above the paths and water, which lie at 0 m, and below the modelled fences that stand on the edge. */
const LIFT_M = 0.3

/**
 * One ribbon object per pass state. `userData.segments` lists each segment ID with the index of its first line
 * segment, so a raycast hit's `faceIndex` finds the segment.
 */
export function buildSegmentRibbons(segments: SegmentView[]): LineSegments2[] {
  const byState = new Map<PassState, SegmentView[]>()
  for (const s of segments) byState.set(s.state, [...(byState.get(s.state) ?? []), s])
  return [...byState].map(([state, list]) => {
    const positions: number[] = []
    const ids = list.map((s) => {
      const entry = { id: s.id, first: positions.length / 6 }
      const line = s.geometry.coordinates
      for (let i = 1; i < line.length; i++) {
        const [ae, an] = toLocal(line[i - 1]!)
        const [be, bn] = toLocal(line[i]!)
        positions.push(ae, LIFT_M, -an, be, LIFT_M, -bn)
      }
      return entry
    })
    const material = new LineMaterial({
      color: passStateColours[state],
      linewidth: WIDTH_M,
      worldUnits: true,
      dashed: DASHED.has(state),
      // Flat on the ground like the base layers: draw order, not depth, puts it over the outline.
      depthWrite: false,
      dashSize: 10,
      gapSize: 6
    })
    const object = new LineSegments2(new LineSegmentsGeometry().setPositions(positions), material)
    if (material.dashed) object.computeLineDistances()
    object.name = `segments ${state}`
    object.userData.segments = ids
    return object
  })
}

/** The segment a raycast hit on a ribbon from `buildSegmentRibbons` belongs to. */
export function segmentAt(object: LineSegments2, faceIndex: number): string {
  const ids = object.userData.segments as Array<{ id: string; first: number }>
  let found = ids[0]!
  for (const entry of ids) if (entry.first <= faceIndex) found = entry
  return found.id
}

/** The point halfway along a segment in the scene frame (x east, z south), for focusing the camera. */
export function segmentMidpoint(segment: SegmentView): [x: number, z: number] {
  const points = segment.geometry.coordinates.map((p) => toLocal(p))
  const lengths = points.slice(1).map(([e, n], i) => Math.hypot(e - points[i]![0], n - points[i]![1]))
  let remaining = lengths.reduce((a, b) => a + b, 0) / 2
  for (let i = 0; i < lengths.length; i++) {
    if (remaining <= lengths[i]!) {
      const t = remaining / lengths[i]!
      const [ae, an] = points[i]!
      const [be, bn] = points[i + 1]!
      return [ae + (be - ae) * t, -(an + (bn - an) * t)]
    }
    remaining -= lengths[i]!
  }
  const [e, n] = points[points.length - 1]!
  return [e, -n]
}
