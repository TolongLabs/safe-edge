// The Safe Edge MCP server on stdio. stdout carries the protocol, so every log goes to stderr.
import { serveStdio } from '@modelcontextprotocol/server/stdio'
import { createSafeEdgeClient } from '@safe-edge/sdk'
import * as z from 'zod'
import { createServer } from './server.ts'

const env = z
  .object({
    SAFE_EDGE_API_URL: z.url().describe("The API's /v1 base, e.g. http://localhost:3000/v1"),
    SAFE_EDGE_AGENT_TOKEN: z.string().min(1).describe("The agent's bearer token, e.g. the dev token dev_agent")
  })
  .parse(process.env)

const client = createSafeEdgeClient({
  transport: 'http',
  baseUrl: env.SAFE_EDGE_API_URL,
  token: env.SAFE_EDGE_AGENT_TOKEN
})
const now = () => new Date().toISOString()

// Only protocol revision 2026-07-28: a 2025-era `initialize` gets the unsupported-version error.
serveStdio(() => createServer({ client, now }), {
  legacy: 'reject',
  onerror: (error) => console.error('safe-edge mcp:', error)
})
console.error(`safe-edge mcp: serving stdio for ${env.SAFE_EDGE_API_URL}`)
