import { describe, expect, test } from 'bun:test'
import type { ItemResult, ItemStatus, Observation } from '@safe-edge/contracts'
import { S1, observeS1, seed, startCore, type Harness, type Who } from './support.ts'

const segment = seed.segments.find((s) => s.id === S1.segmentId)!
const viewpoint = (id: string) => segment.viewpoints.find((v) => v.id === id)!
const item = (suffix: string) => segment.expectedInventory.find((i) => i.id.endsWith(suffix))!.id
/** Fence panels 1 to 3 and the deep-water sign. */
const VP1 = 'vp_866518980_11_1'
/** S1's viewpoint: fence panels 4 to 6 and the ring buoy. */
const VP2 = S1.viewpointId

/** A result for every item the viewpoint expects, in its order: present unless `statuses` says otherwise. */
function report(viewpointId: string, statuses: Record<string, ItemStatus> = {}): ItemResult[] {
  return viewpoint(viewpointId).expectedItemIds.map((id) => {
    const status = statuses[id] ?? 'present'
    const { label } = segment.expectedInventory.find((i) => i.id === id)!
    return {
      inventoryItemId: id,
      status,
      score: 0.9,
      uncertainty: 'low',
      gridCell: 'B3',
      rationale: `${label}: ${status}`
    }
  })
}

function observe(
  h: Harness,
  who: Who,
  viewpointId: string,
  {
    patrolId = null,
    captureSource = 'drone',
    simulated = true
  }: Partial<Pick<Observation, 'patrolId' | 'captureSource' | 'simulated'>> = {}
) {
  return h.call('recordObservation', who, {
    body: {
      patrolId,
      segmentId: S1.segmentId,
      viewpointId,
      captureSource,
      image: null,
      pose: viewpoint(viewpointId).pose,
      capturedAt: h.now(),
      quality: { sharpness: 0.92, alignmentResidualPx: 1.4, occlusion: 0.05 },
      privacyAction: 'none',
      simulated
    }
  }).data
}

const check = (h: Harness, who: Who, observation: Observation, items: ItemResult[]) =>
  h.call('recordInventoryCheck', who, { body: { observationId: observation.id, items, model: null } })

/** A drone patrol over S1's segment, planned by the system and approved by the pilot. */
function flyPatrol(h: Harness, at: string) {
  h.setNow(at)
  const plan = h.call('createPatrolPlan', 'usr_system', {
    body: {
      dockId: 'dock_elmina_roof',
      droneProfileId: 'drn_assumed',
      segmentIds: [S1.segmentId],
      context: [],
      notBefore: at,
      altitudeCapM: 60
    }
  }).data
  h.call('approvePatrolPlan', 'usr_pilot', { params: { id: plan.id } })
  return h.call('startPatrol', 'usr_pilot', { body: { planId: plan.id, provider: 'sim', droneId: 'sim-1' } }).data
}

describe('WATCH-6: Edge Watch reports every expected item at its fixed viewpoint', () => {
  test('S1: the drone reports all four items at its viewpoint; only missing fence panel 4 becomes a candidate, Tier 2, and the pass is suspended', () => {
    const h = startCore()
    const observation = observeS1(h)
    const checked = check(h, 'usr_drone_sim', observation, report(VP2, { [S1.inventoryItemId]: 'missing' }))

    expect(checked.data.check).toMatchObject({
      id: 'chk_1',
      observationId: observation.id,
      segmentId: S1.segmentId,
      viewpointId: VP2,
      patrolId: null,
      candidateIds: ['cand_1'],
      checkedBy: { type: 'provider', id: 'usr_drone_sim' },
      simulated: true
    })
    expect(checked.data.check.items.map((i) => [i.inventoryItemId, i.status])).toEqual([
      [item('fence_panel_4'), 'missing'],
      [item('fence_panel_5'), 'present'],
      [item('fence_panel_6'), 'present'],
      [item('ring_buoy'), 'present']
    ])
    expect(checked.data.candidates).toMatchObject([
      {
        id: 'cand_1',
        observationIds: [observation.id],
        inventoryItemId: S1.inventoryItemId,
        itemStatus: 'missing',
        class: 'inventory_item',
        tier: 2,
        status: 'candidate'
      }
    ])
    expect(checked.events.map((e) => e.type)).toEqual(['edge.candidate.raised.v1', 'edge.pass.suspended.v1'])
    expect(h.segment(S1.segmentId).pass?.state).toBe('suspended')
    expect(h.call('listInventoryChecks', 'usr_gm', { query: { segmentId: S1.segmentId } }).data).toEqual([
      checked.data.check
    ])
  })

  test('S0: a crew phone check on foot reports every item; a changed sign is Tier 1 and a hidden panel is Tier 3 with a field task', () => {
    const h = startCore()
    const observation = observe(h, 'usr_crew', VP1, { captureSource: 'phone', simulated: false })
    const checked = check(
      h,
      'usr_crew',
      observation,
      report(VP1, { [item('fence_panel_2')]: 'not_visible', [item('_sign')]: 'changed' })
    )

    expect(checked.data.check).toMatchObject({ checkedBy: { type: 'user', id: 'usr_crew' }, simulated: false })
    expect(checked.data.check.items.map((i) => i.status)).toEqual(['present', 'not_visible', 'present', 'changed'])
    expect(checked.data.candidates.map((c) => [c.inventoryItemId, c.itemStatus, c.tier, c.simulated])).toEqual([
      [item('fence_panel_2'), 'not_visible', 3, false],
      [item('_sign'), 'changed', 1, false]
    ])
    expect(checked.events.map((e) => e.type)).toEqual(['edge.candidate.raised.v1', 'edge.candidate.raised.v1'])
    expect(h.segment(S1.segmentId).pass?.state).toBe('valid')
    const tasks = h.call('listTasks', 'usr_manager', { query: { segmentId: S1.segmentId } }).data
    expect(tasks.map((t) => [t.kind, t.status])).toEqual([['field_check', 'open']])
  })

  test('a check must report each item its viewpoint expects exactly once, and an observation is checked once', () => {
    const h = startCore()
    const observation = observeS1(h)
    const attempt = (items: ItemResult[], observationId = observation.id) =>
      h.attempt('recordInventoryCheck', 'usr_drone_sim', { body: { observationId, items, model: null } })
    const all = report(VP2)

    expect(attempt(all.slice(1))).toEqual({
      ok: false,
      rule: 'every_item_reported',
      message: `${VP2} expects ${item('fence_panel_4')}, which ${observation.id}'s check does not report`
    })
    expect(attempt([...all, all[0]!])).toEqual({
      ok: false,
      rule: 'every_item_reported',
      message: `${observation.id}'s check reports ${item('fence_panel_4')} twice`
    })
    expect(attempt([...all, report(VP1)[0]!])).toEqual({
      ok: false,
      error: 'not_found',
      message: `${VP2} expects no item ${item('fence_panel_1')}`
    })
    expect(attempt(all, 'obs_404')).toEqual({ ok: false, error: 'not_found', message: 'No observation obs_404' })

    const first = check(h, 'usr_drone_sim', observation, all)
    expect(first.data.candidates).toEqual([])
    expect(attempt(all)).toEqual({
      ok: false,
      rule: 'invalid_transition',
      message: `${observation.id} was already checked as ${first.data.check.id}`
    })

    // Refusals are on the audit chain against the observation; nothing was raised.
    const denied = h.audit().filter((e) => e.decision === 'denied')
    expect(denied.map((e) => [e.action, e.subjectId, e.rule])).toEqual([
      ['recordInventoryCheck', observation.id, 'every_item_reported'],
      ['recordInventoryCheck', observation.id, 'every_item_reported'],
      ['recordInventoryCheck', observation.id, 'invalid_transition']
    ])
    expect(h.call('listCandidates', 'usr_manager', { query: {} }).data).toEqual([])
  })
})

describe('WATCH-7: the false-flag budget', () => {
  /** Panels 4 to 6 missing: three fence-panel flags per check. */
  const panels = {
    [item('fence_panel_4')]: 'missing',
    [item('fence_panel_5')]: 'missing',
    [item('fence_panel_6')]: 'missing'
  } as const
  /** Four drone checks at viewpoint 2 on one patrol: twelve fence-panel flags. */
  const twelvePanelFlags = (h: Harness, patrolId: string) =>
    Array.from({ length: 4 }, () =>
      check(h, 'usr_drone_sim', observe(h, 'usr_drone_sim', VP2, { patrolId }), report(VP2, panels))
    ).flatMap((checked) => checked.data.candidates)
  const decide = (h: Harness, id: string, decision: 'reject' | 'recapture') =>
    h.call('decideCandidate', 'usr_manager', {
      params: { id },
      body: { decision, reason: 'The panel is in place; glare on the water' }
    })
  const board = (h: Harness) => h.call('getFalseFlags', 'usr_gm', {}).data

  test('a class with more than 10 false flags on its latest reviewed patrol drops to Tier 1, and the board shows the counts', () => {
    const h = startCore()
    const first = flyPatrol(h, '2026-10-21T23:40:00.000Z')
    const flags = twelvePanelFlags(h, first.id)
    expect(flags.map((c) => c.tier)).toEqual(Array(12).fill(2))

    for (const flag of flags.slice(0, 10)) decide(h, flag.id, 'reject')
    // A recaptured flag is reviewed but not false, and ten false flags is the budget, not over it.
    decide(h, flags[11]!.id, 'recapture')
    expect(board(h)).toEqual({
      budgetPerPatrol: 10,
      patrols: [
        {
          patrolId: first.id,
          startedAt: '2026-10-21T23:40:00.000Z',
          classes: [{ flagClass: 'fence_panel', reviewed: 11, falseFlags: 10 }]
        }
      ],
      overBudget: []
    })
    decide(h, flags[10]!.id, 'reject')
    expect(board(h)).toMatchObject({
      patrols: [{ patrolId: first.id, classes: [{ flagClass: 'fence_panel', reviewed: 12, falseFlags: 11 }] }],
      overBudget: ['fence_panel']
    })

    // The next patrol. A check that raises no panel flag leaves the class over budget: only reviewed flags restore it.
    h.call('completePatrol', 'usr_pilot', { params: { id: first.id }, body: { coverage: [] } })
    const next = flyPatrol(h, '2026-10-28T23:40:00.000Z')
    check(h, 'usr_drone_sim', observe(h, 'usr_drone_sim', VP2, { patrolId: next.id }), report(VP2))
    expect(board(h).overBudget).toEqual(['fence_panel'])

    // A missing panel is now Tier 1; a panel not visible is still Tier 3, and a missing ring buoy still Tier 2.
    const nextFlags = check(
      h,
      'usr_drone_sim',
      observe(h, 'usr_drone_sim', VP2, { patrolId: next.id }),
      report(VP2, {
        [S1.inventoryItemId]: 'missing',
        [item('fence_panel_5')]: 'not_visible',
        [item('ring_buoy')]: 'missing'
      })
    ).data.candidates
    expect(nextFlags.map((c) => [c.inventoryItemId, c.tier])).toEqual([
      [S1.inventoryItemId, 1],
      [item('fence_panel_5'), 3],
      [item('ring_buoy'), 2]
    ])

    // Reviewing the next patrol with one false panel flag brings the class back within budget.
    decide(h, nextFlags[0]!.id, 'reject')
    expect(board(h)).toMatchObject({
      patrols: [
        { patrolId: first.id, classes: [{ flagClass: 'fence_panel', reviewed: 12, falseFlags: 11 }] },
        { patrolId: next.id, classes: [{ flagClass: 'fence_panel', reviewed: 1, falseFlags: 1 }] }
      ],
      overBudget: []
    })
  })

  test('patrols that start at the same instant count in the order they were created, not by the text of their IDs', () => {
    const h = startCore()
    for (let day = 1; day <= 8; day++) flyPatrol(h, `2026-11-0${day}T23:40:00.000Z`)
    const ninth = flyPatrol(h, '2026-11-09T23:40:00.000Z')
    const tenth = flyPatrol(h, '2026-11-09T23:40:00.000Z')
    expect([ninth.id, tenth.id]).toEqual(['ptl_9', 'ptl_10'])

    // The ninth patrol goes over budget; the tenth, created after it, stays within it.
    for (const flag of twelvePanelFlags(h, ninth.id).slice(0, 11)) decide(h, flag.id, 'reject')
    decide(h, twelvePanelFlags(h, tenth.id)[0]!.id, 'reject')
    expect(board(h).patrols.map((p) => [p.patrolId, p.classes[0]!.falseFlags])).toEqual([
      ['ptl_9', 11],
      ['ptl_10', 1]
    ])
    expect(board(h).overBudget).toEqual([])
  })
})
