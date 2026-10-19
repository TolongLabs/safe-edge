// INBOX-2's recapture leaves owned work, like confirm: a task to capture the viewpoint again, through dispatch.
import { describe, expect, test } from 'bun:test'
import type { Task } from '@safe-edge/contracts'
import { S1, observeS1, raiseOnS1, seed, startCore, type Harness } from './support.ts'

function sendForRecapture(h: Harness, reason = 'Blurred frame') {
  const raised = raiseOnS1(h, 'usr_drone_sim', {
    inventoryItemId: null,
    itemStatus: null,
    class: 'bank_change',
    rationale: 'Bank may have slumped below the fence'
  }).data
  const decision = h.call('decideCandidate', 'usr_manager', {
    params: { id: raised.id },
    body: { decision: 'recapture', reason }
  })
  return { candidate: raised, decision }
}

describe('INBOX-2: a recapture opens a task to capture the viewpoint again', () => {
  test("the task is on the candidate's segment and viewpoint, owned by the custodian, and says why", () => {
    const h = startCore()
    const { candidate, decision } = sendForRecapture(h, 'Blurred frame: shoot it again in daylight')
    const task: Task = {
      id: 'task_1',
      kind: 'recapture',
      segmentId: S1.segmentId,
      viewpointId: S1.viewpointId,
      candidateId: candidate.id,
      findingId: null,
      assigneeUserId: 'usr_manager',
      status: 'open',
      reason: 'Blurred frame: shoot it again in daylight',
      dueAt: null,
      createdAt: seed.asOf,
      simulated: true,
      source: 'user'
    }
    expect(seed.assets.find((a) => a.id === h.segment(S1.segmentId).segment.assetId)!.custodianUserId).toBe(
      'usr_manager'
    )
    expect(decision.data).toMatchObject({ candidate: { status: 'needs_recapture' }, finding: null, workOrder: null })
    expect(decision.data.tasks).toEqual([task])
    expect(h.call('listTasks', 'usr_crew', { query: { status: 'open', segmentId: S1.segmentId } }).data).toEqual([task])

    // Audited in the decision's own dispatch, after the candidate it came from.
    expect(
      h
        .audit()
        .slice(-2)
        .map((e) => [e.action, e.subjectId, e.actor.id, e.decision, e.after])
    ).toEqual([
      ['decideCandidate', candidate.id, 'usr_manager', 'allowed', decision.data.candidate],
      ['decideCandidate', 'task_1', 'usr_manager', 'allowed', task]
    ])
  })
})

describe('A recapture task is done when the viewpoint is captured again', () => {
  test('a new frame from that viewpoint closes it; another viewpoint, an older frame or a discarded one does not', () => {
    const h = startCore()
    const { decision } = sendForRecapture(h)
    const [task] = decision.data.tasks
    const segment = seed.segments.find((s) => s.id === S1.segmentId)!
    const frame = (viewpointId: string, capturedAt: string, privacyAction: 'none' | 'discarded' = 'none') =>
      h.call('recordObservation', 'usr_crew', {
        body: {
          patrolId: null,
          segmentId: S1.segmentId,
          viewpointId,
          captureSource: 'phone',
          image: null,
          pose: segment.viewpoints.find((v) => v.id === viewpointId)!.pose,
          capturedAt,
          quality: { sharpness: 0.95, alignmentResidualPx: 1.1, occlusion: 0.02 },
          privacyAction,
          simulated: true
        }
      })
    const status = () => h.call('listTasks', 'usr_manager', { query: {} }).data.find((t) => t.id === task!.id)!.status
    const other = segment.viewpoints.find((v) => v.id !== S1.viewpointId)!.id

    h.setNow('2026-10-20T03:00:00.000Z')
    frame(other, h.now())
    frame(S1.viewpointId, '2026-10-19T23:00:00.000Z')
    frame(S1.viewpointId, h.now(), 'discarded')
    expect(status()).toBe('open')

    const retaken = frame(S1.viewpointId, h.now())
    expect(status()).toBe('done')
    // The task closes in the observation's dispatch, on the audit chain beside it.
    expect(
      h
        .audit()
        .slice(-2)
        .map((e) => [e.action, e.subjectId, e.actor.id])
    ).toEqual([
      ['recordObservation', retaken.data.id, 'usr_crew'],
      ['recordObservation', task!.id, 'usr_crew']
    ])
  })
})

describe('A recapture of a candidate with no photo covers its whole segment', () => {
  test('a missed patrol sent for recapture is done when a patrol that took off after the request inspects the segment', () => {
    const h = startCore()
    const segmentId = 'seg_866518980_5'
    const lengthM = seed.segments.find((s) => s.id === segmentId)!.lengthM
    expect(seed.segments.find((s) => s.id === segmentId)!.viewpoints).toEqual([])
    h.setNow('2026-10-23T01:00:00.000Z')
    const missed = h.call('reportMissedPatrol', 'usr_system', { params: { id: segmentId } }).data
    const fly = () => {
      const plan = h.call('createPatrolPlan', 'usr_manager', {
        body: {
          dockId: 'dock_elmina_roof',
          droneProfileId: 'drn_assumed',
          segmentIds: [segmentId],
          context: [],
          notBefore: h.now(),
          altitudeCapM: 60
        }
      }).data
      h.call('approvePatrolPlan', 'usr_pilot', { params: { id: plan.id } })
      h.setNow(plan.window.start)
      const patrol = h.call('startPatrol', 'usr_pilot', {
        body: { planId: plan.id, provider: 'sim', droneId: 'sim-1' }
      })
      return () =>
        h.call('completePatrol', 'usr_drone_sim', {
          params: { id: patrol.data.id },
          body: { coverage: [{ segmentId, inspectedM: lengthM, unknownM: 0 }] }
        })
    }
    const status = () => h.call('listTasks', 'usr_manager', { query: { segmentId } }).data[0]!.status

    // Already in the air when the manager asks: that flight may have passed the segment before, so it does not count.
    const landEarlier = fly()
    h.setNow(new Date(Date.parse(h.now()) + 60_000).toISOString())
    const decision = h.call('decideCandidate', 'usr_manager', {
      params: { id: missed.id },
      body: { decision: 'recapture', reason: 'Fly it on the next patrol' }
    })
    expect(decision.data.tasks).toMatchObject([
      { kind: 'recapture', segmentId, viewpointId: null, candidateId: missed.id, reason: 'Fly it on the next patrol' }
    ])
    landEarlier()
    expect(status()).toBe('open')

    fly()()
    expect(status()).toBe('done')
    expect(h.audit().at(-1)).toMatchObject({
      action: 'completePatrol',
      subjectId: decision.data.tasks[0]!.id,
      after: { status: 'done' }
    })
  })

  test('a patrol that saw only part of the segment leaves it open', () => {
    const h = startCore()
    const segmentId = 'seg_866518980_5'
    const lengthM = seed.segments.find((s) => s.id === segmentId)!.lengthM
    h.setNow('2026-10-23T01:00:00.000Z')
    const missed = h.call('reportMissedPatrol', 'usr_system', { params: { id: segmentId } }).data
    h.call('decideCandidate', 'usr_manager', {
      params: { id: missed.id },
      body: { decision: 'recapture', reason: 'Fly it on the next patrol' }
    })
    const plan = h.call('createPatrolPlan', 'usr_manager', {
      body: {
        dockId: 'dock_elmina_roof',
        droneProfileId: 'drn_assumed',
        segmentIds: [segmentId],
        context: [],
        notBefore: h.now(),
        altitudeCapM: 60
      }
    }).data
    h.call('approvePatrolPlan', 'usr_pilot', { params: { id: plan.id } })
    h.setNow(plan.window.start)
    const patrol = h.call('startPatrol', 'usr_pilot', { body: { planId: plan.id, provider: 'sim', droneId: 'sim-1' } })
    h.call('completePatrol', 'usr_drone_sim', {
      params: { id: patrol.data.id },
      body: { coverage: [{ segmentId, inspectedM: lengthM - 10, unknownM: 10 }] }
    })
    expect(h.call('listTasks', 'usr_manager', { query: { segmentId } }).data.map((t) => [t.kind, t.status])).toEqual([
      ['recapture', 'open'],
      ['field_check', 'open']
    ])
  })

  test('on a segment with viewpoints, a new frame from any of them also does it', () => {
    const h = startCore()
    h.setNow('2026-10-23T01:00:00.000Z')
    const missed = h.call('reportMissedPatrol', 'usr_system', { params: { id: S1.segmentId } }).data
    const [task] = h.call('decideCandidate', 'usr_manager', {
      params: { id: missed.id },
      body: { decision: 'recapture', reason: 'Walk it today' }
    }).data.tasks
    expect(task).toMatchObject({ segmentId: S1.segmentId, viewpointId: null })
    observeS1(h)
    expect(h.call('listTasks', 'usr_manager', { query: {} }).data).toEqual([{ ...task!, status: 'done' }])
  })
})
