// #123 over HTTP: a damage report and a missed patrol each suspend the pass in one request, stream
// edge.pass.suspended.v1 and land on the audit chain, and neither makes a pass valid. Core-level: packages/core/test/suspensions.test.ts.
import { expect, test } from 'bun:test'
import { AuditEvent, EdgeEvent, EdgePass, type ReportDamageRequest } from '@safe-edge/contracts'
import { S1, fixtureDevTokens, sseFrames, startApi, type Api } from './support.ts'

const S1_PASS = 'pass_866518980_11'
const SOON = 'seg_866518980_12'
/** A whole 7-day interval after the seeded last patrol (2026-10-16T01:00Z). */
const DUE = '2026-10-23T01:00:00.000Z'

const damage = {
  segmentId: S1.segmentId,
  observationIds: [],
  inventoryItemId: S1.inventoryItemId,
  itemStatus: 'missing',
  class: 'inventory_item',
  rationale: 'Fence panel 4 is lying in the grass by the playground path',
  simulated: true
} satisfies ReportDamageRequest

async function answer(response: Promise<Response>) {
  const r = await response
  return { status: r.status, body: await r.json() }
}

const denied = (rule: string) => ({ status: 403, body: { ok: false, rule, message: expect.any(String) } })

const passOf = async (api: Api, segmentId: string, token = 'tok_manager') =>
  EdgePass.parse((await answer(api.request('get', `/segments/${segmentId}`, { token }))).body.pass)

const auditOf = async (api: Api, token = 'tok_gm') =>
  AuditEvent.array().parse((await answer(api.request('get', '/audit', { token }))).body)

/** The CloudEvents the stream carries next, skipping heartbeats. */
async function nextEvents(frames: ReturnType<typeof sseFrames>, count: number): Promise<EdgeEvent[]> {
  const events: EdgeEvent[] = []
  while (events.length < count) {
    const frame = await frames.next()
    if (frame.startsWith(':')) continue
    const data = frame.split('\n').find((line) => line.startsWith('data: '))!
    events.push(EdgeEvent.parse(JSON.parse(data.slice('data: '.length))))
  }
  return events
}

test("the crew's damage report and the system's missed-patrol report each suspend a pass in one request, streamed and audited", async () => {
  const api = startApi({ heartbeatMs: 1_000 })
  const stream = await api.request('get', '/events', { token: 'tok_gm' })
  const frames = sseFrames(stream.body!)
  expect(await frames.next()).toBe(': connected')

  const reported = await answer(api.request('post', '/damage-reports', { token: 'tok_crew', body: damage }))
  expect(reported).toMatchObject({
    status: 201,
    body: { id: 'cand_1', tier: 2, status: 'candidate', raisedBy: { type: 'user', id: 'usr_crew' } }
  })

  // Before its interval is up the system's report is refused; once it is, the pass is suspended.
  api.setNow('2026-10-23T00:59:59.999Z')
  expect(await answer(api.request('post', `/segments/${SOON}/missed-patrol`, { token: 'tok_system' }))).toEqual(
    denied('invalid_transition')
  )
  api.setNow(DUE)
  const missed = await answer(api.request('post', `/segments/${SOON}/missed-patrol`, { token: 'tok_system' }))
  expect(missed).toMatchObject({
    status: 201,
    body: { id: 'cand_2', class: 'missed_patrol', tier: 2, raisedBy: { type: 'system', id: 'usr_system' } }
  })

  const events = await nextEvents(frames, 4)
  await frames.cancel()
  expect(events.map((e) => [e.type, e.data])).toEqual([
    ['edge.candidate.raised.v1', { candidateId: 'cand_1', segmentId: S1.segmentId, tier: 2, simulated: true }],
    ['edge.pass.suspended.v1', { passId: S1_PASS, segmentId: S1.segmentId, candidateId: 'cand_1', simulated: true }],
    ['edge.candidate.raised.v1', { candidateId: 'cand_2', segmentId: SOON, tier: 2, simulated: true }],
    ['edge.pass.suspended.v1', { passId: 'pass_866518980_12', segmentId: SOON, candidateId: 'cand_2', simulated: true }]
  ])
  expect(await passOf(api, S1.segmentId)).toMatchObject({
    state: 'suspended',
    stateReason: 'Damage report cand_1 awaiting review'
  })
  expect(await passOf(api, SOON)).toMatchObject({
    state: 'suspended',
    stateReason: 'Missed patrol cand_2 awaiting review'
  })

  expect((await auditOf(api)).map((e) => [e.action, e.subjectId, e.actor.id, e.decision, e.rule])).toEqual([
    ['reportDamage', 'cand_1', 'usr_crew', 'allowed', null],
    ['reportDamage', S1_PASS, 'usr_crew', 'allowed', null],
    ['reportMissedPatrol', SOON, 'usr_system', 'denied', 'invalid_transition'],
    ['reportMissedPatrol', 'cand_2', 'usr_system', 'allowed', null],
    ['reportMissedPatrol', 'pass_866518980_12', 'usr_system', 'allowed', null]
  ])
})

test('the agent cannot file either report: 403 agents_draft_only, audited, and the pass stays valid', async () => {
  const api = startApi()
  api.setNow(DUE)
  expect(await answer(api.request('post', '/damage-reports', { token: 'tok_agent', body: damage }))).toEqual(
    denied('agents_draft_only')
  )
  expect(await answer(api.request('post', `/segments/${S1.segmentId}/missed-patrol`, { token: 'tok_agent' }))).toEqual(
    denied('agents_draft_only')
  )
  // Nor can the drone provider, which raises what it sees through POST /candidates instead.
  expect(await answer(api.request('post', '/damage-reports', { token: 'tok_provider', body: damage }))).toEqual(
    denied('role_forbidden')
  )
  expect((await auditOf(api)).map((e) => [e.action, e.subjectId, e.actor.id, e.rule])).toEqual([
    ['reportDamage', S1.segmentId, 'usr_agent', 'agents_draft_only'],
    ['reportMissedPatrol', S1.segmentId, 'usr_agent', 'agents_draft_only'],
    ['reportDamage', S1.segmentId, 'usr_drone_sim', 'role_forbidden']
  ])
  expect((await passOf(api, S1.segmentId)).state).toBe('valid')
})

test('over HTTP neither report restores valid: only a reviewing person clears them, a reviewer token on the system is refused', async () => {
  const api = startApi({
    tokens: new Map([
      ...fixtureDevTokens,
      ['dev_system_reviewing', { type: 'system', id: 'usr_system', role: 'reviewer', scopes: [] }]
    ])
  })
  const as = (token: string, method: string, path: string, body?: unknown) =>
    answer(api.request(method, path, { token, body }))
  api.setNow(DUE)
  const missed = (await as('dev_system', 'post', `/segments/${S1.segmentId}/missed-patrol`)).body
  // On the suspended pass: another damage report is only a candidate, a second missed patrol is refused.
  const reported = await as('dev_crew', 'post', '/damage-reports', damage)
  expect(reported.status).toBe(201)
  expect(await as('dev_system', 'post', `/segments/${S1.segmentId}/missed-patrol`)).toEqual(
    denied('invalid_transition')
  )
  // An expired pass stays expired.
  const expired = { ...damage, segmentId: 'seg_866518980_6', inventoryItemId: null, itemStatus: null }
  expect((await as('dev_crew', 'post', '/damage-reports', expired)).status).toBe(201)
  expect((await passOf(api, 'seg_866518980_6', 'dev_manager')).state).toBe('expired')

  for (const [id, decision] of [
    [missed.id, 'recapture'],
    [reported.body.id, 'reject']
  ]) {
    await as('dev_manager', 'post', `/candidates/${id}/decision`, { decision, reason: 'Walked it; nothing missing' })
  }
  const clearance = {
    checklist: [
      { kind: 'saved_view', subjectId: S1.viewpointId, result: 'pass', reason: 'Panel 4 in place', measuredMm: null }
    ],
    evidence: [],
    result: 'accepted',
    reason: 'Walked the segment; every panel is in place'
  }
  for (const id of [missed.id, reported.body.id]) {
    expect(await as('dev_system_reviewing', 'post', `/candidates/${id}/clearance`, clearance)).toEqual(
      denied('one_way_rule')
    )
  }
  expect((await passOf(api, S1.segmentId, 'dev_manager')).state).toBe('suspended')

  // The reviewer clears the rejected report, but the missed patrol, sent for recapture, still holds the pass.
  const first = await as('dev_reviewer', 'post', `/candidates/${reported.body.id}/clearance`, clearance)
  expect(first).toMatchObject({ status: 201, body: { pass: null } })
  const second = await as('dev_reviewer', 'post', `/candidates/${missed.id}/clearance`, clearance)
  expect(second).toMatchObject({ status: 201, body: { pass: { state: 'valid', issuedBy: 'usr_reviewer' } } })

  const madeValid = (await auditOf(api, 'dev_gm')).filter(
    (e) => (e.after as { state?: string } | null)?.state === 'valid'
  )
  expect(madeValid.map((e) => [e.action, e.subjectId, e.actor])).toEqual([
    ['recordClearance', S1_PASS, { type: 'user', id: 'usr_reviewer', role: 'reviewer' }]
  ])
})
