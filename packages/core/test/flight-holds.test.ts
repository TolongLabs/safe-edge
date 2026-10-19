import { describe, expect, test } from 'bun:test'
import type { ContextSnapshot, CreatePatrolPlanRequest } from '@safe-edge/contracts'
import type { ThirdParty } from '@safe-edge/planner'
import { S1, plannerWith, startCore } from './support.ts'

const NOW = '2026-10-20T21:30:00.000Z' // 05:30 on 21 Oct in Elmina (UTC+8)
const PATH_SEGMENT = 'seg_866518980_9'

const snapshot = (
  kind: ContextSnapshot['kind'],
  value: number | null,
  observedAt: string,
  validTo: string | null
): ContextSnapshot => ({
  kind,
  value,
  text: kind === 'lightning_warning' ? 'Ribut petir di beberapa tempat' : null,
  observedAt,
  validTo,
  publisher: kind === 'lightning_warning' ? 'data.gov.my' : 'JPS Public Infobanjir',
  stationId: kind === 'rainfall' ? '27880' : null,
  url: null,
  simulated: true,
  source: 'fixture'
})

// Labelled fixtures: a JPS "heavy" hour, a thunderstorm warning until 08:00 local, and normal water.
const request: CreatePatrolPlanRequest = {
  dockId: 'dock_elmina_roof',
  droneProfileId: 'drn_assumed',
  segmentIds: [S1.segmentId, 'seg_866518980_5', PATH_SEGMENT],
  context: [
    snapshot('rainfall', 40, '2026-10-20T21:15:00.000Z', null),
    snapshot('lightning_warning', null, '2026-10-20T21:00:00.000Z', '2026-10-21T00:00:00.000Z'),
    snapshot('water_level', 1, '2026-10-20T21:15:00.000Z', null)
  ],
  notBefore: NOW,
  altitudeCapM: 60
}

// People at the water's edge by segment 9's middle. The lake is about 40 m wide there, so no zoom stand-off over the
// water reaches 50 m from them and the segment must wait.
const people: ThirdParty = {
  id: 'obs_people_edge',
  kind: 'person',
  label: 'people at the water edge',
  geometry: { type: 'Point', coordinates: [101.514434, 3.179979] },
  observedAt: '2026-10-20T21:20:00.000Z',
  headcount: null,
  simulated: true,
  source: 'fixture'
}

describe('PLAN-7: S1 holds through core', () => {
  test('the weather hold stops the launch until the next dry window; the pilot records the path clear', async () => {
    const h = startCore({ planner: await plannerWith({ thirdParties: [people] }) })
    h.setNow(NOW)
    const plan = h.call('createPatrolPlan', 'usr_manager', { body: request }).data
    expect(plan.window.reason).toBe('next_dry_window')
    expect(plan.holds.map((x) => [x.kind, x.segmentId, x.until, x.releasedBy])).toEqual([
      ['weather', null, plan.window.start, null],
      ['lightning', null, '2026-10-21T00:00:00.000Z', null],
      ['separation', null, null, null],
      ['separation', PATH_SEGMENT, null, null]
    ])
    // The route flies to segment 9 first, past the seed's path crowd on the footway: take-off waits too (#150).
    expect(plan.holds[2]!.reason).toStartWith(
      'the transit from Dock on the park facility roof (assumed site) to seg_866518980_9 passes within 50 m of "S1: people on the lakeside footway"'
    )
    h.call('approvePatrolPlan', 'usr_pilot', { params: { id: plan.id } })

    // 08:30 local: the warning has ended, but after heavy rain the patrol waits for tomorrow's first light.
    h.setNow('2026-10-21T00:30:00.000Z')
    const early = h.attempt('startPatrol', 'usr_pilot', {
      body: { planId: plan.id, provider: 'sim', droneId: 'sim-1' }
    })
    expect(early).toMatchObject({ ok: false, rule: 'weather_hold' })
    expect(early.ok === false && early.message).toStartWith(
      `${plan.id} cannot launch yet: weather hold until ${plan.window.start}: rain 40 mm/h`
    )
    expect(h.audit().at(-1)).toMatchObject({
      action: 'startPatrol',
      subjectId: plan.id,
      decision: 'denied',
      rule: 'weather_hold'
    })

    h.setNow(plan.window.start)
    const start = { body: { planId: plan.id, provider: 'sim' as const, droneId: 'sim-1' } }
    expect(h.attempt('startPatrol', 'usr_pilot', start)).toMatchObject({ ok: false, rule: 'separation_hold' })
    const dockClear = h.call('releasePlanHold', 'usr_pilot', { params: { id: plan.id, segmentId: 'dock' } }).data
    const patrol = h.call('startPatrol', 'usr_pilot', start)
    expect(patrol.data.status).toBe('in_flight')

    // At segment 9 the observer sees the edge clear. Only the pilot records it, never the planner or an agent.
    const release = (who: string, segmentId = PATH_SEGMENT) =>
      h.attempt('releasePlanHold', who, { params: { id: plan.id, segmentId } })
    expect(release('usr_manager')).toMatchObject({ ok: false, rule: 'role_forbidden' })
    expect(release('usr_agent')).toMatchObject({ ok: false, rule: 'agents_draft_only' })
    const clearAt = new Date(Date.parse(plan.window.start) + 6 * 60_000).toISOString()
    h.setNow(clearAt)
    const released = h.call('releasePlanHold', 'usr_pilot', { params: { id: plan.id, segmentId: PATH_SEGMENT } }).data
    expect(released).toEqual({
      ...plan,
      status: 'approved',
      approvedBy: 'usr_pilot',
      approvedAt: NOW,
      holds: [
        plan.holds[0]!,
        plan.holds[1]!,
        dockClear.holds[2]!,
        { ...plan.holds[3]!, releasedBy: 'usr_pilot', releasedAt: clearAt }
      ]
    })
    expect(h.audit().at(-1)).toMatchObject({
      action: 'releasePlanHold',
      subjectId: plan.id,
      decision: 'allowed',
      actor: { id: 'usr_pilot' }
    })
    expect(release('usr_pilot')).toMatchObject({ ok: false, rule: 'invalid_transition' })
    expect(release('usr_pilot', 'seg_866518980_5')).toMatchObject({ ok: false, error: 'not_found' })
  })
})
