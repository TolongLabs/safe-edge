import type { Feature, FeatureCollection, Geometry, Position } from 'geojson'
import {
  BufferGeometry,
  ExtrudeGeometry,
  type Material,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  Path,
  Shape,
  ShapeGeometry,
  Vector2
} from 'three'
import { LineMaterial } from 'three/addons/lines/LineMaterial.js'
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { toLocal } from './frame.ts'

type OsmProperties = { osm_type: string; osm_id: number } & Record<string, string | number>
type OsmFeature = Feature<Geometry, OsmProperties>

/** The OSM layers from `data/elmina/osm/` that the base scene draws. */
export interface ElminaLayers {
  water: FeatureCollection<Geometry, OsmProperties>
  parks: FeatureCollection<Geometry, OsmProperties>
  paths: FeatureCollection<Geometry, OsmProperties>
  buildings: FeatureCollection<Geometry, OsmProperties>
}

/** Placeholder colours until DESIGN.md (#47) sets the scene palette. */
export const basePalette = {
  sky: 0xdfe8ee,
  ground: 0xe6e3da,
  park: 0xc5dbb0,
  water: 0x76aed3,
  path: 0xb3ab9a,
  building: 0xf2efe8
} as const

/** Ribbon widths in metres, since WebGL ignores line width on plain lines. */
const WATERWAY_WIDTH: Record<string, number> = { river: 12, canal: 6, stream: 4 }
const DRAIN_WIDTH = 2
const PATH_WIDTH = 2
/** Most Elmina buildings carry no height or levels in OSM; two 3 m storeys stand in. */
const STOREY_M = 3
const DEFAULT_STOREYS = 2

/**
 * One merged object per layer and material. `userData.features` lists each OSM ID with the index of its first
 * triangle (meshes) or segment (ribbons), so a raycast hit's `faceIndex` finds the feature.
 */
export function buildBaseLayers(layers: ElminaLayers): Array<Mesh<BufferGeometry, Material>> {
  const water = layers.water.features.filter(isArea)
  const waterways = new Map<number, OsmFeature[]>()
  for (const f of layers.water.features.filter((f) => !isArea(f))) {
    const width = WATERWAY_WIDTH[String(f.properties.waterway)] ?? DRAIN_WIDTH
    waterways.set(width, [...(waterways.get(width) ?? []), f])
  }
  const flat = (color: number) => new MeshBasicMaterial({ color, depthWrite: false })
  const ribbon = (color: number, linewidth: number) =>
    new LineMaterial({ color, linewidth, worldUnits: true, depthWrite: false })

  // Everything but the buildings lies at ground level, so draw order separates the layers instead of depth.
  const objects = [
    mergedMesh('parks', layers.parks.features.filter(isArea), flatShapes, flat(basePalette.park)),
    mergedMesh('water', water, flatShapes, flat(basePalette.water)),
    ...[...waterways].map(([width, features]) =>
      ribbons(`waterways ${width} m`, features, ribbon(basePalette.water, width))
    ),
    ribbons('paths', layers.paths.features, ribbon(basePalette.path, PATH_WIDTH)),
    mergedMesh(
      'buildings',
      layers.buildings.features.filter(isArea),
      extruded,
      new MeshLambertMaterial({ color: basePalette.building })
    )
  ]
  objects.forEach((object, order) => (object.renderOrder = order + 1))
  return objects
}

function isArea(f: OsmFeature): boolean {
  return f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon'
}

function shapesOf(geometry: Geometry): Shape[] {
  const polygons =
    geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.type === 'MultiPolygon' ? geometry.coordinates : []
  return polygons.map(([outer, ...holes]) => {
    const shape = new Shape(outer!.map(toVector))
    shape.holes = holes.map((ring) => new Path(ring.map(toVector)))
    return shape
  })
}

const toVector = (position: Position) => new Vector2(...toLocal(position))

// Shapes are drawn in the east-north plane; rotating -90° about x lays them on the ground with north at -z.
function flatShapes(f: OsmFeature): BufferGeometry {
  return new ShapeGeometry(shapesOf(f.geometry)).rotateX(-Math.PI / 2)
}

function extruded(f: OsmFeature): BufferGeometry {
  const height = Number.parseFloat(String(f.properties.height))
  const storeys = Number.parseFloat(String(f.properties['building:levels']))
  const depth = height > 0 ? height : (storeys > 0 ? storeys : DEFAULT_STOREYS) * STOREY_M
  return new ExtrudeGeometry(shapesOf(f.geometry), { depth, bevelEnabled: false }).rotateX(-Math.PI / 2)
}

const osmId = (f: OsmFeature) => `${f.properties.osm_type}/${f.properties.osm_id}`

function mergedMesh(
  name: string,
  features: OsmFeature[],
  build: (f: OsmFeature) => BufferGeometry,
  material: Material
) {
  const parts = features.map(build)
  const geometry = mergeGeometries(parts)
  if (!geometry) throw new Error(`${name}: layer geometries do not share attributes`)
  parts.forEach((part) => part.dispose())

  let first = 0
  const ids = features.map((f, i) => {
    const entry = { id: osmId(f), first }
    first += (parts[i]!.index?.count ?? parts[i]!.attributes.position!.count) / 3
    return entry
  })
  const mesh = new Mesh(geometry, material)
  mesh.name = name
  mesh.userData.features = ids
  return mesh
}

function ribbons(name: string, features: OsmFeature[], material: LineMaterial) {
  const positions: number[] = []
  const ids = features.map((f) => {
    const entry = { id: osmId(f), first: positions.length / 6 }
    const lines =
      f.geometry.type === 'LineString'
        ? [f.geometry.coordinates]
        : f.geometry.type === 'MultiLineString'
          ? f.geometry.coordinates
          : []
    for (const line of lines) {
      for (let i = 1; i < line.length; i++) {
        const [ae, an] = toLocal(line[i - 1]!)
        const [be, bn] = toLocal(line[i]!)
        positions.push(ae, 0, -an, be, 0, -bn)
      }
    }
    return entry
  })
  const object = new LineSegments2(new LineSegmentsGeometry().setPositions(positions), material)
  object.name = name
  object.userData.features = ids
  return object
}
