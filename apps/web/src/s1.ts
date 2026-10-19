import type { FlightView } from '@safe-edge/scene'
import { createElminaPlanner, createSafeEdgeClient, elminaSeed, type MemoryClient } from '@safe-edge/sdk'
import barriersUrl from '../../../data/elmina/osm/barriers.geojson?url'
import parksUrl from '../../../data/elmina/osm/parks.geojson?url'
import pathsUrl from '../../../data/elmina/osm/paths.geojson?url'
import waterUrl from '../../../data/elmina/osm/water.geojson?url'

// The planner asks for its layers by their repo paths (elminaLayerPaths); the browser fetches the built copies.
const plannerFiles: Record<string, string> = {
  'data/elmina/osm/water.geojson': waterUrl,
  'data/elmina/osm/barriers.geojson': barriersUrl,
  'data/elmina/osm/paths.geojson': pathsUrl,
  'data/elmina/osm/parks.geojson': parksUrl
}

async function readJson(path: string): Promise<unknown> {
  const url = plannerFiles[path]
  if (!url) throw new Error(`The planner asked for ${path}, which the scene does not serve`)
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${path} answered ${response.status}`)
  return response.json()
}

/** 05:30 on 21 Oct in Elmina (UTC+8), after a night of heavy rain and a thunderstorm warning. */
const S1_NOW = '2026-10-20T21:30:00.000Z'

const fixture = { simulated: true, source: 'fixture' } as const

// S1's request, as PLAN-7 in packages/core/test/flight-holds.test.ts makes it: labelled fixtures for a JPS "heavy" hour,
// a thunderstorm warning until 08:00 local, and normal water.
const s1Request: Parameters<MemoryClient['createPatrolPlan']>[0]['body'] = {
  dockId: 'dock_elmina_roof',
  droneProfileId: 'drn_assumed',
  segmentIds: [elminaSeed.story.s1.segmentId, 'seg_866518980_5', 'seg_866518980_9'],
  context: [
    {
      kind: 'rainfall',
      value: 40,
      text: null,
      observedAt: '2026-10-20T21:15:00.000Z',
      validTo: null,
      publisher: 'JPS Public Infobanjir',
      stationId: '27880',
      url: null,
      ...fixture
    },
    {
      kind: 'lightning_warning',
      value: null,
      text: 'Ribut petir di beberapa tempat',
      observedAt: '2026-10-20T21:00:00.000Z',
      validTo: '2026-10-21T00:00:00.000Z',
      publisher: 'data.gov.my',
      stationId: null,
      url: null,
      ...fixture
    },
    {
      kind: 'water_level',
      value: 1,
      text: null,
      observedAt: '2026-10-20T21:15:00.000Z',
      validTo: null,
      publisher: 'JPS Public Infobanjir',
      stationId: null,
      url: null,
      ...fixture
    }
  ],
  notBefore: S1_NOW,
  altitudeCapM: 60
}

export interface S1Flight {
  flight: FlightView
  /** When the scenario starts: the weather hold, before the launch window. */
  startsAt: string
  window: { start: string; end: string }
  /** The plan's holds: timed ones lift on their own, the others wait for the pilot to record the path clear. */
  holds: Array<{ kind: 'weather' | 'lightning' | 'separation'; segmentId: string | null; until: string | null }>
  /** The rain reading behind the weather hold, and the dock's limit. */
  rain: { mmPerH: number; observedAt: string; dockLimitMmPerH: number }
  energyWh: number
}

/**
 * Plans S1 in the browser through the demo's own core (the SDK's memory transport) and the Elmina planner, exactly as
 * the API would: the weather hold, the next dry window and the route the drone flies.
 */
export async function planS1(): Promise<S1Flight> {
  const planner = await createElminaPlanner(readJson, { thirdParties: [] })
  const demo = createSafeEdgeClient({
    transport: 'memory',
    userId: 'usr_manager',
    planner,
    clock: { now: () => S1_NOW }
  })
  const plan = await demo.createPatrolPlan({ body: s1Request })
  const dock = elminaSeed.docks.find((d) => d.id === s1Request.dockId)
  const drone = elminaSeed.droneProfiles.find((d) => d.id === s1Request.droneProfileId)
  if (!dock || !drone) throw new Error('The seed has no S1 dock or drone profile')
  const rain = s1Request.context.find((c) => c.kind === 'rainfall')
  if (!rain || rain.value === null) throw new Error('S1 has no rainfall reading')
  return {
    flight: {
      dock: dock.position,
      waypoints: plan.waypoints,
      usableBatteryWh: drone.usableBatteryWh,
      camera: drone.camera
    },
    startsAt: S1_NOW,
    window: { start: plan.window.start, end: plan.window.end },
    holds: plan.holds.map((h) => ({ kind: h.kind, segmentId: h.segmentId, until: h.until })),
    rain: { mmPerH: rain.value, observedAt: rain.observedAt, dockLimitMmPerH: dock.rainLimitMmPerH },
    energyWh: plan.energyWh
  }
}
