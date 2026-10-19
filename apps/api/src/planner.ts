import type { PatrolPlanner } from '@safe-edge/core'
import { loadElmina, planPatrol, splitEdges } from '@safe-edge/planner'

/**
 * Core's `createPatrolPlan` port over #71's `planPatrol` (a copy of `elminaPlanner` in packages/core/test/support.ts).
 * It holds what the store lacks: the planner geometry, capture settings, geofences and water-level bands.
 */
export async function elminaPlanner(readJson: (path: string) => Promise<unknown>): Promise<PatrolPlanner> {
  const elmina = await loadElmina(readJson)
  const plannerSegments = splitEdges({ ...elmina, maxBendDeg: 40, pointObstructionToleranceM: 3 })
  const plannerSegment = (id: string) => {
    const segment = plannerSegments.find((p) => p.id === id)
    if (segment === undefined) throw new Error(`the planner geometry has no segment ${id}`)
    return segment
  }

  return ({ id, now, request, dock, droneProfile, segments, passes, findings }) =>
    planPatrol({
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
      window: {
        start: request.notBefore,
        end: new Date(Date.parse(request.notBefore) + 2 * 3_600_000).toISOString(),
        reason: 'requested'
      },
      geofences: [],
      passes: passes.map((p) => ({ segmentId: p.segmentId, state: p.state, validTo: p.validTo, readAt: now })),
      flags: segments.map((s) => ({
        segmentId: s.id,
        severity: findings.find((f) => f.segmentId === s.id && f.status !== 'closed')?.severity ?? null,
        readAt: now
      })),
      context: request.context,
      waterLevelBands: { alertM: 2, warningM: 2.5, dangerM: 3 }
    })
}
