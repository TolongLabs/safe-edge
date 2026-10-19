// The http transport against the real v1 API (apps/api), started by the API's own test harness on a free port with an
// injectable clock. Bearer tokens `tok_<userId>` map to the seeded users.
import { describe, expect, test } from 'bun:test'
import { actorFor } from '@safe-edge/core'
import { startApi as startRealApi } from '../../../apps/api/test/support.ts'
import { SafeEdgeApiError, SafeEdgeDeniedError, createSafeEdgeClient, elminaSeed } from '../src/index.ts'
import { S1, playS1toS3 } from './story.ts'

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
    const demo = createSafeEdgeClient({ transport: 'memory', userId: 'usr_manager', clock: { now: () => now } })
    const inMemory = await playS1toS3({ as: (userId) => demo.as(userId), setNow: (iso) => (now = iso) })

    expect(overHttp.retest.pass).toMatchObject({ segmentId: S1.segmentId, state: 'valid', source: 'fixture' })
    expect(overHttp).toEqual(inMemory)
    expect(await httpAs('usr_gm').listAudit()).toEqual(await demo.listAudit())
    expect(await httpAs('usr_manager').listPasses({ query: { state: 'valid' } })).toEqual(
      await demo.listPasses({ query: { state: 'valid' } })
    )
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
