import type { Finding, Retest, WorkOrder } from '@safe-edge/contracts'
import { movePass, routeStatus } from '../policy.ts'
import type { Tx } from '../store.ts'
import { blockedOpenings } from './fix-lens.ts'
import { ok, type Handlers } from './handler.ts'

type WorkOperation =
  | 'createWorkOrder'
  | 'updateWorkOrder'
  | 'setWorkOrderExternalRef'
  | 'submitWorkOrder'
  | 'startWorkOrder'
  | 'completeWorkOrder'
  | 'recordRetest'

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

export const work: Handlers<WorkOperation> = {
  createWorkOrder: (tx, { body }) => {
    const finding = tx.get('findings', body.findingId)
    if (!finding) return tx.notFound(`No finding ${body.findingId}`)
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
      reviewerUserId: tx.actor.id,
      recordedAt: tx.now,
      simulated: workOrder.simulated,
      source: tx.source
    }
    tx.put('retests', retest)
    tx.emit(
      'edge.retest.recorded.v1',
      { retestId: retest.id, workOrderId: workOrder.id, result: retest.result, simulated: retest.simulated },
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
    const checkedRoutes = retest.checklist
      .filter((c) => c.kind === 'route_check' && c.result === 'pass')
      .flatMap((c) => segmentRoutes.filter((r) => r.id === c.subjectId).map((r) => r.id))
    if (segment.passId === null) throw new Error(`store integrity: ${segment.id} has no pass`)
    const pass = movePass(tx, tx.must('passes', segment.passId), { to: 'valid', retest, routeIds: checkedRoutes })
    if ('rule' in pass) return pass
    tx.emit(
      'edge.pass.issued.v1',
      {
        passId: pass.id,
        segmentId: segment.id,
        retestId: retest.id,
        validTo: pass.validTo!,
        simulated: pass.simulated
      },
      segment.id
    )

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
  }
}
