// The MCP server over stdio, driven by the official MCP client, the way a local client (Claude Code) launches it.
import { afterAll } from 'bun:test'
import { Client } from '@modelcontextprotocol/client'
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio'
import { join } from 'node:path'

const entry = join(import.meta.dir, '../src/index.ts')
const serverEnv = (apiUrl: URL | string, token: string) => ({
  SAFE_EDGE_API_URL: new URL('/v1', apiUrl).href,
  SAFE_EDGE_AGENT_TOKEN: token
})

/** Spawns `bun apps/mcp/src/index.ts` with the API URL and a bearer token, and connects the official client to it. */
export async function connectMcp(
  apiUrl: URL | string,
  token: string,
  mode: 'legacy' | { pin: string } = { pin: '2026-07-28' }
) {
  const client = new Client({ name: 'safe-edge-it', version: '0.0.0' }, { versionNegotiation: { mode } })
  afterAll(() => client.close())
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [entry],
    env: serverEnv(apiUrl, token),
    stderr: 'pipe'
  })
  await client.connect(transport)
  return client
}

/**
 * Runs the server with no client, for one that exits as it starts: its exit code and everything it logged. (The
 * client's pinned negotiation probes on a sibling process, so its transport never sees that process's stderr.)
 */
export async function runMcpToExit(apiUrl: URL | string, token: string) {
  const server = Bun.spawn([process.execPath, entry], {
    env: serverEnv(apiUrl, token),
    stdin: 'pipe',
    stdout: 'ignore',
    stderr: 'pipe'
  })
  const [exitCode, stderr] = await Promise.all([server.exited, new Response(server.stderr).text()])
  return { exitCode, stderr }
}
