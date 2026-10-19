// The Safe Edge MCP server on stdio. stdout carries the protocol, so every log goes to stderr.
import { serveStdio } from '@modelcontextprotocol/server/stdio'
import { createSafeEdgeClient } from '@safe-edge/sdk'
import * as z from 'zod'
import { createServer } from './server.ts'

const env = z
  .object({
    SAFE_EDGE_API_URL: z.url().describe("The API's /v1 base, e.g. http://localhost:3000/v1"),
    SAFE_EDGE_AGENT_TOKEN: z.string().min(1).describe("The agent's bearer token; in dev, `bun run dev:token usr_agent`")
  })
  .parse(process.env)

const client = createSafeEdgeClient({
  transport: 'http',
  baseUrl: env.SAFE_EDGE_API_URL,
  token: env.SAFE_EDGE_AGENT_TOKEN
})
const now = () => new Date().toISOString()

// The tools act as whoever the token names, so it must name the agent: a person's token would record the model's
// drafts as that person's work, and a provider's would raise its candidates as the drone.
const me = await client.getMe()
if (me.type !== 'agent') {
  throw new Error(`SAFE_EDGE_AGENT_TOKEN acts as ${me.id} (${me.role}), not as an agent; refusing to serve`)
}

// Only protocol revision 2026-07-28: a 2025-era `initialize` gets the unsupported-version error.
// The server never learns which model its client runs, so proposals carry model null rather than the model's own claim.
serveStdio(() => createServer({ client, now, model: () => null }), {
  legacy: 'reject',
  onerror: (error) => console.error('safe-edge mcp:', error)
})
console.error(`safe-edge mcp: serving stdio for ${env.SAFE_EDGE_API_URL}`)
