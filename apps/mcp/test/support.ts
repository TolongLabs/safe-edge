// The MCP server over stdio, driven by the official MCP client, the way a local client (Claude Code) launches it.
import { afterAll } from 'bun:test'
import { Client } from '@modelcontextprotocol/client'
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio'
import { join } from 'node:path'

/**
 * Spawns `bun apps/mcp/src/index.ts` with the API URL and a bearer token, and connects the official client to it.
 * `stderr()` is what the server has logged so far, for checking why it refused to start.
 */
export function startMcp(
  apiUrl: URL | string,
  token: string,
  mode: 'legacy' | { pin: string } = { pin: '2026-07-28' }
) {
  const client = new Client({ name: 'safe-edge-it', version: '0.0.0' }, { versionNegotiation: { mode } })
  afterAll(() => client.close())
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [join(import.meta.dir, '../src/index.ts')],
    env: { SAFE_EDGE_API_URL: new URL('/v1', apiUrl).href, SAFE_EDGE_AGENT_TOKEN: token },
    stderr: 'pipe'
  })
  let stderr = ''
  transport.stderr!.on('data', (chunk: Buffer) => (stderr += chunk.toString()))
  return { client, connected: client.connect(transport).then(() => client), stderr: () => stderr }
}

/** A connected client, or the connection error. */
export const connectMcp = (apiUrl: URL | string, token: string, mode?: 'legacy' | { pin: string }) =>
  startMcp(apiUrl, token, mode).connected
