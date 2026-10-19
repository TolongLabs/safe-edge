import type { CoreOperationId, Denial, NotFound, OperationInput, OperationOutput } from '@safe-edge/contracts'
import type { Tx } from '../store.ts'

export type HandlerResult<K extends CoreOperationId> = { ok: true; data: OperationOutput<K> } | Denial | NotFound

/** The command behind one operation. Input is already parsed with the operation's schemas. */
export type Handler<K extends CoreOperationId> = (tx: Tx, input: OperationInput<K>) => HandlerResult<K>

/** One handler per core operation; the type makes a missing operation a compile error. */
export type Handlers<K extends CoreOperationId = CoreOperationId> = { [P in K]: Handler<P> }

export const ok = <T>(data: T) => ({ ok: true as const, data })
