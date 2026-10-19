import { describe, expect, test } from 'bun:test'
import type { AuditEvent } from '@safe-edge/contracts'
import { verifyAuditChain } from '../src/index.ts'
import { S1, playS1toRepair, raiseOnS1, startCore, type Harness } from './support.ts'

/** S1 to S3: the repair, then a different reviewer re-tests it on a phone and accepts. */
function playS1toS3(h: Harness) {
  const played = playS1toRepair(h)
  h.setNow('2026-10-23T01:00:00.000Z')
  const retest = h.call('recordRetest', 'usr_reviewer', {
    body: { ...played.retest, reason: 'Both observed approaches closed; far end still to be inspected' }
  })
  return { ...played, retest }
}

describe('S1 to S3: the core loop on one segment', () => {
  test('a Tier 2 missing panel suspends the pass at once, in the same dispatch that raises it', () => {
    const h = startCore()
    const raised = raiseOnS1(h, 'usr_drone_sim', {
      inventoryItemId: S1.inventoryItemId,
      itemStatus: 'missing',
      class: 'inventory_item',
      rationale: 'Fence panel 4 is missing by the playground path'
    })
    expect(raised.data).toMatchObject({
      tier: 2,
      status: 'candidate',
      raisedBy: { type: 'provider', id: 'usr_drone_sim' }
    })
    expect(raised.events.map((e) => [e.type, e.subject])).toEqual([
      ['edge.candidate.raised.v1', `segments/${S1.segmentId}`],
      ['edge.pass.suspended.v1', `segments/${S1.segmentId}`]
    ])
    expect(h.segment(S1.segmentId).pass).toMatchObject({
      state: 'suspended',
      stateReason: 'Tier 2 candidate cand_1 awaiting review'
    })
  })

  test('confirming opens a finding owned by the custodian, interim protection and a draft work order', () => {
    const h = startCore()
    const { decision } = playS1toS3(h)
    expect(decision.data.finding).toMatchObject({
      id: 'fnd_1',
      status: 'open',
      severity: 'high',
      confirmedBy: 'usr_manager',
      custodianUserId: 'usr_manager'
    })
    expect(decision.data.tasks.map((t) => [t.kind, t.findingId, t.status])).toEqual([
      ['interim_protection', 'fnd_1', 'open']
    ])
    expect(decision.data.workOrder).toMatchObject({
      status: 'draft',
      findingId: 'fnd_1',
      draftedBy: { type: 'user', id: 'usr_manager' }
    })
    expect(decision.events.map((e) => e.type)).toEqual(['edge.candidate.decided.v1', 'edge.work_order.drafted.v1'])
  })

  test('Fix Lens: a route stays open until one of its openings is blocked, and an unseen link stays unknown', () => {
    const { previews } = playS1toS3(startCore())
    expect(previews.panelOnly).toEqual([
      ['rte_1', 'closed'],
      ['rte_2', 'open'],
      ['rte_3', 'unknown']
    ])
    expect(previews.full).toEqual([
      ['rte_1', 'closed'],
      ['rte_2', 'closed'],
      ['rte_3', 'unknown']
    ])
  })

  test('an accepted independent re-test issues a 12-month pass listing the routes and tests it covers', () => {
    const h = startCore()
    const { retest, workOrderId } = playS1toS3(h)
    expect(retest.events.map((e) => e.type)).toEqual(['edge.retest.recorded.v1', 'edge.pass.issued.v1'])
    expect(retest.data.pass).toMatchObject({
      state: 'valid',
      validFrom: '2026-10-23T01:00:00.000Z',
      validTo: '2027-10-23T01:00:00.000Z',
      scope: { routeIds: ['rte_1', 'rte_2'], retestIds: ['rt_1'] },
      issuedBy: 'usr_reviewer'
    })
    expect(h.call('getWorkOrder', 'usr_manager', { params: { id: workOrderId } }).data.status).toBe('accepted')
    expect(h.call('getFinding', 'usr_manager', { params: { id: 'fnd_1' } }).data.status).toBe('closed')
    // The installed remedy now blocks both openings: both observed routes are closed, the unseen one is not.
    const lens = h.call('previewRouteClosure', 'usr_manager', { params: { id: S1.segmentId }, body: { remedyIds: [] } })
    expect(lens.data.routes.map((r) => [r.id, r.status])).toEqual([
      ['rte_1', 'closed'],
      ['rte_2', 'closed'],
      ['rte_3', 'unknown']
    ])
  })

  test("the segment's audit trail shows every step with actor, before and after, on a chain that verifies", () => {
    const h = startCore()
    playS1toS3(h)
    const state = (record: unknown) => {
      if (record === null) return '∅'
      const r = record as { status?: string; state?: string; result?: string; engineerApprovedBy?: string | null }
      if ('engineerApprovedBy' in r) return r.engineerApprovedBy ? 'approved' : 'unapproved'
      return r.status ?? r.state ?? r.result ?? 'recorded'
    }
    const line = (e: AuditEvent) => `${e.actor.id} ${e.action} ${e.subjectId} ${state(e.before)}→${state(e.after)}`
    expect(h.audit(S1.segmentId).map(line)).toEqual([
      'usr_drone_sim recordObservation obs_1 ∅→recorded',
      'usr_drone_sim raiseCandidate cand_1 ∅→candidate',
      'usr_drone_sim raiseCandidate pass_866518980_11 valid→suspended',
      'usr_manager decideCandidate cand_1 candidate→confirmed',
      'usr_manager decideCandidate fnd_1 ∅→open',
      'usr_manager decideCandidate task_1 ∅→open',
      'usr_manager decideCandidate wo_1 ∅→draft',
      'usr_crew completeTask task_1 open→done',
      'usr_crew completeTask fnd_1 open→interim_protected',
      'usr_manager createOpening opn_1 ∅→open',
      'usr_manager createOpening opn_2 ∅→open',
      'usr_manager createRoute rte_1 ∅→open',
      'usr_manager createRoute rte_2 ∅→open',
      'usr_manager createRoute rte_3 ∅→unknown',
      'usr_engineer createRemedy rem_1 ∅→unapproved',
      'usr_engineer createRemedy rem_2 ∅→unapproved',
      'usr_engineer approveRemedy rem_2 unapproved→approved',
      'usr_manager updateWorkOrder wo_1 draft→draft',
      'usr_manager submitWorkOrder wo_1 draft→submitted',
      'usr_manager submitWorkOrder fnd_1 interim_protected→work_ordered',
      'usr_installer startWorkOrder wo_1 submitted→in_progress',
      'usr_installer completeWorkOrder wo_1 in_progress→completed',
      'usr_installer completeWorkOrder fnd_1 work_ordered→repaired',
      'usr_installer completeWorkOrder fnd_1 repaired→retest_pending',
      'usr_reviewer recordRetest rt_1 ∅→accepted',
      'usr_reviewer recordRetest wo_1 completed→accepted',
      'usr_reviewer recordRetest fnd_1 retest_pending→closed',
      'usr_reviewer recordRetest pass_866518980_11 suspended→valid',
      'usr_reviewer recordRetest opn_1 open→blocked',
      'usr_reviewer recordRetest opn_2 open→blocked',
      'usr_reviewer recordRetest rte_1 open→closed',
      'usr_reviewer recordRetest rte_2 open→closed'
    ])
    const chain = h.audit()
    expect(chain.every((e) => e.decision === 'allowed' && e.policyVersion === 'safe-edge-core/1')).toBe(true)
    expect(verifyAuditChain(chain)).toMatchObject({ ok: true, length: chain.length })
  })

  test('two runs with the same seed, clock and ID counter give identical records and hashes', () => {
    const first = startCore()
    const second = startCore()
    playS1toS3(first)
    playS1toS3(second)
    expect(second.audit()).toEqual(first.audit())
    expect(verifyAuditChain(second.audit())).toEqual(verifyAuditChain(first.audit()))
  })
})
