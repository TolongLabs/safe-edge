import type { PatrolPlanner } from '@safe-edge/contracts'
import { loadElmina } from './elmina.ts'
import { planPatrol, type PatrolPlanInput } from './patrol.ts'
import { replan } from './replan.ts'
import { splitEdges } from './segments.ts'
import type { ThirdParty } from './separation.ts'

/**
 * The authorisation the Elmina plans fly under. Every Elmina route takes off in Elmina Valley Central Park, a designated
 * (recreational) area, so none flies without the Director General's authorisation (CAR 2016 reg. 143(1)(a), (b)). CAAM
 * has issued none (docs/research/drone-integration/caam-rules.md), so this is a labelled fixture.
 */
const ASSUMED_AUTHORISATION = {
  ref: 'Assumed CAAM authorisation (fixture: none has been issued)',
  simulated: true,
  source: 'fixture'
} as const

/**
 * Core's planner port (`PatrolPlanner`) over `planPatrol` for the Elmina seed: the one adapter the API, the SDK and
 * the tests use. It holds what the store lacks: planner geometry, capture settings, geofences (the mapped parks, as
 * designated areas under an assumed authorisation), water-level bands, a 120-minute window after first light and a
 * 2-minute wait budget for each held segment. `readJson` loads a path from `elminaLayerPaths` (relative to the repo
 * root): the browser fetches it, Bun reads the file. `thirdParties` are mapped people, vessels, vehicles and
 * structures not under the pilot's control that every plan keeps 50 m from; there is no default, so none are left out
 * by accident. Core adds the ones the seed records and the create-plan request reports (the port's `thirdParties`).
 */
export async function createElminaPlanner(
  readJson: (path: string) => Promise<unknown>,
  { thirdParties }: { thirdParties: ThirdParty[] }
): Promise<PatrolPlanner> {
  const elmina = await loadElmina(readJson)
  // The split the seed's segment IDs come from (DECISIONS #70).
  const plannerSegments = splitEdges({ ...elmina, maxBendDeg: 40, pointObstructionToleranceM: 3 })
  const plannerSegment = (id: string) => {
    const segment = plannerSegments.find((p) => p.id === id)
    if (!segment) throw new Error(`The Elmina split has no segment ${id}`)
    return segment
  }

  return ({ id, now, request, previous, dock, droneProfile, segments, passes, findings, ...observed }) => {
    const input: PatrolPlanInput = {
      id,
      now,
      edges: elmina.edges,
      segments: segments.map((s) => plannerSegment(s.id)),
      dock,
      drone: droneProfile,
      rangeM: 15,
      forwardOverlap: 0.6,
      viewpoints: segments.flatMap((s) => s.viewpoints.map((v) => ({ id: v.id, pose: v.pose, segmentId: s.id }))),
      altitudeM: Math.min(9, request.altitudeCapM),
      altitudeCapM: request.altitudeCapM,
      notBefore: request.notBefore,
      windowMinutes: 120,
      geofences: elmina.designatedAreas,
      authorisation: ASSUMED_AUTHORISATION,
      thirdParties: [...thirdParties, ...observed.thirdParties],
      // A stated assumption, like the window: two minutes for people to clear a held segment's path.
      separationWaitS: 120,
      passes: passes.map((p) => ({ segmentId: p.segmentId, state: p.state, validTo: p.validTo, readAt: now })),
      flags: segments.map((s) => ({
        segmentId: s.id,
        severity: findings.find((f) => f.segmentId === s.id && f.status !== 'closed')?.severity ?? null,
        readAt: now
      })),
      context: request.context,
      waterLevelBands: { alertM: 2, warningM: 2.5, dangerM: 3 }
    }
    // A re-plan keeps the committed stops of the plan it supersedes (DECISIONS #72).
    if (!request.replan) return planPatrol(input)
    const committedTasks = request.replan.supersedes?.committedTasks ?? 0
    return replan(previous, { committedTasks }, input, request.replan.trigger)
  }
}
