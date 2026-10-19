// Runs the API's real entry (src/index.ts, or src/dev.ts as bun run dev serves it) as its own process, on a free port.
// It never loads a .env file (`--no-env-file`) and gets no credential (testEnv), so no test run can file real sandbox
// Observations.
import type { Subprocess } from 'bun'
import { afterAll } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { answer, freePort, testEnv } from '../../../test/spawn.ts'
import { seed } from './support.ts'

const repoRoot = join(import.meta.dir, '../../..')

/** `tok_<role>` for each seeded user, as the process's inline dev tokens. */
const processTokens = Object.fromEntries(seed.users.map((user) => [`tok_${user.role}`, user.id]))

/** The deployed entry with the inline dev tokens above, or bun run dev's, which generates this machine's own. */
type Entry = 'index' | 'dev'

const running = new Set<Subprocess>()
const dataDirs: string[] = []
afterAll(async () => {
  for (const api of running) api.kill('SIGKILL')
  await Promise.all([...running].map((api) => api.exited))
  for (const dir of dataDirs) rmSync(dir, { recursive: true })
})

/** Spawns the entry; a start without SAFE_EDGE_DATA_DIR gets a fresh, empty one. */
function spawnApi(port: number, env: Record<string, string>, entry: Entry) {
  const dataDir = mkdtempSync(join(tmpdir(), 'safe-edge-api-'))
  dataDirs.push(dataDir)
  const tokens: Record<string, string> =
    entry === 'index' ? { SAFE_EDGE_DEV_TOKENS: JSON.stringify(processTokens) } : {}
  return Bun.spawn(['bun', '--no-env-file', `apps/api/src/${entry}.ts`], {
    cwd: repoRoot,
    env: testEnv({
      PORT: String(port),
      ...tokens,
      SAFE_EDGE_AGENT_TOKEN: 'tok_agent',
      SAFE_EDGE_DATA_DIR: dataDir,
      ...env
    }),
    stdout: 'pipe',
    stderr: 'pipe'
  })
}

/**
 * Spawns the API entry with `env` on top of the defaults (for `index`, the inline dev tokens). Resolves once it
 * answers, or rejects with its stderr.
 */
export async function startApiProcess(env: Record<string, string>, entry: Entry = 'index') {
  const port = freePort()
  const api = spawnApi(port, env, entry)
  running.add(api)
  const url = `http://localhost:${port}`
  const health = await answer(`${url}/v1/health`, api)
  if (!health.ok) throw new Error(`${url}/v1/health answered ${health.status}`)

  const output = api.stdout.getReader()
  const decoder = new TextDecoder()
  let printed = ''

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
    /** The first whole line the process printed that starts with `start`, waiting for it if need be. */
    async printedLine(start: string) {
      for (;;) {
        const line = printed
          .split('\n')
          .slice(0, -1)
          .find((l) => l.startsWith(start))
        if (line !== undefined) return line
        const { done, value } = await output.read()
        if (done) throw new Error(`The API exited without printing a line starting ${start}; it printed: ${printed}`)
        printed += decoder.decode(value, { stream: true })
      }
    },
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
  const api = spawnApi(freePort(), env, 'index')
  return { code: await api.exited, stderr: await new Response(api.stderr).text() }
}
