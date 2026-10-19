import {
  operations,
  type CoreOperationId,
  type OperationId,
  type OperationInput,
  type OperationOutput,
  type Operations,
  type OperationSpec
} from '@safe-edge/contracts'

type IdsWhere<Cond> = { [K in OperationId]: Operations[K] extends Cond ? K : never }[OperationId]

/** HTTP-only operations the client can call: `api`-handled and not streamed (no `askAgent`, no `streamEvents`). */
export type ApiOperationId = Exclude<IdsWhere<{ handledBy: 'api' }>, IdsWhere<{ stream: true }>>
/** Operations only the memory transport serves (`resetDemo`). */
export type MemoryOperationId = IdsWhere<{ handledBy: 'memory' }>

/** The operation's `{ params?, query?, body? }`, with `query` optional when all its fields are. */
export type CallInput<K extends OperationId> =
  OperationInput<K> extends { query: infer Q }
    ? {} extends Q
      ? Omit<OperationInput<K>, 'query'> & { query?: Q }
      : OperationInput<K>
    : OperationInput<K>

export interface CallOptions {
  /** Sent as `Idempotency-Key` on HTTP writes; reuse it to retry a write safely. A fresh key is used when absent. */
  idempotencyKey?: string
}

type Args<K extends OperationId> =
  unknown extends CallInput<K>
    ? [input?: undefined, options?: CallOptions]
    : {} extends CallInput<K>
      ? [input?: CallInput<K>, options?: CallOptions]
      : [input: CallInput<K>, options?: CallOptions]

/** One method per operation, named by its operationId, typed from the contracts' operations table. */
export type Methods<K extends OperationId> = { [P in K]: (...args: Args<P>) => Promise<OperationOutput<P>> }

/** What both transports offer: every operation core's `dispatch` serves. */
export type SafeEdgeClient = Methods<CoreOperationId>

/** Raw input as the transports receive it, before validation. */
export type RawInput = { params?: Record<string, unknown>; query?: Record<string, unknown>; body?: unknown }

/** The operationIds a transport binds as methods: those it handles, minus streams. */
export const idsHandledBy = (handledBy: OperationSpec['handledBy']) =>
  (Object.keys(operations) as OperationId[]).filter((id) => {
    const op: OperationSpec = operations[id]
    return op.handledBy === handledBy && !op.stream
  })

/** Builds the method object for `ids`, each forwarding to the transport's `call`. */
export function bindMethods<K extends OperationId>(
  ids: readonly K[],
  call: (operationId: K, input: RawInput, options: CallOptions) => Promise<unknown>
): Methods<K> {
  return Object.fromEntries(
    ids.map((id) => [id, (input?: RawInput, options?: CallOptions) => call(id, input ?? {}, options ?? {})])
  ) as unknown as Methods<K>
}
