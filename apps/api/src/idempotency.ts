// Answers kept by Idempotency-Key (draft-ietf-httpapi-idempotency-key-header) in the API's SQLite store, so a retry
// after a restart replays them too. app.ts keeps a write's answer in the same transaction as its journal entries.
//
// The draft (section 2.3) asks a resource to define when keys expire and publish it: an answer is kept for a
// retention of wall-clock time after it was given, 24 hours unless SAFE_EDGE_IDEMPOTENCY_RETENTION_SECONDS says
// otherwise (Stripe keeps keys for at least 24 hours too), then pruned, and a request with that key runs as a new one.
// Wall-clock time, not the API's injected clock: a scenario clock jumps by days and stops, and the retention bounds
// the store's size.
import type { Database } from 'bun:sqlite'

const DAY_SECONDS = 24 * 60 * 60

/** How long answers are kept, in milliseconds, from `SAFE_EDGE_IDEMPOTENCY_RETENTION_SECONDS` (24 hours when unset). */
export function idempotencyRetentionMs(env: Record<string, string | undefined>): number {
  const seconds = env.SAFE_EDGE_IDEMPOTENCY_RETENTION_SECONDS
  if (seconds === undefined) return DAY_SECONDS * 1000
  if (!/^\d+$/.test(seconds) || Number(seconds) === 0) {
    throw new Error(`SAFE_EDGE_IDEMPOTENCY_RETENTION_SECONDS is a whole number of seconds above 0, not "${seconds}"`)
  }
  return Number(seconds) * 1000
}

export interface KeptAnswer {
  fingerprint: string
  status: number
  /** The headers, as JSON. */
  headers: string
  body: string
}

export function openIdempotency(db: Database, retentionMs: number) {
  db.run(
    'create table if not exists idempotency (scope text primary key, fingerprint text not null, ' +
      'status integer not null, headers text not null, body text not null, kept_at integer not null)'
  )
  const columns = db.query<{ name: string }, []>("select name from pragma_table_info('idempotency')").all()
  if (!columns.some((column) => column.name === 'kept_at')) {
    // A store from before #149 kept answers without a time: they count as kept now, so they last one retention more.
    db.transaction(() => {
      db.run('alter table idempotency add column kept_at integer not null default 0')
      db.run('update idempotency set kept_at = ?', [Date.now()])
    })()
  }
  db.run('create index if not exists idempotency_kept_at on idempotency (kept_at)')
  const prune = db.query('delete from idempotency where kept_at <= ?')
  const find = db.query<KeptAnswer, [string]>(
    'select fingerprint, status, headers, body from idempotency where scope = ?'
  )
  const insert = db.query(
    'insert into idempotency (scope, fingerprint, status, headers, body, kept_at) values (?, ?, ?, ?, ?, ?)'
  )
  return {
    /** The answer kept for `scope`, once every answer older than the retention is pruned. */
    find(scope: string): KeptAnswer | null {
      prune.run(Date.now() - retentionMs)
      return find.get(scope)
    },
    /** Keeps the answer given to the request `scope` with the body `fingerprint`. */
    keep(
      scope: string,
      fingerprint: string,
      answer: { status: number; headers: Record<string, string>; body: string }
    ) {
      insert.run(scope, fingerprint, answer.status, JSON.stringify(answer.headers), answer.body, Date.now())
    }
  }
}
