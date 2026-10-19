// #128: what the Inbox and Ask panel (#80) get from the agent layer, over HTTP against the real API, without Claude.
// The agent's own runs are in agent.test.ts.
import { expect, test } from 'bun:test'
import { CandidateDecision, WorkOrder } from '@safe-edge/contracts'
import { playS1toRepair } from '../../../packages/sdk/test/story.ts'
import { auditLength, httpPlayer } from './s6.ts'
import { S1, raiseTier2, seed, startApi } from './support.ts'

test("the agent's Inbox summary is stored on the candidate as an AI suggestion, and only an agent's token writes one", async () => {
  const api = startApi()
  const manager = httpPlayer(api).clientFor('usr_manager')
  const candidate = (await (await raiseTier2(api)).json()) as { id: string }
  const path = `/candidates/${candidate.id}/agent-summary`
  const summary = {
    text: `Fence panel 4 is missing on ${S1.segmentId}, a Tier 2 change (${candidate.id}).`,
    citations: [S1.segmentId, candidate.id],
    model: 'claude-opus-5-5'
  }

  // A person cannot pass their words off as the agent's.
  const forged = await api.request('post', path, { token: 'tok_manager', body: summary })
  expect({ status: forged.status, body: await forged.json() }).toMatchObject({
    status: 403,
    body: { rule: 'role_forbidden' }
  })
  const stored = await api.request('post', path, { token: 'tok_agent', body: summary })
  expect(stored.status).toBe(200)

  // The card reads it with the candidate, labelled, with the model and the evidence IDs.
  const { candidate: card } = await manager.getCandidate({ params: { id: candidate.id } })
  expect(card.agentSummary).toEqual({
    label: 'ai_suggestion',
    ...summary,
    draftedBy: { type: 'agent', id: 'usr_agent' },
    draftedAt: seed.asOf
  })
  expect((await manager.listAudit({})).at(-1)).toMatchObject({
    action: 'recordAgentSummary',
    subjectId: candidate.id,
    actor: { type: 'agent', id: 'usr_agent' },
    decision: 'allowed',
    after: { agentSummary: card.agentSummary }
  })
})

test('asked for a second draft, POST /work-orders gives back the draft confirming made: one open work order per finding', async () => {
  const api = startApi()
  const manager = httpPlayer(api).clientFor('usr_manager')
  const candidate = (await (await raiseTier2(api)).json()) as { id: string }
  const decided = await api.request('post', `/candidates/${candidate.id}/decision`, {
    token: 'tok_manager',
    body: { decision: 'confirm', severity: 'high' }
  })
  const { finding, workOrder } = CandidateDecision.parse(await decided.json())
  const audited = await auditLength(manager)

  // The agent's draft and a person's both get the open draft back, unchanged (200, not 201 Created).
  for (const token of ['tok_agent', 'tok_manager']) {
    const again = await api.request('post', '/work-orders', {
      token,
      body: { findingId: finding!.id, remedyId: null, notes: 'Replace fence panel 4 by the playground path' }
    })
    expect({ token, status: again.status, body: await again.json() }).toEqual({ token, status: 200, body: workOrder })
  }
  const listed = WorkOrder.array().parse(
    await (await api.request('get', '/work-orders', { token: 'tok_manager' })).json()
  )
  expect(listed.filter((w) => w.findingId === finding!.id)).toEqual([workOrder!])
  // Nothing was written, so nothing went on the audit chain.
  expect(await auditLength(manager)).toBe(audited)
})

test('a work order past draft blocks another until a re-test reopens the finding; then the agent drafts one as itself', async () => {
  const api = startApi()
  const player = httpPlayer(api)
  const { decision, workOrderId, retest } = await playS1toRepair({ as: player.clientFor, setNow: player.setNow })
  const findingId = decision.finding!.id
  const draft = () =>
    api.request('post', '/work-orders', {
      token: 'tok_agent',
      body: { findingId, remedyId: null, notes: `Refit fence panel 4 on ${findingId}` }
    })

  // The repair is done and awaits its re-test: no second work order.
  const refused = await draft()
  expect({ status: refused.status, body: await refused.json() }).toEqual({
    status: 403,
    body: { ok: false, rule: 'invalid_transition', message: expect.stringContaining(workOrderId) }
  })

  // The reviewer rejects the repair: that work order is finished with and the finding is reopened.
  await player.clientFor('usr_reviewer').recordRetest({
    body: {
      ...retest,
      checklist: retest.checklist.map((check, i) =>
        i === 1 ? { ...check, result: 'fail' as const, reason: 'Gap still open' } : check
      ),
      result: 'rejected',
      reason: 'Panel 4 still loose'
    }
  })
  const created = await draft()
  expect(created.status).toBe(201)
  const agents = WorkOrder.parse(await created.json())
  expect(agents).toMatchObject({ findingId, status: 'draft', draftedBy: { type: 'agent', id: 'usr_agent' } })
  const open = (await player.clientFor('usr_manager').listWorkOrders({})).filter(
    (w) => w.findingId === findingId && w.status === 'draft'
  )
  expect(open).toEqual([agents])
})
