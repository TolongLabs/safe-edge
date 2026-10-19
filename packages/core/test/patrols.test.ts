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

    h.setNow(approved.data.window.start)
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
    h.setNow(proposed.data.window.start)
    expect(
      h.call('startPatrol', 'usr_pilot', { body: { planId: 'plan_1', provider: 'sim', droneId: 'sim-1' } }).data.status
    ).toBe('in_flight')
  })
})

describe("PLAN-7: a patrol launches only inside its plan's window", () => {
  test('before the window opens and once it has closed, the start is refused', () => {
    const h = startCore()
    const plan = h.call('createPatrolPlan', 'usr_manager', { body: request }).data
    h.call('approvePatrolPlan', 'usr_pilot', { params: { id: plan.id } })
    const start = () =>
      h.attempt('startPatrol', 'usr_pilot', { body: { planId: plan.id, provider: 'sim', droneId: 'sim-1' } })
    const minute = 60_000
    const at = (iso: string, deltaMs: number) => new Date(Date.parse(iso) + deltaMs).toISOString()

    h.setNow(at(plan.window.start, -minute))
    expect(start()).toMatchObject({
      ok: false,
      rule: 'outside_window',
      message: expect.stringContaining(plan.window.start)
    })
    expect(lastAudit(h)).toMatchObject({ action: 'startPatrol', subjectId: plan.id, rule: 'outside_window' })
    h.setNow(plan.window.end)
    expect(start()).toMatchObject({
      ok: false,
      rule: 'outside_window',
      message: expect.stringContaining(plan.window.end)
    })
    expect(h.call('listPatrols', 'usr_manager', {}).data).toEqual([])

    h.setNow(plan.window.start)
    expect(start()).toMatchObject({ ok: true, data: { status: 'in_flight', startedAt: plan.window.start } })
  })
})

describe('PLAN-4: a plan a re-plan superseded never flies', () => {
  test('it can be neither approved nor started; the re-plan needs its own approval', () => {
    const h = startCore()
    const replanOf = (planId: string): CreatePatrolPlanRequest['replan'] => ({
      trigger: {
        kind: 'pass_expiring',
        segmentId: 'seg_866518980_5',
        passId: 'pass_866518980_5',
        validTo: '2026-11-15T00:00:00.000Z'
      },
      supersedes: { planId, committedTasks: 0 }
    })
    h.call('createPatrolPlan', 'usr_manager', { body: request })
    h.call('approvePatrolPlan', 'usr_pilot', { params: { id: 'plan_1' } })
    h.call('createPatrolPlan', 'usr_manager', { body: request })
    const replanned = h.call('createPatrolPlan', 'usr_system', { body: { ...request, replan: replanOf('plan_1') } })
    h.call('createPatrolPlan', 'usr_system', { body: { ...request, replan: replanOf('plan_2') } })

    const approve = h.attempt('approvePatrolPlan', 'usr_pilot', { params: { id: 'plan_2' } })
    expect(approve).toMatchObject({ ok: false, rule: 'plan_superseded', message: expect.stringContaining('plan_4') })
    expect(lastAudit(h)).toMatchObject({ action: 'approvePatrolPlan', subjectId: 'plan_2', rule: 'plan_superseded' })
    h.setNow(replanned.data.window.start)
    const start = h.attempt('startPatrol', 'usr_pilot', {
      body: { planId: 'plan_1', provider: 'sim', droneId: 'sim-1' }
    })
    expect(start).toMatchObject({ ok: false, rule: 'plan_superseded', message: expect.stringContaining('plan_3') })
    expect(lastAudit(h)).toMatchObject({ action: 'startPatrol', subjectId: 'plan_1', rule: 'plan_superseded' })
    expect(h.call('listPatrols', 'usr_manager', {}).data).toEqual([])

    h.call('approvePatrolPlan', 'usr_pilot', { params: { id: 'plan_3' } })
    const patrol = h.call('startPatrol', 'usr_pilot', { body: { planId: 'plan_3', provider: 'sim', droneId: 'sim-1' } })
    expect(patrol.data).toMatchObject({ planId: 'plan_3', status: 'in_flight' })
  })
})

describe('WATCH-3: unknown coverage stays unknown', () => {
  test('unknown stretches and unreported segments create field checks and never count as inspected', () => {
    const h = startFlying()
    const length = (id: string) => h.segment(id).segment.lengthM
    const [occluded, clear, unreported] = SEGMENTS as [string, string, string]

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

  test('only a segment inspected along its whole length restarts its patrol interval', () => {
    const h = startFlying()
    const [partial, whole, unreported] = SEGMENTS as [string, string, string]
    const length = (id: string) => h.segment(id).segment.lengthM
    const lastPatrolled = () => SEGMENTS.map((id) => h.segment(id).segment.lastPatrolledAt)
    const [partialBefore, , unreportedBefore] = lastPatrolled()

    h.call('completePatrol', 'usr_drone_sim', {
      params: { id: 'ptl_1' },
      body: {
        coverage: [
          { segmentId: partial, inspectedM: length(partial) - 0.5, unknownM: 0.5 },
          { segmentId: whole, inspectedM: length(whole), unknownM: 0 }
        ]
      }
    })
    // Half a metre unseen is a field check, and the segment is still overdue for a patrol.
    expect(lastPatrolled()).toEqual([partialBefore, '2026-10-22T00:20:00.000Z', unreportedBefore])
  })

  test('length reported as neither inspected nor unknown is unknown: a field check, never inspected', () => {
    const h = startFlying()
    const [partial, clear, third] = SEGMENTS as [string, string, string]
    const length = (id: string) => h.segment(id).segment.lengthM
    const completed = h.call('completePatrol', 'usr_drone_sim', {
      params: { id: 'ptl_1' },
      body: {
        coverage: [
          // The drone says it saw 40 m and claims nothing about the rest.
          { segmentId: partial, inspectedM: 40, unknownM: 0 },
          { segmentId: clear, inspectedM: length(clear), unknownM: 0 },
          { segmentId: third, inspectedM: length(third), unknownM: 0 }
        ]
      }
    })
    // S1's segment is 198.31 m long.
    expect(completed.data.coverage[0]).toEqual({ segmentId: partial, inspectedM: 40, unknownM: 158.31 })
    const tasks = h.call('listTasks', 'usr_manager', { query: { status: 'open' } }).data
    expect(tasks.map((t) => [t.kind, t.segmentId])).toEqual([['field_check', partial]])
    expect(tasks[0]!.reason).toContain('158.31 m of')
  })

  test('a segment reported twice, or for more than its length, is refused and changes nothing', () => {
    const h = startFlying()
    const [first, second] = SEGMENTS as [string, string, string]
    const length = h.segment(first).segment.lengthM
    const complete = (coverage: { segmentId: string; inspectedM: number; unknownM: number }[]) =>
      h.attempt('completePatrol', 'usr_drone_sim', { params: { id: 'ptl_1' }, body: { coverage } })

    const twice = complete([
      { segmentId: first, inspectedM: length, unknownM: 0 },
      { segmentId: first, inspectedM: 0, unknownM: length }
    ])
    expect(twice).toMatchObject({ ok: false, rule: 'invalid_coverage' })
    expect(twice.ok === false && twice.message).toContain(`${first} is reported twice`)
    expect(lastAudit(h)).toMatchObject({ action: 'completePatrol', subjectId: 'ptl_1', rule: 'invalid_coverage' })

    const over = complete([
      { segmentId: first, inspectedM: length, unknownM: 1 },
      { segmentId: second, inspectedM: 1, unknownM: 0 }
    ])
    expect(over).toMatchObject({ ok: false, rule: 'invalid_coverage' })
    expect(over.ok === false && over.message).toContain(`${length + 1} m of ${first}`)

    expect(h.call('listPatrols', 'usr_manager', {}).data[0]!.status).toBe('in_flight')
    expect(h.call('listTasks', 'usr_manager', { query: { status: 'open' } }).data).toEqual([])
  })
})

/** A patrol in flight from plan_1, launched when its window opened; the clock is then at its landing. */
function startFlying() {
  const h = startCore()
  const plan = h.call('createPatrolPlan', 'usr_manager', { body: request }).data
  h.call('approvePatrolPlan', 'usr_pilot', { params: { id: plan.id } })
  h.setNow(plan.window.start)
  h.call('startPatrol', 'usr_pilot', { body: { planId: 'plan_1', provider: 'sim', droneId: 'sim-1' } })
  h.setNow('2026-10-22T00:20:00.000Z')
  return h
}
