// S6 from its scenario fixture (data/elmina/scenarios/s6-text-in-image.json), played through an SDK client: the
// HTTP one against the API, or the memory one the scene's scenario player (#64) drives.
import { expect } from 'bun:test'
import { PolicyRule, Timestamp, UserId, operations, type CoreOperationId } from '@safe-edge/contracts'
import { createSafeEdgeClient, type SafeEdgeClient } from '@safe-edge/sdk'
import { join } from 'node:path'
import * as z from 'zod'
import { seed, type Api } from './support.ts'

const coreOperationIds = Object.entries(operations)
  .filter(([, op]) => op.handledBy === 'core')
  .map(([id]) => id) as [CoreOperationId, ...CoreOperationId[]]

/** One timed call: who acts, which operation, its input. IDs made by earlier events count from 1 after a reset. */
const ScenarioEvent = z.object({
  at: Timestamp,
  type: z.enum(['candidate', 'decision', 'observation', 'attempt']),
  as: UserId,
  operationId: z.enum(coreOperationIds),
  input: z.object({ params: z.record(z.string(), z.string()).optional(), body: z.unknown().optional() }),
  refusedWith: PolicyRule.optional(),
  note: z.string().min(1)
})
export type ScenarioEvent = z.infer<typeof ScenarioEvent>

const Scenario = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string(),
  simulated: z.literal(true),
  source: z.literal('scenario'),
  signText: z.string(),
  setup: z.array(ScenarioEvent),
  events: z.array(ScenarioEvent)
})

export const repoRoot = join(import.meta.dir, '../../..')
export const S6 = Scenario.parse(await Bun.file(join(repoRoot, 'data/elmina/scenarios/s6-text-in-image.json')).json())
/** The S6 events that store evidence. */
export const S6_EVIDENCE = S6.events.filter((event) => event.refusedWith === undefined)
/** The S6 attempt to act on the sign's words with the agent's token, which the API must refuse. */
export const S6_REFUSED = S6.events.filter((event) => event.refusedWith !== undefined)

export interface Player {
  clientFor(userId: string): SafeEdgeClient
  setNow(iso: string): void
}

/** Plays events in order at their times. A refused event must be refused with its rule; the rest return results. */
export async function play(player: Player, events: readonly ScenarioEvent[]) {
  const results: unknown[] = []
  for (const event of events) {
    player.setNow(event.at)
    const call = (player.clientFor(event.as)[event.operationId] as (input: unknown) => Promise<unknown>)(event.input)
    if (event.refusedWith === undefined) results.push(await call)
    else await expect(call).rejects.toMatchObject({ status: 403, rule: event.refusedWith })
  }
  return results
}

/** The scene's transport: the memory client on the labelled seed, acting as each event's user. */
export function memoryPlayer(): Player {
  let now = seed.asOf
  const client = createSafeEdgeClient({ transport: 'memory', userId: 'usr_manager', clock: { now: () => now } })
  return { clientFor: (userId) => client.as(userId), setNow: (iso) => (now = iso) }
}

/** The API over HTTP, each user calling with its own `tok_<role>` token. */
export function httpPlayer(api: Api): Player {
  const baseUrl = new URL('/v1', api.url).href
  const role = (userId: string) => {
    const user = seed.users.find((u) => u.id === userId)
    if (user === undefined) throw new Error(`No seeded user ${userId}`)
    return user.role
  }
  return {
    clientFor: (userId) => createSafeEdgeClient({ transport: 'http', baseUrl, token: `tok_${role(userId)}` }),
    setNow: api.setNow
  }
}

/** Everything a mark-safe would move: passes, findings, tasks, work orders and notices, read as the manager. */
export const stateOf = async (client: SafeEdgeClient) => ({
  passes: await client.listPasses({}),
  findings: await client.listFindings({}),
  tasks: await client.listTasks({}),
  workOrders: await client.listWorkOrders({}),
  notices: await client.listNotices({})
})

/** The audit chain's length, to read what a step appends with `auditSince`. */
export const auditLength = async (client: SafeEdgeClient) => (await client.listAudit({})).length

/** Who did what to which record after the first `from` audit events, and whether it was refused under which rule. */
export const auditSince = async (client: SafeEdgeClient, from: number) =>
  (await client.listAudit({}))
    .slice(from)
    .map(({ actor, action, subjectId, decision, rule }) => ({ actor: actor.id, action, subjectId, decision, rule }))
