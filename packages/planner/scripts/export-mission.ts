// Plans a demo patrol over the real Elmina water edges and writes it as a DJI WPML KMZ and a QGroundControl .plan,
// both stamped "not flight-ready", for opening in DJI Pilot 2 or QGroundControl.
// Usage: bun run export:mission <outDir>
import { Dock, DroneProfile, EdgePass, type ContextSnapshot } from '@safe-edge/contracts'
import { mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { NOT_FLIGHT_READY, exportQgcPlan, exportWpmlKmz } from '../src/export/index.ts'
import { loadElmina, planPatrol, splitEdges } from '../src/index.ts'

const SEED_PATH = 'data/elmina/fixtures/seed.json'
const NOW = '2026-10-20T06:00:00.000Z'
const at = (hours: number) => new Date(Date.parse(NOW) + hours * 3_600_000).toISOString()
/** Ground elevation at the seed dock: Copernicus GLO-90 DEM via the Open-Meteo elevation API, read 19 Oct 2026. */
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

/**
 * A patrol over all 47 Elmina segments from the shared seed's dock, drone and passes, with no open flags, no rain and
 * normal water, at the capture settings core's tests use. The seed drone's battery cannot cover every segment.
 */
export async function demoPlan(readJson: (path: string) => Promise<unknown>) {
  const seed = (await readJson(SEED_PATH)) as { docks: unknown[]; droneProfiles: unknown[]; passes: unknown[] }
  const dock = Dock.parse(seed.docks[0])
  const drone = DroneProfile.parse(seed.droneProfiles[0])
  const passes = seed.passes.map((p) => EdgePass.parse(p))
  const elmina = await loadElmina(readJson)
  const segments = splitEdges({ ...elmina, maxBendDeg: 40, pointObstructionToleranceM: 3 })
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
    notBefore: NOW,
    windowMinutes: 120,
    context: [reading('rainfall', 0), reading('water_level', 1)],
    waterLevelBands: { alertM: 2, warningM: 2.5, dangerM: 3 },
    passes: passes.map((p) => ({ segmentId: p.segmentId, state: p.state, validTo: p.validTo, readAt: NOW })),
    flags: segments.map((s) => ({ segmentId: s.id, severity: null, readAt: NOW })),
    geofences: [],
    authorisation: null,
    thirdParties: [],
    separationWaitS: 120
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
