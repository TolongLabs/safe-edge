import type { PatrolPlanner } from '@safe-edge/core'
import { loadElmina, planPatrol, replan, splitEdges, type PatrolPlanInput, type ThirdParty } from '@safe-edge/planner'

/**
 * The planner port over #71's `planPatrol` for the Elmina seed, the same adapter core's tests use. It holds what the
 * store lacks: planner geometry, capture settings, geofences (none yet), water-level bands and a 120-minute window
 * after first light. `readJson` loads a path from `elminaLayerPaths` (relative to the repo root): the browser fetches
 * it, Bun reads the file. `thirdParties` are the people, vessels, vehicles and structures not under the pilot's control
 * that plans keep 50 m from (S1's people on the path); there is no default, so none are left out by accident.
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

  return ({ id, now, request, previous, dock, droneProfile, segments, passes, findings }) => {
    const input: PatrolPlanInput = {
      id,
      now,
      edges: elmina.edges,
      segments: segments.map((s) => plannerSegment(s.id)),
      dock,
      drone: droneProfile,
      rangeM: 15,
      forwardOverlap: 0.6,
      altitudeM: Math.min(9, request.altitudeCapM),
      altitudeCapM: request.altitudeCapM,
      notBefore: request.notBefore,
      windowMinutes: 120,
      geofences: [],
      thirdParties,
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
