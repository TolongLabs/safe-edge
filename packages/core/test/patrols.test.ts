import { describe, expect, test } from 'bun:test'
import type { CreatePatrolPlanRequest } from '@safe-edge/contracts'
import { S1, startCore, type Harness } from './support.ts'

const SEGMENTS = [S1.segmentId, 'seg_866518980_5', 'seg_866518980_6']
const request: CreatePatrolPlanRequest = {
  dockId: 'dock_elmina_roof',
  droneProfileId: 'drn_assumed',
  segmentIds: SEGMENTS,
  context: [],
  notBefore: '2026-10-21T23:30:00.000Z',
  altitudeCapM: 60
}

function lastAudit(h: Harness) {
  return h.audit().at(-1)!
}

describe('PLAN-6: a plan flies only after a pilot approves it', () => {
  test("the planner's plan is stored proposed, and a proposed plan cannot start", () => {
    const h = startCore()
    const planned = h.call('createPatrolPlan', 'usr_manager', { body: request })
    expect(planned.data).toMatchObject({ id: 'plan_1', status: 'proposed', approvedBy: null, createdAt: h.now() })
    expect(planned.data.tasks.map((t) => t.segmentId).toSorted()).toEqual(SEGMENTS.toSorted())
    expect(planned.events.map((e) => e.type)).toEqual(['edge.patrol.planned.v1'])

    const start = h.attempt('startPatrol', 'usr_pilot', {
      body: { planId: 'plan_1', provider: 'sim', droneId: 'sim-1' }
    })
    expect(start).toMatchObject({ ok: false, rule: 'plan_not_approved' })
    expect(lastAudit(h)).toMatchObject({
      action: 'startPatrol',
      subjectId: 'plan_1',
      decision: 'denied',
      rule: 'plan_not_approved'
    })
    expect(h.call('listPatrols', 'usr_manager', {}).data).toEqual([])
  })

  test('only a pilot can approve: not the manager, the engineer or the agent', () => {
    const h = startCore()
    h.call('createPatrolPlan', 'usr_manager', { body: request })
    const approve = (who: string) => h.attempt('approvePatrolPlan', who, { params: { id: 'plan_1' } })
    expect(approve('usr_manager')).toMatchObject({ ok: false, rule: 'role_forbidden' })
    expect(approve('usr_engineer')).toMatchObject({ ok: false, rule: 'role_forbidden' })
    expect(approve('usr_agent')).toMatchObject({ ok: false, rule: 'agents_draft_only' })
    expect(h.call('listPatrolPlans', 'usr_manager', {}).data[0]!.status).toBe('proposed')

    h.setNow('2026-10-21T22:00:00.000Z')
    const approved = h.call('approvePatrolPlan', 'usr_pilot', { params: { id: 'plan_1' } })
    expect(approved.data).toMatchObject({
      status: 'approved',
      approvedBy: 'usr_pilot',
      approvedAt: '2026-10-21T22:00:00.000Z'
    })
    expect(lastAudit(h)).toMatchObject({
      action: 'approvePatrolPlan',
      decision: 'allowed',
      before: { status: 'proposed' },
      after: { status: 'approved' }
    })
    expect(approve('usr_pilot')).toMatchObject({ ok: false, rule: 'invalid_transition' })

    const patrol = h.call('startPatrol', 'usr_pilot', { body: { planId: 'plan_1', provider: 'sim', droneId: 'sim-1' } })
    expect(patrol.data).toMatchObject({ id: 'ptl_1', status: 'in_flight', pilotUserId: 'usr_pilot' })
    expect(patrol.events.map((e) => e.type)).toEqual(['edge.patrol.started.v1'])
  })

  test("the agent's patrol.propose plan still needs a pilot", () => {
    const h = startCore()
    const proposed = h.call('createPatrolPlan', 'usr_agent', { body: request })
    expect(proposed.data.status).toBe('proposed')
    expect(
      h.attempt('startPatrol', 'usr_agent', { body: { planId: 'plan_1', provider: 'sim', droneId: 'sim-1' } })
    ).toMatchObject({
      ok: false,
      rule: 'agents_draft_only'
    })
    expect(
      h.attempt('startPatrol', 'usr_pilot', { body: { planId: 'plan_1', provider: 'sim', droneId: 'sim-1' } })
    ).toMatchObject({
      ok: false,
      rule: 'plan_not_approved'
    })
    h.call('approvePatrolPlan', 'usr_pilot', { params: { id: 'plan_1' } })
    expect(
      h.call('startPatrol', 'usr_pilot', { body: { planId: 'plan_1', provider: 'sim', droneId: 'sim-1' } }).data.status
    ).toBe('in_flight')
  })
})

describe('WATCH-3: unknown coverage stays unknown', () => {
  test('unknown stretches and unreported segments create field checks and never count as inspected', () => {
    const h = startCore()
    h.call('createPatrolPlan', 'usr_manager', { body: request })
    h.call('approvePatrolPlan', 'usr_pilot', { params: { id: 'plan_1' } })
    h.call('startPatrol', 'usr_pilot', { body: { planId: 'plan_1', provider: 'sim', droneId: 'sim-1' } })
    const length = (id: string) => h.segment(id).segment.lengthM
    const [occluded, clear, unreported] = SEGMENTS as [string, string, string]

    h.setNow('2026-10-22T00:20:00.000Z')
    const completed = h.call('completePatrol', 'usr_drone_sim', {
      params: { id: 'ptl_1' },
      body: {
        coverage: [
          // Trees hid 12.5 m of the S1 segment from the camera.
          { segmentId: occluded, inspectedM: length(occluded) - 12.5, unknownM: 12.5 },
          { segmentId: clear, inspectedM: length(clear), unknownM: 0 }
        ]
      }
    })
    expect(completed.data).toMatchObject({ status: 'completed', completedAt: '2026-10-22T00:20:00.000Z' })
    expect(completed.data.coverage).toEqual([
      { segmentId: occluded, inspectedM: length(occluded) - 12.5, unknownM: 12.5 },
      { segmentId: clear, inspectedM: length(clear), unknownM: 0 },
      { segmentId: unreported, inspectedM: 0, unknownM: length(unreported) }
    ])
    expect(completed.events.map((e) => e.type)).toEqual(['edge.patrol.completed.v1'])

    const tasks = h.call('listTasks', 'usr_manager', { query: { status: 'open' } }).data
    expect(tasks.map((t) => [t.kind, t.segmentId, t.assigneeUserId])).toEqual([
      ['field_check', occluded, 'usr_manager'],
      ['field_check', unreported, 'usr_manager']
    ])
    expect(tasks[0]!.reason).toContain('12.5 m')
    expect(tasks[0]!.reason).toContain('unknown is not inspected')
    expect(
      h.attempt('completePatrol', 'usr_drone_sim', { params: { id: 'ptl_1' }, body: { coverage: [] } })
    ).toMatchObject({
      ok: false,
      rule: 'invalid_transition'
    })
  })
})
