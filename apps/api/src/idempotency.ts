// Answers kept by Idempotency-Key (draft-ietf-httpapi-idempotency-key-header) in the API's SQLite store, so a retry
// after a restart replays them too. app.ts keeps a write's answer in the same transaction as its journal entries.
import type { Database } from 'bun:sqlite'

export interface KeptAnswer {
  fingerprint: string
  status: number
  /** The headers, as JSON. */
  headers: string
  body: string
}

export function openIdempotency(db: Database) {
  db.run(
    'create table if not exists idempotency (scope text primary key, fingerprint text not null, ' +
      'status integer not null, headers text not null, body text not null)'
  )
  const find = db.query<KeptAnswer, [string]>(
    'select fingerprint, status, headers, body from idempotency where scope = ?'
  )
  const insert = db.query('insert into idempotency (scope, fingerprint, status, headers, body) values (?, ?, ?, ?, ?)')
  return {
    /** The answer kept for `scope`, if any. */
    find: (scope: string): KeptAnswer | null => find.get(scope),
    /** Keeps the answer given to the request `scope` with the body `fingerprint`. */
    keep(
      scope: string,
      fingerprint: string,
      answer: { status: number; headers: Record<string, string>; body: string }
    ) {
      insert.run(scope, fingerprint, answer.status, JSON.stringify(answer.headers), answer.body)
    }
  }
}
