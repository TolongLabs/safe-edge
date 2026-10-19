// Every operation the HTTP API serves comes from the contracts' operations table, and core's policy guards each one.
import { expect, test } from 'bun:test'
import { AuditEvent, Role, operations, type OperationSpec, type PolicyRule } from '@safe-edge/contracts'
import { verifyAuditChain } from '@safe-edge/core'
import { startApi, type Token } from './support.ts'

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
  const expectedDenials: { action: string; rule: PolicyRule }[] = []

  for (const [operationId, op] of httpOperations) {
    const path = op.path.replace('{id}', 'x_1')
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
    const response = await api.request(op.method, op.path.replace('{id}', 'x_1'), {
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
