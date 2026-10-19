// The API's state outlives its process (TRD "Pilot target"): core's records and audit chain, idempotency keys,
// webhooks with their secrets, and evidence. The API runs as its own process here and is killed with SIGKILL, as a
// crash would, then started again on the same data directory.
import { afterAll, expect, test } from 'bun:test'
import {
  AuditEvent,
  Candidate,
  CandidateDecision,
  EdgeEvent,
  EdgePass,
  EvidenceRef,
  EvidenceUrl,
  Observation,
  Opening,
  RegisteredWebhook,
  Remedy,
  RetestOutcome,
  Task,
  Webhook,
  WorkOrder
} from '@safe-edge/contracts'
import { verifyAuditChain } from '@safe-edge/core'
import { Database } from 'bun:sqlite'
import { chmod, mkdtemp, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Webhook as StandardWebhook } from 'standardwebhooks'
import { createApp } from '../src/app.ts'
import { scenarioClock, type ApiClock } from '../src/clock.ts'
import { JournalWriteError } from '../src/journal.ts'
import { devTokens } from '../src/tokens.ts'
import { eventually } from '../../../test/spawn.ts'
import { startApiProcess } from './process.ts'
import { S1, seed, tier2Candidate } from './support.ts'

const dataDir = await mkdtemp(join(tmpdir(), 'safe-edge-api-'))
afterAll(() => rm(dataDir, { recursive: true }))

// FF D8 FF E0 followed by "safe-edge", as in evidence.test.ts.
const PHOTO_BASE64 = '/9j/4HNhZmUtZWRnZQ=='
const PASS_ID = `pass_${S1.segmentId.slice('seg_'.length)}`

type ApiProcess = Awaited<ReturnType<typeof startApiProcess>>

/** The parsed body of a 2xx answer; anything else fails with the status and body. */
async function call<T>(
  api: ApiProcess,
  schema: { parse(value: unknown): T },
  ...[method, path, token, body, headers]: Parameters<ApiProcess['request']>
): Promise<T> {
  const response = await api.request(method, path, token, body, headers)
  if (!response.ok) throw new Error(`${method} ${path}: HTTP ${response.status}: ${await response.text()}`)
  return schema.parse(await response.json())
}

const audit = (api: ApiProcess) => call(api, AuditEvent.array(), 'get', '/audit', 'tok_gm')
const passState = async (api: ApiProcess) => (await call(api, EdgePass, 'get', `/passes/${PASS_ID}`, 'tok_gm')).state
const webhooks = (api: ApiProcess) => call(api, Webhook.array(), 'get', '/webhooks', 'tok_integrator')

test('S1 suspends the pass, the API is killed, and the restarted API carries S1 to a valid pass on the same audit chain', async () => {
  const deliveries: { headers: Record<string, string>; body: string }[] = []
  const receiver = Bun.serve({
    port: 0,
    async fetch(request) {
      deliveries.push({ headers: Object.fromEntries(request.headers), body: await request.text() })
      return new Response(null, { status: 204 })
    }
  })
  afterAll(() => receiver.stop(true))
  const delivered = (secret: string, type: EdgeEvent['type']) =>
    eventually(`A signed ${type} delivery`, () =>
      deliveries
        .map(({ headers, body }) => EdgeEvent.parse(new StandardWebhook(secret).verify(body, headers)))
        .find((event) => event.type === type)
    )
  const env = { NODE_ENV: 'test', SAFE_EDGE_DATA_DIR: dataDir }

  // Before the crash: an integrator's webhook, the crew's photo, and the drone's Tier 2 report, which suspends S1.
  const first = await startApiProcess(env)
  const hook = await call(first, RegisteredWebhook, 'post', '/webhooks', 'tok_integrator', {
    url: receiver.url.href,
    eventTypes: ['edge.pass.suspended.v1', 'edge.pass.issued.v1']
  })
  const capturedAt = '2026-10-20T08:00:00.000Z'
  const photo = await call(first, EvidenceRef, 'post', '/evidence', 'tok_crew', {
    mediaType: 'image/jpeg',
    dataBase64: PHOTO_BASE64,
    capturedAt,
    simulated: true
  })
  const viewpoint = seed.segments.find((s) => s.id === S1.segmentId)!.viewpoints.find((v) => v.id === S1.viewpointId)!
  const observation = await call(first, Observation, 'post', '/observations', 'tok_crew', {
    patrolId: null,
    segmentId: S1.segmentId,
    viewpointId: S1.viewpointId,
    captureSource: 'phone',
    image: photo,
    pose: viewpoint.pose,
    capturedAt,
    quality: { sharpness: 0.9, alignmentResidualPx: 2, occlusion: 0 },
    privacyAction: 'none',
    simulated: true
  })
  const report = { ...tier2Candidate, observationIds: [observation.id] }
  const key = { 'idempotency-key': 'drone-report-s1-panel-4' }
  const raised = await first.request('post', '/candidates', 'tok_provider', report, key)
  expect(raised.status).toBe(201)
  const candidate = Candidate.parse(await raised.json())
  expect(await passState(first)).toBe('suspended')
  expect((await delivered(hook.secret, 'edge.pass.suspended.v1')).data).toMatchObject({ candidateId: candidate.id })
  const chainBefore = await audit(first)
  const webhooksBefore = await webhooks(first)

  await first.crash()
  const api = await startApiProcess(env)

  // The same records, the same chain, the same webhooks; nothing is lost and nothing is added by starting.
  expect(await audit(api)).toEqual(chainBefore)
  expect(await webhooks(api)).toEqual(webhooksBefore)
  expect(await passState(api)).toBe('suspended')
  // The drone's retry of its report replays the stored answer instead of raising a second candidate.
  const replayed = await api.request('post', '/candidates', 'tok_provider', report, key)
  expect(replayed.status).toBe(201)
  expect(await replayed.json()).toEqual(candidate)
  expect(await audit(api)).toHaveLength(chainBefore.length)
  // The photo's bytes are still served, through a freshly signed link.
  const link = await call(api, EvidenceUrl, 'get', `/evidence/${photo.id}/url`, 'tok_manager')
  const bytes = new Uint8Array(await (await fetch(link.url)).arrayBuffer())
  expect(Buffer.from(bytes).toString('base64')).toBe(PHOTO_BASE64)

  // After the restart: the manager confirms, the remedy is approved and submitted, the installer repairs, and a
  // reviewer accepts the re-test, which makes the pass valid again.
  const { finding, workOrder, tasks } = await call(
    api,
    CandidateDecision,
    'post',
    `/candidates/${candidate.id}/decision`,
    'tok_manager',
    { decision: 'confirm', severity: 'high' }
  )
  await call(api, Task, 'post', `/tasks/${tasks[0]!.id}/complete`, 'tok_crew')
  const gap = await call(api, Opening, 'post', '/openings', 'tok_manager', {
    segmentId: S1.segmentId,
    type: 'fence_gap',
    photoMarks: [{ evidenceId: photo.id, x: 0.45, y: 0.6 }],
    measuredMm: 1200
  })
  const remedy = await call(api, Remedy, 'post', '/remedies', 'tok_engineer', {
    segmentId: S1.segmentId,
    type: 'panel_replacement',
    label: 'Replace panel 4',
    blocksOpeningIds: [gap.id],
    quantities: [{ item: 'Fence panel 2.4 m', amount: 1, unit: 'panel' }],
    acceptanceTest: 'No gap over 100 mm along the run',
    quote: 'quote_needed'
  })
  await call(api, Remedy, 'post', `/remedies/${remedy.id}/approve`, 'tok_engineer')
  const id = workOrder!.id
  await call(api, WorkOrder, 'patch', `/work-orders/${id}`, 'tok_manager', { remedyId: remedy.id })
  await call(api, WorkOrder, 'post', `/work-orders/${id}/submit`, 'tok_manager', {
    installerUserId: 'usr_installer',
    dueAt: '2026-10-24T09:00:00.000Z'
  })
  await call(api, WorkOrder, 'post', `/work-orders/${id}/start`, 'tok_installer')
  await call(api, WorkOrder, 'post', `/work-orders/${id}/complete`, 'tok_installer', {
    evidence: [],
    note: 'Panel 4 replaced'
  })
  const { pass } = await call(api, RetestOutcome, 'post', '/retests', 'tok_reviewer', {
    workOrderId: id,
    checklist: [{ kind: 'saved_view', subjectId: S1.viewpointId, result: 'pass', reason: 'Panel 4', measuredMm: null }],
    evidence: [],
    result: 'accepted',
    reason: 'Gap closed'
  })
  expect(pass).toMatchObject({ id: PASS_ID, state: 'valid' })
  expect(finding).not.toBeNull()

  // The webhook registered before the crash still delivers, signed with the secret it was given then.
  expect((await delivered(hook.secret, 'edge.pass.issued.v1')).data).toMatchObject({ passId: PASS_ID })
  // One chain across both processes: it starts with every event from before the crash, and it verifies.
  const chain = await audit(api)
  expect(chain.slice(0, chainBefore.length)).toEqual(chainBefore)
  expect(chain.length).toBeGreaterThan(chainBefore.length)
  expect(verifyAuditChain(chain)).toEqual({ ok: true, length: chain.length, head: chain.at(-1)!.hash })
}, 60_000)

test('a journal that no longer replays to what it recorded stops the start, naming the entry', async () => {
  const tampered = await mkdtemp(join(tmpdir(), 'safe-edge-api-'))
  afterAll(() => rm(tampered, { recursive: true }))
  const env = { NODE_ENV: 'test', SAFE_EDGE_DATA_DIR: tampered }
  const api = await startApiProcess(env)
  expect((await api.request('post', '/candidates', 'tok_provider', tier2Candidate)).status).toBe(201)
  await api.crash()

  // Someone rewrites when the drone's report was raised: the replayed records, and so the chain, would differ.
  const db = new Database(join(tampered, 'api.sqlite'))
  const { seq } = db.query<{ seq: number }, []>("select seq from journal where kind = 'dispatch'").get()!
  db.run('update journal set clock = \'["2026-01-01T00:00:00.000Z","2026-01-01T00:00:00.000Z"]\' where seq = ?', [seq])
  db.close()
  await expect(startApiProcess(env)).rejects.toThrow(`Journal entry ${seq} (dispatch) replays differently than it ran`)
}, 30_000)

test("a dev API on the scenario clock starts again at the scenario's time, not the seed's", async () => {
  const dir = await mkdtemp(join(tmpdir(), 'safe-edge-api-'))
  afterAll(() => rm(dir, { recursive: true }))
  const env = { NODE_ENV: 'test', SAFE_EDGE_CLOCK: 'scenario', SAFE_EDGE_DATA_DIR: dir }
  const scenarioTime = '2026-10-21T00:40:00.000Z'
  const first = await startApiProcess(env)
  const set = await first.request('post', '/scenario/clock', 'tok_system', { now: scenarioTime })
  expect(set.status).toBe(200)
  await first.crash()

  const api = await startApiProcess(env)
  const raised = await call(api, Candidate, 'post', '/candidates', 'tok_provider', tier2Candidate)
  expect(raised.raisedAt).toBe(scenarioTime)
}, 30_000)

test("a scenario clock won't start behind a store the wall clock wrote later: its writes would go on the chain before", async () => {
  // #147: bun run dev now starts on the scenario clock, at the seed's date, and may meet a store an earlier run wrote
  // on the wall clock after that date.
  const dir = await mkdtemp(join(tmpdir(), 'safe-edge-api-'))
  afterAll(() => rm(dir, { recursive: true }))
  const store = join(dir, 'in-process.sqlite')
  const tokens = await devTokens(
    { SAFE_EDGE_DEV_TOKENS: JSON.stringify({ tok_provider: 'usr_drone_sim' }) },
    seed.users
  )
  const start = (clock: ApiClock) =>
    createApp({
      seed,
      clock,
      store,
      tokens,
      heartbeatMs: 5_000,
      webhooks: { origins: [], allowLoopback: true, retryDelaysMs: [] },
      idempotencyRetentionMs: 24 * 60 * 60 * 1000,
      every: () => {}
    })
  const wallTime = '2026-10-25T09:00:00.000Z'
  const raised = await start({ now: () => wallTime }).fetch(
    new Request('http://safe-edge.test/v1/candidates', {
      method: 'POST',
      headers: { authorization: 'Bearer tok_provider', 'content-type': 'application/json' },
      body: JSON.stringify(tier2Candidate)
    })
  )
  expect(raised.status).toBe(201)

  expect(() => start(scenarioClock(seed.asOf))).toThrow(
    `${store} holds writes up to ${wallTime}, after the scenario clock's ${seed.asOf}: start with ` +
      'SAFE_EDGE_CLOCK=wall, or move it away to start again from the seed'
  )
  // A scenario clock that has caught up starts on it.
  expect(() => start(scenarioClock(wallTime))).not.toThrow()
})

test("the automation's writes are journaled like a request's: a restart replays them onto the same chain", async () => {
  const dir = await mkdtemp(join(tmpdir(), 'safe-edge-api-'))
  afterAll(() => rm(dir, { recursive: true }))
  const env = { NODE_ENV: 'test', SAFE_EDGE_CLOCK: 'scenario', SAFE_EDGE_DATA_DIR: dir }
  const first = await startApiProcess(env)
  const plan = {
    dockId: 'dock_elmina_roof',
    droneProfileId: 'drn_assumed',
    segmentIds: ['seg_866518980_5'],
    context: [],
    notBefore: seed.asOf,
    altitudeCapM: 60
  }
  expect((await first.request('post', '/patrol-plans', 'tok_manager', plan)).status).toBe(201)
  // Moving the clock runs the scheduled pass (tick, missed patrols), and `_12` starting to expire re-plans the plan.
  expect(
    (await first.request('post', '/scenario/clock', 'tok_system', { now: '2026-11-12T02:00:00.000Z' })).status
  ).toBe(200)
  const written = await audit(first)
  expect(new Set(written.map((e) => e.actor.id))).toEqual(
    new Set(['usr_manager', 'usr_system', 'core.tick', 'core.automation', 'core.replan'])
  )
  await first.crash()

  const api = await startApiProcess(env)
  expect(await audit(api)).toEqual(written)
}, 30_000)

test('a write the journal cannot keep throws out of the app, which takes no more writes, and the entrypoint exits', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'safe-edge-api-'))
  afterAll(() => rm(dir, { recursive: true }))
  // Another connection holds the database, so the API's append to its journal fails.
  const lock = (file: string) => {
    const db = new Database(join(dir, file))
    db.run('begin exclusive')
    return db
  }

  // In process, the app throws the failure to whoever serves it, and refuses every later write: memory holds one the
  // journal lacks.
  const tokens = await devTokens(
    { SAFE_EDGE_DEV_TOKENS: JSON.stringify({ tok_provider: 'usr_drone_sim' }) },
    seed.users
  )
  const app = createApp({
    seed,
    clock: scenarioClock(seed.asOf),
    store: join(dir, 'in-process.sqlite'),
    tokens,
    heartbeatMs: 5_000,
    webhooks: { origins: [], allowLoopback: true, retryDelaysMs: [] },
    idempotencyRetentionMs: 24 * 60 * 60 * 1000
  })
  const raise = () =>
    app.fetch(
      new Request('http://safe-edge.test/v1/candidates', {
        method: 'POST',
        headers: { authorization: 'Bearer tok_provider', 'content-type': 'application/json' },
        body: JSON.stringify(tier2Candidate)
      })
    )
  const held = lock('in-process.sqlite')
  await expect(raise()).rejects.toThrow(JournalWriteError)
  held.run('rollback')
  held.close()
  await expect(raise()).rejects.toThrow(JournalWriteError)

  // Deployed, the entrypoint stops the process rather than serve on without the write.
  const api = await startApiProcess({ NODE_ENV: 'test', SAFE_EDGE_DATA_DIR: dir })
  const deployed = lock('api.sqlite')
  await expect(api.request('post', '/candidates', 'tok_provider', tier2Candidate)).rejects.toThrow()
  const { code, stderr } = await api.exited()
  deployed.run('rollback')
  deployed.close()
  expect(code).toBe(1)
  expect(stderr).toContain('could not journal a dispatch')
}, 30_000)

test("the data directory, which holds webhook secrets and evidence, is the OS user's alone, even one that existed", async () => {
  const dir = await mkdtemp(join(tmpdir(), 'safe-edge-api-'))
  afterAll(() => rm(dir, { recursive: true }))
  await chmod(dir, 0o755)
  await startApiProcess({ NODE_ENV: 'test', SAFE_EDGE_DATA_DIR: dir })
  expect((await stat(dir)).mode & 0o777).toBe(0o700)
}, 30_000)
