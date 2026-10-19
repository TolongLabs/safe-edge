import type * as z from 'zod'
import type { Actor, ApiError, Denial } from './actors.ts'
import type { EdgeEvent } from './events.ts'
import type { OperationId, Operations } from './operations.ts'

/** Operations that core's `dispatch` implements, so both the HTTP API and the SDK memory transport can call them. */
export type CoreOperationId = {
  [K in OperationId]: Operations[K]['handledBy'] extends 'core' ? K : never
}[OperationId]

type InputPart<Op, Key extends 'params' | 'query' | 'body'> =
  Op extends Record<Key, infer S extends z.ZodType> ? Record<Key, z.output<S>> : unknown

/** `{ params?, query?, body? }`, each present when the operation declares it. Already validated by the transport. */
export type OperationInput<K extends OperationId> = InputPart<Operations[K], 'params'> &
  InputPart<Operations[K], 'query'> &
  InputPart<Operations[K], 'body'>

export type OperationOutput<K extends OperationId> = z.output<Operations[K]['response']>

export type DispatchSuccess<K extends CoreOperationId> = {
  ok: true
  status: Operations[K]['status']
  data: OperationOutput<K>
  /** The CloudEvents this call emitted, for the transport to publish (SSE, webhooks, memory subscribers). */
  events: EdgeEvent[]
}

export type NotFound = ApiError & { error: 'not_found' }

/** A denial is a value, not a throw: HTTP 403 naming `rule`. It is also appended to the audit chain. */
export type DispatchResult<K extends CoreOperationId> = DispatchSuccess<K> | Denial | NotFound

/** The HTTP status of a dispatch that did not succeed: 403 for a denial (it names the rule), 404 for not found. */
export const failureStatus = (failure: Denial | NotFound): 403 | 404 => ('rule' in failure ? 403 : 404)

/**
 * The single entry point core implements (PLAN "One dispatch, two transports"): check the actor's role or agent
 * scope against the operations table, run the command, emit events and append audit. Synchronous.
 */
export type Dispatch = <K extends CoreOperationId>(
  operationId: K,
  actor: Actor,
  input: OperationInput<K>
) => DispatchResult<K>
