import type { ContextSnapshot, Dock, DroneProfile } from '@safe-edge/contracts'
import { join } from 'node:path'

const repoRoot = join(import.meta.dir, '../../..')
export const readJson = (path: string) => Bun.file(join(repoRoot, path)).json()

// Test fixtures, not a chosen site or aircraft: a dock on a park building roof by the lake, and assumed drone figures.
export const dock: Dock = {
  id: 'dock_central_park',
  name: 'Central Park facility roof',
  position: { lon: 101.5135, lat: 3.1784, altM: 6 },
  rainLimitMmPerH: 2,
  droneProfileIds: ['drn_assumed'],
  simulated: true,
  source: 'fixture'
}
export const drone: DroneProfile = {
  id: 'drn_assumed',
  name: 'assumed test drone',
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

export const reading = (
  kind: 'rainfall' | 'water_level',
  value: number,
  observedAt: string,
  validTo: string | null = null
): ContextSnapshot => ({
  kind,
  value,
  text: null,
  observedAt,
  validTo,
  publisher: 'JPS Public Infobanjir',
  stationId: kind === 'rainfall' ? '27880' : null,
  url: null,
  simulated: true,
  source: 'fixture'
})
