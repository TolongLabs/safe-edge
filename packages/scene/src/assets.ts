import type { LineString } from 'geojson'
import {
  BoxGeometry,
  CylinderGeometry,
  type BufferGeometry,
  InstancedMesh,
  type Material,
  MeshLambertMaterial,
  Object3D,
  TorusGeometry,
  Vector3
} from 'three'
import { toLocal } from './frame.ts'

export type ItemType = 'fence_panel' | 'cover' | 'grating' | 'gate' | 'ring_buoy' | 'sign'

/** A segment's expected inventory, which the scene models along its accessible side. */
export interface EdgeAssetView {
  segmentId: string
  geometry: LineString
  /** Accessible side relative to the line direction. */
  side: 'left' | 'right'
  items: Array<{ id: string; type: ItemType; label: string }>
}

/** Panel width; a fence run is drawn panel by panel along the whole segment. */
const PANEL_M = 2.5
const FENCE_HEIGHT_M = 1.2
/** Fences stand on the accessible side, just outside the 8 m pass-state ribbon drawn on the edge line. */
const SETBACK_M = 5

const colours = {
  fence: 0xe6eeea,
  post: 0x3a4743,
  gate: 0x24443b,
  cover: 0x6f7b76,
  grating: 0x8e9994,
  buoy: 0xb02e28,
  sign: 0xfbfcfb
}

interface Placement {
  position: Vector3
  /** Rotation about the vertical axis, so a panel runs along the edge. */
  heading: number
}

/**
 * Edge assets as one `InstancedMesh` per part. Returns the meshes and where each inventory item stands, so flags and
 * labels can point at it.
 */
export function buildEdgeAssets(views: EdgeAssetView[]): {
  objects: Array<InstancedMesh<BufferGeometry, Material>>
  itemPositions: Map<string, Vector3>
} {
  const parts = {
    posts: [] as Placement[],
    panels: [] as Placement[],
    gates: [] as Placement[],
    covers: [] as Placement[],
    gratings: [] as Placement[],
    buoyPosts: [] as Placement[],
    buoys: [] as Placement[],
    signPosts: [] as Placement[],
    signs: [] as Placement[]
  }
  const itemPositions = new Map<string, Vector3>()

  for (const view of views) {
    const path = alongSide(view)
    const fenced = view.items.some((i) => i.type === 'fence_panel')
    if (fenced) {
      for (let d = 0; d <= path.length; d += PANEL_M) parts.posts.push(path.at(d, 0))
      for (let d = PANEL_M / 2; d < path.length; d += PANEL_M) parts.panels.push(path.at(d, FENCE_HEIGHT_M / 2))
    }
    // Labelled items share the run in their listed order; the rest of the fence is unlabelled.
    const spread = (list: typeof view.items) =>
      list.map((item, i) => ({ item, d: ((i + 1) / (list.length + 1)) * path.length }))
    const panels = view.items.filter((i) => i.type === 'fence_panel')
    for (const { item, d } of spread(panels)) itemPositions.set(item.id, path.at(d, FENCE_HEIGHT_M).position)
    for (const { item, d } of spread(view.items.filter((i) => i.type !== 'fence_panel'))) {
      const at = path.at(d, 0)
      const back = path.at(d, 0, SETBACK_M + 1.2)
      switch (item.type) {
        case 'gate':
          parts.gates.push(path.at(d, FENCE_HEIGHT_M / 2))
          break
        case 'cover':
          parts.covers.push(at)
          break
        case 'grating':
          parts.gratings.push(at)
          break
        case 'ring_buoy':
          parts.buoyPosts.push(back)
          parts.buoys.push({ position: back.position.clone().setY(1.3), heading: back.heading })
          break
        case 'sign':
          parts.signPosts.push(back)
          parts.signs.push({ position: back.position.clone().setY(1.7), heading: back.heading })
          break
        case 'fence_panel':
          throw new Error('fence panels are placed with the run')
      }
      itemPositions.set(item.id, back.position.clone().setY(1.5))
    }
  }

  const lambert = (color: number) => new MeshLambertMaterial({ color })
  const objects = [
    instanced(
      'fence posts',
      new BoxGeometry(0.16, FENCE_HEIGHT_M, 0.16).translate(0, FENCE_HEIGHT_M / 2, 0),
      lambert(colours.post),
      parts.posts
    ),
    instanced(
      'fence panels',
      new BoxGeometry(PANEL_M - 0.14, FENCE_HEIGHT_M - 0.2, 0.04),
      lambert(colours.fence),
      parts.panels
    ),
    instanced('gates', new BoxGeometry(3, FENCE_HEIGHT_M, 0.06), lambert(colours.gate), parts.gates),
    instanced('covers', new BoxGeometry(1.2, 0.08, 1.2), lambert(colours.cover), parts.covers),
    instanced('gratings', new BoxGeometry(1, 0.06, 0.6), lambert(colours.grating), parts.gratings),
    instanced(
      'ring buoy posts',
      new CylinderGeometry(0.05, 0.05, 1.6).translate(0, 0.8, 0),
      lambert(colours.post),
      parts.buoyPosts
    ),
    instanced('ring buoys', new TorusGeometry(0.35, 0.09, 8, 20), lambert(colours.buoy), parts.buoys),
    instanced(
      'sign posts',
      new CylinderGeometry(0.05, 0.05, 2.2).translate(0, 1.1, 0),
      lambert(colours.post),
      parts.signPosts
    ),
    instanced('signs', new BoxGeometry(0.9, 0.6, 0.04), lambert(colours.sign), parts.signs)
  ].filter((o) => o.count > 0)
  for (const o of objects) o.userData.layer = 'modelled'
  return { objects, itemPositions }
}

function instanced(name: string, geometry: BufferGeometry, material: Material, placements: Placement[]) {
  const mesh = new InstancedMesh(geometry, material, placements.length)
  const dummy = new Object3D()
  placements.forEach((p, i) => {
    dummy.position.copy(p.position)
    dummy.rotation.set(0, p.heading, 0)
    dummy.updateMatrix()
    mesh.setMatrixAt(i, dummy.matrix)
  })
  mesh.instanceMatrix.needsUpdate = true
  // Culling uses these bounds; without them it tests the base geometry at the origin and drops the fence.
  mesh.computeBoundingBox()
  mesh.computeBoundingSphere()
  mesh.name = name
  return mesh
}

/** Walks a segment's line, offset to its accessible side, in metres from its start. */
function alongSide(view: EdgeAssetView) {
  const points = view.geometry.coordinates.map((p) => toLocal(p))
  const lengths = points.slice(1).map(([e, n], i) => Math.hypot(e - points[i]![0], n - points[i]![1]))
  const length = lengths.reduce((a, b) => a + b, 0)
  const sign = view.side === 'right' ? 1 : -1
  return {
    length,
    /** The placement `d` metres along, `y` metres up and `setback` metres onto the accessible side. */
    at(d: number, y: number, setback = SETBACK_M): Placement {
      let i = 0
      let rest = Math.min(Math.max(d, 0), length)
      while (i < lengths.length - 1 && rest > lengths[i]!) rest -= lengths[i++]!
      const [ae, an] = points[i]!
      const [be, bn] = points[i + 1]!
      const t = lengths[i]! === 0 ? 0 : rest / lengths[i]!
      const de = (be - ae) / (lengths[i]! || 1)
      const dn = (bn - an) / (lengths[i]! || 1)
      // The right-hand normal of (de, dn) in the east-north plane is (dn, -de).
      const e = ae + (be - ae) * t + sign * dn * setback
      const n = an + (bn - an) * t - sign * de * setback
      // Scene axes: x east, z south. A box's length runs along x, so turn it to the edge's bearing.
      return { position: new Vector3(e, y, -n), heading: Math.atan2(dn, de) }
    }
  }
}
