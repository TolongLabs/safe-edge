// Starts the API the way index.ts does, but on a free port with an injected clock, and calls it over real HTTP.
import { afterAll } from 'bun:test'
import type { Role } from '@safe-edge/contracts'
import { counterIds, createCore, Seed } from '@safe-edge/core'
import { join } from 'node:path'
import { createApp, type ApiOptions } from '../src/app.ts'
import { createElminaPlanner } from '@safe-edge/sdk'
import { devTokens } from '../src/tokens.ts'

const repoRoot = join(import.meta.dir, '../../..')
export const seed = Seed.parse(await Bun.file(join(repoRoot, 'data/elmina/fixtures/seed.json')).json())
export const S1 = seed.story.s1
const planner = await createElminaPlanner((path) => Bun.file(join(repoRoot, path)).json(), { thirdParties: [] })

/** `tok_<role>` for the seeded user holding each role, loaded as dev tokens are, plus an agent token with no scope. */
const tokens = await devTokens(
  { SAFE_EDGE_DEV_TOKENS: JSON.stringify(Object.fromEntries(seed.users.map((user) => [`tok_${user.role}`, user.id]))) },
  seed.users
)
tokens.set('tok_agent_unscoped', { type: 'agent', id: 'usr_agent', role: 'agent', scopes: [] })
export type Token = `tok_${Role}` | 'tok_agent_unscoped'

export function startApi({
  heartbeatMs = 5_000,
  workOrders
}: { heartbeatMs?: number; workOrders?: ApiOptions['workOrders'] } = {}) {
  let now = seed.asOf
  const clock = { now: () => now }
  const ids = counterIds()
  const core = createCore({ seed, clock, ids, planner })
  const app = createApp({ core, clock, ids, tokens, heartbeatMs, workOrders })
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

/** S1: the drone reports fence panel 4 missing, a Tier 2 candidate on a segment whose pass is valid. */
export const raiseTier2 = (api: Api) =>
  api.request('post', '/candidates', {
    token: 'tok_provider',
    body: {
      segmentId: S1.segmentId,
      observationIds: [],
      inventoryItemId: S1.inventoryItemId,
      itemStatus: 'missing',
      class: 'inventory_item',
      score: 0.9,
      uncertainty: 'low',
      gridCell: 'B3',
      rationale: 'Fence panel 4 is missing by the playground path',
      model: null,
      simulated: true
    }
  })
