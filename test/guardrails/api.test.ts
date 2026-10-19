// #57: the guardrails, met the way an integrator meets them: the real v1 API on a free port, over HTTP, with the
// committed dev tokens. One test per "Done when" bullet (TRD "Testing" item 2, PRD MCP-3); the MCP side is in
// mcp.test.ts. The same rules at core level: packages/core/test/guardrails.test.ts.
import { afterAll, expect, test } from 'bun:test'
import { Role, type Denial, type OperationId } from '@safe-edge/contracts'
import {
  answer,
  denied,
  devTokenForRole,
  httpOperations,
  json,
  operationFor,
  pathFor,
  patrolRequest,
  playS1toRepair,
  playS1toS3,
  raiseTier2,
  S1,
  s1Check,
  startGuardedApi,
  tier2Candidate
} from './support.ts'

test('the installer cannot accept their own work: 403 role_forbidden, and 403 two_person_rule even with a reviewer token', async () => {
  // A small township where one person installs and reviews: usr_installer also holds a reviewer token.
  const api = startGuardedApi({
    dev_installer_reviewing: { type: 'user', id: 'usr_installer', role: 'reviewer', scopes: [] }
  })
  const { retest, workOrderId } = await playS1toRepair(api.stage)
  const accept = (token: string) => answer(api.request('post', '/retests', { token, body: retest }))

  expect(await accept('dev_installer')).toEqual(denied('role_forbidden'))
  expect(await accept('dev_installer_reviewing')).toEqual(denied('two_person_rule'))
  // Both refusals are on the audit chain, under the one person's two roles.
  expect((await api.audit()).slice(-2)).toMatchObject([
    {
      action: 'recordRetest',
      subjectId: workOrderId,
      actor: { type: 'user', id: 'usr_installer', role: 'installer' },
      decision: 'denied',
      rule: 'role_forbidden'
    },
    {
      action: 'recordRetest',
      actor: { type: 'user', id: 'usr_installer', role: 'reviewer' },
      decision: 'denied',
      rule: 'two_person_rule'
    }
  ])
  expect((await api.pass()).state).toBe('suspended')

  // A different person accepts the very same re-test, and only then is the pass valid again.
  expect((await accept('dev_reviewer')).status).toBe(201)
  expect(await api.pass()).toMatchObject({ state: 'valid', issuedBy: 'usr_reviewer' })
})

test('an agent token cannot confirm, accept, issue or send: every operation the table keeps for people is 403 agents_draft_only', async () => {
  const api = startGuardedApi()
  const played = await playS1toRepair(api.stage)
  const asAgent = (method: string, path: string, body?: unknown) =>
    api.request(method, path, { token: 'dev_agent', body })

  // What the agent may do leaves records only a person can act on: a proposed candidate, a notice draft, a plan.
  const proposed = await json(
    asAgent('post', '/candidates', {
      ...tier2Candidate,
      inventoryItemId: null,
      itemStatus: null,
      class: 'worn_path',
      rationale: 'A worn path leads from the playground to the bank'
    })
  )
  const notice = await json(
    asAgent('post', '/notices', {
      kind: 'escalation',
      subjectId: played.decision.finding!.id,
      title: 'Repair awaiting re-test',
      body: 'Draft for the general manager'
    })
  )
  const plan = await json(asAgent('post', '/patrol-plans', patrolRequest))
  // And a patrol in flight, so completing one is a real request too.
  const flying = await json(api.request('post', '/patrol-plans', { token: 'dev_manager', body: patrolRequest }))
  await json(api.request('post', `/patrol-plans/${flying.id}/approve`, { token: 'dev_pilot' }))
  const patrol = await json(
    api.request('post', '/patrols', {
      token: 'dev_pilot',
      body: { planId: flying.id, provider: 'sim', droneId: 'drn_assumed' }
    })
  )
  const ids = {
    candidates: proposed.id,
    notices: notice.id,
    'patrol-plans': plan.id,
    patrols: patrol.id,
    'work-orders': played.workOrderId,
    remedies: played.remedy.id,
    tasks: played.decision.tasks[0]!.id
  }
  // The four named actions send exactly what a person sends. Policy runs before validation, so for the rest an empty
  // body changes nothing about the answer.
  const asAPersonWould: Partial<Record<OperationId, unknown>> = {
    decideCandidate: { decision: 'confirm', severity: 'low' }, // confirm
    recordRetest: played.retest, // accept, which issues the pass
    submitWorkOrder: { installerUserId: 'usr_installer', dueAt: '2026-10-30T00:00:00.000Z' } // issue the work order
    // sendNotice (send) takes no body
  }

  // Enumerated from the operations table: every row with no agent scope.
  const keptForPeople = httpOperations.filter(([, op]) => op.agentScope === null)
  expect(keptForPeople.map(([id]) => id)).toEqual(
    expect.arrayContaining(['decideCandidate', 'recordRetest', 'submitWorkOrder', 'sendNotice', 'approveRemedy'])
  )
  const before = (await api.audit()).length
  for (const [operationId, op] of keptForPeople) {
    const body = op.body ? (asAPersonWould[operationId] ?? {}) : undefined
    const response = await answer(asAgent(op.method, pathFor(op, ids), body))
    expect({ operationId, ...response }).toEqual({ operationId, ...denied('agents_draft_only') })
  }

  // Every refusal is on the audit chain, under the agent's own identity.
  expect((await api.audit()).slice(before).map((e) => [e.action, e.actor, e.decision, e.rule])).toEqual(
    keptForPeople.map(([id]) => [id, { type: 'agent', id: 'usr_agent', role: 'agent' }, 'denied', 'agents_draft_only'])
  )
  // Nothing moved.
  const read = (path: string) => json(api.request('get', path, { token: 'dev_manager' }))
  expect((await read(`/candidates/${proposed.id}`)).candidate.status).toBe('candidate')
  expect((await read(`/work-orders/${played.workOrderId}`)).status).toBe('completed')
  expect((await read('/notices')).map((n: { status: string }) => n.status)).toEqual(['draft'])
  expect((await read('/patrol-plans')).map((p: { status: string }) => p.status)).toEqual(['proposed', 'approved'])
  expect((await api.pass()).state).toBe('suspended')

  // The same requests from the right people go through: only the agent's identity refused them.
  const statusFor = (token: string, method: string, path: string, body?: unknown) =>
    api.request(method, path, { token, body }).then((response) => response.status)
  const decision = asAPersonWould.decideCandidate
  expect(await statusFor('dev_manager', 'post', `/candidates/${proposed.id}/decision`, decision)).toBe(200)
  expect(await statusFor('dev_reviewer', 'post', '/retests', played.retest)).toBe(201)
  expect(await statusFor('dev_manager', 'post', `/notices/${notice.id}/send`)).toBe(200)
  expect((await api.pass()).state).toBe('valid')
})

test('a Tier 2 candidate suspends the pass in the same request', async () => {
  const api = startGuardedApi()
  expect((await api.pass()).state).toBe('valid')
  const before = (await api.audit()).length

  // The drone reports fence panel 4 missing: a safety-critical item, so core makes it Tier 2.
  const raised = await answer(raiseTier2(api, 'dev_drone_sim'))
  expect(raised).toMatchObject({ status: 201, body: { tier: 2, status: 'candidate' } })
  const candidateId: string = raised.body.id
  expect(await api.pass()).toMatchObject({ state: 'suspended', stateReason: expect.stringContaining(candidateId) })

  // One request, one transaction: the candidate and the suspension are the two writes of that one call.
  const writes = (await api.audit()).slice(before)
  expect(writes.map((e) => [e.action, e.actor.id, e.subjectId, e.at])).toEqual([
    ['raiseCandidate', 'usr_drone_sim', candidateId, writes[0]!.at],
    ['raiseCandidate', 'usr_drone_sim', 'pass_866518980_11', writes[0]!.at]
  ])
  expect(writes[1]).toMatchObject({ before: { state: 'valid' }, after: { state: 'suspended' } })
  expect(api.log.filter((r) => r.method !== 'GET').length).toBe(1)
})

// Over HTTP, automation reaches core only through these rows. Core's own time path, tick(), only expires passes
// (packages/core/test/tick.test.ts), and the API exposes no tick.
test('no system or provider call makes a pass valid, whichever operation it tries', async () => {
  const api = startGuardedApi({
    // Automation tokens mis-issued with the reviewer role: the one-way rule still holds.
    dev_system_reviewing: { type: 'system', id: 'usr_system', role: 'reviewer', scopes: [] },
    dev_drone_sim_reviewing: { type: 'provider', id: 'usr_drone_sim', role: 'reviewer', scopes: [] }
  })
  // S1 repaired and awaiting its re-test: the pass is suspended and an accepting re-test is one request away.
  const played = await playS1toRepair(api.stage)
  const flying = await json(api.request('post', '/patrol-plans', { token: 'dev_manager', body: patrolRequest }))
  await json(api.request('post', `/patrol-plans/${flying.id}/approve`, { token: 'dev_pilot' }))
  const patrol = await json(
    api.request('post', '/patrols', {
      token: 'dev_pilot',
      body: { planId: flying.id, provider: 'sim', droneId: 'drn_assumed' }
    })
  )
  const notice = await json(
    api.request('post', '/notices', {
      token: 'dev_manager',
      body: { kind: 'escalation', subjectId: S1.segmentId, title: 'Re-test due', body: 'Draft' }
    })
  )
  const validBefore = await json(api.request('get', '/passes?state=valid', { token: 'dev_manager' }))

  const observation = {
    patrolId: patrol.id,
    segmentId: S1.segmentId,
    viewpointId: S1.viewpointId,
    captureSource: 'drone',
    image: null,
    pose: { lon: 101.51341, lat: 3.178948, altM: 9, headingDeg: -30.9, pitchDeg: -36.9 },
    capturedAt: '2026-10-22T05:30:00.000Z',
    quality: { sharpness: 0.92, alignmentResidualPx: 1.4, occlusion: 0.05 },
    privacyAction: 'none',
    simulated: true
  }
  // An observation is checked once, so each automation token checks its own: S1's frame, and one more.
  const toCheck: Record<string, string> = {
    dev_system: played.candidate.observationIds[0]!,
    dev_drone_sim: (await json(api.request('post', '/observations', { token: 'dev_drone_sim', body: observation }))).id
  }

  // What each automation role sends where the table lets it act. A row the table opens to them later has no
  // request here, and the test fails until it gets one.
  const requests = (token: string): Partial<Record<OperationId, unknown>> => ({
    createPatrolPlan: patrolRequest,
    raiseCandidate: tier2Candidate,
    recordObservation: observation,
    recordInventoryCheck: s1Check(toCheck[token]!),
    completePatrol: { coverage: [{ segmentId: S1.segmentId, inspectedM: 198.31, unknownM: 0 }] },
    uploadEvidence: { mediaType: 'image/jpeg', dataBase64: '/9j/4AAQ', capturedAt: null, simulated: true },
    previewRouteClosure: { remedyIds: [played.remedy.id] },
    setWorkOrderExternalRef: { externalRef: 'procore-observation-1' }
  })
  const ids = {
    'patrol-plans': flying.id,
    patrols: patrol.id,
    candidates: played.candidate.id,
    'work-orders': played.workOrderId,
    remedies: played.remedy.id,
    tasks: played.decision.tasks[0]!.id,
    notices: notice.id,
    segments: S1.segmentId
  }
  const writes = httpOperations.filter(([, op]) => op.method !== 'get')
  for (const token of ['dev_system', 'dev_drone_sim']) {
    const { role } = api.actorOf(token)
    const sent = requests(token)
    for (const [operationId, op] of writes) {
      const allowed = op.roles === 'any' || op.roles.includes(role)
      if (!allowed) {
        const refused = await answer(api.request(op.method, pathFor(op, ids), { token, body: {} }))
        expect({ token, operationId, ...refused }).toEqual({ token, operationId, ...denied('role_forbidden') })
        continue
      }
      if (!(operationId in sent)) throw new Error(`No ${role} request for ${operationId}`)
      const response = await api.request(op.method, pathFor(op, ids), { token, body: sent[operationId] })
      expect({ token, operationId, ok: response.ok }).toEqual({ token, operationId, ok: true })
    }
  }
  // Accepting the re-test is the only way to valid, and it needs a person: a reviewer role on automation is not enough.
  for (const token of ['dev_system_reviewing', 'dev_drone_sim_reviewing']) {
    const refused = await answer(api.request('post', '/retests', { token, body: played.retest }))
    expect({ token, ...refused }).toEqual({ token, ...denied('one_way_rule') })
  }

  expect((await api.pass()).state).toBe('suspended')
  expect(await json(api.request('get', '/passes?state=valid', { token: 'dev_manager' }))).toEqual(validBefore)
  // A person who reviews makes it valid, and that is the only write to a valid pass on the whole chain.
  const accepted = await answer(api.request('post', '/retests', { token: 'dev_reviewer', body: played.retest }))
  expect(accepted.status).toBe(201)
  const madeValid = (await api.audit()).filter(
    (e) => e.subjectId.startsWith('pass_') && (e.after as { state?: string } | null)?.state === 'valid'
  )
  expect(madeValid.map((e) => [e.subjectId, e.actor])).toEqual([
    ['pass_866518980_11', { type: 'user', id: 'usr_reviewer', role: 'reviewer' }]
  ])
})

test('every write, refused or allowed, is on the audit chain, and GET /v1/audit verifies when re-hashed independently', async () => {
  const receiver = Bun.serve({ port: 0, fetch: () => new Response(null, { status: 204 }) })
  afterAll(() => receiver.stop(true))
  const api = startGuardedApi()
  const as = (token: string, method: string, path: string, body?: unknown) =>
    json(api.request(method, path, { token, body }))

  // A working day over HTTP: S1 to S3 through the SDK story, then every other write the API serves.
  const played = await playS1toS3(api.stage)
  const findingId = played.decision.finding!.id
  const draft = await as('dev_agent', 'post', '/work-orders', { findingId, remedyId: null, notes: 'Agent draft' })
  await as('dev_agent', 'patch', `/work-orders/${draft.id}`, { notes: 'Revised agent draft' })
  const notice = await as('dev_agent', 'post', '/notices', {
    kind: 'escalation',
    subjectId: findingId,
    title: 'Fence repaired',
    body: 'Draft'
  })
  await as('dev_manager', 'post', `/notices/${notice.id}/send`)
  await as('dev_system', 'post', `/work-orders/${draft.id}/external-ref`, { externalRef: 'procore-observation-1' })
  const plan = await as('dev_manager', 'post', '/patrol-plans', patrolRequest)
  await as('dev_pilot', 'post', `/patrol-plans/${plan.id}/approve`)
  const patrol = await as('dev_pilot', 'post', '/patrols', { planId: plan.id, provider: 'sim', droneId: 'drn_assumed' })
  await as('dev_drone_sim', 'post', `/patrols/${patrol.id}/complete`, {
    coverage: [{ segmentId: S1.segmentId, inspectedM: 198.31, unknownM: 0 }]
  })
  await as('dev_drone_sim', 'post', '/evidence', {
    mediaType: 'image/jpeg',
    dataBase64: '/9j/4AAQ',
    capturedAt: '2026-10-23T01:00:00.000Z',
    simulated: true
  })
  await as('dev_integrator', 'post', '/webhooks', {
    url: new URL('/hooks', receiver.url).href,
    eventTypes: ['edge.pass.issued.v1']
  })
  await as('dev_manager', 'post', `/segments/${S1.segmentId}/route-closure`, { remedyIds: [played.remedy.id] })
  await as('dev_drone_sim', 'post', '/inventory-checks', s1Check(played.candidate.observationIds[0]!))

  // And one refused attempt at every write: the agent at a people-only row, otherwise a role the row leaves out.
  const ids = {
    candidates: played.candidate.id,
    'work-orders': played.workOrderId,
    remedies: played.remedy.id,
    notices: notice.id,
    tasks: played.decision.tasks[0]!.id,
    'patrol-plans': plan.id,
    patrols: patrol.id,
    segments: S1.segmentId
  }
  const writes = httpOperations.filter(([, op]) => op.method !== 'get')
  for (const [, op] of writes) {
    if (op.roles === 'any') continue // read-only POSTs (route closure) refuse no dev token
    const token =
      op.agentScope === null
        ? 'dev_agent'
        : devTokenForRole(Role.options.find((r) => r !== 'agent' && !op.roles.includes(r))!)
    expect((await api.request(op.method, pathFor(op, ids), { token, body: {} })).status).toBe(403)
  }

  const chain = await api.audit()
  const exchanges = api.log.map((r) => ({
    ...r,
    operationId: operationFor(r.method, r.path),
    actor: r.token === null ? null : api.actorOf(r.token)
  }))

  // Every refusal, read or write, is on the chain in the order the API answered it, naming the rule.
  expect(chain.filter((e) => e.decision === 'denied').map((e) => `${e.action} ${e.actor.id} ${e.rule}`)).toEqual(
    exchanges.filter((r) => r.status === 403).map((r) => `${r.operationId} ${r.actor!.id} ${(r.body as Denial).rule}`)
  )
  // Every allowed write is on the chain with the record it answered with. The route-closure preview is the one POST
  // that changes nothing, so it has nothing to audit.
  const allowed = exchanges.filter((r) => r.method !== 'GET' && r.status < 300)
  const audited = (r: (typeof allowed)[number]) => {
    const record = answeredRecord(r.body)
    return chain.some(
      (e) =>
        e.decision === 'allowed' &&
        e.action === r.operationId &&
        e.actor.id === r.actor!.id &&
        e.subjectId === record.id &&
        Bun.deepEquals(e.after, record)
    )
  }
  expect(
    allowed.filter((r) => r.operationId !== 'previewRouteClosure' && !audited(r)).map((r) => r.operationId)
  ).toEqual([])
  expect(chain.filter((e) => e.action === 'previewRouteClosure')).toEqual([])
  // Every write the API serves today was exercised.
  const notReachable = {
    releasePlanHold: 'needs a separation hold, which the API planner never makes: it sees no third parties (#79)',
    triageImages: 'answers 501 until #74',
    // The agent's flows need Claude (apps/api/test/agent.test.ts replays recorded runs). They write only through
    // the agent's own createWorkOrder and draftNotice calls, made with its token like the ones above.
    askAgent: 'needs Claude',
    draftInbox: 'needs Claude',
    draftMonthlyReport: 'needs Claude'
  }
  expect(new Set(allowed.map((r) => r.operationId))).toEqual(
    new Set(writes.map(([id]) => id).filter((id) => !(id in notReachable)))
  )

  // An integrator re-hashes the chain from the contract alone, and catches an edited or a missing event.
  const raw: Record<string, unknown>[] = await as('dev_manager', 'get', '/audit')
  expect(raw.length).toBe(chain.length)
  expect(brokenLinks(raw)).toEqual([])
  const firstRefusal = chain.findIndex((e) => e.decision === 'denied')
  expect(brokenLinks(raw.with(firstRefusal, { ...raw[firstRefusal], rule: null }))).toEqual([firstRefusal])
  expect(brokenLinks(raw.toSpliced(firstRefusal, 1))).toEqual([firstRefusal])
})

// Paths around the guardrails, found while writing this suite. Each failed before its fix.

test('an Idempotency-Key replay stays with its token: a narrower token of the same agent is refused, not replayed', async () => {
  const api = startGuardedApi({
    dev_agent_read_only: { type: 'agent', id: 'usr_agent', role: 'agent', scopes: ['edge.read'] }
  })
  const propose = (token: string) =>
    answer(
      api.request('post', '/candidates', {
        token,
        body: { ...tier2Candidate, rationale: 'Fence panel 4 looks missing in the latest frame' },
        headers: { 'idempotency-key': 'propose-panel-4' }
      })
    )

  const first = await propose('dev_agent')
  expect(first.status).toBe(201)
  expect(await propose('dev_agent_read_only')).toEqual(denied('scope_missing'))
  expect((await api.audit()).at(-1)).toMatchObject({
    action: 'raiseCandidate',
    actor: { type: 'agent', id: 'usr_agent' },
    decision: 'denied',
    rule: 'scope_missing'
  })
  // The token that made the request still gets its answer replayed.
  expect(await propose('dev_agent')).toEqual(first)
})

/** A write's main record: the body itself, or its first record (decideCandidate's candidate, recordRetest's re-test). */
function answeredRecord(body: unknown): { id: string } {
  const isRecord = (value: unknown): value is { id: string } =>
    typeof value === 'object' && value !== null && typeof (value as { id?: unknown }).id === 'string'
  const record = isRecord(body) ? body : Object.values(body as object).find(isRecord)
  if (record === undefined) throw new Error(`No record in ${JSON.stringify(body)}`)
  return record
}

/**
 * The chain check an integrator writes from the contract (`AuditEvent` in packages/contracts/generated/openapi.yaml),
 * sharing no code with core: each event's prevHash is the previous event's hash (64 zeros for the first), and its hash
 * is the hex SHA-256 of prevHash followed by the event's canonical JSON without `hash`. Returns the broken indexes.
 */
function brokenLinks(chain: Record<string, unknown>[]): number[] {
  const broken: number[] = []
  let prevHash = '0'.repeat(64)
  for (const [index, { hash, ...event }] of chain.entries()) {
    const expected = new Bun.CryptoHasher('sha256').update(prevHash + canonicalJson(event)).digest('hex')
    if (event.prevHash !== prevHash || hash !== expected) broken.push(index)
    prevHash = hash as string
  }
  return broken
}

/** Canonical JSON: object keys sorted, no whitespace, every value as JSON writes it. */
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (typeof value !== 'object' || value === null) return JSON.stringify(value)
  const record = value as Record<string, unknown>
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(',')}}`
}
