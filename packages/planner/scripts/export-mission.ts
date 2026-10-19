// Plans a demo patrol over the real Elmina water edges and writes it as a DJI WPML KMZ and a QGroundControl .plan,
// both stamped "not flight-ready", for opening in DJI Pilot 2 or QGroundControl.
// Usage: bun run export:mission <outDir>
import type { ContextSnapshot, Dock, DroneProfile } from '@safe-edge/contracts'
import { mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { NOT_FLIGHT_READY, exportQgcPlan, exportWpmlKmz } from '../src/export/index.ts'
import { loadElmina, planPatrol, splitEdges } from '../src/index.ts'

const NOW = '2026-10-20T06:00:00.000Z'
const at = (hours: number) => new Date(Date.parse(NOW) + hours * 3_600_000).toISOString()

// Demo fixtures, not a chosen site or aircraft: a dock on a park building roof by the lake, and assumed drone figures.
const dock: Dock = {
  id: 'dock_central_park',
  name: 'Central Park facility roof',
  position: { lon: 101.5135, lat: 3.1784, altM: 6 },
  rainLimitMmPerH: 2,
  droneProfileIds: ['drn_assumed'],
  simulated: true,
  source: 'fixture'
}
const drone: DroneProfile = {
  id: 'drn_assumed',
  name: 'assumed demo drone',
  usableBatteryWh: 400,
  reserveWh: 30,
  cruiseSpeedMps: 8,
  cruisePowerW: 250,
  hoverPowerW: 220,
  maxWindMps: 12,
  camera: { hfovDeg: 70, vfovDeg: 55, imageWidthPx: 4000, imageHeightPx: 3000, maxZoom: 1 },
  missionFormats: ['wpml', 'qgc_plan'],
  simulated: true,
  source: 'fixture'
}
/** Ground elevation at the dock: Copernicus GLO-90 DEM via the Open-Meteo elevation API, read 19 Oct 2026. */
const groundAmslM = 36

const reading = (kind: 'rainfall' | 'water_level', value: number): ContextSnapshot => ({
  kind,
  value,
  text: null,
  observedAt: at(-0.5),
  validTo: null,
  publisher: 'JPS Public Infobanjir',
  stationId: null,
  url: null,
  simulated: true,
  source: 'fixture'
})

/** The Central Park lake segments, every pass valid for 200 days, no open flags, no rain and normal water. */
export async function demoPlan(readJson: (path: string) => Promise<unknown>) {
  const elmina = await loadElmina(readJson)
  const segments = splitEdges({ ...elmina, maxBendDeg: 40, pointObstructionToleranceM: 3 }).filter(
    (s) => s.osmId === 866518980
  )
  const plan = planPatrol({
    id: 'plan_demo',
    now: NOW,
    edges: elmina.edges,
    segments,
    dock,
    drone,
    rangeM: 15,
    forwardOverlap: 0.6,
    altitudeM: 9,
    altitudeCapM: 60,
    window: { start: NOW, end: at(2), reason: 'requested' },
    context: [reading('rainfall', 0), reading('water_level', 1)],
    waterLevelBands: { alertM: 2, warningM: 2.5, dangerM: 3 },
    passes: segments.map((s) => ({ segmentId: s.id, state: 'valid', validTo: at(24 * 200), readAt: NOW })),
    flags: segments.map((s) => ({ segmentId: s.id, severity: null, readAt: NOW })),
    geofences: []
  })
  return { plan, dock, drone, groundAmslM }
}

if (import.meta.main) {
  const [outArg] = process.argv.slice(2)
  if (!outArg) throw new Error('usage: bun run export:mission <outDir>')
  const outDir = resolve(outArg)
  const repoRoot = join(import.meta.dir, '../../..')
  const { plan, drone } = await demoPlan((path) => Bun.file(join(repoRoot, path)).json())
  const name = `${plan.id}-${NOT_FLIGHT_READY.replace(' ', '-')}`
  await mkdir(outDir, { recursive: true })
  await writeFile(join(outDir, `${name}.kmz`), exportWpmlKmz({ plan, drone }))
  await writeFile(join(outDir, `${name}.plan`), exportQgcPlan({ plan, drone, groundAmslM }))
  console.log(`wrote ${name}.kmz and ${name}.plan (${plan.waypoints.length} waypoints) to ${outDir}`)
}
