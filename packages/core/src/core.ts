import {
  Actor,
  operations,
  type CoreOperationId,
  type Denial,
  type Dispatch,
  type DispatchResult,
  type EdgeEvent,
  type OperationId,
  type OperationInput,
  type OperationSpec
} from '@safe-edge/contracts'
import { fixLens } from './handlers/fix-lens.ts'
import type { Handlers } from './handlers/handler.ts'
import { inbox } from './handlers/inbox.ts'
import { notices } from './handlers/notices.ts'
import { patrolHandlers, type PatrolPlanner } from './handlers/patrols.ts'
import { reads } from './handlers/reads.ts'
import { work } from './handlers/work.ts'
import { authorize, expiringFrom, movePass } from './policy.ts'
import { Seed } from './seed.ts'
import { Tx, createState, type IdPrefix } from './store.ts'

export interface Clock {
  /** The current time as an ISO 8601 UTC string. */
  now(): string
}

export interface IdGenerator {
  next(prefix: IdPrefix): string
}

export interface CoreOptions {
  seed: Seed
  clock: Clock
  ids: IdGenerator
  /** Needed only by `createPatrolPlan`; core never imports the planner itself. */
  planner?: PatrolPlanner
}

export interface Core {
  /** The single entry point both transports call: access check, command, events, audit. */
  dispatch: Dispatch
  /**
   * The operations-table access check (`authorize`) alone, with a refusal appended to the audit chain as `dispatch` does.
   * For a transport that refuses before it validates input, or that serves the operation itself (`handledBy: 'api'`).
   * `input` only names the refused record.
   */
  checkAccess(operationId: OperationId, actor: Actor, input?: { params?: unknown; body?: unknown }): Denial | null
  /**
   * Appends an allowed write that a transport stored itself (a `handledBy: 'api'` row: evidence, webhooks), with
   * `before` null and `after` the record, so every write is on the audit chain. Call it once `checkAccess` allowed it.
   */
  recordStored(operationId: OperationId, actor: Actor, record: { id: string }): void
  /**
   * Time-driven pass moves: valid → expiring 30 days before `validTo`, and → expired at `validTo`. Acts as the system,
   * which the one-way rule never lets make a pass valid. Returns the events to publish.
   */
  tick(now: string): EdgeEvent[]
}

/** `<prefix>_<n>` with one counter per prefix, so two runs with the same calls produce the same IDs. */
export function counterIds(start = 1): IdGenerator {
  const counters = new Map<string, number>()
  return {
    next(prefix) {
      const n = counters.get(prefix) ?? start
      counters.set(prefix, n + 1)
      return `${prefix}_${n}`
    }
  }
}

const TICK_ACTOR: Actor = { type: 'system', id: 'core.tick', role: 'system', scopes: [] }

export function createCore({ seed: rawSeed, clock, ids, planner }: CoreOptions): Core {
  const seed = Seed.parse(rawSeed)
  checkSeed(seed)
  const state = createState(seed)
  const handlers: Handlers = { ...reads, ...patrolHandlers(planner), ...inbox, ...fixLens, ...work, ...notices }
  const openTx = (actor: Actor, now: string) => new Tx(state, actor, now, (prefix) => ids.next(prefix), seed.townshipId)

  const checkAccess = (operationId: OperationId, actor: Actor, input: { params?: unknown; body?: unknown } = {}) => {
    const who = Actor.parse(actor)
    const refused = authorize(operationId, operations[operationId], who)
    if (refused) openTx(who, clock.now()).commitDenial(operationId, refused.rule, defaultSubject(operationId, input))
    return refused
  }

  const recordStored = (operationId: OperationId, actor: Actor, record: { id: string }) => {
    const { handledBy } = operations[operationId]
    if (handledBy !== 'api')
      throw new Error(`${operationId} is handled by ${handledBy}, whose writes core audits itself`)
    openTx(Actor.parse(actor), clock.now()).commitStored(operationId, record)
  }

  const dispatch = <K extends CoreOperationId>(
    operationId: K,
    actor: Actor,
    input: OperationInput<K>
  ): DispatchResult<K> => {
    const op: OperationSpec = operations[operationId]
    if (op.handledBy !== 'core') throw new Error(`${operationId} is handled by ${op.handledBy}, not core`)
    const who = Actor.parse(actor)
    const tx = openTx(who, clock.now())
    const raw = (input ?? {}) as { params?: unknown; query?: unknown; body?: unknown }

    const refused = checkAccess(operationId, who, raw)
    if (refused) return refused

    const parsed = {
      ...(op.params && { params: op.params.parse(raw.params) }),
      ...(op.query && { query: op.query.parse(raw.query ?? {}) }),
      ...(op.body && { body: op.body.parse(raw.body) })
    } as OperationInput<K>
    const result = (handlers[operationId] as Handlers[K])(tx, parsed)
    if (!result.ok) {
      if ('rule' in result)
        tx.commitDenial(operationId, result.rule, tx.deniedSubject ?? defaultSubject(operationId, raw))
      return result
    }

    for (const event of tx.events) {
      if (!op.events.includes(event.type))
        throw new Error(`${operationId} emitted ${event.type}, which its operation does not list`)
    }
    tx.commit(operationId)
    return {
      ok: true,
      status: operations[operationId].status,
      data: structuredClone(result.data),
      events: structuredClone(tx.events)
    }
  }

  const tick = (now: string): EdgeEvent[] => {
    const tx = openTx(TICK_ACTOR, now)
    const at = Date.parse(now)
    for (let pass of tx.all('passes')) {
      if (pass.validTo === null) continue
      const validTo = Date.parse(pass.validTo)
      if (pass.state === 'valid' && at >= expiringFrom(pass.validTo)) {
        const moved = movePass(tx, pass, { to: 'expiring', reason: 'Within 30 days of validTo' })
        if ('rule' in moved) throw new Error(moved.message)
        pass = moved
        const data = { passId: pass.id, segmentId: pass.segmentId, validTo: pass.validTo!, simulated: pass.simulated }
        tx.emit('edge.pass.expiring.v1', data, pass.segmentId)
      }
      if (pass.state === 'expiring' && at >= validTo) {
        const moved = movePass(tx, pass, { to: 'expired', reason: 'validTo reached' })
        if ('rule' in moved) throw new Error(moved.message)
        tx.emit(
          'edge.pass.expired.v1',
          { passId: pass.id, segmentId: pass.segmentId, simulated: pass.simulated },
          pass.segmentId
        )
      }
    }
    tx.commit('tick')
    return structuredClone(tx.events)
  }

  return { dispatch: dispatch as Dispatch, checkAccess, recordStored, tick }
}

/** The record a refused call was about, from its input; the operation itself when there is none. */
function defaultSubject(operationId: string, input: { params?: unknown; body?: unknown }): string {
  const params = (input.params ?? {}) as { id?: unknown }
  const body = (input.body ?? {}) as Record<string, unknown>
  const subject = [params.id, body.workOrderId, body.findingId, body.planId, body.segmentId].find(
    (v): v is string => typeof v === 'string'
  )
  return subject ?? operationId
}

/** Fails loudly on a seed whose records point at nothing. Every segment carries a pass (never issued = `none`). */
function checkSeed(seed: Seed): void {
  const ids = (records: { id: string }[]) => new Set(records.map((r) => r.id))
  const users = ids(seed.users)
  const assets = ids(seed.assets)
  const passes = new Map(seed.passes.map((p) => [p.id, p]))
  const baselines = ids(seed.baselines)
  const problems: string[] = []
  for (const a of seed.assets)
    if (!users.has(a.custodianUserId)) problems.push(`${a.id} custodian ${a.custodianUserId}`)
  for (const s of seed.segments) {
    if (!assets.has(s.assetId)) problems.push(`${s.id} asset ${s.assetId}`)
    if (s.passId === null || passes.get(s.passId)?.segmentId !== s.id) problems.push(`${s.id} pass ${s.passId}`)
    if (s.baselineId !== null && !baselines.has(s.baselineId)) problems.push(`${s.id} baseline ${s.baselineId}`)
  }
  if (problems.length > 0) throw new Error(`seed references missing records: ${problems.join('; ')}`)
}
