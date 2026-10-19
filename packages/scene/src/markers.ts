import {
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshLambertMaterial,
  type Object3D,
  SphereGeometry,
  TorusGeometry,
  Vector3
} from 'three'
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'
import { LineMaterial } from 'three/addons/lines/LineMaterial.js'
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js'
import { toLocal } from './frame.ts'
import type { SegmentView } from './segments.ts'

/** What the scene marks on the map, all of it simulated: flags, dropped frames and unseen stretches. */
export interface SceneMarkers {
  /** Candidate flags, pinned on their inventory item, or on the segment's middle when they name none. */
  pins: Array<{ id: string; segmentId: string; itemId: string | null; tier: 1 | 2 | 3; label: string }>
  /** Frames the privacy gate dropped, where the drone took them. */
  dropped: Array<{ id: string; pose: { lon: number; lat: number; altM: number }; label: string }>
  /** Stretches nobody could see: around an item, or along a whole segment. */
  unknowns: Array<{ id: string; segmentId: string; itemId: string | null; label: string }>
}

/** Pins stand tall enough to find from the overview, like map pins; heights are drawn, not measured. */
const PIN_HEIGHT_M = 22
const HEAD_M = 3.2
/** An unknown stretch around an item reaches this far each way along its segment. */
const UNKNOWN_REACH_M = 12

/** Tier 2 is a missing or changed safety item; Tier 3 is unknown; Tier 1 is a change to review. Shape carries it too. */
const tierColours = { 1: 0x94500e, 2: 0xb02e28, 3: 0x5d6b66 } as const

/** A small solid chip, as the design system's tags: the label every simulated thing in the scene wears. */
export function labelChip(text: string): CSS2DObject {
  const chip = document.createElement('div')
  chip.textContent = text
  Object.assign(chip.style, {
    padding: '2px 8px',
    borderRadius: '4px',
    border: '1px solid #cfd6d2',
    background: '#fbfcfb',
    color: '#1c2925',
    font: '600 12px/16px "Atkinson Hyperlegible Next", system-ui, sans-serif',
    whiteSpace: 'nowrap',
    pointerEvents: 'none'
  })
  const label = new CSS2DObject(chip)
  label.center.set(0.5, 1)
  return label
}

const scenePoint = (lon: number, lat: number, altM = 0) => {
  const [east, north] = toLocal([lon, lat])
  return new Vector3(east, altM, -north)
}

/**
 * Builds the markers. `itemPositions` (from `buildEdgeAssets`) places pins and unknown stretches on their items;
 * `segments` gives the lines to pin on and hatch along.
 */
export function buildMarkers(
  markers: SceneMarkers,
  { itemPositions, segments }: { itemPositions: Map<string, Vector3>; segments: SegmentView[] }
): { objects: Object3D[]; dispose(): void } {
  const segment = (id: string) => {
    const found = segments.find((s) => s.id === id)
    if (!found) throw new Error(`No segment ${id} in this scene to mark`)
    return found
  }
  const line = (id: string) => segment(id).geometry.coordinates.map(([lon, lat]) => scenePoint(lon!, lat!, 0.5))
  const placeOf = (segmentId: string, itemId: string | null) => {
    if (itemId !== null) {
      const at = itemPositions.get(itemId)
      if (!at) throw new Error(`No modelled item ${itemId} to mark`)
      return at.clone().setY(0)
    }
    const points = line(segmentId)
    return points[Math.floor(points.length / 2)]!.clone().setY(0)
  }

  const objects: Object3D[] = []
  for (const pin of markers.pins) {
    const material = new MeshLambertMaterial({ color: tierColours[pin.tier] })
    const head =
      pin.tier === 2
        ? new BoxGeometry(HEAD_M, HEAD_M, HEAD_M)
        : pin.tier === 3
          ? new TorusGeometry(HEAD_M / 2, HEAD_M / 5, 8, 24)
          : new SphereGeometry(HEAD_M / 2, 16, 12)
    const group = new Group()
    group.name = `pin ${pin.id} (simulated)`
    group.add(new Mesh(new CylinderGeometry(0.25, 0.25, PIN_HEIGHT_M).translate(0, PIN_HEIGHT_M / 2, 0), material))
    group.add(new Mesh(head.translate(0, PIN_HEIGHT_M + HEAD_M / 2, 0), material))
    const label = labelChip(`${pin.label} · simulated`)
    label.position.set(0, PIN_HEIGHT_M + HEAD_M * 1.4, 0)
    group.add(label)
    group.position.copy(placeOf(pin.segmentId, pin.itemId))
    objects.push(group)
  }

  for (const frame of markers.dropped) {
    const group = new Group()
    group.name = `dropped frame ${frame.id} (simulated)`
    const tick = new Mesh(new BoxGeometry(0.6, 6, 0.6), new MeshLambertMaterial({ color: 0x5d6b66 }))
    group.add(tick)
    const label = labelChip(`${frame.label} · simulated`)
    label.position.set(0, 4, 0)
    group.add(label)
    group.position.copy(scenePoint(frame.pose.lon, frame.pose.lat, frame.pose.altM))
    objects.push(group)
  }

  for (const unknown of markers.unknowns) {
    const points = stretch(line(unknown.segmentId), unknown.itemId ? placeOf(unknown.segmentId, unknown.itemId) : null)
    const positions = points.slice(1).flatMap((b, i) => [...points[i]!.toArray(), ...b.toArray()])
    const material = new LineMaterial({
      color: 0x8e9994,
      linewidth: 10,
      worldUnits: true,
      dashed: true,
      dashSize: 1.2,
      gapSize: 1.2,
      depthWrite: false
    })
    const hatch = new LineSegments2(new LineSegmentsGeometry().setPositions(positions), material)
    hatch.computeLineDistances()
    hatch.name = `unknown ${unknown.id} (simulated)`
    // Draw over the pass-state ribbons, which lie lower on the same edge.
    hatch.renderOrder = 1_000
    const label = labelChip(`${unknown.label} · simulated`)
    label.position.copy(points[Math.floor(points.length / 2)]!).setY(3)
    hatch.add(label)
    objects.push(hatch)
  }

  for (const o of objects) o.userData.layer = 'simulation'
  return {
    objects,
    dispose() {
      for (const o of objects) {
        o.traverse((child) => {
          if (child instanceof CSS2DObject) child.element.remove()
          if ('geometry' in child && child.geometry instanceof BufferGeometry) child.geometry.dispose()
          if ('material' in child) (child.material as { dispose(): void }).dispose()
        })
      }
    }
  }
}

/** The part of a segment's line within `UNKNOWN_REACH_M` of `around` (measured along the line), or all of it. */
function stretch(points: Vector3[], around: Vector3 | null): Vector3[] {
  if (around === null) return points
  const along = [0]
  for (let i = 1; i < points.length; i++) along.push(along[i - 1]! + points[i]!.distanceTo(points[i - 1]!))
  // Where along the line the item stands: the nearest point on any of its pieces.
  let at = 0
  let best = Infinity
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!
    const piece = points[i]!.clone().sub(a)
    const t = Math.min(1, Math.max(0, around.clone().setY(a.y).sub(a).dot(piece) / piece.lengthSq()))
    const d = a.clone().addScaledVector(piece, t).distanceTo(around.clone().setY(a.y))
    if (d < best) [best, at] = [d, along[i - 1]! + t * piece.length()]
  }
  const from = at - UNKNOWN_REACH_M
  const to = at + UNKNOWN_REACH_M
  const pointAt = (d: number) => {
    const i = Math.max(
      1,
      along.findIndex((x) => x >= d)
    )
    const a = points[i - 1]!
    const b = points[i] ?? a
    const span = along[i]! - along[i - 1]!
    return a.clone().lerp(b, span > 0 ? (d - along[i - 1]!) / span : 0)
  }
  const inside = points.filter((_, i) => along[i]! > from && along[i]! < to)
  return [pointAt(Math.max(0, from)), ...inside, pointAt(Math.min(along.at(-1)!, to))]
}
