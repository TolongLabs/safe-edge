// #150: CAR 2016 regulation 143 over the whole flight, on real Elmina geometry: the transits between stops and to and
// from the dock, the climb from the dock and the descent onto it, and open-air assemblies of more than 1,000 persons.
import { describe, expect, test } from 'bun:test'
import { distance } from '@turf/distance'
import { lineString } from '@turf/helpers'
import { nearestPointOnLine } from '@turf/nearest-point-on-line'
import {
  loadElmina,
  planPatrol,
  planStations,
  splitEdges,
  type PatrolPlanInput,
  type ThirdParty
} from '../src/index.ts'
import { dock, drone, readJson, reading } from './support.ts'

const NOW = '2026-10-20T12:00:00.000Z'
const SEEN = '2026-10-20T11:50:00.000Z'
const m = { units: 'meters' } as const
/** The east bank by the lakeside footway, and the west bank by the dock. */
const EAST = 'seg_866518980_9'
const WEST = 'seg_866518980_5'

describe('separation over the whole flight', async () => {
  const elmina = await loadElmina(readJson)
  const segments = splitEdges({ ...elmina, maxBendDeg: 40, pointObstructionToleranceM: 3 })
  const input = (ids: string[], thirdParties: ThirdParty[] = []): PatrolPlanInput => ({
    id: 'plan_test',
    now: NOW,
    edges: elmina.edges,
    segments: ids.map((id) => segments.find((s) => s.id === id)!),
    dock,
    drone,
    rangeM: 15,
    forwardOverlap: 0.6,
    viewpoints: [],
    altitudeM: 9,
    altitudeCapM: 60,
    notBefore: NOW,
    windowMinutes: 60,
    context: [reading('rainfall', 0, NOW), reading('water_level', 1, NOW)],
    waterLevelBands: { alertM: 2, warningM: 2.5, dangerM: 3 },
    passes: ids.map((segmentId) => ({ segmentId, state: 'valid', validTo: '2027-06-01T00:00:00.000Z', readAt: NOW })),
    flags: ids.map((segmentId) => ({ segmentId, severity: null, readAt: NOW })),
    geofences: [],
    authorisation: null,
    thirdParties,
    separationWaitS: 120
  })

  test('people beside the transit between two stops hold the stop it flies into, and the wait is budgeted', () => {
    // On the curving footbridge way/909868199 between the two banks: 78 m from the nearest station and 99 m from the
    // dock, but 9 m from the straight transit from the east bank to the west bank. A labelled fixture.
    const people: ThirdParty = {
      id: 'obs_people_footbridge',
      kind: 'person',
      label: 'people on footbridge way/909868199',
      geometry: { type: 'Point', coordinates: [101.5130697, 3.1791843] },
      observedAt: SEEN,
      simulated: true,
      source: 'fixture'
    }
    const clear = planPatrol(input([EAST, WEST]))
    const held = planPatrol(input([EAST, WEST], [people]))

    // The same route: the transit is the only part of the flight near them.
    expect(held.tasks.map((t) => t.segmentId)).toEqual([EAST, WEST])
    expect(held.waypoints.map((w) => [w.lon, w.lat])).toEqual(clear.waypoints.map((w) => [w.lon, w.lat]))
    for (const w of held.waypoints.filter((w) => w.kind === 'station')) {
      expect(distance([w.lon, w.lat], people.geometry.coordinates as number[], m)).toBeGreaterThan(50)
    }
    const lastEast = held.waypoints.findLast((w) => w.segmentId === EAST)!
    const firstWest = held.waypoints.find((w) => w.segmentId === WEST)!
    const transit = lineString([
      [lastEast.lon, lastEast.lat],
      [firstWest.lon, firstWest.lat]
    ])
    const closestM = nearestPointOnLine(transit, people.geometry.coordinates as number[], m).properties.pointDistance
    expect(closestM).toBeLessThan(50)

    const [westTask] = planStations({ ...input([WEST]), camera: drone.camera }).tasks
    const firstWestId = westTask!.stations.find((s) => s.pose.lon === firstWest.lon && s.pose.lat === firstWest.lat)!.id
    expect(held.holds).toEqual([
      {
        kind: 'separation',
        segmentId: WEST,
        until: null,
        releasedBy: null,
        releasedAt: null,
        reason: `the transit from ${EAST} to ${WEST} passes within 50 m of "people on footbridge way/909868199" (person, seen ${SEEN}), closest ${closestM.toFixed(0)} m; the segment waits for the pilot or observer to confirm the path is clear; the plan budgets 2.0 min of hover before ${firstWestId} for it, and a longer wait uses the reserve`
      }
    ])

    // The drone hovers at the east bank's last station for the confirm: two minutes of the test drone's 220 W hover,
    // on the west stop's energy, the plan's, and every time after it.
    const waitWh = (220 * 120) / 3600
    expect(held.tasks[1]!.energyWh - clear.tasks[1]!.energyWh).toBeCloseTo(waitWh, 9)
    expect(held.tasks[0]!.energyWh).toBe(clear.tasks[0]!.energyWh)
    expect(held.energyWh - clear.energyWh).toBeCloseTo(waitWh, 9)
    const at = (plan: typeof held, i: number) => Date.parse(plan.waypoints[i]!.eta)
    const k = held.waypoints.indexOf(firstWest)
    expect(at(held, k - 1)).toBe(at(clear, k - 1))
    expect(at(held, k) - at(clear, k)).toBe(120_000)
    expect(at(held, held.waypoints.length - 1) - at(clear, clear.waypoints.length - 1)).toBe(120_000)
  })
})
