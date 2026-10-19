// Processes a test spawns: the environment every one starts from, so no test run can reach a live service with
// someone's credentials, a free port to serve on, and the wait until it answers.
import type { Subprocess } from 'bun'
import { PROCORE_ENV } from '../packages/providers/src/workorder-procore.ts'

/** Inherited variables a spawned test process never gets: credentials, NODE_ENV, and the app's own SAFE_EDGE_*. */
const DROPPED = /^(PROCORE|ANTHROPIC|SAFE_EDGE)_|KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|_CT0|^NODE_ENV$/

/**
 * Set blank: what the product reads to reach Procore and Claude. A process's own environment wins over a .env file bun
 * loads (`bun run dev` loads the root .env), and a blank variable counts as unset to readProcoreEnv and the Claude SDK.
 */
const BLANKED = [...Object.values(PROCORE_ENV), 'ANTHROPIC_API_KEY']

/** The environment for a process a test spawns: the test run's without credentials, then `env` on top. */
export function testEnv(env: Record<string, string> = {}): Record<string, string> {
  const inherited = Object.entries(process.env).filter(
    (entry): entry is [string, string] => entry[1] !== undefined && !DROPPED.test(entry[0])
  )
  return { ...Object.fromEntries(inherited), ...Object.fromEntries(BLANKED.map((name) => [name, ''])), ...env }
}

/** A port nothing listens on right now. */
export function freePort(): number {
  const server = Bun.serve({ port: 0, fetch: () => new Response() })
  const { port } = server
  server.stop(true)
  if (port === undefined) throw new Error('Bun.serve did not report a port')
  return port
}

/**
 * Calls `check` every `intervalMs` until it returns something other than undefined, and fails naming `what` once
 * `timeoutMs` has passed: for what happens on its own time, after the call that caused it.
 */
export async function eventually<T>(
  what: string,
  check: () => T | undefined | Promise<T | undefined>,
  { timeoutMs = 10_000, intervalMs = 10 }: { timeoutMs?: number; intervalMs?: number } = {}
): Promise<T> {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const value = await check()
    if (value !== undefined) return value
    if (Date.now() > deadline) throw new Error(`${what} did not happen within ${timeoutMs / 1000} s`)
    await Bun.sleep(intervalMs)
  }
}

/**
 * The first answer `url` gives once the spawned process serving it is up. Fails if the process exits first (with its
 * stderr, when piped) or nothing answers within 20 s.
 */
export function answer(url: string, server: Subprocess<'ignore', 'ignore' | 'inherit', 'pipe' | 'inherit'>) {
  return eventually(
    `An answer from ${url}`,
    async () => {
      if (server.exitCode !== null) {
        const stderr = server.stderr instanceof ReadableStream ? `: ${await new Response(server.stderr).text()}` : ''
        throw new Error(`The process serving ${url} exited with code ${server.exitCode}${stderr}`)
      }
      return fetch(url).catch((error: Error) => {
        if (error.message.includes('Unable to connect')) return undefined
        throw error
      })
    },
    { timeoutMs: 20_000, intervalMs: 100 }
  )
}
