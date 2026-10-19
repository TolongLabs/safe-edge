import { describe, expect, test } from 'bun:test'
import { PatrolPlan, type ContextSnapshot } from '@safe-edge/contracts'
import { booleanPointInPolygon } from '@turf/boolean-point-in-polygon'
import { distance } from '@turf/distance'
import { polygon } from '@turf/helpers'
import { nearestPointOnLine } from '@turf/nearest-point-on-line'
import type { FeatureCollection, LineString } from 'geojson'
import {
  elminaLayerPaths,
  loadElmina,
  planPatrol,
  planStations,
  splitEdges,
  type PatrolPlanInput,
  type ThirdParty
} from '../src/index.ts'
import { dock, drone, readJson, reading } from './support.ts'

const MINUTE_MS = 60_000
const SECOND_MS = 1000
/** Elmina keeps Malaysia time, UTC+8, all year. */
const myt = (local: string) => new Date(`${local}+08:00`).toISOString()
const plus = (iso: string, minutes: number) => new Date(Date.parse(iso) + minutes * MINUTE_MS).toISOString()

/**
 * Start of civil twilight at 3.18° N, 101.51° E from api.sunrise-sunset.org (an independent calculation), fetched
 * 19 Oct 2026: 06:36:34 MYT on 21 Oct and 06:36:28 MYT on 22 Oct. The dock is 0.4 km away, a second's difference.
 */
const FIRST_LIGHT_21_OCT = '2026-10-20T22:36:34.000Z'
const FIRST_LIGHT_22_OCT = '2026-10-21T22:36:28.000Z'
/** A data.gov.my thunderstorm warning, as a labelled fixture. */
const warning = (observedAt: string, validTo: string): ContextSnapshot => ({
  kind: 'lightning_warning',
  value: null,
  text: 'Ribut petir di beberapa tempat',
  observedAt,
  validTo,
  publisher: 'data.gov.my',
  stationId: null,
  url: null,
  simulated: true,
  source: 'fixture'
})
const closeTo = (iso: string, expected: string) => Math.abs(Date.parse(iso) - Date.parse(expected)) < 5 * SECOND_MS

describe('flight windows', async () => {
  const elmina = await loadElmina(readJson)
  const segments = splitEdges({ ...elmina, maxBendDeg: 40, pointObstructionToleranceM: 3 })
  const segment = (id: string) => segments.find((s) => s.id === id)!

  const input = (ids: string[], now: string): PatrolPlanInput => ({
    id: 'plan_test',
    now,
    edges: elmina.edges,
    segments: ids.map(segment),
    dock,
    drone,
    rangeM: 15,
    forwardOverlap: 0.6,
    altitudeM: 9,
    altitudeCapM: 60,
    notBefore: now,
    windowMinutes: 60,
    context: [reading('rainfall', 0, plus(now, -30)), reading('water_level', 1, plus(now, -30))],
    waterLevelBands: { alertM: 2, warningM: 2.5, dangerM: 3 },
    passes: ids.map((segmentId) => ({ segmentId, state: 'valid', validTo: plus(now, 200 * 24 * 60), readAt: now })),
    flags: ids.map((segmentId) => ({ segmentId, severity: null, readAt: now })),
    geofences: [],
    thirdParties: [],
    separationWaitS: 120
  })

  test('a plan asked for in the evening opens at first light next morning, under the air-traffic altitude cap', () => {
    const plan = planPatrol(input(['seg_866518980_5', 'seg_866518980_9'], myt('2026-10-20T20:00:00')))

    expect(PatrolPlan.parse(plan)).toEqual(plan)
    expect(plan.window.reason).toBe('first_light')
    expect(closeTo(plan.window.start, FIRST_LIGHT_21_OCT)).toBe(true)
    expect(plan.window.end).toBe(plus(plan.window.start, 60))
    expect(plan.holds).toEqual([])
    expect(plan.waypoints[0]).toMatchObject({ kind: 'takeoff', eta: plan.window.start })
    expect(Date.parse(plan.waypoints.at(-1)!.eta)).toBeLessThanOrEqual(Date.parse(plan.window.end))

    expect(plan.altitudeCapM).toBe(60)
    for (const w of plan.waypoints) expect(w.altM).toBeLessThanOrEqual(60)
    expect(() =>
      planPatrol({ ...input(['seg_866518980_5'], myt('2026-10-20T20:00:00')), altitudeM: 12, altitudeCapM: 10 })
    ).toThrow('altitude 12 m is above the 10 m cap')
  })

  test('a plan asked for inside the morning window launches straight away and keeps the window end', () => {
    const now = myt('2026-10-21T07:00:00')
    const plan = planPatrol(input(['seg_866518980_5'], now))

    expect(plan.window).toMatchObject({ start: now, reason: 'first_light' })
    expect(closeTo(plan.window.end, plus(FIRST_LIGHT_21_OCT, 60))).toBe(true)
    expect(plan.holds).toEqual([])
  })

  test('S1: rain and lightning at dawn hold the launch until the next dry morning; a path segment with people waits', () => {
    const now = myt('2026-10-21T05:30:00')
    const base = input(['seg_866518980_5', 'seg_866518980_9', 'seg_866518980_11'], now)
    // A JPS "heavy" hour at Sungai Buloh and a thunderstorm warning until 08:00, both labelled fixtures.
    const rain = reading('rainfall', 40, myt('2026-10-21T05:15:00'))
    const lightning = warning(myt('2026-10-21T05:00:00'), myt('2026-10-21T08:00:00'))
    const context = [rain, lightning, reading('water_level', 1, myt('2026-10-21T05:15:00'))]
    // People on the footway (OSM way/926276001) beside segment 9, 23 m from its nearest station: a labelled fixture.
    const people: ThirdParty = {
      id: 'obs_people_footway',
      kind: 'person',
      label: '3 people on the lakeside footway',
      geometry: { type: 'Point', coordinates: [101.514381, 3.180066] },
      observedAt: myt('2026-10-21T05:20:00'),
      simulated: true,
      source: 'fixture'
    }
    const plan = planPatrol({ ...base, context, windowMinutes: 120, thirdParties: [people] })

    // Today's window runs from first light (06:36) to 08:36. The warning ends at 08:00 and the reading stops counting
    // three hours after it was taken, at 08:15, so the gate alone would launch at 08:15. After heavy rain the patrol
    // waits for a morning that is dry from first light: tomorrow, when the heavy reading is over a day old.
    expect(plan.window.reason).toBe('next_dry_window')
    expect(closeTo(plan.window.start, FIRST_LIGHT_22_OCT)).toBe(true)
    expect(plan.window.end).toBe(plus(plan.window.start, 120))
    expect(plan.waypoints[0]).toMatchObject({ kind: 'takeoff', eta: plan.window.start })
    expect(plan.holds).toEqual([
      expect.objectContaining({ kind: 'weather', segmentId: null, until: plan.window.start }),
      expect.objectContaining({ kind: 'lightning', segmentId: null, until: lightning.validTo }),
      expect.objectContaining({ kind: 'separation', segmentId: 'seg_866518980_9', until: null })
    ])
    // The planner never releases a hold; core's releasePlanHold records the pilot's confirm-clear.
    for (const hold of plan.holds) expect(hold).toMatchObject({ releasedBy: null, releasedAt: null })
    const [weatherHold, lightningHold, pathHold] = plan.holds
    expect(weatherHold!.reason).toBe(
      `rain 40 mm/h at JPS Public Infobanjir station 27880 (observed ${rain.observedAt}) is above the dock's 2 mm/h limit; after heavy rain (observed ${rain.observedAt}) the launch waits for a morning that is dry from first light`
    )
    expect(lightningHold!.reason).toBe(
      `lightning warning from data.gov.my (observed ${lightning.observedAt}) is in force until ${lightning.validTo}: "Ribut petir di beberapa tempat"`
    )

    // The segment stays in the route and waits there; the camera has no zoom to stand further off.
    const held = Array.from({ length: 11 }, (_, i) => `stn_866518980_9_${i + 8}`).join(', ')
    expect(pathHold!.reason).toBe(
      `stations ${held} are within 50 m of "3 people on the lakeside footway" (person, seen ${people.observedAt}), closest 23 m; the segment waits for the pilot or observer to confirm the path is clear; the plan budgets 2.0 min of hover before stn_866518980_9_8 for it, and a longer wait uses the reserve`
    )
    expect(plan.tasks.map((t) => t.segmentId).toSorted()).toEqual(base.segments.map((s) => s.id).toSorted())
    expect(plan.rejected).toEqual([])
    expect(plan.tasks.find((t) => t.segmentId === 'seg_866518980_9')!.stations).toHaveLength(27)
  })

  test('light rain above the dock limit holds the launch only until a reading at the limit, the same morning', () => {
    const now = myt('2026-10-21T05:30:00')
    // Labelled fixtures, as a scenario would script them: 3 mm/h at 06:00, then 2 mm/h (the limit itself) at 07:10.
    const wet = reading('rainfall', 3, myt('2026-10-21T06:00:00'))
    const easing = reading('rainfall', 2, myt('2026-10-21T07:10:00'))
    const plan = planPatrol({
      ...input(['seg_866518980_5'], now),
      context: [wet, easing, reading('water_level', 1, myt('2026-10-21T05:15:00'))]
    })

    expect(plan.window).toMatchObject({ start: easing.observedAt, reason: 'next_dry_window' })
    expect(closeTo(plan.window.end, plus(FIRST_LIGHT_21_OCT, 60))).toBe(true)
    expect(plan.holds).toEqual([
      {
        kind: 'weather',
        segmentId: null,
        until: easing.observedAt,
        reason: `rain 3 mm/h at JPS Public Infobanjir station 27880 (observed ${wet.observedAt}) is above the dock's 2 mm/h limit`,
        releasedBy: null,
        releasedAt: null
      }
    ])
    expect(plan.waypoints[0]!.eta).toBe(easing.observedAt)
  })

  test('the route lands before the window closes, and segments that do not fit are rejected as outside the window', () => {
    // The whole lake takes over 20 minutes under the assumed model (a 3 s hover at each of about 370 stations alone is
    // 18 minutes); this window is 10 minutes long and the battery has room for all of it.
    const ids = segments.filter((s) => s.osmId === 866518980).map((s) => s.id)
    const plan = planPatrol({ ...input(ids, myt('2026-10-20T20:00:00')), windowMinutes: 10 })

    expect(plan.tasks.length).toBeGreaterThan(0)
    expect(plan.rejected.length).toBeGreaterThan(0)
    expect([...plan.tasks, ...plan.rejected].map((x) => x.segmentId).toSorted()).toEqual(ids.toSorted())
    for (const { code, reason } of plan.rejected) {
      expect(code).toBe('outside_window')
      expect(reason).toMatch(/^needs \d+\.\d min more; \d+\.\d min left before the window closes at \S+Z$/)
    }
    expect(plan.waypoints.at(-1)!.kind).toBe('landing')
    expect(Date.parse(plan.waypoints.at(-1)!.eta)).toBeLessThanOrEqual(Date.parse(plan.window.end))
  })

  test('time waiting for a held segment counts against the battery and the window', () => {
    const id = 'seg_866518980_9'
    // People on the footway (OSM way/926276001) beside segment 9, as in S1: a labelled fixture. The test drone has no
    // zoom, so the stations stay where they are and only the wait changes the plan.
    const peopleAt = [101.514381, 3.180066]
    const people: ThirdParty = {
      id: 'obs_people_footway',
      kind: 'person',
      label: '3 people on the lakeside footway',
      geometry: { type: 'Point', coordinates: peopleAt },
      observedAt: myt('2026-10-20T19:50:00'),
      simulated: true,
      source: 'fixture'
    }
    const base = input([id], myt('2026-10-20T20:00:00'))
    const clear = planPatrol(base)
    const held = planPatrol({ ...base, thirdParties: [people] })
    expect(clear.holds).toEqual([])
    expect(held.holds.map((h) => [h.kind, h.segmentId])).toEqual([['separation', id]])
    // Stations 8 to 18 are within 50 m of them; the first of those in flying order is where the wait ends.
    expect(held.holds[0]!.reason).toMatch(
      /; the plan budgets 2\.0 min of hover before stn_866518980_9_(8|18) for it, and a longer wait uses the reserve$/
    )

    // Two minutes of hover at the test drone's 220 W: 7.33 Wh more for the task and the plan, and 2 minutes later home.
    const waitWh = (220 * 120) / 3600
    expect(held.tasks[0]!.energyWh - clear.tasks[0]!.energyWh).toBeCloseTo(waitWh, 9)
    expect(held.energyWh - clear.energyWh).toBeCloseTo(waitWh, 9)
    const landing = (plan: typeof held) => Date.parse(plan.waypoints.at(-1)!.eta)
    expect(landing(held) - landing(clear)).toBe(120 * SECOND_MS)
    // The drone waits at the last waypoint clear of the people, then flies on to the first station that is too close:
    // between those two, and nowhere else, the time is more than the 8 m/s flight plus the 3 s capture hover.
    const m = { units: 'meters' } as const
    const w = held.waypoints
    const at = (i: number) => [w[i]!.lon, w[i]!.lat]
    const extraS = w.slice(1).map((next, i) => {
      const takenS = (Date.parse(next.eta) - Date.parse(w[i]!.eta)) / SECOND_MS
      const flyS = distance(at(i), at(i + 1), m) / 8 + Math.abs(next.altM - w[i]!.altM) / 3
      return Math.round(takenS - flyS - (w[i]!.kind === 'station' ? 3 : 0)) + 0 // + 0 turns -0 into 0
    })
    const k = extraS.findIndex((x) => x > 0) + 1
    expect(extraS).toEqual(extraS.map((_, i) => (i + 1 === k ? 120 : 0)))
    expect(w[k]!.kind).toBe('station')
    expect(distance(at(k), peopleAt, m)).toBeLessThan(50)
    expect(distance(at(k - 1), peopleAt, m)).toBeGreaterThanOrEqual(50)

    // A window with a minute to spare without the wait, and a battery with 3 Wh to spare: the wait does not fit either.
    const minutes = (landing(clear) - Date.parse(clear.window.start)) / MINUTE_MS + 1
    const late = planPatrol({ ...base, thirdParties: [people], windowMinutes: minutes })
    expect(late.tasks).toEqual([])
    expect(late.rejected).toEqual([
      { segmentId: id, code: 'outside_window', reason: expect.stringMatching(/^needs \d+\.\d min more; /) }
    ])
    const small = { ...drone, usableBatteryWh: drone.reserveWh + clear.energyWh + 3 }
    expect(planPatrol({ ...base, drone: small }).tasks).toHaveLength(1)
    const flat = planPatrol({ ...base, drone: small, thirdParties: [people] })
    expect(flat.tasks).toEqual([])
    expect(flat.rejected).toEqual([
      { segmentId: id, code: 'battery', reason: expect.stringMatching(/^needs \d+\.\d Wh more; /) }
    ])
  })

  test('take-off and landing wait while a person is within 30 m of the dock, and only then', () => {
    // CAR 2016 reg. 143(1)(g): not "within 30 metres of any person during take-off or landing". Labelled fixtures south
    // of the dock, away from the lake: one 20 m off, one 40 m off.
    const south = (m: number): ThirdParty => ({
      id: `obs_person_${m}m`,
      kind: 'person',
      label: `person ${m} m south of the dock`,
      geometry: { type: 'Point', coordinates: [dock.position.lon, dock.position.lat - m / 111_320] },
      observedAt: myt('2026-10-20T19:50:00'),
      simulated: true,
      source: 'fixture'
    })
    const base = input(['seg_866518980_5'], myt('2026-10-20T20:00:00'))
    const near = planPatrol({ ...base, thirdParties: [south(20), south(40)] })
    expect(near.holds).toEqual([
      {
        kind: 'separation',
        segmentId: null,
        until: null,
        releasedBy: null,
        releasedAt: null,
        reason: `"person 20 m south of the dock" (person, seen ${myt('2026-10-20T19:50:00')}) is within 30 m of ${dock.name}, closest 20 m; take-off and landing wait for the pilot or observer to confirm no one is within 30 m of the dock (CAR 2016 reg. 143(1)(g))`
      }
    ])
    // The route itself is unchanged: the hold is on the dock, not on any segment.
    expect(near.waypoints).toEqual(planPatrol(base).waypoints)

    expect(planPatrol({ ...base, thirdParties: [south(40)] }).holds).toEqual([])
    // A mapped structure by the dock is not a person: rule (g) is about people.
    expect(
      planPatrol({ ...base, thirdParties: [{ ...south(20), kind: 'structure', observedAt: null }] }).holds
    ).toEqual([])
  })

  test('a station within 50 m of a person moves to a longer zoom stand-off when the camera allows it', () => {
    const id = 'seg_866518980_7' // 298 m of lake bank in the park, with a footway 11 to 18 m behind it
    const zoomDrone = { ...drone, camera: { ...drone.camera, maxZoom: 3 } }
    // A jogger on that footway (OSM way/926276001), 30 m from the nearest station: a labelled fixture.
    const joggerAt = [101.514452, 3.179396]
    const jogger: ThirdParty = {
      id: 'obs_jogger',
      kind: 'person',
      label: 'jogger on the footway',
      geometry: { type: 'Point', coordinates: joggerAt },
      observedAt: myt('2026-10-20T19:50:00'),
      simulated: true,
      source: 'fixture'
    }
    const base = { ...input([id], myt('2026-10-20T20:00:00')), drone: zoomDrone }
    const [nominal] = planStations({ ...base, camera: zoomDrone.camera }).tasks
    const plan = planPatrol({ ...base, thirdParties: [jogger] })

    expect(plan.holds).toEqual([])
    expect(plan.rejected).toEqual([])
    const flown = plan.tasks[0]!.stations
    const first = nominal!.stations[0]!.pose
    const stations = flown[0]!.lon === first.lon && flown[0]!.lat === first.lat ? flown : flown.toReversed()
    expect(stations).toHaveLength(nominal!.stations.length)

    const lake = polygon([elmina.edges.find((e) => e.osmId === 866518980)!.geometry.coordinates])
    const m = { units: 'meters' } as const
    let moved = 0
    nominal!.stations.forEach((before, i) => {
      const after = stations[i]!
      const at = [after.lon, after.lat]
      expect(distance(at, joggerAt, m)).toBeGreaterThanOrEqual(50)
      if (distance([before.pose.lon, before.pose.lat], joggerAt, m) >= 50) {
        expect(after).toEqual({ ...before.pose, viewpointId: null })
        return
      }
      moved++
      // Further out over the water on the same line of sight, at the same height, zoomed so the aim point is seen at
      // the 15 m range's detail.
      const outM = distance(at, before.aim, m)
      expect(booleanPointInPolygon(at, lake)).toBe(true)
      expect(after.altM).toBe(9)
      expect(after.headingDeg).toBeCloseTo(before.pose.headingDeg, 1)
      expect(after.gimbalPitchDeg).toBeCloseTo(-Math.atan2(9, outM) * (180 / Math.PI), 3)
      expect(Math.hypot(outM, 9) / after.zoom).toBeCloseTo(15, 3)
      expect(after.zoom).toBeGreaterThan(1)
      expect(after.zoom).toBeLessThanOrEqual(3)
    })
    expect(moved).toBeGreaterThan(0)
  })

  test('a mapped structure no stand-off clears leaves its nearby stations out of the plan instead of waiting', async () => {
    const id = 'seg_866518980_7'
    const paths = (await readJson(elminaLayerPaths.paths)) as FeatureCollection<LineString, { osm_id: number }>
    const bridge = paths.features.find((f) => f.properties.osm_id === 926280618)!
    // The OSM footbridge across the lake at the segment's end, treated as not under the pilot's control.
    const footbridge: ThirdParty = {
      id: 'way/926280618',
      kind: 'structure',
      label: 'footbridge way/926280618',
      geometry: bridge.geometry,
      observedAt: null,
      simulated: false,
      source: 'osm'
    }
    const base = input([id], myt('2026-10-20T20:00:00'))
    const [nominal] = planStations({ ...base, camera: drone.camera }).tasks
    const plan = planPatrol({ ...base, thirdParties: [footbridge] })

    const m = { units: 'meters' } as const
    const tooClose = nominal!.stations.filter(
      (s) => nearestPointOnLine(bridge.geometry, [s.pose.lon, s.pose.lat], m).properties.pointDistance < 50
    )
    expect(tooClose.length).toBeGreaterThan(0)
    expect(plan.holds).toEqual([])
    expect(plan.rejected).toEqual([
      {
        segmentId: id,
        code: 'separation_hold',
        reason: `stations ${tooClose.map((s) => s.id).join(', ')} left out: within 50 m of "footbridge way/926280618" (structure), and no stand-off over the water within the camera's 1× zoom clears it; the rest of the segment is planned`
      }
    ])
    expect(plan.tasks[0]!.stations).toHaveLength(nominal!.stations.length - tooClose.length)
  })
})
