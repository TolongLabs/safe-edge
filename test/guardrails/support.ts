// The guardrail suite's stage: the real API on a free port behind its own tokens, met over HTTP. It reuses
// the API harness (apps/api/test) and the SDK's S1 story (packages/sdk/test) rather than copying them.
import {
  AuditEvent,
  EdgePass,
  operations,
  type Actor,
  type CreatePatrolPlanRequest,
  type OperationId,
  type OperationSpec,
  type Role
} from '@safe-edge/contracts'
import { createSafeEdgeClient } from '@safe-edge/sdk'
import { expect } from 'bun:test'
import { devTokens } from '../../apps/api/src/tokens.ts'
import { S1, seed, startApi } from '../../apps/api/test/support.ts'
import type { Stage } from '../../packages/sdk/test/story.ts'

export { S1, raiseTier2, tier2Candidate } from '../../apps/api/test/support.ts'
export { playS1toRepair, playS1toS3 } from '../../packages/sdk/test/story.ts'

/** Every row of the operations table the HTTP API serves (all but the demo-only reset). */
export const httpOperations = (Object.entries(operations) as [OperationId, OperationSpec][]).filter(
  ([, op]) => op.handledBy !== 'memory'
)

/** The operation a request reached, by method and path; undefined for the one route outside the table. */
export function operationFor(method: string, path: string): OperationId | undefined {
  const matches = ([, op]: [OperationId, OperationSpec]) =>
    op.method.toUpperCase() === method && new RegExp(`^/v1${op.path.replaceAll(/\{\w+\}/g, '[^/]+')}$`).test(path)
  return httpOperations.find(matches)?.[0]
}

/**
 * The stage's tokens, `dev_<name>` for each seeded `usr_<name>`, loaded as dev tokens are. They are the names of the
 * dev tokens the repo used to commit; `bun run dev` now generates random ones (test/dev.test.ts) and refuses these.
 */
const stageTokens = await devTokens(
  {
    SAFE_EDGE_DEV_TOKENS: JSON.stringify(
      Object.fromEntries(seed.users.map((user) => [user.id.replace(/^usr_/, 'dev_'), user.id]))
    )
  },
  seed.users
)

/** The stage's token for the seeded user holding a role. */
export function devTokenForRole(role: Role): string {
  const entry = [...stageTokens].find(([, actor]) => actor.role === role)
  if (entry === undefined) throw new Error(`No dev token acts as a ${role}`)
  return entry[0]
}

/** The stage's token for a seeded user (`dev_<name>` for `usr_<name>`). */
export function devTokenFor(userId: string): string {
  const entry = [...stageTokens].find(([, actor]) => actor.id === userId)
  if (entry === undefined) throw new Error(`No dev token acts as ${userId}`)
  return entry[0]
}

/**
 * The API as `bun run dev` serves it, but on a free port with a settable clock: behind the stage's tokens, plus any
 * extra tokens a test issues.
 */
export function startGuardedApi(extra: Record<string, Actor> = {}) {
  const tokens = new Map([...stageTokens, ...Object.entries(extra)])
  const api = startApi({ tokens })
  const baseUrl = new URL('/v1', api.url).href

  const actorOf = (token: string) => {
    const actor = tokens.get(token)
    if (actor === undefined) throw new Error(`Unknown token ${token}`)
    return actor
  }
  /** The SDK story's stage: each seeded user drives the http client with their own token. */
  const stage: Stage = {
    as: (userId) => createSafeEdgeClient({ transport: 'http', baseUrl, token: devTokenFor(userId) }),
    setNow: api.setNow
  }
  /** The full audit chain, oldest first, as the general manager reads it. */
  const audit = async () => AuditEvent.array().parse(await json(api.request('get', '/audit', { token: 'dev_gm' })))
  /** S1's Edge Pass. */
  const pass = async () =>
    EdgePass.parse(await json(api.request('get', '/passes/pass_866518980_11', { token: 'dev_manager' })))

  return { ...api, actorOf, stage, audit, pass }
}

export type GuardedApi = ReturnType<typeof startGuardedApi>

/** The JSON body of a 2xx response; anything else fails loudly with the status and body. */
export async function json(request: Promise<Response>): Promise<any> {
  const response = await request
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`)
  return response.json()
}

/** Status and JSON body, for comparing a whole response. */
export async function answer(request: Promise<Response>) {
  const response = await request
  return { status: response.status, body: await response.json() }
}

/** A 403 naming the policy rule, as the API sends it. */
export const denied = (rule: string) => ({ status: 403, body: { ok: false, rule, message: expect.any(String) } })

/** A patrol over S1 from the township's only dock and drone. */
export const patrolRequest = {
  dockId: 'dock_elmina_roof',
  droneProfileId: 'drn_assumed',
  segmentIds: [S1.segmentId],
  context: [],
  notBefore: '2026-10-22T22:00:00.000Z',
  altitudeCapM: 30
} satisfies CreatePatrolPlanRequest

/**
 * The operation's path with real record IDs, picked by the path's first segment (`/work-orders/{id}` → the work
 * order). A path naming a record the test has none of fails loudly, so a new row of the table gets one.
 */
export function pathFor(op: OperationSpec, ids: Record<string, string>): string {
  const resource = op.path.split('/')[1]!
  return op.path
    .replace('{id}', () => {
      const id = ids[resource]
      if (id === undefined) throw new Error(`No ${resource} ID for ${op.path}`)
      return id
    })
    .replace('{segmentId}', S1.segmentId)
}
