// Starts the API the way index.ts does, but on a free port with an injected clock, and calls it over real HTTP.
import type Anthropic from '@anthropic-ai/sdk'
import { afterAll } from 'bun:test'
import type { Actor, RaiseCandidateRequest, Role } from '@safe-edge/contracts'
import { counterIds, createCore, Seed } from '@safe-edge/core'
import { join } from 'node:path'
import { createApp, type ApiOptions } from '../src/app.ts'
import { createElminaPlanner } from '@safe-edge/sdk'
import { devTokens } from '../src/tokens.ts'

const repoRoot = join(import.meta.dir, '../../..')
export const seed = Seed.parse(await Bun.file(join(repoRoot, 'data/elmina/fixtures/seed.json')).json())
export const S1 = seed.story.s1
const planner = await createElminaPlanner((path) => Bun.file(join(repoRoot, path)).json(), { thirdParties: [] })

/** `tok_<role>` for the seeded user holding each role, loaded as dev tokens are, plus two narrower agent tokens. */
const tokens = await devTokens(
  { SAFE_EDGE_DEV_TOKENS: JSON.stringify(Object.fromEntries(seed.users.map((user) => [`tok_${user.role}`, user.id]))) },
  seed.users
)
tokens.set('tok_agent_unscoped', { type: 'agent', id: 'usr_agent', role: 'agent', scopes: [] })
tokens.set('tok_agent_read_only', { type: 'agent', id: 'usr_agent', role: 'agent', scopes: ['edge.read'] })
export type Token = `tok_${Role}` | 'tok_agent_unscoped' | 'tok_agent_read_only'

/** The committed dev tokens (`dev_manager`, `dev_agent`, …), loaded from their file as `bun run dev` loads them. */
export const fixtureDevTokens = await devTokens(
  { SAFE_EDGE_DEV_TOKENS_FILE: join(repoRoot, 'data/elmina/fixtures/dev-tokens.json') },
  seed.users
)

/** One request as the server saw it: who sent it, and what came back (JSON bodies only; streams are not read). */
export interface Exchange {
  method: string
  path: string
  token: string | null
  idempotencyKey: string | null
  status: number
  body: unknown
}

/** With `claude`, the API runs its agent with that client and the `tok_agent` token; without it, it has no agent. */
export function startApi({
  heartbeatMs = 5_000,
  tokens: tokenTable = tokens,
  workOrders,
  claude
}: {
  heartbeatMs?: number
  tokens?: ReadonlyMap<string, Actor>
  workOrders?: ApiOptions['workOrders']
  claude?: Anthropic
} = {}) {
  let now = seed.asOf
  const clock = { now: () => now }
  const ids = counterIds()
  const core = createCore({ seed, clock, ids, planner })
  const agent = claude && { claude, token: 'tok_agent' }
  const app = createApp({ core, clock, ids, tokens: tokenTable, heartbeatMs, workOrders, agent })
  const log: Exchange[] = []
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      const response = await app.fetch(request)
      const json = response.headers.get('content-type')?.includes('application/json')
      log.push({
        method: request.method,
        path: new URL(request.url).pathname,
        token: /^Bearer (\S+)$/i.exec(request.headers.get('authorization') ?? '')?.[1] ?? null,
        idempotencyKey: request.headers.get('idempotency-key'),
        status: response.status,
        body: json ? await response.clone().json() : undefined
      })
      return response
    }
  })
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
    /** Every request the server answered, in order. */
    log,
    setNow: (iso: string) => {
      now = iso
    }
  }
}

export type Api = ReturnType<typeof startApi>

/** S1: the drone reports fence panel 4 missing, a Tier 2 candidate on a segment whose pass is valid. */
export const tier2Candidate = {
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
} satisfies RaiseCandidateRequest

export const raiseTier2 = (api: Api, token: Token | string = 'tok_provider') =>
  api.request('post', '/candidates', { token, body: tier2Candidate })
