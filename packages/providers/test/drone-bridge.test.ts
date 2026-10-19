// The drone bridge against a provider that reports exactly the frames a test scripts, through the DroneProvider port,
// wired to a real core. Coverage comes from stations: a station counts once it has a frame the privacy gate kept,
// however many frames it has, so a repeated frame cannot stand in for a station the drone missed (TRD rule 4).
import { describe, expect, test } from 'bun:test'
import type { DroneProvider, PatrolPlan, PatrolRun, ProviderEvent } from '@safe-edge/contracts'
import { seed, startCore } from '../../core/test/support.ts'
import { bridgeDrone } from '../src/index.ts'

const SEGMENT_IDS = [seed.story.s1.segmentId, 'seg_866518980_5']

/** A provider that flies nothing: the test emits each event it would report. */
function scriptedProvider() {
  const handlers = new Set<(event: ProviderEvent) => void>()
  let run: PatrolRun | null = null
  const provider: DroneProvider = {
    listDevices: async () => [],
    getStatus: async () => {
      throw new Error('The scripted provider has no aircraft status')
    },
    schedulePatrol: async (plan) => {
      run = {
        id: 'run_1',
        planId: plan.id,
        deviceId: 'scripted-1',
        status: 'scheduled',
        scheduledAt: plan.window.start,
        dispatchedAt: null,
        approval: null,
        simulated: true,
        source: 'fixture'
      }
      return run
    },
    dispatchPatrol: async () => {},
    cancelPatrol: async () => {},
    onEvent: (handler) => {
      handlers.add(handler)
      return () => handlers.delete(handler)
    }
  }
  const emit = (event: ProviderEvent) => {
    for (const handler of handlers) handler(event)
  }
  return { provider, emit }
}

/** A planned, approved and started patrol over S1 and segment 5, handed to the bridge on the scripted provider. */
async function flying() {
  const h = startCore()
  const { provider, emit } = scriptedProvider()
  const failures: unknown[] = []
  const bridge = bridgeDrone({
    provider,
    dispatch: h.core.dispatch,
    actor: h.actor('usr_drone_sim'),
    publish: () => {},
    onFailure: (error) => failures.push(error)
  })
  const proposed: PatrolPlan = h.call('createPatrolPlan', 'usr_manager', {
    body: {
      dockId: 'dock_elmina_roof',
      droneProfileId: 'drn_assumed',
      segmentIds: SEGMENT_IDS,
      context: [],
      notBefore: '2026-10-21T23:30:00.000Z',
      altitudeCapM: 60
    }
  }).data
  const plan = h.call('approvePatrolPlan', 'usr_pilot', { params: { id: proposed.id } }).data
  h.setNow(plan.window.start)
  const patrol = h.call('startPatrol', 'usr_pilot', {
    body: { planId: plan.id, provider: 'sim', droneId: 'sim-1' }
  }).data
  const run = await bridge.fly(patrol)

  const base = { runId: run.id, deviceId: run.deviceId, at: plan.window.start, simulated: true }
  /** A frame at the plan's waypoint `index`, as the scripted drone took it. */
  const frame = (index: number, privacyAction: 'none' | 'discarded' = 'none'): ProviderEvent => {
    const waypoint = plan.waypoints[index]!
    return {
      type: 'observation',
      ...base,
      waypointIndex: index,
      segmentId: waypoint.segmentId!,
      viewpointId: waypoint.viewpointId,
      zoom: waypoint.zoom,
      captureSource: 'drone',
      image: null,
      pose: {
        lon: waypoint.lon,
        lat: waypoint.lat,
        altM: waypoint.altM,
        headingDeg: waypoint.headingDeg,
        pitchDeg: waypoint.gimbalPitchDeg
      },
      quality: { sharpness: 0.9, alignmentResidualPx: 1, occlusion: 0.05 },
      privacyAction
    }
  }
  const landed: ProviderEvent = {
    type: 'landed',
    ...base,
    outcome: 'completed',
    pose: { lon: plan.waypoints.at(-1)!.lon, lat: plan.waypoints.at(-1)!.lat, altM: 0, headingDeg: 0, pitchDeg: 0 },
    remainingWh: plan.reserveWh
  }
  /** The waypoint indexes of each segment's stations, in flying order. */
  const stationsOf = (segmentId: string) =>
    plan.waypoints.flatMap((w, i) => (w.kind === 'station' && w.segmentId === segmentId ? [i] : []))
  const lengthOf = (segmentId: string) => h.segment(segmentId).segment.lengthM
  const coverage = () => h.call('listPatrols', 'usr_manager', {}).data.find((p) => p.id === patrol.id)!.coverage
  return { h, plan, emit, frame, landed, stationsOf, lengthOf, coverage, failures }
}

describe('the drone bridge counts stations, not frames', () => {
  test('a station seen twice does not make up for one never seen, and a discarded frame sees nothing', async () => {
    const { emit, frame, landed, stationsOf, lengthOf, coverage, failures } = await flying()
    const [s1, five] = SEGMENT_IDS as [string, string]
    const s1Stations = stationsOf(s1)
    const fiveStations = stationsOf(five)
    expect(s1Stations.length).toBeGreaterThan(2)
    expect(fiveStations.length).toBeGreaterThan(1)

    // S1: as many frames as stations, but the first station twice and the last never.
    for (const index of [s1Stations[0]!, ...s1Stations.slice(0, -1)]) emit(frame(index))
    // Segment 5: a frame at every station, but the privacy gate discarded the first.
    emit(frame(fiveStations[0]!, 'discarded'))
    for (const index of fiveStations.slice(1)) emit(frame(index))
    emit(landed)
    expect(failures).toEqual([])

    // Each station seen stands for an equal share of its segment; the rest is unknown, never inspected.
    const share = (segmentId: string, seen: number, of: number) => {
      const inspectedM = (lengthOf(segmentId) * seen) / of
      return { segmentId, inspectedM, unknownM: lengthOf(segmentId) - inspectedM }
    }
    expect(coverage()).toEqual([
      share(s1, s1Stations.length - 1, s1Stations.length),
      share(five, fiveStations.length - 1, fiveStations.length)
    ])
  })

  test('a segment whose every station has a kept frame is inspected along its whole length', async () => {
    const { emit, frame, landed, stationsOf, lengthOf, coverage, failures } = await flying()
    for (const segmentId of SEGMENT_IDS) for (const index of stationsOf(segmentId)) emit(frame(index))
    emit(landed)
    expect(failures).toEqual([])
    expect(coverage()).toEqual(
      SEGMENT_IDS.map((segmentId) => ({ segmentId, inspectedM: lengthOf(segmentId), unknownM: 0 }))
    )
  })
})
