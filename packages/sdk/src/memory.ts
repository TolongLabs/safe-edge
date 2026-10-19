import {
  failureStatus,
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
  createEventQueue,
  runSchedule,
  startReplanning,
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
import { SafeEdgeApiError, SafeEdgeDeniedError, errorFor } from './errors.ts'

/** The labelled Elmina fixtures (`data/elmina/fixtures/seed.json`): every record is `simulated: true, source: 'fixture'`. */
export const elminaSeed: Seed = Seed.parse(seedJson)

export interface MemoryOptions {
  transport: 'memory'
  /** The seeded user the client acts as; switch with `client.as(userId)`. */
  userId: string
  /**
   * Needed by `createPatrolPlan` (see `createElminaPlanner`) and by re-planning; without one core throws, and a re-plan
   * a trigger needs is recorded as a failed `runAutomation` on the audit chain.
   */
  planner?: PatrolPlanner
  /** The scenario clock; the wall clock when absent. */
  clock?: Clock
}

export interface MemoryClient extends SafeEdgeClient, Methods<MemoryOperationId> {
  /** The Actor this client acts as. */
  readonly actor: Actor
  /** The same demo, acting as another seeded user. */
  as(userId: string): MemoryClient
  /**
   * Calls `handler` with every event core emits in this demo, whoever acted, including the re-plans core's re-plan
   * subscriber makes in reaction (each right after the event that caused it). Returns the unsubscribe function.
   */
  subscribe(handler: (event: EdgeEvent) => void): () => void
  /**
   * Runs the scheduled pass at `now`, the one the API runs on its timer or scenario clock (core's `runSchedule`):
   * passes move valid → expiring 30 days before `validTo`, then → expired, and every valid or expiring pass whose
   * segment went a whole patrol interval uninspected gets a missed patrol, which suspends it. The system acts, whichever
   * user this client is, so it never makes a pass valid. Pass the demo clock's time: core stamps the missed patrols
   * with it. Subscribers get the events, which are also returned.
   */
  tick(now: string): Promise<EdgeEvent[]>
}

const wallClock: Clock = { now: () => new Date().toISOString() }

export function createMemoryClient({ userId, planner, clock = wallClock }: MemoryOptions): MemoryClient {
  const fresh = (): Core => createCore({ seed: elminaSeed, clock, ids: counterIds(), planner })
  const session = { core: fresh() }
  // Subscribers see events in the order they happened, each re-plan right after the event that caused it.
  const events = createEventQueue()
  // The demo's current core, whichever reset made it.
  const current: Pick<Core, 'dispatch' | 'recordStored'> = {
    dispatch: (operationId, actor, input) => session.core.dispatch(operationId, actor, input),
    recordStored: (...args) => session.core.recordStored(...args)
  }
  // Core's re-plan subscriber reacts to every event, as in the API. The demo flies no drone, so an in-flight patrol has
  // no progress to re-plan from, and that plan's re-plan fails (recorded) rather than re-flying its stops.
  const replan = startReplanning({
    core: current,
    clock,
    committedTasks: (patrol) => {
      throw new Error(`The memory transport flies no drone, so nothing reports ${patrol.id}'s progress`)
    },
    publish: events.publish
  })
  events.subscribe(replan.onEvent)

  const clientFor = (actor: Actor): MemoryClient => {
    const call = async (operationId: CoreOperationId, input: RawInput) => {
      validate(operationId, input)
      const result = session.core.dispatch(operationId, actor, input as never) as DispatchResult<CoreOperationId>
      if (!result.ok) throw errorFor(failureStatus(result), result)
      events.publish(result.events)
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
      tick: async (now) => {
        const scheduled = runSchedule(session.core, now)
        events.publish(scheduled)
        return scheduled
      },
      actor,
      as: (id) => clientFor(actorOf(id)),
      subscribe: events.subscribe
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
