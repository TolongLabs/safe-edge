// Starts the API the way index.ts does, but on a free port with an injected clock, and calls it over real HTTP.
import { afterAll } from 'bun:test'
import type { Role } from '@safe-edge/contracts'
import { counterIds, createCore, Seed } from '@safe-edge/core'
import { join } from 'node:path'
import { createApp } from '../src/app.ts'
import { elminaPlanner } from '../src/planner.ts'
import { devTokens } from '../src/tokens.ts'

const repoRoot = join(import.meta.dir, '../../..')
export const seed = Seed.parse(await Bun.file(join(repoRoot, 'data/elmina/fixtures/seed.json')).json())
export const S1 = seed.story.s1
const planner = await elminaPlanner((path) => Bun.file(join(repoRoot, path)).json())

/** `tok_<role>` for the seeded user holding each role, loaded as dev tokens are, plus an agent token with no scope. */
const tokens = await devTokens(
  { SAFE_EDGE_DEV_TOKENS: JSON.stringify(Object.fromEntries(seed.users.map((user) => [`tok_${user.role}`, user.id]))) },
  seed.users
)
tokens.set('tok_agent_unscoped', { type: 'agent', id: 'usr_agent', role: 'agent', scopes: [] })
export type Token = `tok_${Role}` | 'tok_agent_unscoped'

export function startApi({ heartbeatMs = 5_000 }: { heartbeatMs?: number } = {}) {
  let now = seed.asOf
  const clock = { now: () => now }
  const ids = counterIds()
  const core = createCore({ seed, clock, ids, planner })
  const app = createApp({ core, clock, ids, tokens, heartbeatMs })
  const server = Bun.serve({ port: 0, fetch: app.fetch })
  afterAll(() => server.stop(true))

  const request = (
    method: string,
    path: string,
    { token, body, headers = {} }: { token?: Token | string; body?: unknown; headers?: Record<string, string> } = {}
  ) =>
    fetch(new URL(`/v1${path}`, server.url), {
      method: method.toUpperCase(),
      headers: {
        ...(token === undefined ? {} : { authorization: `Bearer ${token}` }),
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        ...headers
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    })

  return {
    url: server.url,
    request,
    setNow: (iso: string) => {
      now = iso
    }
  }
}

export type Api = ReturnType<typeof startApi>
