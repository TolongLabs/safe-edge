// #150: CAR 2016 regulation 143 over the whole flight, on real Elmina geometry: the transits between stops and to and
// from the dock, the climb from the dock and the descent onto it, and open-air assemblies of more than 1,000 persons.
import { describe, expect, test } from 'bun:test'
import { distance } from '@turf/distance'
import { lineString } from '@turf/helpers'
import type { FeatureCollection, LineString, Polygon } from 'geojson'
import { nearestPointOnLine } from '@turf/nearest-point-on-line'
import {
  elminaLayerPaths,
  loadElmina,
  planPatrol,
  planStations,
  replan,
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
      headcount: null,
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

  test('a vehicle within 50 m of the dock holds take-off and landing; a structure there grounds every patrol', async () => {
    // A van parked 40 m south of the dock, away from the lake: (e) keeps 50 m from vehicles, take-off included. A
    // labelled fixture.
    const van: ThirdParty = {
      id: 'obs_van_dock',
      kind: 'vehicle',
      label: 'van parked by the dock building',
      geometry: { type: 'Point', coordinates: [dock.position.lon, dock.position.lat - 40 / 111_320] },
      observedAt: SEEN,
      headcount: null,
      simulated: true,
      source: 'fixture'
    }
    const waiting = planPatrol(input([WEST], [van]))
    expect(waiting.holds).toEqual([
      {
        kind: 'separation',
        segmentId: null,
        until: null,
        releasedBy: null,
        releasedAt: null,
        reason: `"van parked by the dock building" (vehicle, seen ${SEEN}) is within 50 m of ${dock.name}, closest 40 m; take-off and landing wait for the pilot or observer to confirm the dock and the transits from and to it are clear (CAR 2016 reg. 143(1))`
      }
    ])
    expect(waiting.waypoints).toEqual(planPatrol(input([WEST])).waypoints)

    // The OSM footbridge way/926280618 by the dock, treated as not under the pilot's control: it stays put.
    const paths = (await readJson(elminaLayerPaths.paths)) as FeatureCollection<LineString, { osm_id: number }>
    const bridge = paths.features.find((f) => f.properties.osm_id === 926280618)!.geometry
    const footbridge: ThirdParty = {
      id: 'way/926280618',
      kind: 'structure',
      label: 'footbridge way/926280618',
      geometry: bridge,
      observedAt: null,
      headcount: null,
      simulated: false,
      source: 'osm'
    }
    const dockAt = [dock.position.lon, dock.position.lat]
    const bridgeM = nearestPointOnLine(bridge, dockAt, m).properties.pointDistance
    expect(bridgeM).toBeLessThan(50)
    const grounded = planPatrol(input([EAST, WEST], [footbridge]))
    expect(grounded.tasks).toEqual([])
    expect(grounded.waypoints).toEqual([])
    expect(grounded.holds).toEqual([])
    expect(grounded.rejected).toEqual(
      [EAST, WEST].map((segmentId) => ({
        segmentId,
        code: 'separation_hold',
        reason: `the climb from ${dock.name} comes within 50 m of "footbridge way/926280618" (structure), closest ${bridgeM.toFixed(0)} m, which waiting would not clear; no patrol can take off or land there`
      }))
    )
  })

  test('no leg flies within 50 m of a structure: transits past one are not taken, and a flight line past one is out', async () => {
    const paths = (await readJson(elminaLayerPaths.paths)) as FeatureCollection<LineString, { osm_id: number }>
    const footbridge = (osmId: number): ThirdParty => ({
      id: `way/${osmId}`,
      kind: 'structure',
      label: `footbridge way/${osmId}`,
      geometry: paths.features.find((f) => f.properties.osm_id === osmId)!.geometry,
      observedAt: null,
      headcount: null,
      simulated: false,
      source: 'osm'
    })
    const legsOf = (plan: ReturnType<typeof planPatrol>) =>
      plan.waypoints.slice(1).flatMap((b, i) => {
        const a = plan.waypoints[i]!
        return a.lon === b.lon && a.lat === b.lat
          ? []
          : [
              lineString([
                [a.lon, a.lat],
                [b.lon, b.lat]
              ])
            ]
      })
    const legM = (leg: ReturnType<typeof lineString>, bridge: LineString) =>
      Math.min(
        ...bridge.coordinates.map((c) => nearestPointOnLine(leg, c, m).properties.pointDistance),
        ...leg.geometry.coordinates.map((c) => nearestPointOnLine(bridge, c, m).properties.pointDistance)
      )

    // Footbridge way/909868199 curves between the east and west banks, 96 m from the dock and more than 50 m from
    // every station: only the transits between the two banks pass it.
    const between = footbridge(909868199)
    const bridge = between.geometry as LineString
    const clear = planPatrol(input([EAST, WEST]))
    expect(Math.min(...legsOf(clear).map((leg) => legM(leg, bridge)))).toBeLessThan(50)
    const plan = planPatrol(input([EAST, WEST], [between]))
    for (const leg of legsOf(plan)) expect(legM(leg, bridge)).toBeGreaterThanOrEqual(50)
    expect(plan.tasks).toHaveLength(1)
    expect(plan.holds).toEqual([])
    const [left] = [EAST, WEST].filter((id) => id !== plan.tasks[0]!.segmentId)
    expect(plan.rejected).toEqual([
      {
        segmentId: left,
        code: 'separation_hold',
        reason: expect.stringMatching(
          /^every straight transit to it comes within 50 m of "footbridge way\/909868199" \(structure\), closest \d+ m, which waiting would not clear$/
        )
      }
    ])

    // A contractor's crane on the bank halfway along the lake's 519 m west arm, segment 18: a labelled fixture. Its
    // stations within 50 m are left out, and the flight line between the stations either side would pass it 9 m off,
    // so the segment is out. (Mapped footbridges never do this: segments split where paths cross the bank.)
    const crane: ThirdParty = {
      id: 'obs_crane_west_arm',
      kind: 'structure',
      label: 'crane on the west arm bank',
      geometry: { type: 'Point', coordinates: [101.5070877, 3.1767494] },
      observedAt: SEEN,
      headcount: null,
      simulated: true,
      source: 'fixture'
    }
    const crossed = planPatrol(input(['seg_866518980_18'], [crane]))
    expect(crossed.tasks).toEqual([])
    expect(crossed.rejected).toEqual([
      expect.objectContaining({ segmentId: 'seg_866518980_18', code: 'separation_hold' }),
      {
        segmentId: 'seg_866518980_18',
        code: 'separation_hold',
        reason: `its flight line comes within 50 m of "crane on the west arm bank" (structure, seen ${SEEN}), closest 9 m, which waiting would not clear`
      }
    ])
  })

  test('an assembly in the open air of more than 1,000 persons is kept 150 m clear; 1,000 is not one', () => {
    // CAR 2016 reg. 143(1)(c), (d): no flight "over any assembly in the open air of more than 1,000 persons" nor "within
    // 150 metres of" one. A labelled fixture: an event filling Elmina Urban Park (the mapped park polygon), 132 m from
    // the west bank's nearest station and 334 m from the dock.
    const park = elmina.designatedAreas.find((a) => a.id === 'way/1309457596')!
    expect(park.label).toBe('Elmina Urban Park (recreational)')
    const event = (headcount: number): ThirdParty => ({
      id: 'obs_event_urban_park',
      kind: 'person',
      label: 'Deepavali open house in Elmina Urban Park',
      geometry: park.geometry as Polygon,
      observedAt: SEEN,
      headcount,
      simulated: true,
      source: 'fixture'
    })
    const ids = [EAST, WEST, 'seg_866518980_7']
    const clear = planPatrol(input(ids))
    expect(clear.rejected).toEqual([])

    const kept = planPatrol(input(ids, [event(1500)]))
    expect(kept.tasks.map((t) => t.segmentId).toSorted()).toEqual([EAST, 'seg_866518980_7'].toSorted())
    expect(kept.holds).toEqual([])
    expect(kept.rejected).toEqual([
      {
        segmentId: WEST,
        code: 'authorisation',
        reason: `its flight line comes within 150 m of "Deepavali open house in Elmina Urban Park" (person, 1500 people, seen ${SEEN}), closest 132 m, an assembly in the open air of more than 1,000 persons (CAR 2016 reg. 143(1)(c), (d))`
      }
    ])
    const ring = lineString((park.geometry as Polygon).coordinates[0]!)
    for (const w of kept.waypoints) {
      expect(nearestPointOnLine(ring, [w.lon, w.lat], m).properties.pointDistance).toBeGreaterThanOrEqual(150)
    }

    // A thousand people is not more than 1,000: they are people like any others, and all of them are far enough off.
    expect(planPatrol(input(ids, [event(1000)]))).toEqual(clear)
  })

  test('an assembly within 150 m of the dock grounds every patrol, whatever the authorisation', () => {
    // A concert crowd on the lakeside footway at S1's path crowd vertex (OSM way/926276001), 147 m from the dock.
    const concert: ThirdParty = {
      id: 'obs_concert_footway',
      kind: 'person',
      label: 'concert crowd on the lakeside footway',
      geometry: { type: 'Point', coordinates: [101.5144008, 3.1793557] },
      observedAt: SEEN,
      headcount: 1200,
      simulated: true,
      source: 'fixture'
    }
    const concertM = distance([dock.position.lon, dock.position.lat], concert.geometry.coordinates as number[], m)
    expect(concertM).toBeLessThan(150)
    const authorised = { ref: 'test authorisation', simulated: true, source: 'fixture' }
    const plan = planPatrol({ ...input([EAST, WEST], [concert]), authorisation: authorised })
    expect(plan.tasks).toEqual([])
    expect(plan.waypoints).toEqual([])
    expect(plan.rejected).toEqual(
      [EAST, WEST].map((segmentId) => ({
        segmentId,
        code: 'authorisation',
        reason: `the climb from ${dock.name} comes within 150 m of "concert crowd on the lakeside footway" (person, 1200 people, seen ${SEEN}), closest ${concertM.toFixed(0)} m, an assembly in the open air of more than 1,000 persons (CAR 2016 reg. 143(1)(c), (d)); no patrol can take off or land there`
      }))
    )
  })

  test('a re-plan in flight checks its new way home: one dock hold, for the landing only', () => {
    // Someone 40 m south of the dock, away from the lake: a labelled fixture. They are clear of take-off and landing
    // (30 m), not of the transits that start and end above the dock.
    const byTheDock: ThirdParty = {
      id: 'obs_person_dock_40m',
      kind: 'person',
      label: 'person 40 m south of the dock',
      geometry: { type: 'Point', coordinates: [dock.position.lon, dock.position.lat - 40 / 111_320] },
      observedAt: SEEN,
      headcount: null,
      simulated: true,
      source: 'fixture'
    }
    const flying = planPatrol(input([EAST, WEST], [byTheDock]))
    expect(flying.tasks.map((t) => t.segmentId)).toEqual([EAST, WEST])
    expect(flying.holds.map((h) => [h.kind, h.segmentId])).toEqual([['separation', null]])

    // The east bank is flown; a confirmed flag re-plans the rest from there.
    const trigger = { kind: 'flag_confirmed' as const, segmentId: WEST, findingId: 'fnd_1' }
    const next = replan(
      flying,
      { committedTasks: 1 },
      { ...input([EAST, WEST], [byTheDock]), id: 'plan_next' },
      trigger
    )
    expect(next.tasks.map((t) => t.segmentId)).toEqual([EAST, WEST])
    expect(next.holds).toEqual([
      {
        kind: 'separation',
        segmentId: null,
        until: null,
        releasedBy: null,
        releasedAt: null,
        reason: `the transit from ${WEST} to ${dock.name} passes within 50 m of "person 40 m south of the dock" (person, seen ${SEEN}), closest 40 m; take-off and landing wait for the pilot or observer to confirm the dock and the transits from and to it are clear (CAR 2016 reg. 143(1))`
      }
    ])
  })
})
