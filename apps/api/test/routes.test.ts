// Every operation the HTTP API serves comes from the contracts' operations table, and core's policy guards each one.
import { expect, test } from 'bun:test'
import { AuditEvent, Role, operations, type OperationSpec, type PolicyRule } from '@safe-edge/contracts'
import { verifyAuditChain } from '@safe-edge/core'
import { S1, raiseTier2, startApi, type Token } from './support.ts'

const httpOperations = (Object.entries(operations) as [string, OperationSpec][]).filter(
  ([, op]) => op.handledBy !== 'memory'
)

/** Who the table refuses, and by which rule. */
function refusals(op: OperationSpec): [Token, PolicyRule][] {
  const out: [Token, PolicyRule][] = [
    op.agentScope === null ? ['tok_agent', 'agents_draft_only'] : ['tok_agent_unscoped', 'scope_missing']
  ]
  if (op.roles !== 'any') {
    const allowed = op.roles
    out.push([`tok_${Role.options.find((r) => r !== 'agent' && !allowed.includes(r))!}`, 'role_forbidden'])
  }
  return out
}

/** A person or service the table allows. */
const allowed = (op: OperationSpec): Token =>
  op.roles === 'any' ? 'tok_manager' : `tok_${op.roles.find((r) => r !== 'agent')!}`

test('every operation in the table is served under /v1 and refuses callers the table does not allow, naming the rule', async () => {
  const api = startApi()
  // Generated from the table, so later rows (#79's two-parameter releasePlanHold) are covered without listing them.
  expect(httpOperations.map(([id]) => id)).toContain('releasePlanHold')
  const expectedDenials: { action: string; rule: PolicyRule }[] = []

  for (const [operationId, op] of httpOperations) {
    const path = op.path.replaceAll(/\{\w+\}/g, 'x_1')
    for (const [token, rule] of refusals(op)) {
      const response = await api.request(op.method, path, { token })
      expect({ operationId, token, status: response.status, body: await response.json() }).toEqual({
        operationId,
        token,
        status: 403,
        body: { ok: false, rule, message: expect.any(String) }
      })
      expectedDenials.push({ action: operationId, rule })
    }
  }

  // Every refused attempt over HTTP is on the audit chain, and the chain verifies.
  const audit = await api.request('get', '/audit', { token: 'tok_manager' })
  const chain = AuditEvent.array().parse(await audit.json())
  expect(verifyAuditChain(chain).ok).toBe(true)
  expect(chain.filter((e) => e.decision === 'denied').map(({ action, rule }) => ({ action, rule }))).toEqual(
    expectedDenials
  )
})

test('an allowed caller reaches every operation, and its input is checked against the contract schema', async () => {
  const api = startApi()
  for (const [operationId, op] of httpOperations) {
    const response = await api.request(op.method, op.path.replaceAll(/\{\w+\}/g, 'x_1'), {
      token: allowed(op),
      ...(op.body ? { body: {} } : {})
    })
    if (op.body || op.params) {
      // An empty body or a malformed ID fails the operation's own schema before anything runs.
      expect({ operationId, status: response.status, body: await response.json() }).toEqual({
        operationId,
        status: 400,
        body: { ok: false, error: 'invalid_input', message: expect.any(String) }
      })
    } else if (op.stream) {
      expect({ operationId, status: response.status }).toEqual({ operationId, status: 200 })
      expect(response.headers.get('content-type')).toStartWith('text/event-stream')
      await response.body!.cancel()
    } else {
      expect({ operationId, status: response.status }).toEqual({ operationId, status: op.status })
      op.response.parse(await response.json())
    }
  }
})

test('a transition the state machine refuses is 403 naming the rule, and the refusal is on the audit chain', async () => {
  const api = startApi()
  const candidate = (await (await raiseTier2(api)).json()) as { id: string }
  const confirmed = await api.request('post', `/candidates/${candidate.id}/decision`, {
    token: 'tok_manager',
    body: { decision: 'confirm', severity: 'high' }
  })
  expect(confirmed.status).toBe(200)
  const { workOrder } = (await confirmed.json()) as { workOrder: { id: string } }

  // The draft has no engineer-approved remedy yet.
  const submitted = await api.request('post', `/work-orders/${workOrder.id}/submit`, {
    token: 'tok_manager',
    body: { installerUserId: 'usr_installer', dueAt: '2026-10-24T09:00:00.000Z' }
  })
  expect(submitted.status).toBe(403)
  expect(await submitted.json()).toEqual({ ok: false, rule: 'remedy_not_approved', message: expect.any(String) })
  const audit = AuditEvent.array().parse(await (await api.request('get', '/audit', { token: 'tok_gm' })).json())
  expect(audit.at(-1)).toMatchObject({
    action: 'submitWorkOrder',
    subjectId: workOrder.id,
    decision: 'denied',
    rule: 'remedy_not_approved',
    actor: { id: 'usr_manager' }
  })
})

test('a request without a known API token is 401, and demo-mode tokens are rejected', async () => {
  const api = startApi()
  const cases: [string | undefined, RegExp][] = [
    [undefined, /Authorization: Bearer/],
    ['tok_nobody', /Unknown bearer token/],
    ['demo_usr_manager', /Demo-mode tokens work only in the in-browser demo/]
  ]
  for (const [token, message] of cases) {
    const response = await api.request('get', '/segments', token === undefined ? {} : { token })
    expect(response.status).toBe(401)
    expect(response.headers.get('www-authenticate')).toBe('Bearer')
    expect(await response.json()).toEqual({
      ok: false,
      error: 'unauthenticated',
      message: expect.stringMatching(message)
    })
  }
})

test('triage (#74) and the agent (#75) are reserved: their contract schemas check the body, then 501', async () => {
  const api = startApi()
  const image = { mediaType: 'image/jpeg', dataBase64: '/9j/4AAQ' }
  const reserved: [string, unknown][] = [
    ['/triage/images', { segmentId: S1.segmentId, viewpointId: S1.viewpointId, baseline: image, current: image }],
    ['/agent/ask', { question: 'Which passes expire in the next 30 days?' }]
  ]
  for (const [path, body] of reserved) {
    const response = await api.request('post', path, { token: 'tok_manager', body })
    expect({ path, status: response.status }).toEqual({ path, status: 501 })
    expect(await response.json()).toEqual({ ok: false, error: 'not_implemented', message: expect.any(String) })
  }
})
