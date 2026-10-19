// The TRD state machines, observed through dispatch: allowed moves succeed, out-of-order moves are refused by name.
import { describe, expect, test } from 'bun:test'
import { S1, playS1toRepair, raiseOnS1, startCore, type Harness } from './support.ts'

function confirmedFinding(h: Harness) {
  const raised = raiseOnS1(h, 'usr_drone_sim', {
    inventoryItemId: null,
    itemStatus: null,
    class: 'bank_change',
    rationale: 'Bank slumped below the fence'
  })
  return h.call('decideCandidate', 'usr_manager', {
    params: { id: raised.data.id },
    body: { decision: 'confirm', severity: 'medium' }
  }).data
}

function approvedRemedy(h: Harness, type: 'fence_gap' | 'low_barrier' = 'fence_gap') {
  const opening = h.call('createOpening', 'usr_engineer', {
    body: { segmentId: S1.segmentId, type, photoMarks: [{ evidenceId: 'evd_1', x: 0.5, y: 0.5 }], measuredMm: 300 }
  }).data
  const remedy = h.call('createRemedy', 'usr_engineer', {
    body: {
      segmentId: S1.segmentId,
      type: 'barrier_extension',
      label: 'Close the gap',
      blocksOpeningIds: [opening.id],
      quantities: [],
      acceptanceTest: 'No gap over 100 mm',
      quote: { amount: 1800, currency: 'MYR', date: '2026-10-21' }
    }
  }).data
  return h.call('approveRemedy', 'usr_engineer', { params: { id: remedy.id } }).data
}

const deniedWith = (rule: string) => ({ ok: false, rule })

describe('Candidate: candidate → confirmed | rejected | needs_recapture, by a person, once', () => {
  test('reject and recapture record the reason and open no finding; a decided candidate cannot be decided again', () => {
    const h = startCore()
    const raise = () =>
      raiseOnS1(h, 'usr_drone_sim', {
        inventoryItemId: null,
        itemStatus: null,
        class: 'vegetation',
        rationale: 'Grass over the kerb'
      }).data.id
    const [a, b] = [raise(), raise()]
    const rejected = h.call('decideCandidate', 'usr_manager', {
      params: { id: a },
      body: { decision: 'reject', reason: 'Seasonal growth, not a hazard' }
    })
    expect(rejected.data).toMatchObject({
      candidate: { status: 'rejected', decisionReason: 'Seasonal growth, not a hazard', decidedBy: 'usr_manager' },
      finding: null,
      tasks: [],
      workOrder: null
    })
    expect(rejected.events.map((e) => [e.type, e.data])).toEqual([
      [
        'edge.candidate.decided.v1',
        { candidateId: a, segmentId: S1.segmentId, decision: 'reject', findingId: null, simulated: true }
      ]
    ])
    const recapture = h.call('decideCandidate', 'usr_manager', {
      params: { id: b },
      body: { decision: 'recapture', reason: 'Blurred frame' }
    })
    expect(recapture.data.candidate.status).toBe('needs_recapture')
    const again = h.attempt('decideCandidate', 'usr_manager', {
      params: { id: a },
      body: { decision: 'confirm', severity: 'low' }
    })
    expect(again).toMatchObject(deniedWith('invalid_transition'))
    expect(h.call('listFindings', 'usr_manager', { query: {} }).data).toEqual([])
  })
})

describe('Finding and work order: open → interim_protected → work_ordered → repaired → retest_pending → closed', () => {
  test('a work order is submitted only with interim protection in place and an engineer-approved remedy', () => {
    const h = startCore()
    const { finding, workOrder, tasks } = confirmedFinding(h)
    const submit = () =>
      h.attempt('submitWorkOrder', 'usr_manager', {
        params: { id: workOrder!.id },
        body: { installerUserId: 'usr_installer', dueAt: '2026-10-30T00:00:00.000Z' }
      })
    expect(submit()).toMatchObject(deniedWith('remedy_not_approved'))

    const unapproved = h.call('createRemedy', 'usr_manager', {
      body: {
        segmentId: S1.segmentId,
        type: 'other',
        label: 'Regrade the bank',
        blocksOpeningIds: [
          h.call('createOpening', 'usr_manager', {
            body: {
              segmentId: S1.segmentId,
              type: 'low_barrier',
              photoMarks: [{ evidenceId: 'evd_2', x: 0.2, y: 0.7 }],
              measuredMm: null
            }
          }).data.id
        ],
        quantities: [],
        acceptanceTest: 'Bank holds',
        quote: 'quote_needed'
      }
    }).data
    h.call('updateWorkOrder', 'usr_manager', { params: { id: workOrder!.id }, body: { remedyId: unapproved.id } })
    expect(submit()).toMatchObject(deniedWith('remedy_not_approved'))

    h.call('approveRemedy', 'usr_engineer', { params: { id: unapproved.id } })
    expect(submit()).toMatchObject({
      ok: false,
      rule: 'invalid_transition',
      message: `${finding!.id} needs interim protection in place before its work order is submitted`
    })
    h.call('completeTask', 'usr_installer', { params: { id: tasks[0]!.id } })
    expect(h.call('getFinding', 'usr_gm', { params: { id: finding!.id } }).data.status).toBe('interim_protected')
    expect(submit()).toMatchObject({ ok: true, data: { status: 'submitted', submittedBy: 'usr_manager' } })
    expect(h.call('getFinding', 'usr_gm', { params: { id: finding!.id } }).data.status).toBe('work_ordered')
  })

  test('work-order moves out of order are refused: draft → submitted → in_progress → completed → accepted', () => {
    const h = startCore()
    const { workOrderId } = playS1toRepair(h, 'submitted')
    const completeEarly = h.attempt('completeWorkOrder', 'usr_installer', {
      params: { id: workOrderId },
      body: { evidence: [], note: '' }
    })
    expect(completeEarly).toMatchObject(deniedWith('invalid_transition'))
    const retestEarly = h.attempt('recordRetest', 'usr_reviewer', {
      body: {
        workOrderId,
        checklist: [{ kind: 'photo', subjectId: null, result: 'pass', reason: 'Looks done', measuredMm: null }],
        evidence: [],
        result: 'accepted',
        reason: 'Looks done'
      }
    })
    expect(retestEarly).toMatchObject(deniedWith('invalid_transition'))
    const editSubmitted = h.attempt('updateWorkOrder', 'usr_manager', {
      params: { id: workOrderId },
      body: { notes: 'Changed after submission' }
    })
    expect(editSubmitted).toMatchObject(deniedWith('invalid_transition'))
    const resubmit = h.attempt('submitWorkOrder', 'usr_engineer', {
      params: { id: workOrderId },
      body: { installerUserId: 'usr_installer', dueAt: '2026-10-30T00:00:00.000Z' }
    })
    expect(resubmit).toMatchObject(deniedWith('invalid_transition'))
    expect(h.call('startWorkOrder', 'usr_installer', { params: { id: workOrderId } }).data.status).toBe('in_progress')
    expect(h.attempt('startWorkOrder', 'usr_installer', { params: { id: workOrderId } })).toMatchObject(
      deniedWith('invalid_transition')
    )
  })

  test('a reopened finding takes a new work order through the same gates', () => {
    const h = startCore()
    const played = playS1toRepair(h)
    h.call('recordRetest', 'usr_reviewer', {
      body: {
        ...played.retest,
        checklist: [{ kind: 'route_check', subjectId: 'rte_2', result: 'fail', reason: 'Still open', measuredMm: 300 }],
        result: 'rejected',
        reason: 'Fence end still open'
      }
    })
    expect(h.call('getWorkOrder', 'usr_gm', { params: { id: played.workOrderId } }).data.status).toBe('rejected')
    const second = h.call('createWorkOrder', 'usr_manager', {
      body: { findingId: played.findingId, remedyId: played.remedies.full.id, notes: 'Second attempt' }
    }).data
    h.call('submitWorkOrder', 'usr_manager', {
      params: { id: second.id },
      body: { installerUserId: 'usr_installer', dueAt: '2026-11-01T00:00:00.000Z' }
    })
    expect(h.call('getFinding', 'usr_gm', { params: { id: played.findingId } }).data.status).toBe('work_ordered')
  })
})

describe('Fix Lens route closure', () => {
  test('a route through several openings closes when any one of them is blocked', () => {
    const h = startCore()
    const gate = h.call('createOpening', 'usr_manager', {
      body: {
        segmentId: S1.segmentId,
        type: 'gate',
        photoMarks: [{ evidenceId: 'evd_3', x: 0.3, y: 0.5 }],
        measuredMm: null
      }
    }).data
    const low = h.call('createOpening', 'usr_manager', {
      body: {
        segmentId: S1.segmentId,
        type: 'low_barrier',
        photoMarks: [{ evidenceId: 'evd_3', x: 0.6, y: 0.5 }],
        measuredMm: 500
      }
    }).data
    const route = h.call('createRoute', 'usr_manager', {
      body: {
        segmentId: S1.segmentId,
        fromFeature: { kind: 'gate', label: 'Maintenance gate, then over the low wall' },
        openingIds: [gate.id, low.id],
        status: 'open'
      }
    }).data
    expect(route.status).toBe('open')
    const lockGate = h.call('createRemedy', 'usr_engineer', {
      body: {
        segmentId: S1.segmentId,
        type: 'gate',
        label: 'Self-closing, self-latching gate',
        blocksOpeningIds: [gate.id],
        quantities: [{ item: 'Gate', amount: 1, unit: 'each' }],
        acceptanceTest: 'Gate closes and latches from 1 m open',
        quote: 'quote_needed'
      }
    }).data
    const preview = h.call('previewRouteClosure', 'usr_gm', {
      params: { id: S1.segmentId },
      body: { remedyIds: [lockGate.id] }
    }).data
    expect(preview.routes.map((r) => [r.id, r.status, r.projectedStatus])).toEqual([[route.id, 'open', 'closed']])
    // A preview changes nothing.
    expect(h.audit().at(-1)!.action).toBe('createRemedy')
  })

  test('remedies and routes must reference openings on the same segment', () => {
    const h = startCore()
    const opening = approvedRemedy(h).blocksOpeningIds[0]!
    const elsewhere = h.attempt('createRoute', 'usr_manager', {
      body: {
        segmentId: 'seg_866518980_5',
        fromFeature: { kind: 'path', label: 'Path' },
        openingIds: [opening],
        status: 'open'
      }
    })
    expect(elsewhere).toMatchObject({ ok: false, error: 'not_found' })
  })
})
