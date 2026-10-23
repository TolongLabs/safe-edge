// PROOF-4's other automatic suspensions (#123): a damage report and a missed patrol each suspend the segment's pass in
// the same dispatch, audited, and neither can make a pass valid. The same paths over HTTP: apps/api/test/suspensions.test.ts.
import { describe, expect, test } from 'bun:test'
import type { Dispatch, RecordClearanceRequest, ReportDamageRequest } from '@safe-edge/contracts'
import { runSchedule, verifyAuditChain } from '../src/index.ts'
import { S1, playS1toRepair, startCore } from './support.ts'

const damage = {
  segmentId: S1.segmentId,
  observationIds: [],
  inventoryItemId: S1.inventoryItemId,
  itemStatus: 'missing',
  class: 'inventory_item',
  rationale: 'Fence panel 4 is lying in the grass by the playground path',
  simulated: true
} satisfies ReportDamageRequest

describe('a damage report suspends the pass', () => {
  test("the walk crew's report is a Tier 2 candidate that suspends the valid pass in the same dispatch, audited", () => {
    const h = startCore()
    h.setNow('2026-10-20T03:00:00.000Z')
    const before = h.audit().length

    const reported = h.call('reportDamage', 'usr_crew', { body: damage })

    expect(reported.data).toMatchObject({
      id: 'cand_1',
      tier: 2,
      status: 'candidate',
      raisedBy: { type: 'user', id: 'usr_crew' },
      rationale: damage.rationale,
      model: null,
      source: 'user'
    })
    expect(reported.events.map((e) => [e.type, e.data])).toEqual([
      ['edge.candidate.raised.v1', { candidateId: 'cand_1', segmentId: S1.segmentId, tier: 2, simulated: true }],
      [
        'edge.pass.suspended.v1',
        { passId: 'pass_866518980_11', segmentId: S1.segmentId, candidateId: 'cand_1', simulated: true }
      ]
    ])
    expect(h.segment(S1.segmentId).pass).toMatchObject({
      state: 'suspended',
      stateReason: 'Damage report cand_1 awaiting review'
    })
    const written = h.audit().slice(before)
    expect(written.map((e) => [e.action, e.subjectId, e.actor.id, e.decision])).toEqual([
      ['reportDamage', 'cand_1', 'usr_crew', 'allowed'],
      ['reportDamage', 'pass_866518980_11', 'usr_crew', 'allowed'],
      ['reportDamage', 'drpt_1', 'usr_crew', 'allowed']
    ])
    expect(written[1]).toMatchObject({ before: { state: 'valid' }, after: { state: 'suspended' } })
    expect(verifyAuditChain(h.audit()).ok).toBe(true)
  })

  test('only the crew and the manager file damage reports: the agent, automation and other roles are refused, audited', () => {
    const h = startCore()
    const refusals = [
      ['usr_agent', 'agents_draft_only'],
      ['usr_drone_sim', 'role_forbidden'],
      ['usr_system', 'role_forbidden'],
      ['usr_installer', 'role_forbidden']
    ] as const
    for (const [who, rule] of refusals) {
      expect(h.attempt('reportDamage', who, { body: damage })).toMatchObject({ ok: false, rule })
    }
    expect(h.audit().map((e) => [e.action, e.subjectId, e.actor.id, e.decision, e.rule])).toEqual(
      refusals.map(([who, rule]) => ['reportDamage', S1.segmentId, who, 'denied', rule])
    )
    expect(h.segment(S1.segmentId).pass!.state).toBe('valid')

    // The manager files what a resident phoned in.
    const phoned = h.call('reportDamage', 'usr_manager', { body: damage })
    expect(phoned.data).toMatchObject({ tier: 2, raisedBy: { type: 'user', id: 'usr_manager' } })
    expect(h.segment(S1.segmentId).pass!.state).toBe('suspended')
  })
})

// Seeded: every segment was last patrolled at LAST_PATROL and is patrolled every 7 days, so its patrol is missed at DUE.
const LAST_PATROL = '2026-10-16T01:00:00.000Z'
const DUE = '2026-10-23T01:00:00.000Z'
const SOON = 'seg_866518980_12'

describe('a missed patrol suspends the pass', () => {
  test("once a whole patrol interval passes with no patrol, the system's report suspends the pass in the same dispatch, audited", () => {
    const h = startCore()
    expect(h.segment(S1.segmentId).segment).toMatchObject({ patrolIntervalDays: 7, lastPatrolledAt: LAST_PATROL })

    h.setNow('2026-10-23T00:59:59.999Z')
    const early = h.attempt('reportMissedPatrol', 'usr_system', { params: { id: S1.segmentId } })
    expect(early).toMatchObject({ ok: false, rule: 'invalid_transition' })
    expect(h.audit().at(-1)).toMatchObject({
      action: 'reportMissedPatrol',
      subjectId: S1.segmentId,
      decision: 'denied',
      rule: 'invalid_transition'
    })

    h.setNow(DUE)
    const before = h.audit().length
    const missed = h.call('reportMissedPatrol', 'usr_system', { params: { id: S1.segmentId } })
    expect(missed.data).toMatchObject({
      id: 'cand_1',
      segmentId: S1.segmentId,
      class: 'missed_patrol',
      tier: 2,
      status: 'candidate',
      observationIds: [],
      inventoryItemId: null,
      raisedBy: { type: 'system', id: 'usr_system' },
      rationale: `No patrol has inspected ${S1.segmentId} since ${LAST_PATROL}; it must be patrolled every 7 days`,
      source: 'system'
    })
    expect(missed.events.map((e) => [e.type, e.data])).toEqual([
      ['edge.candidate.raised.v1', { candidateId: 'cand_1', segmentId: S1.segmentId, tier: 2, simulated: true }],
      [
        'edge.pass.suspended.v1',
        { passId: 'pass_866518980_11', segmentId: S1.segmentId, candidateId: 'cand_1', simulated: true }
      ]
    ])
    expect(h.segment(S1.segmentId).pass).toMatchObject({
      state: 'suspended',
      stateReason: 'Missed patrol cand_1 awaiting review'
    })
    expect(
      h
        .audit()
        .slice(before)
        .map((e) => [e.action, e.subjectId, e.actor.id, e.decision])
    ).toEqual([
      ['reportMissedPatrol', 'cand_1', 'usr_system', 'allowed'],
      ['reportMissedPatrol', 'pass_866518980_11', 'usr_system', 'allowed']
    ])
    expect(verifyAuditChain(h.audit()).ok).toBe(true)
  })

  test('a patrol that inspected the whole segment restarts its interval; one that saw none of it does not', () => {
    const h = startCore()
    const plan = h.call('createPatrolPlan', 'usr_manager', {
      body: {
        dockId: 'dock_elmina_roof',
        droneProfileId: 'drn_assumed',
        segmentIds: [S1.segmentId, SOON],
        context: [],
        notBefore: '2026-10-21T23:30:00.000Z',
        altitudeCapM: 60
      }
    }).data
    h.call('approvePatrolPlan', 'usr_pilot', { params: { id: plan.id } })
    h.setNow(plan.window.start)
    const patrol = h.call('startPatrol', 'usr_pilot', { body: { planId: plan.id, provider: 'sim', droneId: 'sim-1' } })
    const landed = '2026-10-22T01:00:00.000Z'
    h.setNow(landed)
    const lengthM = h.segment(S1.segmentId).segment.lengthM
    h.call('completePatrol', 'usr_drone_sim', {
      params: { id: patrol.data.id },
      body: { coverage: [{ segmentId: S1.segmentId, inspectedM: lengthM, unknownM: 0 }] }
    })
    expect(h.segment(S1.segmentId).segment.lastPatrolledAt).toBe(landed)
    expect(h.segment(SOON).segment.lastPatrolledAt).toBe(LAST_PATROL)

    h.setNow(DUE)
    expect(h.attempt('reportMissedPatrol', 'usr_system', { params: { id: S1.segmentId } })).toMatchObject({
      ok: false,
      rule: 'invalid_transition'
    })
    expect(h.call('reportMissedPatrol', 'usr_system', { params: { id: SOON } }).data.class).toBe('missed_patrol')
    h.setNow('2026-10-29T01:00:00.000Z')
    h.call('reportMissedPatrol', 'usr_system', { params: { id: S1.segmentId } })
    expect(h.segment(S1.segmentId).pass!.state).toBe('suspended')
  })

  test("a newly issued pass counts from the reviewer's re-test on site, not from the last patrol", () => {
    const h = startCore()
    const played = playS1toRepair(h)
    const issuedAt = '2026-10-22T08:00:00.000Z'
    h.setNow(issuedAt)
    h.call('recordRetest', 'usr_reviewer', { body: played.retest })
    expect(h.segment(S1.segmentId).pass).toMatchObject({ state: 'valid', validFrom: issuedAt })

    h.setNow(DUE)
    expect(h.attempt('reportMissedPatrol', 'usr_system', { params: { id: S1.segmentId } })).toMatchObject({
      ok: false,
      rule: 'invalid_transition'
    })
    h.setNow('2026-10-29T08:00:00.000Z')
    expect(h.call('reportMissedPatrol', 'usr_system', { params: { id: S1.segmentId } }).data.tier).toBe(2)
  })

  test('only the system reports a missed patrol: the agent, the provider and people are refused, audited', () => {
    const h = startCore()
    h.setNow(DUE)
    const refusals = [
      ['usr_agent', 'agents_draft_only'],
      ['usr_drone_sim', 'role_forbidden'],
      ['usr_manager', 'role_forbidden'],
      ['usr_pilot', 'role_forbidden']
    ] as const
    for (const [who, rule] of refusals) {
      expect(h.attempt('reportMissedPatrol', who, { params: { id: S1.segmentId } })).toMatchObject({ ok: false, rule })
    }
    expect(h.audit().map((e) => [e.action, e.subjectId, e.actor.id, e.decision, e.rule])).toEqual(
      refusals.map(([who, rule]) => ['reportMissedPatrol', S1.segmentId, who, 'denied', rule])
    )
    expect(h.segment(S1.segmentId).pass!.state).toBe('valid')
  })

  test('the manager sends a missed patrol for recapture or rejects it; confirming it would open repair work for nothing', () => {
    const h = startCore()
    h.setNow(DUE)
    const missed = h.call('reportMissedPatrol', 'usr_system', { params: { id: S1.segmentId } }).data
    const confirm = h.attempt('decideCandidate', 'usr_manager', {
      params: { id: missed.id },
      body: { decision: 'confirm', severity: 'low' }
    })
    expect(confirm).toMatchObject({ ok: false, rule: 'invalid_transition' })
    expect(h.audit().at(-1)).toMatchObject({ action: 'decideCandidate', subjectId: missed.id, decision: 'denied' })
    expect(h.call('listFindings', 'usr_manager', { query: {} }).data).toEqual([])
    const recapture = h.call('decideCandidate', 'usr_manager', {
      params: { id: missed.id },
      body: { decision: 'recapture', reason: 'Walk it today' }
    })
    expect(recapture.data.candidate.status).toBe('needs_recapture')
  })
})

describe("the scheduled pass (both transports' runSchedule)", () => {
  test('a missed patrol that fails is recorded; the writes already made keep their events, and the other segments go on', () => {
    const h = startCore()
    const NOV_12 = '2026-11-12T02:00:00.000Z'
    h.setNow(NOV_12)
    // S1's report fails, as a bug in it would.
    const dispatch = ((operationId, actor, input) =>
      operationId === 'reportMissedPatrol' && (input as { params: { id: string } }).params.id === S1.segmentId
        ? { ok: false, rule: 'invalid_transition', message: 'forced to fail' }
        : h.core.dispatch(operationId, actor, input)) as Dispatch

    const events = runSchedule({ ...h.core, dispatch }, NOV_12)

    expect(events.map((e) => [e.type, 'segmentId' in e.data ? e.data.segmentId : null])).toEqual([
      ['edge.pass.expired.v1', 'seg_866518980_5'],
      ['edge.pass.expiring.v1', 'seg_866518980_12'],
      ['edge.candidate.raised.v1', 'seg_866518980_12'],
      ['edge.pass.suspended.v1', 'seg_866518980_12']
    ])
    expect(h.audit('automation').map((e) => [e.action, e.actor.id, e.after])).toEqual([
      [
        'runAutomation',
        'core.automation',
        { id: 'automation', step: 'schedule', error: `reportMissedPatrol ${S1.segmentId}: forced to fail` }
      ]
    ])
  })
})

describe('PROOF-4: neither report can make a pass valid', () => {
  test('they move only a valid or expiring pass, and only to suspended', () => {
    const h = startCore()
    h.setNow(DUE)
    const report = (segmentId: string) =>
      h.attempt('reportDamage', 'usr_crew', { body: { ...damage, segmentId, inventoryItemId: null, itemStatus: null } })
    const missed = (id: string) => h.attempt('reportMissedPatrol', 'usr_system', { params: { id } })
    const state = (segmentId: string) => h.segment(segmentId).pass!.state

    // Suspended by a damage report: a second report and a missed patrol leave it as it is.
    h.call('reportDamage', 'usr_crew', { body: damage })
    const again = report(S1.segmentId)
    expect(again).toMatchObject({ ok: true, data: { tier: 2 } })
    expect(again.ok && again.events.map((e) => e.type)).toEqual(['edge.candidate.raised.v1'])
    expect(missed(S1.segmentId)).toMatchObject({ ok: false, rule: 'invalid_transition' })
    expect(state(S1.segmentId)).toBe('suspended')

    // Expired and never issued: a report is still a candidate in the Inbox, but the pass does not move.
    for (const segmentId of ['seg_866518980_6', 'seg_866518980_1']) {
      const before = state(segmentId)
      expect(report(segmentId)).toMatchObject({ ok: true, events: [{ type: 'edge.candidate.raised.v1' }] })
      expect(missed(segmentId)).toMatchObject({ ok: false, rule: 'invalid_transition' })
      expect(state(segmentId)).toBe(before)
    }
    expect(state('seg_866518980_6')).toBe('expired')
    expect(state('seg_866518980_1')).toBe('none')

    // Expiring: a missed patrol suspends it, and a suspended pass then sits out its expiry.
    expect(missed('seg_866518980_5')).toMatchObject({ ok: true })
    expect(state('seg_866518980_5')).toBe('suspended')
    const ticked = h.core.tick('2026-11-12T02:00:00.000Z')
    expect(ticked.map((e) => 'passId' in e.data && e.data.passId)).not.toContain('pass_866518980_5')
    expect(state('seg_866518980_5')).toBe('suspended')

    // Every pass the two reports wrote, from what to what.
    const reports = ['reportDamage', 'reportMissedPatrol']
    const moved = h
      .audit()
      .filter((e) => reports.includes(e.action) && e.subjectId.startsWith('pass_') && e.decision === 'allowed')
    expect(
      moved.map((e) => [e.subjectId, (e.before as { state: string }).state, (e.after as { state: string }).state])
    ).toEqual([
      ['pass_866518980_11', 'valid', 'suspended'],
      ['pass_866518980_5', 'expiring', 'suspended']
    ])
  })

  test("the pass comes back only through a reviewer's accepted clearance of every report, never through automation", () => {
    const h = startCore()
    h.setNow(DUE)
    const missed = h.call('reportMissedPatrol', 'usr_system', { params: { id: S1.segmentId } }).data
    const reported = h.call('reportDamage', 'usr_crew', { body: damage }).data
    h.call('decideCandidate', 'usr_manager', {
      params: { id: missed.id },
      body: { decision: 'recapture', reason: 'Walk it today' }
    })
    h.call('decideCandidate', 'usr_manager', {
      params: { id: reported.id },
      body: { decision: 'reject', reason: 'The panel was off for repainting' }
    })
    const clearance = {
      checklist: [
        { kind: 'saved_view', subjectId: S1.viewpointId, result: 'pass', reason: 'Panel 4 in place', measuredMm: null }
      ],
      evidence: [],
      result: 'accepted',
      reason: 'Walked the segment; every panel is in place'
    } satisfies RecordClearanceRequest

    // Automation holding a reviewer token cannot clear either report.
    const reviewingSystem = { ...h.actor('usr_system'), role: 'reviewer' as const }
    for (const id of [missed.id, reported.id]) {
      expect(h.attempt('recordClearance', reviewingSystem, { params: { id }, body: clearance })).toMatchObject({
        ok: false,
        rule: 'one_way_rule'
      })
    }

    // A reviewer clears the damage report, but the missed patrol still holds the pass.
    h.setNow('2026-10-23T05:00:00.000Z')
    const first = h.call('recordClearance', 'usr_reviewer', { params: { id: reported.id }, body: clearance })
    expect(first.data.pass).toBeNull()
    expect(h.segment(S1.segmentId).pass).toMatchObject({
      state: 'suspended',
      stateReason: expect.stringContaining(missed.id)
    })

    const second = h.call('recordClearance', 'usr_reviewer', { params: { id: missed.id }, body: clearance })
    expect(second.data.pass).toMatchObject({
      state: 'valid',
      issuedBy: 'usr_reviewer',
      validFrom: '2026-10-23T05:00:00.000Z'
    })

    const madeValid = h.audit().filter((e) => (e.after as { state?: string } | null)?.state === 'valid')
    expect(madeValid.map((e) => [e.action, e.subjectId, e.actor])).toEqual([
      ['recordClearance', 'pass_866518980_11', { type: 'user', id: 'usr_reviewer', role: 'reviewer' }]
    ])
    expect(verifyAuditChain(h.audit()).ok).toBe(true)
  })
})
