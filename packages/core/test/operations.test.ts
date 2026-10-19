// Every row of the operations table that core handles dispatches to a real command, or refuses by a named rule.
import { describe, expect, test } from 'bun:test'
import {
  Role,
  Scope,
  operations,
  type Actor,
  type CoreOperationId,
  type OperationSpec,
  type PolicyRule
} from '@safe-edge/contracts'
import type { ThirdParty } from '@safe-edge/planner'
import { verifyAuditChain } from '../src/index.ts'
import { S1, playS1toRepair, plannerWith, raiseOnS1, startCore } from './support.ts'

const coreOperations = (Object.keys(operations) as (keyof typeof operations)[]).filter(
  (id): id is CoreOperationId => operations[id].handledBy === 'core'
)

describe('the operations table in core', () => {
  test('every core operation refuses a caller the table does not allow, by a named rule, on the audit chain', () => {
    const h = startCore()
    const agent = (scopes: Actor['scopes']): Actor => ({ type: 'agent', id: 'usr_agent', role: 'agent', scopes })
    for (const operationId of coreOperations) {
      const spec: OperationSpec = operations[operationId]
      const refusals: [Actor, PolicyRule][] = [
        spec.agentScope === null ? [agent([...Scope.options]), 'agents_draft_only'] : [agent([]), 'scope_missing']
      ]
      if (spec.roles !== 'any') {
        const outsider = Role.options.find((r) => r !== 'agent' && !spec.roles.includes(r))!
        const type = outsider === 'system' || outsider === 'provider' ? outsider : 'user'
        refusals.push([{ type, id: `usr_${outsider}`, role: outsider, scopes: [] }, 'role_forbidden'])
      }
      for (const [actor, rule] of refusals) {
        // The access check runs before the input is even read.
        const result = h.core.dispatch(operationId, actor, {} as never)
        expect({ operationId, result }).toEqual({
          operationId,
          result: { ok: false, rule, message: expect.any(String) }
        })
        expect(h.audit().at(-1)).toMatchObject({
          action: operationId,
          decision: 'denied',
          rule,
          actor: { id: actor.id }
        })
      }
    }
    expect(verifyAuditChain(h.audit()).ok).toBe(true)
  })

  test('every core operation runs a real command for a caller the table allows', async () => {
    // Someone on S1's water edge (a vertex of its seed geometry), so its patrol plan has a separation hold to release.
    const onTheEdge: ThirdParty = {
      id: 'obs_person_s1',
      kind: 'person',
      label: 'person on the S1 edge',
      geometry: { type: 'Point', coordinates: [101.5124058, 3.1786474] },
      observedAt: '2026-10-24T23:00:00.000Z',
      simulated: true,
      source: 'fixture'
    }
    const h = startCore({ planner: await plannerWith({ thirdParties: [onTheEdge] }) })
    const played = playS1toRepair(h)
    h.call('recordRetest', 'usr_reviewer', { body: played.retest })
    // Then a false alarm: the drone reports the panel missing again, the manager rejects it, a reviewer clears it.
    const alarm = raiseOnS1(h, 'usr_drone_sim', {
      inventoryItemId: S1.inventoryItemId,
      itemStatus: 'missing',
      class: 'inventory_item',
      rationale: 'Panel 4 missing again'
    }).data
    h.call('decideCandidate', 'usr_manager', {
      params: { id: alarm.id },
      body: { decision: 'reject', reason: 'Shadow' }
    })
    const { workOrderId: _, ...clearance } = played.retest
    h.call('recordClearance', 'usr_reviewer', { params: { id: alarm.id }, body: clearance })

    h.call('createWorkOrder', 'usr_agent', {
      body: { findingId: played.findingId, remedyId: null, notes: 'Follow-up' }
    })
    h.call('setWorkOrderExternalRef', 'usr_system', {
      params: { id: played.workOrderId },
      body: { externalRef: '9378' }
    })
    h.call('recordWorkOrderExternalError', 'usr_system', {
      params: { id: played.workOrderId },
      body: { message: 'Procore POST /rest/v1.1/projects/1234/uploads answered 503' }
    })
    const notice = h.call('draftNotice', 'usr_manager', {
      body: { kind: 'monthly_report', subjectId: null, title: 'October report', body: 'One finding closed' }
    }).data
    expect(notice.simulated).toBe(true)
    h.call('sendNotice', 'usr_gm', { params: { id: notice.id } })

    const plan = h.call('createPatrolPlan', 'usr_system', {
      body: {
        dockId: 'dock_elmina_roof',
        droneProfileId: 'drn_assumed',
        segmentIds: [S1.segmentId],
        context: [],
        notBefore: '2026-10-24T23:30:00.000Z',
        altitudeCapM: 60
      }
    }).data
    h.call('approvePatrolPlan', 'usr_pilot', { params: { id: plan.id } })
    h.setNow(plan.window.start)
    const patrol = h.call('startPatrol', 'usr_pilot', {
      body: { planId: plan.id, provider: 'sim', droneId: 'sim-1' }
    }).data
    h.call('releasePlanHold', 'usr_pilot', { params: { id: plan.id, segmentId: S1.segmentId } })
    h.call('completePatrol', 'usr_pilot', { params: { id: patrol.id }, body: { coverage: [] } })
    // The other suspensions: a segment unpatrolled since the seed's last patrol, and damage the crew saw.
    h.call('reportMissedPatrol', 'usr_system', { params: { id: 'seg_866518980_12' } })
    h.call('reportDamage', 'usr_crew', {
      body: {
        segmentId: S1.segmentId,
        observationIds: [],
        inventoryItemId: null,
        itemStatus: null,
        class: 'bank_change',
        rationale: 'The bank has slumped beside the bench',
        simulated: true
      }
    })

    // Reads, each checked against its response schema by `call`.
    const reader = 'usr_gm'
    h.call('listAssets', reader, {})
    h.call('listSegments', reader, {})
    h.call('getSegment', reader, { params: { id: S1.segmentId } })
    h.call('listUsers', reader, {})
    h.call('getMe', reader, {})
    h.call('listDocks', reader, {})
    h.call('listDroneProfiles', reader, {})
    h.call('listPatrolPlans', reader, {})
    h.call('listPatrols', reader, {})
    h.call('listCandidates', 'usr_manager', { query: { status: 'confirmed' } })
    h.call('getCandidate', 'usr_reviewer', { params: { id: played.raised.data.id } })
    h.call('listFindings', reader, { query: { segmentId: S1.segmentId } })
    h.call('getFinding', reader, { params: { id: played.findingId } })
    h.call('listTasks', reader, { query: {} })
    h.call('listWorkOrders', reader, { query: { installerUserId: 'usr_installer' } })
    h.call('getWorkOrder', reader, { params: { id: played.workOrderId } })
    h.call('listPasses', reader, { query: { state: 'valid' } })
    h.call('getPass', reader, { params: { id: `pass_${S1.segmentId.slice('seg_'.length)}` } })
    h.call('listAudit', reader, { query: { subject: S1.segmentId } })
    h.call('listNotices', reader, { query: { status: 'sent' } })

    expect([...h.succeeded].toSorted()).toEqual(coreOperations.toSorted())
  })

  test('an unknown record is not found, and a lookup that finds nothing appends no audit event', () => {
    const h = startCore()
    const before = h.audit().length
    expect(h.attempt('getCandidate', 'usr_manager', { params: { id: 'cand_404' } })).toEqual({
      ok: false,
      error: 'not_found',
      message: 'No candidate cand_404'
    })
    expect(h.attempt('approveRemedy', 'usr_engineer', { params: { id: 'rem_404' } })).toMatchObject({
      ok: false,
      error: 'not_found'
    })
    expect(h.audit().length).toBe(before)
  })

  test('operations the API or the memory transport own are not core commands', () => {
    const h = startCore()
    expect(() => h.core.dispatch('resetDemo' as never, h.actor('usr_manager'), {} as never)).toThrow(
      'resetDemo is handled by memory, not core'
    )
  })
})
