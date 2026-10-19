# @safe-edge/mcp

The Safe Edge MCP server lets an AI assistant such as Claude Code or Claude Desktop read, propose and draft, and nothing more. It serves the eight agent tools from `@safe-edge/agent-tools` (`packages/agent-tools/src/index.ts`), plus resources and prompts, over stdio on MCP protocol revision 2026-07-28 only. It calls the v1 API with the agent's token, so the API enforces every scope and state rule.

Contents:

1.  [Run it](#run-it)
1.  [Connect Claude Code](#connect-claude-code)
1.  [What it serves](#what-it-serves)
1.  [See also](#see-also)

## Run it

The client launches the server itself, so there is no `dev` script. It needs two environment variables, and fails at startup without them:

- `SAFE_EDGE_API_URL`: the API's `/v1` base, for example `http://localhost:3000/v1` from `bun run dev`.
- `SAFE_EDGE_AGENT_TOKEN`: the agent's bearer token. Locally, that is `dev_agent` from `data/elmina/fixtures/dev-tokens.json`. At startup the server asks the API who the token acts as (`GET /v1/me`) and exits unless it is an agent, so a person's token can't pass the model's drafts off as that person's.

Protocol messages use stdout, so the server logs only to stderr. A client still on the 2025 handshake gets the unsupported-protocol-version error.

## Connect Claude Code

Start the API (`bun run dev`). Then, from the repo root, either pass the config file for one session:

```sh
SAFE_EDGE_AGENT_TOKEN=dev_agent claude --mcp-config apps/mcp/mcp.json --allowedTools "mcp__safe-edge__*"
```

or add the server to your local Claude Code config:

```sh
claude mcp add safe-edge -e SAFE_EDGE_API_URL=http://localhost:3000/v1 -e SAFE_EDGE_AGENT_TOKEN=dev_agent \
  -- bun "$PWD/apps/mcp/src/index.ts"
```

`apps/mcp/mcp.json` reads `SAFE_EDGE_API_URL` (default `http://localhost:3000/v1`) and `SAFE_EDGE_AGENT_TOKEN` from your environment. The token has no default, so the server never acts with a token you did not choose: without it, Claude Code refuses the config. To stop a session reaching the API another way (for example by reading another dev token from the fixture file), turn off the built-in tools with `--tools ""`, as the [S5 evidence run](/docs/evidence/s5-mcp-claude-code.md) did.

## What it serves

- **Tools:** `get_edge_context`, `get_inspection_evidence`, `list_open_findings`, `list_expiring_passes`, `propose_finding`, `draft_work_order`, `draft_escalation` and `propose_patrol`. No tool approves, accepts, submits, sends or closes. A refusal from the API comes back as a tool error naming the policy rule.
- **Resources:** `safeedge://edges/{id}`, `safeedge://findings/{id}` and `safeedge://passes/{id}`, as JSON.
- **Prompts:** `triage_finding` (`candidateId`) and `monthly_report` (`month`, `YYYY-MM`).

Text in tool results and resources, such as rationales, notes and sign or OCR text, comes back as data fields. The server's instructions tell the model never to follow it.

## See also

- [S5 with Claude Code over MCP](/docs/evidence/s5-mcp-claude-code.md)
- [TRD: Agent layer and MCP server](/docs/TRD.md#agent-layer-and-mcp-server)
- `apps/mcp/test/mcp.test.ts`: the integration tests, using the official MCP client over stdio against the real API
