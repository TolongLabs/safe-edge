// Builds the labelled Elmina seed (`data/elmina/fixtures/seed.json`) from the planner's segments, so segment IDs and
// geometry always match `@safe-edge/planner`. Only this script imports the planner; core's runtime never does.
// Run `bun run generate:seed` after the planner's split inputs or the OSM layers change.
import type {
  Asset,
  Baseline,
  Dock,
  DroneProfile,
  EdgePass,
  InventoryItem,
  Segment,
  ThirdParty,
  User,
  Viewpoint
} from '@safe-edge/contracts'
import { elminaLayerPaths, loadElmina, planStations, splitEdges } from '@safe-edge/planner'
import type { FeatureCollection, Geometry, Position } from 'geojson'
import { join } from 'node:path'
import { format, resolveConfig } from 'prettier'
import type { Seed } from '../src/index.ts'

const repoRoot = join(import.meta.dir, '../../..')
export const seedPath = join(repoRoot, 'data/elmina/fixtures/seed.json')

/** The split inputs #70 documents; segment IDs depend on them. */
const MAX_BEND_DEG = 40
const POINT_OBSTRUCTION_TOLERANCE_M = 3
const LAKE = 866518980
/** Six 2.4 m fence panels, with room either side. */
const STORY_MIN_LENGTH_M = 30
/** The date the fixtures describe. Pass dates are written relative to it, so `tick` has work to do. */
const AS_OF = '2026-10-20T00:00:00.000Z'
const fixture = { simulated: true, source: 'fixture' } as const
/**
 * An assumed weekly patrol (PRODUCT.md: today's practice is a weekly walk), last done the Friday before AS_OF, so a
 * missed patrol falls due on 23 October.
 */
const PATROL_INTERVAL_DAYS = 7
const LAST_PATROLLED_AT = '2026-10-16T01:00:00.000Z'

// Capture settings for the viewpoints, as in #70's tests: an assumed camera, not a chosen aircraft.
const RANGE_M = 15
const FORWARD_OVERLAP = 0.6
const ALTITUDE_M = 9

const users: User[] = [
  { id: 'usr_manager', name: 'Farah Hashim (manager)', role: 'manager', ...fixture },
  { id: 'usr_engineer', name: 'Lim Wei Jie (engineer)', role: 'engineer', ...fixture },
  { id: 'usr_reviewer', name: 'Priya Nair (reviewer)', role: 'reviewer', ...fixture },
  { id: 'usr_installer', name: 'Hafiz Rahman (installer)', role: 'installer', ...fixture },
  { id: 'usr_pilot', name: 'Daniel Tan (pilot)', role: 'pilot', ...fixture },
  { id: 'usr_gm', name: 'Rosli Ahmad (township general manager)', role: 'gm', ...fixture },
  { id: 'usr_crew', name: 'Siti Aminah (walk crew)', role: 'crew', ...fixture },
  { id: 'usr_integrator', name: 'Maintenance system integration', role: 'integrator', ...fixture },
  { id: 'usr_agent', name: 'Safe Edge agent', role: 'agent', ...fixture },
  { id: 'usr_system', name: 'Safe Edge scheduler', role: 'system', ...fixture },
  { id: 'usr_drone_sim', name: 'Simulated drone provider', role: 'provider', ...fixture }
]
const CUSTODIAN = 'usr_manager'

const droneProfile: DroneProfile = {
  id: 'drn_assumed',
  name: 'Assumed dock aircraft (battery figures are assumptions until an aircraft is chosen)',
  usableBatteryWh: 90,
  reserveWh: 25,
  cruiseSpeedMps: 10,
  cruisePowerW: 300,
  hoverPowerW: 280,
  maxWindMps: 12,
  camera: { hfovDeg: 70, vfovDeg: 55, imageWidthPx: 4000, imageHeightPx: 3000, maxZoom: 3 },
  missionFormats: ['wpml', 'qgc_plan'],
  ...fixture
}

/**
 * S1's path crowd: people on the lakeside footway (OSM way/926276001), at one of its vertices beside the lake. With the
 * seed drone's 3× zoom, the path segment beside it (`seg_866518980_9`) cannot keep 50 m and waits for a clear path,
 * and the bank across the lake (`seg_866518980_7`) stands further off with zoom.
 */
const s1PathCrowd: ThirdParty = {
  id: 'tp_s1_path_crowd',
  kind: 'person',
  label: 'S1: people on the lakeside footway',
  geometry: { type: 'Point', coordinates: [101.5144008, 3.1793557] },
  observedAt: '2026-10-20T21:20:00.000Z',
  headcount: null,
  ...fixture
}

export async function buildSeed(): Promise<Seed> {
  const readJson = (path: string) => Bun.file(join(repoRoot, path)).json()
  const elmina = await loadElmina(readJson)
  const planned = splitEdges({
    ...elmina,
    maxBendDeg: MAX_BEND_DEG,
    pointObstructionToleranceM: POINT_OBSTRUCTION_TOLERANCE_M
  })

  const assets: Asset[] = elmina.edges.map((edge) => ({
    id: `ast_${edge.osmId}`,
    townshipId: 'twp_elmina',
    kind: edge.kind,
    name: edge.osmId === LAKE ? edge.name : `${edge.name} (way/${edge.osmId})`,
    osmId: `way/${edge.osmId}`,
    retainedBySdp: true,
    custodianUserId: CUSTODIAN,
    geometry: { type: 'Polygon', coordinates: [edge.geometry.coordinates] },
    ...fixture
  }))

  // S1's segment: of the lake segments inside the park custodian's area that are long enough for a six-panel fence
  // run, the one that comes closest to a mapped playground.
  const parks = (await readJson(elminaLayerPaths.parks)) as FeatureCollection<Geometry, { leisure?: string }>
  const playgrounds = parks.features
    .filter((f) => f.properties.leisure === 'playground')
    .flatMap((f) => positionsOf(f.geometry))
  const parkLake = planned.filter((s) => s.osmId === LAKE && s.owner !== null)
  const nearestPlaygroundM = (coords: Position[]) =>
    Math.min(...coords.flatMap((c) => playgrounds.map((p) => haversineM(c, p))))
  const story = parkLake
    .filter((s) => s.lengthM >= STORY_MIN_LENGTH_M)
    .toSorted((a, b) => nearestPlaygroundM(a.geometry.coordinates) - nearestPlaygroundM(b.geometry.coordinates))[0]!

  const { tasks } = planStations({
    edges: elmina.edges,
    segments: [story],
    camera: droneProfile.camera,
    rangeM: RANGE_M,
    forwardOverlap: FORWARD_OVERLAP,
    altitudeM: ALTITUDE_M,
    // The viewpoints are made from these stations, below.
    viewpoints: []
  })
  const stations = tasks[0]!.stations
  const key = `${story.osmId}_${story.index}`
  const item = (slug: string, type: InventoryItem['type'], label: string, safetyCritical: boolean): InventoryItem => ({
    id: `item_${key}_${slug}`,
    type,
    label,
    safetyCritical
  })
  const panels = [1, 2, 3, 4, 5, 6].map((n) => item(`fence_panel_${n}`, 'fence_panel', `Fence panel ${n}`, true))
  const buoy = item('ring_buoy', 'ring_buoy', 'Ring buoy by the playground path', true)
  const sign = item('sign', 'sign', 'Deep water warning sign', false)
  const viewpoint = (n: number, station: (typeof stations)[number], items: InventoryItem[]): Viewpoint => ({
    id: `vp_${key}_${n}`,
    pose: {
      lon: station.pose.lon,
      lat: station.pose.lat,
      altM: station.pose.altM,
      headingDeg: station.pose.headingDeg,
      pitchDeg: station.pose.gimbalPitchDeg
    },
    expectedItemIds: items.map((i) => i.id)
  })
  const viewpoints = [
    viewpoint(1, stations[0]!, [...panels.slice(0, 3), sign]),
    viewpoint(2, stations.at(-1)!, [...panels.slice(3), buoy])
  ]
  const expectedInventory = [...panels, buoy, sign]
  const baseline: Baseline = {
    id: `bsl_${key}`,
    segmentId: story.id,
    capturedAt: '2026-04-15T01:30:00.000Z',
    images: [],
    inventorySnapshot: expectedInventory.map((i) => ({ itemId: i.id, status: 'present' })),
    acceptedBy: 'usr_reviewer',
    ...fixture
  }

  // Pass dates around AS_OF: the story segment is valid; the next three park segments become expiring, are
  // expiring, and have expired. Every other segment has never had a pass.
  const following = [1, 2, 3].map((n) => parkLake[(parkLake.indexOf(story) + n) % parkLake.length]!.id)
  const passFor = (segmentId: string): EdgePass => {
    const base = { id: segmentId.replace(/^seg_/, 'pass_'), segmentId, exceptions: [], ...fixture }
    const issued = (state: EdgePass['state'], stateReason: string | null, validFrom: string, validTo: string) => ({
      ...base,
      state,
      stateReason,
      validFrom,
      validTo,
      scope: { routeIds: [], retestIds: [] },
      issuedBy: 'usr_reviewer'
    })
    if (segmentId === story.id) return issued('valid', null, '2026-04-15T02:00:00.000Z', '2027-04-15T02:00:00.000Z')
    if (segmentId === following[0]) return issued('valid', null, '2025-12-01T02:00:00.000Z', '2026-12-01T02:00:00.000Z')
    if (segmentId === following[1]) {
      return issued('expiring', 'Within 30 days of validTo', '2025-11-12T02:00:00.000Z', '2026-11-12T02:00:00.000Z')
    }
    if (segmentId === following[2]) {
      return issued('expired', 'validTo reached', '2025-09-30T02:00:00.000Z', '2026-09-30T02:00:00.000Z')
    }
    return {
      ...base,
      state: 'none',
      stateReason: null,
      validFrom: null,
      validTo: null,
      scope: { routeIds: [], retestIds: [] },
      issuedBy: null
    }
  }

  const segments: Segment[] = planned.map((s) => {
    const asset = assets.find((a) => a.osmId === `way/${s.osmId}`)!
    const isStory = s.id === story.id
    return {
      id: s.id,
      assetId: asset.id,
      name: `${asset.name}, segment ${s.index + 1}`,
      geometry: s.geometry,
      // The accessible side is the land, opposite the water side the planner flies over.
      side: s.waterSide === 'left' ? 'right' : 'left',
      lengthM: Math.round(s.lengthM * 100) / 100,
      viewpoints: isStory ? viewpoints : [],
      expectedInventory: isStory ? expectedInventory : [],
      baselineId: isStory ? baseline.id : null,
      passId: s.id.replace(/^seg_/, 'pass_'),
      patrolIntervalDays: PATROL_INTERVAL_DAYS,
      lastPatrolledAt: LAST_PATROLLED_AT,
      ...fixture
    }
  })

  const park = parks.features.find(
    (f) =>
      f.properties.leisure === 'park' && 'name' in f.properties && f.properties.name === 'Elmina Valley Central Park'
  )!
  const parkRing = positionsOf(park.geometry)
  const dock: Dock = {
    id: 'dock_elmina_roof',
    name: 'Dock on the park facility roof (assumed site)',
    position: {
      lon: round6(parkRing.reduce((sum, p) => sum + p[0]!, 0) / parkRing.length),
      lat: round6(parkRing.reduce((sum, p) => sum + p[1]!, 0) / parkRing.length),
      altM: 6
    },
    rainLimitMmPerH: 2,
    droneProfileIds: [droneProfile.id],
    ...fixture
  }

  return {
    asOf: AS_OF,
    townshipId: 'twp_elmina',
    story: {
      s1: { segmentId: story.id, viewpointId: viewpoints[1]!.id, inventoryItemId: panels[3]!.id }
    },
    users,
    assets,
    segments,
    baselines: [baseline],
    passes: segments.map((s) => passFor(s.id)),
    docks: [dock],
    droneProfiles: [droneProfile],
    thirdParties: [s1PathCrowd]
  }
}

function positionsOf(geometry: Geometry): Position[] {
  switch (geometry.type) {
    case 'Point':
      return [geometry.coordinates]
    case 'Polygon':
      return geometry.coordinates.flat()
    case 'MultiPolygon':
      return geometry.coordinates.flat(2)
    default:
      throw new Error(`unexpected ${geometry.type} in the parks layer`)
  }
}

function haversineM([lon1, lat1]: Position, [lon2, lat2]: Position): number {
  const rad = Math.PI / 180
  const a =
    Math.sin(((lat2! - lat1!) * rad) / 2) ** 2 +
    Math.cos(lat1! * rad) * Math.cos(lat2! * rad) * Math.sin(((lon2! - lon1!) * rad) / 2) ** 2
  return 2 * 6_371_008.8 * Math.asin(Math.sqrt(a))
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6

export async function formatSeed(seed: Seed): Promise<string> {
  const config = await resolveConfig(seedPath)
  return format(JSON.stringify(seed), { ...config, filepath: seedPath })
}

if (import.meta.main) {
  await Bun.write(seedPath, await formatSeed(await buildSeed()))
  console.log(`wrote ${seedPath}`)
}
