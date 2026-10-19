// INBOX-2's recapture leaves owned work, like confirm: a task to capture the viewpoint again, through dispatch.
import { describe, expect, test } from 'bun:test'
import type { Task } from '@safe-edge/contracts'
import { S1, raiseOnS1, seed, startCore, type Harness } from './support.ts'

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
