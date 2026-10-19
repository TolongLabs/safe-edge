// S1 to S3 on one segment, played through a SafeEdgeClient as the demo users, the way the screens and the scenario
// player (#64) drive it. Transport-agnostic: `as(userId)` gives the client for a seeded user.
import type { RetestCheck } from '@safe-edge/contracts'
import { elminaSeed, type SafeEdgeClient } from '../src/index.ts'

export const S1 = elminaSeed.story.s1

export interface Stage {
  as(userId: string): SafeEdgeClient
  setNow(iso: string): void
}

export async function playS1toS3({ as, setNow }: Stage) {
  const viewpoint = elminaSeed.segments
    .find((s) => s.id === S1.segmentId)!
    .viewpoints.find((v) => v.id === S1.viewpointId)!

  // S1: the simulated drone sees fence panel 4 missing by the playground path.
  setNow('2026-10-21T00:40:00.000Z')
  const drone = as('usr_drone_sim')
  const observation = await drone.recordObservation({
    body: {
      patrolId: null,
      segmentId: S1.segmentId,
      viewpointId: S1.viewpointId,
      captureSource: 'drone',
      image: null,
      pose: viewpoint.pose,
      capturedAt: '2026-10-21T00:40:00.000Z',
      quality: { sharpness: 0.92, alignmentResidualPx: 1.4, occlusion: 0.05 },
      privacyAction: 'none',
      simulated: true
    }
  })
  const candidate = await drone.raiseCandidate({
    body: {
      segmentId: S1.segmentId,
      observationIds: [observation.id],
      inventoryItemId: S1.inventoryItemId,
      itemStatus: 'missing',
      class: 'inventory_item',
      score: 0.9,
      uncertainty: 'low',
      gridCell: 'B3',
      rationale: 'Fence panel 4 is missing by the playground path',
      model: null,
      simulated: true
    }
  })

  // The manager confirms in the Inbox; the crew puts up interim protection.
  setNow('2026-10-21T01:15:00.000Z')
  const manager = as('usr_manager')
  const decision = await manager.decideCandidate({
    params: { id: candidate.id },
    body: { decision: 'confirm', severity: 'high' }
  })
  setNow('2026-10-21T03:00:00.000Z')
  await as('usr_crew').completeTask({ params: { id: decision.tasks[0]!.id } })

  // S2: Fix Lens. The full remedy closes both observed routes; the engineer approves it.
  setNow('2026-10-21T06:00:00.000Z')
  const mark = (x: number) => [{ evidenceId: 'evd_s1_photo', x, y: 0.6 }]
  const gap = await manager.createOpening({
    body: { segmentId: S1.segmentId, type: 'fence_gap', photoMarks: mark(0.45), measuredMm: 1200 }
  })
  const fenceEnd = await manager.createOpening({
    body: { segmentId: S1.segmentId, type: 'fence_end', photoMarks: mark(0.9), measuredMm: 450 }
  })
  const route = (label: string, openingIds: string[]) =>
    manager.createRoute({
      body: { segmentId: S1.segmentId, fromFeature: { kind: 'play_area', label }, openingIds, status: 'open' }
    })
  const throughGap = await route('Playground path, through the panel gap', [gap.id])
  const aroundEnd = await route('Playground path, around the fence end', [fenceEnd.id])
  const engineer = as('usr_engineer')
  const remedy = await engineer.createRemedy({
    body: {
      segmentId: S1.segmentId,
      type: 'barrier_extension',
      label: 'Replace panel 4 and extend the fence end to the headwall',
      blocksOpeningIds: [gap.id, fenceEnd.id],
      quantities: [{ item: 'Fence panel 2.4 m', amount: 1, unit: 'panel' }],
      acceptanceTest: 'No gap over 100 mm along the run and around both fence ends',
      quote: 'quote_needed'
    }
  })
  await engineer.approveRemedy({ params: { id: remedy.id } })
  const workOrderId = decision.workOrder!.id
  await manager.updateWorkOrder({ params: { id: workOrderId }, body: { remedyId: remedy.id } })
  await manager.submitWorkOrder({
    params: { id: workOrderId },
    body: { installerUserId: 'usr_installer', dueAt: '2026-10-24T09:00:00.000Z' }
  })

  // S3: the installer repairs it, and a different person re-tests it on a phone and accepts.
  setNow('2026-10-22T02:00:00.000Z')
  const installer = as('usr_installer')
  await installer.startWorkOrder({ params: { id: workOrderId } })
  setNow('2026-10-22T05:30:00.000Z')
  await installer.completeWorkOrder({
    params: { id: workOrderId },
    body: { evidence: [], note: 'Panel replaced, fence extended 1.5 m to the headwall' }
  })
  setNow('2026-10-23T01:00:00.000Z')
  const checklist = [
    { kind: 'saved_view', subjectId: S1.viewpointId, result: 'pass', reason: 'Panel 4 in place', measuredMm: null },
    { kind: 'route_check', subjectId: throughGap.id, result: 'pass', reason: 'Gap closed', measuredMm: 40 },
    { kind: 'route_check', subjectId: aroundEnd.id, result: 'pass', reason: 'Fence meets headwall', measuredMm: 60 }
  ] satisfies RetestCheck[]
  const retest = await as('usr_reviewer').recordRetest({
    body: { workOrderId, checklist, evidence: [], result: 'accepted', reason: 'Both observed approaches closed' }
  })
  return { candidate, decision, workOrderId, retest }
}
