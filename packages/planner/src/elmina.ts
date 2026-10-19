import { booleanClockwise } from '@turf/boolean-clockwise'
import type { Feature, FeatureCollection, Geometry } from 'geojson'
import type { AssetKind, Edge, Obstruction, OwnerArea } from './segments.ts'

/**
 * The one place that knows where the Elmina OSM layers live, relative to the repo root. It points at the research
 * extract until #59 lands the Overpass extract in `data/elmina/`; then only these paths change.
 */
export const elminaLayerPaths = {
  water: 'docs/research/drone-integration/data/water.geojson',
  barriers: 'docs/research/drone-integration/data/barriers.geojson',
  paths: 'docs/research/drone-integration/data/paths.geojson',
  parks: 'docs/research/drone-integration/data/parks.geojson'
} as const

/** The Elmina Central Park lake and the three polygons OSM names "flood retention pond". */
export const elminaWaterEdges: ReadonlyArray<{ osmId: number; kind: AssetKind; name: string }> = [
  { osmId: 866518980, kind: 'lake', name: 'Elmina Central Park lake' },
  { osmId: 383055739, kind: 'retention_pond', name: 'flood retention pond' },
  { osmId: 383055740, kind: 'retention_pond', name: 'flood retention pond' },
  { osmId: 404002712, kind: 'retention_pond', name: 'flood retention pond' }
]

/** OSM way of the Elmina Valley Central Park polygon. */
const CENTRAL_PARK = 866543394

export interface ElminaPlannerInput {
  edges: Edge[]
  obstructions: Obstruction[]
  ownerAreas: OwnerArea[]
}

type OsmFeature = Feature<Geometry, { osm_type: string; osm_id: number }>

/**
 * Loads the Elmina water edges, their obstructions (barriers and paths) and owner areas. `readJson` takes a path from
 * `elminaLayerPaths` and returns the parsed file, so the planner itself never touches the file system: tests read
 * with Bun, the browser fetches.
 */
export async function loadElmina(readJson: (path: string) => Promise<unknown>): Promise<ElminaPlannerInput> {
  const [water, barriers, paths, parks] = await Promise.all([
    readLayer(readJson, elminaLayerPaths.water),
    readLayer(readJson, elminaLayerPaths.barriers),
    readLayer(readJson, elminaLayerPaths.paths),
    readLayer(readJson, elminaLayerPaths.parks)
  ])

  const edges = elminaWaterEdges.map(({ osmId, kind, name }): Edge => {
    const feature = water.features.find((f) => f.properties.osm_id === osmId)
    if (!feature) throw new Error(`water layer has no OSM way ${osmId}`)
    if (feature.geometry.type !== 'Polygon' || feature.geometry.coordinates.length !== 1) {
      throw new Error(`OSM way ${osmId} must be a polygon with one ring, got ${feature.geometry.type}`)
    }
    const ring = feature.geometry.coordinates[0]!
    return {
      assetId: `asset_${osmId}`,
      osmId,
      kind,
      name,
      geometry: { type: 'LineString', coordinates: ring },
      // A clockwise ring has its interior, the water, on the right of travel.
      waterSide: booleanClockwise(ring) ? 'right' : 'left',
      simulated: false,
      source: 'osm'
    }
  })

  const obstructions = [...barriers.features, ...paths.features].map((f): Obstruction => {
    const { geometry } = f
    if (geometry.type !== 'Point' && geometry.type !== 'LineString' && geometry.type !== 'Polygon') {
      throw new Error(`obstruction ${f.properties.osm_type}/${f.properties.osm_id} has unsupported ${geometry.type}`)
    }
    return { id: `${f.properties.osm_type}/${f.properties.osm_id}`, geometry, simulated: false, source: 'osm' }
  })

  // No public ownership register exists. Until SDP's arrives, this labelled fixture gives the mapped park one custodian,
  // so the lake changes owner where it leaves the park; everywhere else the owner is unknown.
  const park = parks.features.find((f) => f.properties.osm_id === CENTRAL_PARK)
  if (park?.geometry.type !== 'Polygon') throw new Error(`parks layer has no polygon for OSM way ${CENTRAL_PARK}`)
  const ownerAreas: OwnerArea[] = [
    { owner: 'Elmina Valley Central Park custodian', geometry: park.geometry, simulated: true, source: 'fixture' }
  ]

  return { edges, obstructions, ownerAreas }
}

async function readLayer(readJson: (path: string) => Promise<unknown>, path: string) {
  const layer = (await readJson(path)) as FeatureCollection<Geometry, OsmFeature['properties']>
  if (layer?.type !== 'FeatureCollection') throw new Error(`${path} is not a GeoJSON FeatureCollection`)
  return layer
}
