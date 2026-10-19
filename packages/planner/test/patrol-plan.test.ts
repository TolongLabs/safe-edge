import { describe, expect, test } from 'bun:test'
import { PatrolPlan } from '@safe-edge/contracts'
import { booleanIntersects } from '@turf/boolean-intersects'
import { distance } from '@turf/distance'
import { lineString } from '@turf/helpers'
import { loadElmina, planPatrol, planStations, splitEdges, type Geofence, type PatrolPlanInput } from '../src/index.ts'
import { dock, drone, readJson, reading } from './support.ts'

const NOW = '2026-10-20T06:00:00.000Z'
const HOUR_MS = 3_600_000
const at = (hours: number) => new Date(Date.parse(NOW) + hours * HOUR_MS).toISOString()

describe('patrol plans over real Elmina segments', async () => {
  const elmina = await loadElmina(readJson)
  const segments = splitEdges({ ...elmina, maxBendDeg: 40, pointObstructionToleranceM: 3 })
  const segment = (id: string) => segments.find((s) => s.id === id)!

  /** Every pass valid for 200 days, no open flags, no rain, normal water. */
  const input = (selected: typeof segments): PatrolPlanInput => ({
    id: 'plan_test',
    now: NOW,
    edges: elmina.edges,
    segments: selected,
    dock,
    drone,
    rangeM: 15,
    forwardOverlap: 0.6,
    altitudeM: 9,
    altitudeCapM: 60,
    // The window opens at first light next morning and is long enough for every segment.
    notBefore: NOW,
    windowMinutes: 180,
    context: [reading('rainfall', 0, at(-0.5)), reading('water_level', 1, at(-0.5))],
    waterLevelBands: { alertM: 2, warningM: 2.5, dangerM: 3 },
    passes: selected.map((s) => ({ segmentId: s.id, state: 'valid', validTo: at(24 * 200), readAt: NOW })),
    flags: selected.map((s) => ({ segmentId: s.id, severity: null, readAt: NOW })),
    geofences: [],
    thirdParties: []
  })

  test('scores each segment as 0.25 expiry + 0.35 reviewed flag + 0.25 rain + 0.15 water level, with the parts', () => {
    const ids = ['seg_866518980_5', 'seg_866518980_6', 'seg_866518980_7', 'seg_866518980_9']
    const base = input(ids.map(segment))
    const plan = planPatrol({
      ...base,
      // 40 mm in the hour is JPS "heavy"; 2.7 m is in the gauge's warning band.
      context: [reading('rainfall', 40, at(-0.5)), reading('water_level', 2.7, at(-0.5))],
      passes: [
        { segmentId: ids[0]!, state: 'expiring', validTo: at(24 * 15), readAt: NOW },
        { segmentId: ids[1]!, state: 'none', validTo: null, readAt: NOW },
        { segmentId: ids[2]!, state: 'valid', validTo: at(24 * 60), readAt: NOW },
        { segmentId: ids[3]!, state: 'suspended', validTo: at(24 * 100), readAt: NOW }
      ],
      flags: [
        { segmentId: ids[0]!, severity: 'high', readAt: NOW },
        { segmentId: ids[1]!, severity: 'medium', readAt: NOW },
        { segmentId: ids[2]!, severity: null, readAt: NOW },
        { segmentId: ids[3]!, severity: 'low', readAt: NOW }
      ]
    })

    expect(PatrolPlan.parse(plan)).toEqual(plan)
    expect(plan).toMatchObject({ status: 'proposed', approvedBy: null, approvedAt: null, rejected: [] })
    const priority = (id: string) => plan.tasks.find((t) => t.segmentId === id)!.priority
    // Halfway through the 30-day expiring window; a high flag; heavy rain; the warning band.
    expect(priority(ids[0]!)).toEqual({
      expiry: 0.5,
      reviewedFlag: 1,
      rain: 0.75,
      waterLevel: 2 / 3,
      total: expect.closeTo(0.7625, 9)
    })
    // No pass yet counts as due; a medium flag.
    expect(priority(ids[1]!)).toMatchObject({ expiry: 1, reviewedFlag: 2 / 3, total: expect.closeTo(0.770833, 6) })
    // A pass 60 days from expiry and no open flag score zero: known, not unknown.
    expect(priority(ids[2]!)).toMatchObject({ expiry: 0, reviewedFlag: 0, total: expect.closeTo(0.2875, 9) })
    // A suspended pass counts as due whatever its date; a low flag.
    expect(priority(ids[3]!)).toMatchObject({ expiry: 1, reviewedFlag: 1 / 3, total: expect.closeTo(0.654167, 6) })
  })

  test('a stale or missing input scores unknown, never zero, and the segment is still planned', () => {
    const [noPass, oldFlag, known] = ['seg_866518980_5', 'seg_866518980_6', 'seg_866518980_7']
    const base = input([noPass!, oldFlag!, known!].map(segment))
    const stale = {
      ...base,
      passes: base.passes.filter((p) => p.segmentId !== noPass),
      flags: base.flags.map((f) => (f.segmentId === oldFlag ? { ...f, readAt: at(-48) } : f))
    }
    const plan = planPatrol(stale)
    const priority = (id: string) => plan.tasks.find((t) => t.segmentId === id)!.priority
    expect(plan.rejected).toEqual([])
    expect(priority(noPass!)).toEqual({ expiry: null, reviewedFlag: 0, rain: 0, waterLevel: 0, total: null })
    expect(priority(oldFlag!)).toEqual({ expiry: 0, reviewedFlag: null, rain: 0, waterLevel: 0, total: null })
    expect(priority(known!)).toEqual({ expiry: 0, reviewedFlag: 0, rain: 0, waterLevel: 0, total: 0 })

    // A rain reading six hours old, and a water level past its validity, are unknown for every segment.
    const oldWeather = [reading('rainfall', 40, at(-6)), reading('water_level', 2.7, at(-1), at(-0.25))]
    const weather = planPatrol({ ...base, context: oldWeather })
    expect(weather.context).toEqual(oldWeather)
    for (const task of weather.tasks) {
      expect(task.priority).toEqual({ expiry: 0, reviewedFlag: 0, rain: null, waterLevel: null, total: null })
    }
  })

  test('a battery-limited plan rejects segments with reasons and still lands on the dock with its reserve', () => {
    // All 47 segments need about 190 Wh under the assumed model; this battery has 90 Wh above its reserve.
    const small = { ...drone, usableBatteryWh: 120, reserveWh: 30 }
    const far = 'seg_404002712_0' // on a retention pond about 1.7 km north of the dock
    const base = input(segments)
    const flags = base.flags.map((f) => (f.segmentId === far ? { ...f, severity: 'high' as const } : f))
    const plan = planPatrol({ ...base, drone: small, flags })

    const planned = plan.tasks.map((t) => t.segmentId)
    expect([...planned, ...plan.rejected.map((r) => r.segmentId)].toSorted()).toEqual(
      segments.map((s) => s.id).toSorted()
    )
    expect(plan.rejected.length).toBeGreaterThan(0)
    for (const { code, reason } of plan.rejected) {
      expect(code).toBe('battery')
      expect(reason).toMatch(/^needs \d+\.\d Wh more; \d+\.\d Wh is left above the 30 Wh reserve$/)
    }
    // The only flagged segment is worth the long flight; some lake segments by the dock are not.
    expect(planned).toContain(far)
    expect(plan.rejected.some((r) => r.segmentId.startsWith('seg_866518980_'))).toBe(true)

    const [takeoff, landing] = [plan.waypoints[0]!, plan.waypoints.at(-1)!]
    const atDock = { lon: dock.position.lon, lat: dock.position.lat, altM: dock.position.altM }
    expect(takeoff).toMatchObject({ ...atDock, kind: 'takeoff', eta: plan.window.start, energyWh: 0 })
    expect(landing).toMatchObject({ ...atDock, kind: 'landing', energyWh: plan.energyWh })
    expect(plan.energyWh).toBeLessThanOrEqual(90)
    expect(plan.reserveWh).toBeCloseTo(120 - plan.energyWh, 9)
    expect(plan.reserveWh).toBeGreaterThanOrEqual(30)
    expect(plan.route.coordinates).toEqual(plan.waypoints.map((w) => [w.lon, w.lat, w.altM]))

    // Energy on arrival follows the stated assumption over the flown legs: 250 W at 8 m/s across, 220 W while
    // climbing or descending at 3 m/s, and a 3 s hover at 220 W at each station.
    let expectedWh = 0
    plan.waypoints.forEach((w, i) => {
      const prev = plan.waypoints[i - 1]
      if (prev) {
        const acrossS = distance([prev.lon, prev.lat], [w.lon, w.lat], { units: 'meters' }) / 8
        const verticalS = Math.abs(w.altM - prev.altM) / 3
        expectedWh += (250 * acrossS + 220 * verticalS + (prev.kind === 'station' ? 220 * 3 : 0)) / 3600
      }
      expect(w.energyWh).toBeCloseTo(expectedWh, 6)
    })
  })

  test('a no-capture zone excludes the stations whose frames would cover it', () => {
    const id = 'seg_866518980_7' // 298 m of lake bank inside the park
    const base = input([segment(id)])
    const [task] = planStations({ ...base, camera: drone.camera }).tasks
    const target = task!.stations[Math.floor(task!.stations.length / 2)]!
    // A 4 m square test fixture standing in for a home's garden on the bank, centred on one station's aim point.
    const [lon, lat] = target.aim as [number, number]
    const d = 2 / 111_320
    const garden: Geofence = {
      id: 'geo_test_garden',
      kind: 'no_capture',
      label: 'test garden',
      geometry: { type: 'Polygon', coordinates: [square(lon, lat, d)] },
      simulated: true,
      source: 'fixture'
    }
    const plan = planPatrol({ ...base, geofences: [garden] })

    const kept = plan.tasks[0]!.stations.map((s) => `${s.lon},${s.lat}`)
    const excluded = task!.stations.filter((s) => !kept.includes(`${s.pose.lon},${s.pose.lat}`))
    expect(excluded.map((s) => s.id)).toContain(target.id)
    expect(kept).toHaveLength(task!.stations.length - excluded.length)
    // Frames are about 21 m along the edge and 16 m deep: stations aiming 17 m or more from the garden stay.
    for (const s of task!.stations) {
      if (distance(s.aim, [lon, lat], { units: 'meters' }) >= 17) expect(excluded).not.toContain(s)
    }
    expect(plan.rejected).toEqual([
      {
        segmentId: id,
        code: 'geofence',
        reason: `stations ${excluded.map((s) => s.id).join(', ')} left out: their frames would cover no-capture zone "test garden"; the rest of the segment is planned`
      }
    ])
  })

  test('no-fly zones are hard limits on flight lines and transits', () => {
    const zone = (id: string, label: string, ring: number[][]): Geofence => ({
      id,
      kind: 'no_fly',
      label,
      geometry: { type: 'Polygon', coordinates: [ring] },
      simulated: true,
      source: 'fixture'
    })
    // Test fixtures: one zone over the north pond, and a band that cuts the north-east ponds off from the dock.
    const northPond = zone('geo_test_pond', 'test north pond', square(101.5092, 3.1938, 0.0012))
    const band = zone('geo_test_band', 'test band', [
      [101.519, 3.18],
      [101.5205, 3.18],
      [101.5205, 3.195],
      [101.519, 3.195],
      [101.519, 3.18]
    ])
    const plan = planPatrol({ ...input(segments), geofences: [northPond, band] })

    const reasons = Object.fromEntries(plan.rejected.map((r) => [r.segmentId, `${r.code}: ${r.reason}`]))
    for (const s of segments) {
      if (s.osmId === 404002712)
        expect(reasons[s.id]).toBe('geofence: its flight line enters no-fly zone "test north pond"')
      else if (s.osmId === 866518980) expect(reasons[s.id]).toBeUndefined()
      else expect(reasons[s.id]).toBe('geofence: every straight transit to it crosses no-fly zone "test band"')
    }
    expect(plan.tasks).toHaveLength(segments.filter((s) => s.osmId === 866518980).length)
    for (const leg of plan.waypoints.slice(1).map((w, i) => [plan.waypoints[i]!, w])) {
      const line = lineString(leg.map((w) => [w.lon, w.lat]))
      expect(booleanIntersects(line, northPond.geometry) || booleanIntersects(line, band.geometry)).toBe(false)
    }
  })
})

/** A closed square ring of half-width `d` degrees around a point. */
function square(lon: number, lat: number, d: number): number[][] {
  return [
    [lon - d, lat - d],
    [lon + d, lat - d],
    [lon + d, lat + d],
    [lon - d, lat + d],
    [lon - d, lat - d]
  ]
}
