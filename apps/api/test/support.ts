// Starts the API the way index.ts does, but on a free port with a scenario clock, and calls it over real HTTP.
import type Anthropic from '@anthropic-ai/sdk'
import { afterAll } from 'bun:test'
import { EdgeEvent, type Actor, type RaiseCandidateRequest, type Role } from '@safe-edge/contracts'
import { Seed } from '@safe-edge/core'
import { join } from 'node:path'
import { createApp, type ApiOptions } from '../src/app.ts'
import type { Every } from '../src/automation.ts'
import { scenarioClock, type ApiClock } from '../src/clock.ts'
import type { WebhookOptions } from '../src/events.ts'
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

/** One request as the server saw it: who sent it, and what came back (JSON bodies only; streams are not read). */
export interface Exchange {
  method: string
  path: string
  token: string | null
  idempotencyKey: string | null
  status: number
  body: unknown
}

/**
 * With `claude`, the API runs its agent with that client and the `tok_agent` token; without it, it has no agent. The
 * clock is a scenario clock (`setNow` sets it directly, without the automation a `setScenarioClock` call runs), unless
 * the test passes a clock without `set` and a timer, as on the wall clock.
 */
export function startApi({
  heartbeatMs = 5_000,
  tokens: tokenTable = tokens,
  workOrders,
  claude,
  webhooks: { origins = [], allowLoopback = true, retryDelaysMs = [] } = {},
  clock = scenarioClock(seed.asOf),
  every,
  weather
}: {
  heartbeatMs?: number
  /** Loopback webhooks allowed and no retries by default, so a failed delivery is final at once. */
  webhooks?: Partial<WebhookOptions>
  tokens?: ReadonlyMap<string, Actor>
  workOrders?: ApiOptions['workOrders']
  claude?: Anthropic
  clock?: ApiClock
  every?: Every
  weather?: ApiOptions['weather']
} = {}) {
  const agent = claude && { claude, token: 'tok_agent' }
  const app = createApp({
    seed,
    planner,
    clock,
    store: ':memory:',
    tokens: tokenTable,
    heartbeatMs,
    workOrders,
    agent,
    webhooks: { origins, allowLoopback, retryDelaysMs },
    every,
    weather
  })
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
      if (clock.set === undefined) throw new Error('This test API runs on a clock the test moves itself')
      clock.set(iso)
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

/** Reads server-sent event frames (blank-line separated) as they arrive. */
export function sseFrames(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  return {
    async next(): Promise<string> {
      while (!buffer.includes('\n\n')) {
        const { done, value } = await reader.read()
        if (done) throw new Error('the event stream closed')
        buffer += decoder.decode(value, { stream: true })
      }
      const end = buffer.indexOf('\n\n')
      const frame = buffer.slice(0, end)
      buffer = buffer.slice(end + 2)
      return frame
    },
    cancel: () => reader.cancel()
  }
}

/** The CloudEvents the stream carries next, skipping heartbeats. */
export async function nextEvents(frames: ReturnType<typeof sseFrames>, count: number): Promise<EdgeEvent[]> {
  const events: EdgeEvent[] = []
  while (events.length < count) {
    const frame = await frames.next()
    if (frame.startsWith(':')) continue
    const data = frame.split('\n').find((line) => line.startsWith('data: '))!
    events.push(EdgeEvent.parse(JSON.parse(data.slice('data: '.length))))
  }
  return events
}

/** An `every` the test fires by hand: `fire()` runs each job once, in the order the API set them, as if its interval passed. */
export function manualTimer() {
  const jobs: (() => void | Promise<void>)[] = []
  return {
    every: ((_ms, run) => void jobs.push(run)) satisfies Every,
    fire: async () => {
      for (const run of jobs) await run()
    }
  }
}
