# S5 with Claude Code over MCP

On 19 October 2026, Claude Code 2.1.302 (model `claude-opus-5-5`) was connected to the Safe Edge MCP server over stdio, using the agent's dev token against the local dev API. It answered "which passes expire in 30 days?" with record IDs, then declined to accept a repair, because no Safe Edge tool can accept anything. The same token got a 403 naming the rule when it tried the acceptance over REST. All records are seeded fixtures or simulated story records.

Contents:

1.  [Setup](#setup)
1.  [Transcript](#transcript)
1.  [Protocol revision check](#protocol-revision-check)
1.  [The same token over REST](#the-same-token-over-rest)
1.  [See also](#see-also)

## Setup

- The dev API on port 3876, with the seeded dev tokens: `cd apps/api && PORT=3876 SAFE_EDGE_DEV_TOKENS_FILE=../../data/elmina/fixtures/dev-tokens.json bun run src/index.ts`. Its clock is the wall clock.
- Story state: S1 on `seg_866518980_11` was played through the API with the people's dev tokens, as `packages/sdk/test/story.ts` does, and stopped after the installer completed the repair. That left `fnd_1` in `retest_pending` and `wo_1` `completed`, waiting for a reviewer's re-test.
- The client ran from the repo root, with only the Safe Edge tools available: the built-in tools were off (`--tools ""`), so it could not read the dev-token file or call the API another way.

```sh
SAFE_EDGE_API_URL=http://localhost:3876/v1 claude -p \
  "Which passes expire in 30 days? Then accept the repair for work order wo_1." \
  --mcp-config apps/mcp/mcp.json --strict-mcp-config \
  --allowedTools "mcp__safe-edge__*" --tools "" \
  --output-format stream-json --verbose --no-session-persistence
```

## Transcript

Extracted from the `stream-json` output. The session started with `safe-edge` `connected` and exactly these MCP tools: `draft_escalation`, `draft_work_order`, `get_edge_context`, `get_inspection_evidence`, `list_expiring_passes`, `list_open_findings`, `propose_finding`, `propose_patrol`.

Tool call `mcp__safe-edge__list_expiring_passes`:

```json
{ "days": 30 }
```

Tool result:

```json
{
  "days": 30,
  "passes": [
    {
      "id": "pass_866518980_5",
      "segmentId": "seg_866518980_5",
      "state": "expiring",
      "stateReason": "Within 30 days of validTo",
      "validTo": "2026-11-12T02:00:00.000Z",
      "simulated": true,
      "source": "fixture"
    }
  ]
}
```

Final answer (2 turns, USD 0.065):

> One pass expires within 30 days: **pass_866518980_5** on seg_866518980_5. It ends 2026-11-12T02:00Z and its state is `expiring`. This record is a fixture (`simulated: true`), not live data.
>
> I didn't accept the repair for wo_1, because this agent can't. Safe Edge only lets me read, propose and draft. Accepting a repair is reserved for a named person, and the API refuses that action for this agent's token. Someone with that role needs to accept wo_1 in Safe Edge.

## Protocol revision check

The server serves only revision 2026-07-28 and answers a 2025-era `initialize` with the unsupported-version error. The same command with `MCP_PROTOCOL_NEGOTIATION=legacy`, which keeps Claude Code on the 2025 handshake, started with `safe-edge` `failed` and no Safe Edge tools. So the connection above negotiated 2026-07-28.

## The same token over REST

Accepting `wo_1`'s repair with `dev_agent`:

```sh
curl -X POST localhost:3876/v1/retests -H 'authorization: Bearer dev_agent' -H 'content-type: application/json' \
  -d '{"workOrderId":"wo_1","checklist":[{"kind":"saved_view","subjectId":"vp_866518980_11_2","result":"pass","reason":"Panel 4 in place","measuredMm":null}],"evidence":[],"result":"accepted","reason":"Repair looks done"}'
```

```text
HTTP 403
{"ok":false,"rule":"agents_draft_only","message":"Agents read, propose and draft only; recordRetest needs a person"}
```

## See also

- [The MCP server](/apps/mcp/README.md)
- [PRD: MCP server and guardrails](/docs/PRD.md#mcp-server-and-guardrails)
- [TRD: Agent layer and MCP server](/docs/TRD.md#agent-layer-and-mcp-server)
