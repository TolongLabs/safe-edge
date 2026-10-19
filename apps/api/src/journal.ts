// The API's durable state (#127). Core stays synchronous and in memory. Every call that changed the API's state is
// appended to a journal in SQLite, with the clock readings it took, and replayed through the same functions on start.
// Core is deterministic given its clock and IDs, so replay rebuilds the same records and the same audit chain, hash
// for hash. Journaling commands instead of snapshotting state needs no change to core and keeps a log of every write.
import type { Database } from 'bun:sqlite'
import { canonicalJson, type Clock, type IdGenerator, type Seed } from '@safe-edge/core'

export interface Journal {
  /** The clock to give core and the API: recorded during a command, played back during replay. */
  clock: Clock
  /** The IDs to give core and the API. Drawing one outside a command throws: a restart would issue it again. */
  ids: IdGenerator
  /**
   * Registers `fn` under `kind` and returns it journaled. A top-level call that drew an ID (every write and every
   * refusal appends an audit event, which draws one; reads draw none) is appended with its arguments, its clock
   * readings and a digest of its result. Calls made inside it, or during replay, are part of it and are not appended.
   * `fn` must be synchronous, and its arguments JSON.
   */
  command<A extends unknown[], R>(kind: string, fn: (...args: A) => R): (...args: A) => R
  /**
   * Replays every appended call in order, once all commands are registered. Throws if any replays differently. Returns
   * the last clock reading the journal holds, or null when none.
   */
  replay(): string | null
  /**
   * Runs `run`, then `alongside` with its result, in one SQLite transaction on the journal's database (#149): the
   * entries `run`'s commands append and the rows `alongside` writes to the same database commit together or not at
   * all, so a kill cannot keep one without the other. If `run` throws, the entries it appended still commit (memory
   * holds their writes) and the error goes on. If `alongside` or the commit fails after `run` appended, nothing commits
   * and the journal breaks, as after a failed append. Both must be synchronous, which keeps every other caller's
   * entries out of the transaction. A section cannot run inside a command, a replay or another section.
   */
  atomic<R>(run: () => R, alongside: (result: R) => void): R
}

/**
 * A call changed the API's state in memory and the journal could not keep it: serving on would lose it at the next
 * start. The journal takes no more calls after one; the entrypoint stops the process (index.ts).
 */
export class JournalWriteError extends Error {}

const digest = (result: unknown) => {
  if (result instanceof Promise) throw new Error('A journaled command must be synchronous')
  return new Bun.CryptoHasher('sha256').update(JSON.stringify(result ?? null)).digest('hex')
}

/**
 * Opens the journal in `db`. The seed is part of the state, so a journal written from another seed is refused rather
 * than replayed onto the wrong records. Replay assumes the code that wrote the journal: a change to core that alters
 * a recorded result stops the start, naming the entry.
 */
export function openJournal(db: Database, { seed, clock, ids }: { seed: Seed; clock: Clock; ids: IdGenerator }) {
  db.run('create table if not exists meta (key text primary key, value text not null)')
  db.run(
    'create table if not exists journal (seq integer primary key, kind text not null, args text not null, ' +
      'clock text not null, outcome text not null)'
  )
  const seedDigest = digest(canonicalJson(seed))
  const recorded = db.query<{ value: string }, [string]>('select value from meta where key = ?').get('seed')
  if (recorded === null) db.run('insert into meta (key, value) values (?, ?)', ['seed', seedDigest])
  else if (recorded.value !== seedDigest) {
    throw new Error(`${db.filename} was written from another seed; move it away to start from this one`)
  }
  const append = db.query('insert into journal (kind, args, clock, outcome) values (?, ?, ?, ?)')

  const commands = new Map<string, (...args: never[]) => unknown>()
  /** The top-level call being recorded. */
  let live: { clock: string[]; drawn: number } | null = null
  /** The entry being replayed, with its clock readings still to play. */
  let replaying: { seq: number; clock: string[] } | null = null
  /** The append that failed, after which memory holds a write the journal lacks. */
  let broken: JournalWriteError | null = null
  /** Entries appended by this process, so an atomic section knows whether it appended any. */
  let appended = 0

  const journal: Journal = {
    clock: {
      now() {
        if (replaying) {
          const at = replaying.clock.shift()
          if (at === undefined) throw new Error(`Journal entry ${replaying.seq} read the clock more often on replay`)
          return at
        }
        const at = clock.now()
        live?.clock.push(at)
        return at
      }
    },
    ids: {
      next(prefix) {
        if (live) live.drawn++
        else if (!replaying) throw new Error(`A ${prefix} ID was drawn outside a journaled command`)
        return ids.next(prefix)
      }
    },

    command<A extends unknown[], R>(kind: string, fn: (...args: A) => R) {
      if (commands.has(kind)) throw new Error(`The journal already has a ${kind} command`)
      commands.set(kind, fn as (...args: never[]) => unknown)
      return (...args: A): R => {
        if (broken) throw broken
        if (live || replaying) return fn(...args)
        const recordedArgs = JSON.stringify(args)
        live = { clock: [], drawn: 0 }
        let outcome = 'threw'
        try {
          const result = fn(...args)
          outcome = digest(result)
          return result
        } finally {
          const { clock: readings, drawn } = live
          live = null
          if (drawn > 0) {
            try {
              append.run(kind, recordedArgs, JSON.stringify(readings), outcome)
              appended++
            } catch (error) {
              broken = new JournalWriteError(`The API could not journal a ${kind} to ${db.filename}`, { cause: error })
              throw broken
            }
          }
        }
      }
    },

    replay() {
      const entries = db
        .query<{ seq: number; kind: string; args: string; clock: string; outcome: string }, []>(
          'select seq, kind, args, clock, outcome from journal order by seq'
        )
        .all()
      let last: string | null = null
      for (const { seq, kind, args, clock: readings, outcome } of entries) {
        const fn = commands.get(kind)
        if (fn === undefined) throw new Error(`Journal entry ${seq} is a ${kind}, which this API does not have`)
        replaying = { seq, clock: JSON.parse(readings) }
        last = replaying.clock.at(-1) ?? last
        let replayed = 'threw'
        let thrown: unknown
        try {
          replayed = digest(fn(...(JSON.parse(args) as never[])))
        } catch (error) {
          // A recorded call that threw must throw again; that it threw is the outcome compared below.
          thrown = error
        }
        const unread = replaying.clock.length
        replaying = null
        if (replayed !== outcome || unread > 0) {
          const message = `Journal entry ${seq} (${kind}) replays differently than it ran: ${db.filename} was written by other code`
          throw new Error(message, { cause: thrown })
        }
      }
      return last
    },

    atomic<R>(run: () => R, alongside: (result: R) => void): R {
      if (broken) throw broken
      if (live || replaying || db.inTransaction) {
        throw new Error('An atomic section runs on its own, not inside a command, a replay or another section')
      }
      const before = appended
      db.run('begin')
      /** Rolls the section back; once it appended, memory holds writes the journal now lacks, so the journal breaks. */
      const abort = (cause: unknown): never => {
        if (db.inTransaction) db.run('rollback')
        if (broken || appended === before) throw cause
        broken = new JournalWriteError(`The API could not commit an atomic section to ${db.filename}`, { cause })
        throw broken
      }
      let result: R
      try {
        result = run()
        if (result instanceof Promise) throw new Error('An atomic section must be synchronous')
      } catch (error) {
        // A failed append broke the journal, and nothing of the section may commit; otherwise the entries stay.
        if (broken) abort(error)
        try {
          db.run('commit')
        } catch (cause) {
          abort(cause)
        }
        throw error
      }
      try {
        alongside(result)
        db.run('commit')
      } catch (cause) {
        abort(cause)
      }
      return result
    }
  }
  return journal
}
