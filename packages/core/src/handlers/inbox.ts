import type {
  Candidate,
  Denial,
  Finding,
  InventoryCheck,
  InventoryItem,
  RaiseCandidateRequest,
  Segment,
  Task,
  WorkOrder
} from '@safe-edge/contracts'
import { falseFlagReport, flagClassOf, itemOf, movePass, tierFor } from '../policy.ts'
import type { Tx } from '../store.ts'
import { ok, type Handlers } from './handler.ts'

const DECIDED = { confirm: 'confirmed', reject: 'rejected', recapture: 'needs_recapture' } as const

/**
 * Raises one candidate on a checked segment and item. Core assigns the tier, under the false-flag budget; a Tier 2
 * suspends the segment's pass in the same transaction, and a Tier 3 opens a field check.
 */
function raise(tx: Tx, segment: Segment, item: InventoryItem | null, body: RaiseCandidateRequest): Candidate | Denial {
  const flagClass = flagClassOf(item, body.class)
  const overBudget = flagClass !== null && falseFlagReport(tx).overBudget.includes(flagClass)
  const candidate: Candidate = {
    id: tx.id('cand'),
    ...body,
    tier: tierFor(item, body.itemStatus, overBudget),
    status: 'candidate',
    raisedBy: { type: tx.actor.type, id: tx.actor.id },
    raisedAt: tx.now,
    decidedBy: null,
    decidedAt: null,
    decisionReason: null,
    source: tx.source
  }
  tx.put('candidates', candidate)
  tx.emit(
    'edge.candidate.raised.v1',
    { candidateId: candidate.id, segmentId: segment.id, tier: candidate.tier, simulated: candidate.simulated },
    segment.id
  )

  // Suspicion suspends, in this same transaction.
  const pass = segment.passId === null ? null : tx.must('passes', segment.passId)
  if (candidate.tier === 2 && pass && (pass.state === 'valid' || pass.state === 'expiring')) {
    const suspended = movePass(tx, pass, {
      to: 'suspended',
      reason: `Tier 2 candidate ${candidate.id} awaiting review`
    })
    if ('rule' in suspended) return suspended
    tx.emit(
      'edge.pass.suspended.v1',
      { passId: pass.id, segmentId: segment.id, candidateId: candidate.id, simulated: pass.simulated },
      segment.id
    )
  }

  // Tier 3: the item was not visible, so the segment is not inspected there until someone checks in the field.
  if (candidate.tier === 3) {
    const task: Task = {
      id: tx.id('task'),
      kind: 'field_check',
      segmentId: segment.id,
      findingId: null,
      assigneeUserId: tx.must('assets', segment.assetId).custodianUserId,
      status: 'open',
      reason: `${item?.label ?? 'An expected item'} was not visible (${candidate.id}); check it in the field`,
      dueAt: null,
      createdAt: tx.now,
      simulated: candidate.simulated,
      source: tx.source
    }
    tx.put('tasks', task)
  }
  return candidate
}

export const inbox: Handlers<'raiseCandidate' | 'recordInventoryCheck' | 'decideCandidate' | 'completeTask'> = {
  raiseCandidate: (tx, { body }) => {
    const segment = tx.get('segments', body.segmentId)
    if (!segment) return tx.notFound(`No segment ${body.segmentId}`)
    for (const id of body.observationIds) {
      if (tx.get('observations', id)?.segmentId !== segment.id)
        return tx.notFound(`No observation ${id} on ${segment.id}`)
    }
    const item =
      body.inventoryItemId === null ? null : segment.expectedInventory.find((i) => i.id === body.inventoryItemId)
    if (item === undefined) return tx.notFound(`Segment ${segment.id} expects no item ${body.inventoryItemId}`)
    const raised = raise(tx, segment, item, body)
    return 'rule' in raised ? raised : ok(raised)
  },

  // Edge Watch reports every item a viewpoint expects (PRD WATCH-6): an item left out would read as inspected.
  recordInventoryCheck: (tx, { body }) => {
    const observation = tx.get('observations', body.observationId)
    if (!observation) return tx.notFound(`No observation ${body.observationId}`)
    const earlier = tx.all('inventoryChecks').find((c) => c.observationId === observation.id)
    if (earlier) {
      return tx.deny('invalid_transition', `${observation.id} was already checked as ${earlier.id}`, observation.id)
    }
    const segment = tx.must('segments', observation.segmentId)
    const viewpoint = segment.viewpoints.find((v) => v.id === observation.viewpointId)
    if (viewpoint === undefined) {
      throw new Error(`store integrity: ${segment.id} has no viewpoint ${observation.viewpointId}`)
    }
    const reported = body.items.map((r) => r.inventoryItemId)
    const unexpected = reported.find((id) => !viewpoint.expectedItemIds.includes(id))
    if (unexpected) return tx.notFound(`${viewpoint.id} expects no item ${unexpected}`)
    const twice = reported.find((id, i) => reported.indexOf(id) !== i)
    if (twice) {
      return tx.deny('every_item_reported', `${observation.id}'s check reports ${twice} twice`, observation.id)
    }
    const unreported = viewpoint.expectedItemIds.find((id) => !reported.includes(id))
    if (unreported) {
      const message = `${viewpoint.id} expects ${unreported}, which ${observation.id}'s check does not report`
      return tx.deny('every_item_reported', message, observation.id)
    }

    const items = viewpoint.expectedItemIds.map((id) => body.items.find((r) => r.inventoryItemId === id)!)
    const candidates: Candidate[] = []
    for (const result of items.filter((r) => r.status !== 'present')) {
      const { inventoryItemId, status, ...judgement } = result
      const raised = raise(tx, segment, itemOf(tx, { segmentId: segment.id, inventoryItemId }), {
        segmentId: segment.id,
        observationIds: [observation.id],
        inventoryItemId,
        itemStatus: status,
        class: 'inventory_item',
        ...judgement,
        model: body.model,
        simulated: observation.simulated
      })
      if ('rule' in raised) return raised
      candidates.push(raised)
    }
    const check: InventoryCheck = {
      id: tx.id('chk'),
      observationId: observation.id,
      segmentId: segment.id,
      viewpointId: viewpoint.id,
      patrolId: observation.patrolId,
      items,
      candidateIds: candidates.map((c) => c.id),
      model: body.model,
      checkedBy: { type: tx.actor.type, id: tx.actor.id },
      checkedAt: tx.now,
      simulated: observation.simulated,
      source: tx.source
    }
    tx.put('inventoryChecks', check)
    return ok({ check, candidates })
  },

  decideCandidate: (tx, { params, body }) => {
    const candidate = tx.get('candidates', params.id)
    if (!candidate) return tx.notFound(`No candidate ${params.id}`)
    if (candidate.status !== 'candidate') {
      return tx.deny('invalid_transition', `${candidate.id} is already ${candidate.status}`, candidate.id)
    }
    const decided: Candidate = {
      ...candidate,
      status: DECIDED[body.decision],
      decidedBy: tx.actor.id,
      decidedAt: tx.now,
      decisionReason: body.decision === 'confirm' ? null : body.reason
    }
    tx.put('candidates', decided)
    if (body.decision !== 'confirm') {
      tx.emit(
        'edge.candidate.decided.v1',
        {
          candidateId: candidate.id,
          segmentId: candidate.segmentId,
          decision: body.decision,
          findingId: null,
          simulated: candidate.simulated
        },
        candidate.segmentId
      )
      return ok({ candidate: decided, finding: null, tasks: [], workOrder: null })
    }

    // Confirming opens work: a finding owned by the custodian, interim protection and a draft work order.
    const segment = tx.must('segments', candidate.segmentId)
    const custodian = tx.must('assets', segment.assetId).custodianUserId
    const provenance = { simulated: candidate.simulated, source: tx.source }
    const finding: Finding = {
      id: tx.id('fnd'),
      candidateId: candidate.id,
      segmentId: segment.id,
      class: candidate.class,
      severity: body.severity,
      confirmedBy: tx.actor.id,
      custodianUserId: custodian,
      status: 'open',
      createdAt: tx.now,
      ...provenance
    }
    const task: Task = {
      id: tx.id('task'),
      kind: 'interim_protection',
      segmentId: segment.id,
      findingId: finding.id,
      assigneeUserId: custodian,
      status: 'open',
      reason: `Protect or close the approach until ${finding.id} is repaired: ${candidate.rationale}`,
      dueAt: null,
      createdAt: tx.now,
      ...provenance
    }
    const workOrder: WorkOrder = {
      id: tx.id('wo'),
      findingId: finding.id,
      remedyId: null,
      draftedBy: { type: tx.actor.type, id: tx.actor.id },
      status: 'draft',
      notes: candidate.rationale,
      installerUserId: null,
      submittedBy: null,
      dueAt: null,
      completedAt: null,
      completionEvidence: [],
      externalRef: null,
      createdAt: tx.now,
      ...provenance
    }
    tx.put('findings', finding)
    tx.put('tasks', task)
    tx.put('workOrders', workOrder)
    tx.emit(
      'edge.candidate.decided.v1',
      {
        candidateId: candidate.id,
        segmentId: segment.id,
        decision: 'confirm',
        findingId: finding.id,
        simulated: finding.simulated
      },
      segment.id
    )
    tx.emit(
      'edge.work_order.drafted.v1',
      { workOrderId: workOrder.id, findingId: finding.id, simulated: workOrder.simulated },
      segment.id
    )
    return ok({ candidate: decided, finding, tasks: [task], workOrder })
  },

  completeTask: (tx, { params }) => {
    const task = tx.get('tasks', params.id)
    if (!task) return tx.notFound(`No task ${params.id}`)
    if (task.status !== 'open') return tx.deny('invalid_transition', `${task.id} is already done`, task.id)
    const done: Task = { ...task, status: 'done' }
    tx.put('tasks', done)
    if (task.kind === 'interim_protection' && task.findingId !== null) {
      const finding = tx.must('findings', task.findingId)
      if (finding.status === 'open') tx.put('findings', { ...finding, status: 'interim_protected' })
    }
    return ok(done)
  }
}
