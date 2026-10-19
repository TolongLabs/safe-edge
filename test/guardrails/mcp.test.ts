// #57: the guardrails, met the way an agent meets them: the MCP server over stdio, launched as apps/mcp/mcp.json does
// with the committed agent dev token, driven by the official MCP client, against the real API on a free port.
// TRD "Testing" item 3, PRD MCP-3. The HTTP side is in api.test.ts.
import { expect, test } from 'bun:test'
import { connectMcp, runMcpToExit } from '../../apps/mcp/test/support.ts'
import { answer, denied, json, raiseTier2, startGuardedApi } from './support.ts'

// Spawning the server is the slow part under load; every wait below is on an event, never a sleep.
const SPAWN_TIMEOUT_MS = 30_000

test(
  'a real MCP client finds no approving tool, drafts a work order, and the same agent token gets 403 approving it over REST',
  async () => {
    const api = startGuardedApi()
    const client = await connectMcp(api.url, 'dev_agent')

    // The eight PRD MCP-1 tools: each reads, or only proposes or drafts. None approves, accepts, confirms, submits,
    // issues, sends, starts, completes or closes.
    const { tools } = await client.listTools()
    expect(tools.map((t) => t.name).toSorted()).toEqual([
      'draft_escalation',
      'draft_work_order',
      'get_edge_context',
      'get_inspection_evidence',
      'list_expiring_passes',
      'list_open_findings',
      'propose_finding',
      'propose_patrol'
    ])
    const approving = /approve|accept|confirm|submit|issue|send|start|complete|close|verify|release|decide/
    expect(tools.filter((t) => approving.test(t.name))).toEqual([])
    expect(
      tools.filter((t) => !t.annotations?.readOnlyHint && !/^(propose|draft)_/.test(t.name)).map((t) => t.name)
    ).toEqual([])

    // A person confirms the drone's Tier 2 candidate, which opens a finding; the agent drafts its work order.
    const candidate = await json(raiseTier2(api, 'dev_drone_sim'))
    const decision = await json(
      api.request('post', `/candidates/${candidate.id}/decision`, {
        token: 'dev_manager',
        body: { decision: 'confirm', severity: 'high' }
      })
    )
    const drafted = await client.callTool({
      name: 'draft_work_order',
      arguments: { findingId: decision.finding.id, notes: 'Replace fence panel 4 by the playground path' }
    })
    expect(drafted.isError).toBeFalsy()
    const { workOrder } = drafted.structuredContent as { workOrder: { id: string } }
    expect(await json(api.request('get', `/work-orders/${workOrder.id}`, { token: 'dev_manager' }))).toMatchObject({
      status: 'draft',
      draftedBy: { type: 'agent', id: 'usr_agent' }
    })

    // The token the MCP server holds, used straight over REST, cannot approve what the agent drafted.
    const submit = api.request('post', `/work-orders/${workOrder.id}/submit`, {
      token: 'dev_agent',
      body: { installerUserId: 'usr_installer', dueAt: '2026-10-27T00:00:00.000Z' }
    })
    expect(await answer(submit)).toEqual(denied('agents_draft_only'))
    expect((await json(api.request('get', `/work-orders/${workOrder.id}`, { token: 'dev_manager' }))).status).toBe(
      'draft'
    )

    // The agent's draft and its refused approval are both on the audit chain, under the agent.
    expect((await api.audit()).slice(-2)).toMatchObject([
      { action: 'createWorkOrder', subjectId: workOrder.id, actor: { type: 'agent' }, decision: 'allowed' },
      {
        action: 'submitWorkOrder',
        subjectId: workOrder.id,
        actor: { type: 'agent' },
        decision: 'denied',
        rule: 'agents_draft_only'
      }
    ])
  },
  SPAWN_TIMEOUT_MS
)

// A path around the guardrails, found while writing this suite: it failed before its fix.

test(
  'the MCP server refuses to start on a token that does not act as an agent',
  async () => {
    const api = startGuardedApi()
    // A person's token would run the model's drafts as that person, and a provider's would raise its candidates
    // as the drone: either way the agent's output stops being labelled as the agent's.
    for (const [token, role] of [
      ['dev_manager', 'manager'],
      ['dev_reviewer', 'reviewer'],
      ['dev_drone_sim', 'provider']
    ] as const) {
      // A real client cannot connect...
      await expect(connectMcp(api.url, token)).rejects.toThrow()
      // ...because the server exits as it starts, naming who the token acts as.
      const { exitCode, stderr } = await runMcpToExit(api.url, token)
      expect({ token, exitCode }).toEqual({ token, exitCode: 1 })
      expect(stderr).toContain(`acts as usr_${token.slice(4)} (${role}), not as an agent`)
    }
  },
  SPAWN_TIMEOUT_MS
)
