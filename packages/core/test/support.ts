// Drives a core the way the HTTP API and the SDK memory transport will: through `dispatch`, as seeded users.
import { expect } from 'bun:test'
import {
  AuditEvent,
  EdgeEvent,
  operations,
  type Actor,
  type CandidateClass,
  type ItemStatus,
  type CoreOperationId,
  type DispatchResult,
  type DispatchSuccess,
  type OperationInput,
  type RetestCheck
} from '@safe-edge/contracts'
import { join } from 'node:path'
import { loadElmina, planPatrol, splitEdges } from '@safe-edge/planner'
import { actorFor, counterIds, createCore, type PatrolPlanner, type Seed } from '../src/index.ts'

const repoRoot = join(import.meta.dir, '../../..')
export const seedPath = join(repoRoot, 'data/elmina/fixtures/seed.json')
/** Loaded the way the API will load it; `createCore` validates it. */
export const seed = (await Bun.file(seedPath).json()) as Seed
export const S1 = seed.story.s1

/** A user ID from the seed, or an explicit Actor (to model a person holding a second role's token). */
export type Who = string | Actor

const elmina = await loadElmina((path) => Bun.file(join(repoRoot, path)).json())
const plannerSegments = splitEdges({ ...elmina, maxBendDeg: 40, pointObstructionToleranceM: 3 })

/**
 * The adapter a transport writes over #71's `planPatrol`: it holds what the store lacks (planner geometry, capture
 * settings, geofences, water-level bands) and maps core's records to the planner's inputs. Tests may import the
 * planner; core's source never does.
 */
export const elminaPlanner: PatrolPlanner = ({ id, now, request, dock, droneProfile, segments, passes, findings }) =>
  planPatrol({
    id,
    now,
    edges: elmina.edges,
    segments: segments.map((s) => plannerSegments.find((p) => p.id === s.id)!),
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

export function startCore({ planner = elminaPlanner }: { planner?: PatrolPlanner } = {}) {
  let now = seed.asOf
  const core = createCore({ seed, clock: { now: () => now }, ids: counterIds(), planner })
  const actor = (who: Who): Actor => {
    if (typeof who !== 'string') return who
    const user = seed.users.find((u) => u.id === who)
    if (!user) throw new Error(`no seeded user ${who}`)
    return actorFor(user)
  }

  /** A raw dispatch: success, denial or not-found. */
  const attempt = <K extends CoreOperationId>(op: K, who: Who, input: OperationInput<K>): DispatchResult<K> =>
    core.dispatch(op, actor(who), input)

  /** A dispatch that must succeed; its data and events must match the contract. */
  /** Operations that have succeeded on this core. */
  const succeeded = new Set<CoreOperationId>()
  const call = <K extends CoreOperationId>(op: K, who: Who, input: OperationInput<K>): DispatchSuccess<K> => {
    const result = attempt(op, who, input)
    if (!result.ok) throw new Error(`${op} as ${actor(who).id} failed: ${JSON.stringify(result)}`)
    operations[op].response.parse(result.data)
    for (const event of result.events) EdgeEvent.parse(event)
    expect(result.status).toBe(operations[op].status)
    succeeded.add(op)
    return result
  }

  /** The full audit chain, read by the manager. */
  const audit = (subject?: string): AuditEvent[] =>
    call('listAudit', 'usr_manager', { query: subject === undefined ? {} : { subject } }).data.map((e) =>
      AuditEvent.parse(e)
    )

  const segment = (id: string) => call('getSegment', 'usr_manager', { params: { id } }).data

  return {
    core,
    succeeded,
    actor,
    attempt,
    call,
    audit,
    segment,
    now: () => now,
    setNow: (iso: string) => {
      now = iso
    }
  }
}

export type Harness = ReturnType<typeof startCore>

/** A drone observation of S1's viewpoint, as the simulated provider records it. */
export function observeS1(h: Harness) {
  const viewpoint = seed.segments.find((s) => s.id === S1.segmentId)!.viewpoints.find((v) => v.id === S1.viewpointId)!
  return h.call('recordObservation', 'usr_drone_sim', {
    body: {
      patrolId: null,
      segmentId: S1.segmentId,
      viewpointId: S1.viewpointId,
      captureSource: 'drone',
      image: null,
      pose: viewpoint.pose,
      capturedAt: h.now(),
      quality: { sharpness: 0.92, alignmentResidualPx: 1.4, occlusion: 0.05 },
      privacyAction: 'none',
      simulated: true
    }
  }).data
}

/** Raises a candidate on S1's segment from a fresh observation. */
export function raiseOnS1(
  h: Harness,
  who: Who,
  candidate: {
    inventoryItemId: string | null
    itemStatus: ItemStatus | null
    class: CandidateClass
    rationale: string
  }
) {
  const observation = observeS1(h)
  return h.call('raiseCandidate', who, {
    body: {
      segmentId: S1.segmentId,
      observationIds: [observation.id],
      score: 0.9,
      uncertainty: 'low',
      gridCell: 'B3',
      model: null,
      simulated: true,
      ...candidate
    }
  })
}

/**
 * S1 and S2, and S3 up to the completed repair, on one core, the way the scenario player and the screens drive it.
 * Returns what later checks need.
 */
export function playS1toRepair(h: Harness, until: 'submitted' | 'completed' = 'completed') {
  // S1: the drone sees fence panel 4 missing by the playground path.
  h.setNow('2026-10-21T00:40:00.000Z')
  const raised = raiseOnS1(h, 'usr_drone_sim', {
    inventoryItemId: S1.inventoryItemId,
    itemStatus: 'missing',
    class: 'inventory_item',
    rationale: 'Fence panel 4 is missing by the playground path'
  })

  h.setNow('2026-10-21T01:15:00.000Z')
  const decision = h.call('decideCandidate', 'usr_manager', {
    params: { id: raised.data.id },
    body: { decision: 'confirm', severity: 'high' }
  })
  const [interim] = decision.data.tasks
  h.setNow('2026-10-21T03:00:00.000Z')
  h.call('completeTask', 'usr_crew', { params: { id: interim!.id } })

  // S2: Fix Lens. Replacing the panel leaves the route around the fence end open; the full remedy closes it.
  h.setNow('2026-10-21T06:00:00.000Z')
  const mark = (x: number) => [{ evidenceId: 'evd_s1_photo', x, y: 0.6 }]
  const gap = h.call('createOpening', 'usr_manager', {
    body: { segmentId: S1.segmentId, type: 'fence_gap', photoMarks: mark(0.45), measuredMm: 1200 }
  }).data
  const fenceEnd = h.call('createOpening', 'usr_manager', {
    body: { segmentId: S1.segmentId, type: 'fence_end', photoMarks: mark(0.9), measuredMm: 450 }
  }).data
  const route = (label: string, openingIds: string[], status: 'open' | 'unknown') =>
    h.call('createRoute', 'usr_manager', {
      body: { segmentId: S1.segmentId, fromFeature: { kind: 'play_area', label }, openingIds, status }
    }).data
  const throughGap = route('Playground path, through the panel gap', [gap.id], 'open')
  const aroundEnd = route('Playground path, around the fence end', [fenceEnd.id], 'open')
  const farEnd = route('Far end of the fence, not seen from safe ground', [fenceEnd.id], 'unknown')
  const remedy = (type: 'panel_replacement' | 'barrier_extension', label: string, blocksOpeningIds: string[]) =>
    h.call('createRemedy', 'usr_engineer', {
      body: {
        segmentId: S1.segmentId,
        type,
        label,
        blocksOpeningIds,
        quantities: [{ item: 'Fence panel 2.4 m', amount: 1, unit: 'panel' }],
        acceptanceTest: 'No gap over 100 mm along the run and around both fence ends',
        quote: 'quote_needed'
      }
    }).data
  const panelOnly = remedy('panel_replacement', 'Replace panel 4', [gap.id])
  const full = remedy('barrier_extension', 'Replace panel 4 and extend the fence end to the headwall', [
    gap.id,
    fenceEnd.id
  ])
  const preview = (remedyIds: string[]) =>
    h
      .call('previewRouteClosure', 'usr_manager', { params: { id: S1.segmentId }, body: { remedyIds } })
      .data.routes.map((r) => [r.id, r.projectedStatus])
  const previews = { panelOnly: preview([panelOnly.id]), full: preview([full.id]) }

  h.call('approveRemedy', 'usr_engineer', { params: { id: full.id } })
  const workOrderId = decision.data.workOrder!.id
  h.call('updateWorkOrder', 'usr_manager', { params: { id: workOrderId }, body: { remedyId: full.id } })
  h.call('submitWorkOrder', 'usr_manager', {
    params: { id: workOrderId },
    body: { installerUserId: 'usr_installer', dueAt: '2026-10-24T09:00:00.000Z' }
  })

  // S3: the installer completes it.
  if (until === 'completed') {
    h.setNow('2026-10-22T02:00:00.000Z')
    h.call('startWorkOrder', 'usr_installer', { params: { id: workOrderId } })
    h.setNow('2026-10-22T05:30:00.000Z')
    h.call('completeWorkOrder', 'usr_installer', {
      params: { id: workOrderId },
      body: { evidence: [], note: 'Panel replaced, fence extended 1.5 m to the headwall' }
    })
  }
  const checklist = [
    { kind: 'saved_view', subjectId: S1.viewpointId, result: 'pass', reason: 'Panel 4 in place', measuredMm: null },
    { kind: 'route_check', subjectId: throughGap.id, result: 'pass', reason: 'Gap closed', measuredMm: 40 },
    { kind: 'route_check', subjectId: aroundEnd.id, result: 'pass', reason: 'Fence meets headwall', measuredMm: 60 },
    { kind: 'gauge_reading', subjectId: gap.id, result: 'pass', reason: '100 mm gauge does not pass', measuredMm: 40 }
  ] satisfies RetestCheck[]
  return {
    raised,
    decision,
    previews,
    routes: { throughGap, aroundEnd, farEnd },
    remedies: { panelOnly, full },
    workOrderId,
    findingId: decision.data.finding!.id,
    /** A passing re-test of the repair, for a reviewer to record. */
    retest: {
      workOrderId,
      checklist,
      evidence: [],
      result: 'accepted' as const,
      reason: 'Both observed approaches closed'
    }
  }
}
