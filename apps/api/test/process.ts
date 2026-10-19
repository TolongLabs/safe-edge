// Runs the API's real entry (src/index.ts) as its own process, the way it is deployed, on a free port. It never loads
// a .env file (`--no-env-file`) and gets no credential (testEnv), so no test run can file real sandbox Observations.
import type { Subprocess } from 'bun'
import { afterAll } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { testEnv } from '../../../test/spawn.ts'
import { seed } from './support.ts'

const repoRoot = join(import.meta.dir, '../../..')

/** `tok_<role>` for each seeded user, as the process's inline dev tokens. */
export const processTokens = Object.fromEntries(seed.users.map((user) => [`tok_${user.role}`, user.id]))

function freePort(): number {
  const server = Bun.serve({ port: 0, fetch: () => new Response() })
  const { port } = server
  server.stop(true)
  if (port === undefined) throw new Error('Bun.serve did not report a port')
  return port
}

const running = new Set<Subprocess>()
const dataDirs: string[] = []
afterAll(async () => {
  for (const api of running) api.kill('SIGKILL')
  await Promise.all([...running].map((api) => api.exited))
  for (const dir of dataDirs) rmSync(dir, { recursive: true })
})

/** Spawns the entry; a start without SAFE_EDGE_DATA_DIR gets a fresh, empty one. */
function spawnApi(port: number, env: Record<string, string>) {
  const dataDir = mkdtempSync(join(tmpdir(), 'safe-edge-api-'))
  dataDirs.push(dataDir)
  return Bun.spawn(['bun', '--no-env-file', 'apps/api/src/index.ts'], {
    cwd: repoRoot,
    env: testEnv({
      PORT: String(port),
      SAFE_EDGE_DEV_TOKENS: JSON.stringify(processTokens),
      SAFE_EDGE_AGENT_TOKEN: 'tok_agent',
      SAFE_EDGE_DATA_DIR: dataDir,
      ...env
    }),
    stdout: 'ignore',
    stderr: 'pipe'
  })
}

/** Spawns the API with `env` on top of the inline dev tokens. Resolves once it answers, or rejects with its stderr. */
export async function startApiProcess(env: Record<string, string>) {
  const port = freePort()
  const api = spawnApi(port, env)
  running.add(api)
  const url = `http://localhost:${port}`
  for (const deadline = Date.now() + 20_000; ; await Bun.sleep(100)) {
    if (api.exitCode !== null) {
      throw new Error(`The API exited with code ${api.exitCode}: ${await new Response(api.stderr).text()}`)
    }
    if (Date.now() > deadline) throw new Error(`${url} did not answer within 20 s`)
    const health = await fetch(`${url}/v1/health`).catch((error: Error) => {
      if (error.message.includes('Unable to connect')) return undefined
      throw error
    })
    if (health?.ok) break
  }

  const request = (method: string, path: string, token: string, body?: unknown, headers: Record<string, string> = {}) =>
    fetch(`${url}/v1${path}`, {
      method: method.toUpperCase(),
      headers: {
        authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        ...headers
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    })

  return {
    url,
    request,
    /** The exit code and stderr of a process that stops by itself. */
    async exited() {
      const [code, stderr] = await Promise.all([api.exited, new Response(api.stderr).text()])
      running.delete(api)
      return { code, stderr }
    },
    /** Kills the process at once, with no chance to flush or clean up, as a crash or `kill -9` would. */
    async crash() {
      api.kill('SIGKILL')
      await api.exited
      running.delete(api)
    }
  }
}

/** The exit code and stderr of an API start that is expected to fail. */
export async function refusedStart(env: Record<string, string>) {
  const api = spawnApi(freePort(), env)
  return { code: await api.exited, stderr: await new Response(api.stderr).text() }
}
