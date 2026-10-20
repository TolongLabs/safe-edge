import type { Denial, EdgePass, Finding, Retest, Segment, WorkOrder } from '@safe-edge/contracts'
import { isAgent, movePass, oneWayRule, openSuspicions, routeStatus } from '../policy.ts'
import type { Tx } from '../store.ts'
import { blockedOpenings } from './fix-lens.ts'
import { ok, type Handlers } from './handler.ts'

type WorkOperation =
  | 'createWorkOrder'
  | 'updateWorkOrder'
  | 'setWorkOrderExternalRef'
  | 'recordWorkOrderExternalError'
  | 'retryWorkOrderHandOff'
  | 'submitWorkOrder'
  | 'startWorkOrder'
  | 'completeWorkOrder'
  | 'recordRetest'
  | 'recordClearance'

/** A remedy on the work order's segment, or a not-found message. */
function remedyFor(tx: Tx, finding: Finding, remedyId: string | null) {
  if (remedyId === null) return null
  const remedy = tx.get('remedies', remedyId)
  return remedy?.segmentId === finding.segmentId ? remedy : `No remedy ${remedyId} on ${finding.segmentId}`
}

const moveFinding = (tx: Tx, finding: Finding, status: Finding['status']): Finding => {
  const moved = { ...finding, status }
  tx.put('findings', moved)
  return moved
}

/**
 * An accepted re-test makes the segment's pass valid, unless another suspicion is still open on the segment: then the
 * pass stays as it is (a suspended pass names what holds it) and null is returned.
 */
function restorePass(tx: Tx, segment: Segment, retest: Retest): EdgePass | Denial | null {
  if (segment.passId === null) throw new Error(`store integrity: ${segment.id} has no pass`)
  const current = tx.must('passes', segment.passId)
  const refused = oneWayRule(tx, current, retest)
  if (refused) return refused
  const open = openSuspicions(tx, segment.id)
  if (open.length > 0) {
    if (current.state === 'suspended') {
      const stateReason = `Re-test ${retest.id} accepted, but ${open.join(', ')} still open on ${segment.id}`
      tx.put('passes', { ...current, stateReason })
    }
    return null
  }
  // The pass covers the segment's routes the re-test checked and passed.
  const routeIds = retest.checklist
    .filter((c) => c.kind === 'route_check' && c.result === 'pass')
    .flatMap((c) => {
      const route = c.subjectId === null ? undefined : tx.get('routes', c.subjectId)
      return route?.segmentId === segment.id ? [route.id] : []
    })
  const pass = movePass(tx, current, { to: 'valid', retest, routeIds })
  if ('rule' in pass) return pass
  tx.emit(
    'edge.pass.issued.v1',
    { passId: pass.id, segmentId: segment.id, retestId: retest.id, validTo: pass.validTo!, simulated: pass.simulated },
    segment.id
  )
  return pass
}

export const work: Handlers<WorkOperation> = {
  createWorkOrder: (tx, { body }) => {
    const finding = tx.get('findings', body.findingId)
    if (!finding) return tx.notFound(`No finding ${body.findingId}`)
    // One open work order per finding. Confirming drafts one, so another request (the agent's draft) gets that draft
    // back unchanged. One past draft blocks another until its re-test closes or reopens the finding.
    const open = tx
      .all('workOrders')
      .find((w) => w.findingId === finding.id && w.status !== 'accepted' && w.status !== 'rejected')
    if (open?.status === 'draft') return ok(open, 200)
    if (open) {
      return tx.deny(
        'invalid_transition',
        `${finding.id} already has work order ${open.id} (${open.status})`,
        finding.id
      )
    }
    const remedy = remedyFor(tx, finding, body.remedyId)
    if (typeof remedy === 'string') return tx.notFound(remedy)
    const workOrder: WorkOrder = {
      id: tx.id('wo'),
      findingId: finding.id,
      remedyId: body.remedyId,
      draftedBy: { type: tx.actor.type, id: tx.actor.id },
      status: 'draft',
      notes: body.notes,
      installerUserId: null,
      submittedBy: null,
      dueAt: null,
      completedAt: null,
      completionEvidence: [],
      externalRef: null,
      externalError: null,
      createdAt: tx.now,
      simulated: finding.simulated,
      source: tx.source
    }
    tx.put('workOrders', workOrder)
    tx.emit(
      'edge.work_order.drafted.v1',
      { workOrderId: workOrder.id, findingId: finding.id, simulated: workOrder.simulated },
      finding.segmentId
    )
    return ok(workOrder)
  },

  updateWorkOrder: (tx, { params, body }) => {
    const workOrder = tx.get('workOrders', params.id)
    if (!workOrder) return tx.notFound(`No work order ${params.id}`)
    // People edit any draft; the agent only its own (INBOX-4).
    const { draftedBy } = workOrder
    if (isAgent(tx.actor) && (draftedBy.type !== 'agent' || draftedBy.id !== tx.actor.id)) {
      const message = `${workOrder.id} was drafted by ${draftedBy.type} ${draftedBy.id}; the agent edits only its own drafts`
      return tx.deny('agents_draft_only', message, workOrder.id)
    }
    if (workOrder.status !== 'draft') {
      return tx.deny(
        'invalid_transition',
        `${workOrder.id} is ${workOrder.status}; only drafts can be edited`,
        workOrder.id
      )
    }
    const remedyId = body.remedyId === undefined ? workOrder.remedyId : body.remedyId
    const remedy = remedyFor(tx, tx.must('findings', workOrder.findingId), remedyId)
    if (typeof remedy === 'string') return tx.notFound(remedy)
    const updated: WorkOrder = { ...workOrder, remedyId, notes: body.notes ?? workOrder.notes }
    tx.put('workOrders', updated)
    return ok(updated)
  },

  // The link to the external work-order system's record is written once, so it always names what was created.
  setWorkOrderExternalRef: (tx, { params, body }) => {
    const workOrder = tx.get('workOrders', params.id)
    if (!workOrder) return tx.notFound(`No work order ${params.id}`)
    if (workOrder.externalRef !== null) {
      return tx.deny('invalid_transition', `${workOrder.id} already links ${workOrder.externalRef}`, workOrder.id)
    }
    const linked: WorkOrder = { ...workOrder, externalRef: body.externalRef }
    tx.put('workOrders', linked)
    return ok(linked)
  },

  // A failed hand-off stays visible on the work order and the audit chain until a person retries it, so it is written
  // once per attempt: a second failure needs that retry first.
  recordWorkOrderExternalError: (tx, { params, body }) => {
    const workOrder = tx.get('workOrders', params.id)
    if (!workOrder) return tx.notFound(`No work order ${params.id}`)
    if (workOrder.externalError !== null) {
      const message = `${workOrder.id} already records a failed hand-off: ${workOrder.externalError.message}`
      return tx.deny('invalid_transition', message, workOrder.id)
    }
    const failed: WorkOrder = { ...workOrder, externalError: { step: body.step, message: body.message, at: tx.now } }
    tx.put('workOrders', failed)
    return ok(failed)
  },

  // A person clears a recorded failure; the API then resumes the hand-off from the step that failed.
  retryWorkOrderHandOff: (tx, { params }) => {
    const workOrder = tx.get('workOrders', params.id)
    if (!workOrder) return tx.notFound(`No work order ${params.id}`)
    const retried = workOrder.externalError
    if (retried === null) {
      return tx.deny('invalid_transition', `${workOrder.id} has no failed hand-off to retry`, workOrder.id)
    }
    const cleared: WorkOrder = { ...workOrder, externalError: null }
    tx.put('workOrders', cleared)
    return ok({ workOrder: cleared, retried })
  },

  submitWorkOrder: (tx, { params, body }) => {
    const workOrder = tx.get('workOrders', params.id)
    if (!workOrder) return tx.notFound(`No work order ${params.id}`)
    if (workOrder.status !== 'draft') {
      return tx.deny('invalid_transition', `${workOrder.id} is already ${workOrder.status}`, workOrder.id)
    }
    if (!tx.get('users', body.installerUserId)) return tx.notFound(`No user ${body.installerUserId}`)
    const remedy = workOrder.remedyId === null ? null : tx.must('remedies', workOrder.remedyId)
    if (remedy?.engineerApprovedBy == null) {
      return tx.deny(
        'remedy_not_approved',
        remedy
          ? `An engineer must approve ${remedy.id} before ${workOrder.id} is submitted`
          : `${workOrder.id} has no remedy`,
        workOrder.id
      )
    }
    const finding = tx.must('findings', workOrder.findingId)
    if (finding.status !== 'interim_protected' && finding.status !== 'reopened') {
      return tx.deny(
        'invalid_transition',
        finding.status === 'open'
          ? `${finding.id} needs interim protection in place before its work order is submitted`
          : `${finding.id} is ${finding.status}`,
        workOrder.id
      )
    }
    const submitted: WorkOrder = {
      ...workOrder,
      status: 'submitted',
      submittedBy: tx.actor.id,
      installerUserId: body.installerUserId,
      dueAt: body.dueAt
    }
    tx.put('workOrders', submitted)
    moveFinding(tx, finding, 'work_ordered')
    tx.emit(
      'edge.work_order.submitted.v1',
      { workOrderId: workOrder.id, findingId: finding.id, simulated: workOrder.simulated },
      finding.segmentId
    )
    return ok(submitted)
  },

  startWorkOrder: (tx, { params }) => {
    const workOrder = tx.get('workOrders', params.id)
    if (!workOrder) return tx.notFound(`No work order ${params.id}`)
    if (workOrder.status !== 'submitted') {
      return tx.deny('invalid_transition', `${workOrder.id} is ${workOrder.status}, not submitted`, workOrder.id)
    }
    if (workOrder.installerUserId !== tx.actor.id) {
      return tx.deny('role_forbidden', `${workOrder.id} is assigned to ${workOrder.installerUserId}`, workOrder.id)
    }
    const started: WorkOrder = { ...workOrder, status: 'in_progress' }
    tx.put('workOrders', started)
    return ok(started)
  },

  completeWorkOrder: (tx, { params, body }) => {
    const workOrder = tx.get('workOrders', params.id)
    if (!workOrder) return tx.notFound(`No work order ${params.id}`)
    if (workOrder.status !== 'in_progress') {
      return tx.deny('invalid_transition', `${workOrder.id} is ${workOrder.status}, not in progress`, workOrder.id)
    }
    if (workOrder.installerUserId !== tx.actor.id) {
      return tx.deny('role_forbidden', `${workOrder.id} is assigned to ${workOrder.installerUserId}`, workOrder.id)
    }
    const completed: WorkOrder = {
      ...workOrder,
      status: 'completed',
      completedAt: tx.now,
      completionEvidence: body.evidence,
      notes: body.note === '' ? workOrder.notes : `${workOrder.notes}\n\nInstaller: ${body.note}`
    }
    tx.put('workOrders', completed)
    // Repaired, and now owed a re-test by someone else.
    const finding = moveFinding(tx, tx.must('findings', workOrder.findingId), 'repaired')
    moveFinding(tx, finding, 'retest_pending')
    tx.emit(
      'edge.repair.completed.v1',
      { workOrderId: workOrder.id, findingId: finding.id, simulated: workOrder.simulated },
      finding.segmentId
    )
    return ok(completed)
  },

  recordRetest: (tx, { body }) => {
    const workOrder = tx.get('workOrders', body.workOrderId)
    if (!workOrder) return tx.notFound(`No work order ${body.workOrderId}`)
    if (workOrder.status !== 'completed') {
      return tx.deny(
        'invalid_transition',
        `${workOrder.id} is ${workOrder.status}; only completed work is re-tested`,
        workOrder.id
      )
    }
    const finding = tx.must('findings', workOrder.findingId)
    // Two people: the reviewer is neither the installer nor whoever confirmed the finding, whatever role they hold.
    if (tx.actor.id === workOrder.installerUserId) {
      return tx.deny('two_person_rule', `${tx.actor.id} installed ${workOrder.id} and cannot re-test it`, workOrder.id)
    }
    if (tx.actor.id === finding.confirmedBy) {
      return tx.deny(
        'two_person_rule',
        `${tx.actor.id} confirmed ${finding.id} and cannot re-test its repair`,
        workOrder.id
      )
    }
    if (body.result === 'accepted' && body.checklist.some((c) => c.result === 'fail')) {
      return tx.deny('invalid_transition', 'A re-test with a failed check cannot be accepted', workOrder.id)
    }

    const retest: Retest = {
      id: tx.id('rt'),
      ...body,
      candidateId: null,
      reviewerUserId: tx.actor.id,
      recordedAt: tx.now,
      simulated: workOrder.simulated,
      source: tx.source
    }
    tx.put('retests', retest)
    tx.emit(
      'edge.retest.recorded.v1',
      {
        retestId: retest.id,
        workOrderId: workOrder.id,
        candidateId: null,
        result: retest.result,
        simulated: retest.simulated
      },
      finding.segmentId
    )
    if (retest.result === 'rejected') {
      tx.put('workOrders', { ...workOrder, status: 'rejected' })
      moveFinding(tx, finding, 'reopened')
      return ok({ retest, pass: null })
    }

    tx.put('workOrders', { ...workOrder, status: 'accepted' })
    moveFinding(tx, finding, 'closed')
    const segment = tx.must('segments', finding.segmentId)
    const segmentRoutes = tx.all('routes').filter((r) => r.segmentId === segment.id)
    const pass = restorePass(tx, segment, retest)
    if (pass !== null && 'rule' in pass) return pass

    // The verified remedy now blocks its openings, which closes the routes through them.
    if (workOrder.remedyId !== null) {
      for (const id of tx.must('remedies', workOrder.remedyId).blocksOpeningIds) {
        const opening = tx.must('openings', id)
        if (opening.status === 'open') tx.put('openings', { ...opening, status: 'blocked' })
      }
      const blocked = blockedOpenings(tx, segment.id)
      for (const route of segmentRoutes) {
        const status = routeStatus(route, blocked)
        if (status !== route.status) tx.put('routes', { ...route, status })
      }
    }
    return ok({ retest, pass })
  },

  // A false alarm: a Tier 2 candidate the manager rejected (or sent for recapture) opened no finding, so no repair
  // re-test can lift its suspension. A second person checks the edge and records a clearance re-test instead.
  recordClearance: (tx, { params, body }) => {
    const candidate = tx.get('candidates', params.id)
    if (!candidate) return tx.notFound(`No candidate ${params.id}`)
    if (candidate.tier !== 2 || (candidate.status !== 'rejected' && candidate.status !== 'needs_recapture')) {
      const message = `${candidate.id} is a ${candidate.status} Tier ${candidate.tier} candidate; only a rejected or recapture Tier 2 candidate is cleared`
      return tx.deny('invalid_transition', message, candidate.id)
    }
    if (tx.actor.id === candidate.decidedBy) {
      return tx.deny('two_person_rule', `${tx.actor.id} decided ${candidate.id} and cannot clear it`, candidate.id)
    }
    const segment = tx.must('segments', candidate.segmentId)
    if (segment.passId === null) throw new Error(`store integrity: ${segment.id} has no pass`)
    const current = tx.must('passes', segment.passId)
    if (current.state !== 'suspended') {
      return tx.deny(
        'invalid_transition',
        `${current.id} is ${current.state}; a clearance only lifts a suspension`,
        candidate.id
      )
    }
    if (body.result === 'accepted' && body.checklist.some((c) => c.result === 'fail')) {
      return tx.deny('invalid_transition', 'A clearance with a failed check cannot be accepted', candidate.id)
    }
    const retest: Retest = {
      id: tx.id('rt'),
      workOrderId: null,
      candidateId: candidate.id,
      ...body,
      reviewerUserId: tx.actor.id,
      recordedAt: tx.now,
      simulated: candidate.simulated,
      source: tx.source
    }
    tx.put('retests', retest)
    tx.emit(
      'edge.retest.recorded.v1',
      {
        retestId: retest.id,
        workOrderId: null,
        candidateId: candidate.id,
        result: retest.result,
        simulated: retest.simulated
      },
      segment.id
    )
    if (retest.result === 'rejected') return ok({ retest, pass: null })
    const pass = restorePass(tx, segment, retest)
    if (pass !== null && 'rule' in pass) return pass
    return ok({ retest, pass })
  }
}
