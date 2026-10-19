import type { Candidate, Denial, Finding, NotFound, Task, Tier, WorkOrder } from '@safe-edge/contracts'
import { DAY, movePass, tierFor } from '../policy.ts'
import type { Tx } from '../store.ts'
import { ok, type Handlers } from './handler.ts'

const DECIDED = { confirm: 'confirmed', reject: 'rejected', recapture: 'needs_recapture' } as const

type CandidateInput = Pick<
  Candidate,
  | 'segmentId'
  | 'observationIds'
  | 'inventoryItemId'
  | 'itemStatus'
  | 'class'
  | 'score'
  | 'uncertainty'
  | 'gridCell'
  | 'rationale'
  | 'model'
  | 'simulated'
>

/**
 * Raises a candidate on its segment. Core assigns the tier: `tierFor` what was seen, unless the caller is a report that
 * is Tier 2 whatever it names. Suspicion suspends: a Tier 2 candidate suspends the segment's valid or expiring pass in
 * the same transaction, and the pass's stateReason names `cause` and the candidate.
 */
function raise(
  tx: Tx,
  input: CandidateInput,
  cause: string,
  tier?: Tier
): { ok: true; data: Candidate } | Denial | NotFound {
  const segment = tx.get('segments', input.segmentId)
  if (!segment) return tx.notFound(`No segment ${input.segmentId}`)
  for (const id of input.observationIds) {
    if (tx.get('observations', id)?.segmentId !== segment.id)
      return tx.notFound(`No observation ${id} on ${segment.id}`)
  }
  const item =
    input.inventoryItemId === null ? null : segment.expectedInventory.find((i) => i.id === input.inventoryItemId)
  if (item === undefined) return tx.notFound(`Segment ${segment.id} expects no item ${input.inventoryItemId}`)

  const candidate: Candidate = {
    id: tx.id('cand'),
    ...input,
    tier: tier ?? tierFor(item, input.itemStatus),
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

  const pass = segment.passId === null ? null : tx.must('passes', segment.passId)
  if (candidate.tier === 2 && pass && (pass.state === 'valid' || pass.state === 'expiring')) {
    const suspended = movePass(tx, pass, { to: 'suspended', reason: `${cause} ${candidate.id} awaiting review` })
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
  return ok(candidate)
}

export const inbox: Handlers<
  'raiseCandidate' | 'reportDamage' | 'reportMissedPatrol' | 'decideCandidate' | 'completeTask'
> = {
  raiseCandidate: (tx, { body }) => raise(tx, body, 'Tier 2 candidate'),

  // A person saw the damage, so it waits for the manager's confirmation as Tier 2 whatever item it names (PROOF-4).
  reportDamage: (tx, { body }) =>
    raise(tx, { ...body, score: 1, uncertainty: null, gridCell: null, model: null }, 'Damage report', 2),

  // Nobody has inspected the segment for a whole patrol interval, so nobody can vouch for its pass (PROOF-4). The
  // interval runs from the last patrol that inspected some of it, or from the re-test that issued the pass if later.
  reportMissedPatrol: (tx, { params }) => {
    const segment = tx.get('segments', params.id)
    if (!segment) return tx.notFound(`No segment ${params.id}`)
    if (segment.passId === null) throw new Error(`store integrity: ${segment.id} has no pass`)
    const pass = tx.must('passes', segment.passId)
    if (pass.state !== 'valid' && pass.state !== 'expiring') {
      const message = `${pass.id} is ${pass.state}; a missed patrol suspends only a valid or expiring pass`
      return tx.deny('invalid_transition', message, segment.id)
    }
    const since = [segment.lastPatrolledAt, pass.validFrom]
      .filter((at) => at !== null)
      .reduce((a, b) => (Date.parse(a) >= Date.parse(b) ? a : b))
    const days = segment.patrolIntervalDays
    const due = Date.parse(since) + days * DAY
    if (Date.parse(tx.now) < due) {
      const message = `${segment.id} was inspected at ${since}; its ${days}-day patrol is due at ${new Date(due).toISOString()}`
      return tx.deny('invalid_transition', message, segment.id)
    }
    const missed: CandidateInput = {
      segmentId: segment.id,
      observationIds: [],
      inventoryItemId: null,
      itemStatus: null,
      class: 'missed_patrol',
      score: 1,
      uncertainty: null,
      gridCell: null,
      rationale: `No patrol has inspected ${segment.id} since ${since}; it must be patrolled every ${days} days`,
      model: null,
      simulated: segment.simulated
    }
    return raise(tx, missed, 'Missed patrol', 2)
  },

  decideCandidate: (tx, { params, body }) => {
    const candidate = tx.get('candidates', params.id)
    if (!candidate) return tx.notFound(`No candidate ${params.id}`)
    if (candidate.status !== 'candidate') {
      return tx.deny('invalid_transition', `${candidate.id} is already ${candidate.status}`, candidate.id)
    }
    if (candidate.class === 'missed_patrol' && body.decision === 'confirm') {
      const message = `${candidate.id} is a missed patrol: nothing to repair, so send it for recapture or reject it`
      return tx.deny('invalid_transition', message, candidate.id)
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
      externalError: null,
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
