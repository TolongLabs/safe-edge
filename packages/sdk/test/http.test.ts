// The http transport against the real v1 API (apps/api), started by the API's own test harness on a free port with an
// injectable clock. Bearer tokens `tok_<userId>` map to the seeded users.
import { describe, expect, test } from 'bun:test'
import { actorFor } from '@safe-edge/core'
import type { AuditEvent, EdgeEvent } from '@safe-edge/contracts'
import { startApi as startRealApi, tier2Candidate } from '../../../apps/api/test/support.ts'
import { join } from 'node:path'
import {
  SafeEdgeApiError,
  SafeEdgeDeniedError,
  createElminaPlanner,
  createSafeEdgeClient,
  elminaSeed
} from '../src/index.ts'
import { S1, playS1toS3 } from './story.ts'

const repoRoot = join(import.meta.dir, '../../..')
const tokens = new Map(elminaSeed.users.map((user) => [`tok_${user.id}`, actorFor(user)]))
const startApi = () => startRealApi({ tokens })
let api: ReturnType<typeof startApi>

const httpAs = (userId: string, token = `tok_${userId}`) =>
  createSafeEdgeClient({ transport: 'http', baseUrl: new URL('/v1', api.url).href, token })

describe('http transport: the same typed client against the v1 API', () => {
  test('S1 to S3 over HTTP leaves the same records and audit chain as the memory transport', async () => {
    api = startApi()
    const overHttp = await playS1toS3({ as: (userId) => httpAs(userId), setNow: api.setNow })

    let now = '2026-10-20T00:00:00.000Z'
    const planner = await createElminaPlanner((path) => Bun.file(join(repoRoot, path)).json(), { thirdParties: [] })
    const demo = createSafeEdgeClient({
      transport: 'memory',
      userId: 'usr_manager',
      planner,
      clock: { now: () => now }
    })
    const inMemory = await playS1toS3({ as: (userId) => demo.as(userId), setNow: (iso) => (now = iso) })

    expect(overHttp.retest.pass).toMatchObject({ segmentId: S1.segmentId, state: 'valid', source: 'fixture' })
    expect(overHttp).toEqual(inMemory)
    // In both, the completed repair queued a re-test patrol of S1, since no plan was open.
    expect(await httpAs('usr_manager').listPatrolPlans()).toMatchObject([
      { id: 'plan_1', replan: { trigger: { kind: 'repair_completed', segmentId: S1.segmentId }, supersedes: null } }
    ])
    expect(await httpAs('usr_gm').listAudit()).toEqual(await demo.listAudit())
    expect(await httpAs('usr_manager').listPasses({ query: { state: 'valid' } })).toEqual(
      await demo.listPasses({ query: { state: 'valid' } })
    )
  })

  test("the scheduled pass is the same in both: memory tick(now) does what moving the API's scenario clock does", async () => {
    // 12 Nov: pass _5 expires, _12 starts expiring, and every seeded patrol interval has run out.
    const NOV_12 = '2026-11-12T02:00:00.000Z'
    api = startApi()
    await httpAs('usr_system').setScenarioClock({ body: { now: NOV_12 } })
    const demo = createSafeEdgeClient({ transport: 'memory', userId: 'usr_manager', clock: { now: () => NOV_12 } })
    const events = await demo.tick(NOV_12)

    expect(events.map((e) => [e.type, 'segmentId' in e.data ? e.data.segmentId : null])).toEqual([
      ['edge.pass.expired.v1', 'seg_866518980_5'],
      ['edge.pass.expiring.v1', 'seg_866518980_12'],
      ['edge.candidate.raised.v1', S1.segmentId],
      ['edge.pass.suspended.v1', S1.segmentId],
      ['edge.candidate.raised.v1', 'seg_866518980_12'],
      ['edge.pass.suspended.v1', 'seg_866518980_12']
    ])
    // The same writes by the same system actors, apart from the API's record of its clock moving.
    const writes = (chain: AuditEvent[]) =>
      chain
        .filter((e) => e.action !== 'setScenarioClock')
        .map(({ action, actor, subjectId, at, after }) => ({ action, actor, subjectId, at, after }))
    expect(writes(await demo.listAudit())).toEqual(writes(await httpAs('usr_gm').listAudit()))
    expect(writes(await demo.listAudit())).toHaveLength(6)
  })

  test('every request carries the bearer token, and every write a fresh Idempotency-Key unless the caller gives one', async () => {
    api = startApi()
    await playS1toS3({ as: (userId) => httpAs(userId), setNow: api.setNow })
    const manager = httpAs('usr_manager')
    await manager.draftNotice(
      { body: { kind: 'escalation', subjectId: S1.segmentId, title: 'Overdue repair', body: 'Draft' } },
      { idempotencyKey: 'retry-me-1' }
    )
    await manager.listFindings()

    const writes = api.log.filter((r) => r.method !== 'GET')
    const reads = api.log.filter((r) => r.method === 'GET')
    expect(writes.length).toBe(16)
    expect(reads.length).toBe(1)
    expect(api.log.every((r) => /^tok_usr_\w+$/.test(r.token ?? ''))).toBe(true)
    expect(reads[0]!.idempotencyKey).toBeNull()
    expect(writes.at(-1)!.idempotencyKey).toBe('retry-me-1')
    const generated = writes.slice(0, -1).map((r) => r.idempotencyKey)
    expect(generated.every((key) => typeof key === 'string' && key.length >= 16)).toBe(true)
    expect(new Set(generated).size).toBe(generated.length)
  })

  test('streamEvents reads GET /v1/events: it resolves once subscribed, then yields each CloudEvent core emits', async () => {
    api = startApi()
    await expect(httpAs('usr_gm', 'tok_nobody').streamEvents()).rejects.toMatchObject({ status: 401 })
    const events = await httpAs('usr_gm').streamEvents()
    const candidate = await httpAs('usr_drone_sim').raiseCandidate({ body: tier2Candidate })

    const seen: EdgeEvent[] = []
    for await (const event of events) {
      seen.push(event)
      if (seen.length === 2) break
    }
    expect(seen.map((e) => [e.type, e.data])).toEqual([
      ['edge.candidate.raised.v1', { candidateId: candidate.id, segmentId: S1.segmentId, tier: 2, simulated: true }],
      [
        'edge.pass.suspended.v1',
        { passId: 'pass_866518980_11', segmentId: S1.segmentId, candidateId: candidate.id, simulated: true }
      ]
    ])
  })

  test('a 403 surfaces as a typed error naming the rule; 401 and 404 as typed API errors', async () => {
    api = startApi()
    const { workOrderId } = await playS1toS3({ as: (userId) => httpAs(userId), setNow: api.setNow })

    const agentSubmit = httpAs('usr_agent').submitWorkOrder({
      params: { id: workOrderId },
      body: { installerUserId: 'usr_installer', dueAt: '2026-10-24T09:00:00.000Z' }
    })
    await expect(agentSubmit).rejects.toBeInstanceOf(SafeEdgeDeniedError)
    await expect(agentSubmit).rejects.toMatchObject({ status: 403, rule: 'agents_draft_only' })
    const audit = await httpAs('usr_manager').listAudit()
    expect(audit.at(-1)).toMatchObject({ action: 'submitWorkOrder', decision: 'denied', rule: 'agents_draft_only' })

    const stranger = httpAs('usr_manager', 'tok_nobody').listSegments()
    await expect(stranger).rejects.toBeInstanceOf(SafeEdgeApiError)
    await expect(stranger).rejects.toMatchObject({ status: 401, error: 'unauthenticated' })
    await expect(httpAs('usr_manager').getFinding({ params: { id: 'fnd_404' } })).rejects.toMatchObject({
      status: 404,
      error: 'not_found'
    })
  })
})
