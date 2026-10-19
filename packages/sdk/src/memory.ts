import {
  operations,
  type Actor,
  type CoreOperationId,
  type DispatchResult,
  type EdgeEvent,
  type OperationSpec
} from '@safe-edge/contracts'
import {
  actorFor,
  authorize,
  counterIds,
  createCore,
  Seed,
  type Clock,
  type Core,
  type PatrolPlanner
} from '@safe-edge/core'
import seedJson from '../../../data/elmina/fixtures/seed.json'
import * as z from 'zod'
import {
  bindMethods,
  idsHandledBy,
  type MemoryOperationId,
  type Methods,
  type RawInput,
  type SafeEdgeClient
} from './client.ts'
import { SafeEdgeApiError, SafeEdgeDeniedError } from './errors.ts'

/** The labelled Elmina fixtures (`data/elmina/fixtures/seed.json`): every record is `simulated: true, source: 'fixture'`. */
export const elminaSeed: Seed = Seed.parse(seedJson)

export interface MemoryOptions {
  transport: 'memory'
  /** The seeded user the client acts as; switch with `client.as(userId)`. */
  userId: string
  /** Needed only by `createPatrolPlan` (see `createElminaPlanner`); core throws without one. */
  planner?: PatrolPlanner
  /** The scenario clock; the wall clock when absent. */
  clock?: Clock
}

export interface MemoryClient extends SafeEdgeClient, Methods<MemoryOperationId> {
  /** The Actor this client acts as. */
  readonly actor: Actor
  /** The same demo, acting as another seeded user. */
  as(userId: string): MemoryClient
  /** Calls `handler` with every event core emits in this demo, whoever acted. Returns the unsubscribe function. */
  subscribe(handler: (event: EdgeEvent) => void): () => void
}

const wallClock: Clock = { now: () => new Date().toISOString() }

export function createMemoryClient({ userId, planner, clock = wallClock }: MemoryOptions): MemoryClient {
  const fresh = (): Core => createCore({ seed: elminaSeed, clock, ids: counterIds(), planner })
  const session = { core: fresh() }
  const subscribers = new Set<(event: EdgeEvent) => void>()

  const clientFor = (actor: Actor): MemoryClient => {
    const call = async (operationId: CoreOperationId, input: RawInput) => {
      validate(operationId, input)
      const result = session.core.dispatch(operationId, actor, input as never) as DispatchResult<CoreOperationId>
      if (!result.ok) {
        throw 'rule' in result
          ? new SafeEdgeDeniedError(result.rule, result.message)
          : new SafeEdgeApiError(404, result.error, result.message)
      }
      for (const event of result.events) for (const handler of subscribers) handler(event)
      return result.data
    }
    return {
      ...bindMethods(idsHandledBy('core') as CoreOperationId[], call),
      // Restores the seed for every client of this demo; subscribers stay subscribed. The access rule comes from the
      // operations table, but core cannot audit a refused reset: it has no entry point for non-core operations.
      resetDemo: async () => {
        const refused = authorize('resetDemo', operations.resetDemo, actor)
        if (refused) throw new SafeEdgeDeniedError(refused.rule, refused.message)
        session.core = fresh()
        return { reset: true }
      },
      actor,
      as: (id) => clientFor(actorOf(id)),
      subscribe: (handler) => {
        subscribers.add(handler)
        return () => subscribers.delete(handler)
      }
    }
  }
  return clientFor(actorOf(userId))
}

function actorOf(userId: string): Actor {
  const user = elminaSeed.users.find((u) => u.id === userId)
  if (!user) throw new Error(`No seeded user ${userId}; seeded users: ${elminaSeed.users.map((u) => u.id).join(', ')}`)
  return actorFor(user)
}

/** Core throws on malformed input, so the transport checks it first and fails the way the API does: 400. */
function validate(operationId: CoreOperationId, input: RawInput): void {
  const op: OperationSpec = operations[operationId]
  const parts = [
    ['params', op.params, input.params],
    ['query', op.query, input.query ?? {}],
    ['body', op.body, input.body]
  ] as const
  for (const [part, schema, value] of parts) {
    const parsed = schema?.safeParse(value)
    if (parsed && !parsed.success) {
      throw new SafeEdgeApiError(400, 'invalid_input', `${operationId} ${part}: ${z.prettifyError(parsed.error)}`)
    }
  }
}
