import { sha256 } from '@noble/hashes/sha2.js'
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js'
import type { AuditEvent } from '@safe-edge/contracts'

/** The `prevHash` of the first audit event. */
export const GENESIS_HASH = '0'.repeat(64)

/** Stamped on every audit event; bump it when a policy rule changes meaning. */
export const POLICY_VERSION = 'safe-edge-core/1'

/**
 * The one canonical JSON encoding hashed by the audit chain: object keys sorted, no whitespace. It matches
 * `JSON.stringify` for anything that survives a JSON round trip, so a client can verify a chain it fetched over HTTP.
 * Throws on values JSON cannot carry (non-finite numbers, `undefined` in arrays, functions, class instances).
 */
export function canonicalJson(value: unknown): string {
  if (value === null) return 'null'
  switch (typeof value) {
    case 'string':
    case 'boolean':
      return JSON.stringify(value)
    case 'number':
      if (!Number.isFinite(value)) throw new Error(`canonicalJson: ${value} is not a finite number`)
      return JSON.stringify(value)
    case 'object': {
      if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
      const proto = Object.getPrototypeOf(value)
      if (proto !== Object.prototype && proto !== null) {
        throw new Error(`canonicalJson: cannot encode a ${proto?.constructor?.name ?? 'non-plain'} object`)
      }
      const record = value as Record<string, unknown>
      const keys = Object.keys(record)
        .filter((key) => record[key] !== undefined)
        .sort()
      return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`
    }
    default:
      throw new Error(`canonicalJson: cannot encode a ${typeof value}`)
  }
}

/** SHA-256 of `prevHash` plus the canonical JSON of the event without its `hash`. */
export function hashAuditEvent(event: Omit<AuditEvent, 'hash'>): string {
  return bytesToHex(sha256(utf8ToBytes(event.prevHash + canonicalJson(event))))
}

export type AuditChainCheck = { ok: true; length: number; head: string } | { ok: false; index: number; reason: string }

/** Checks that a full audit trail (as `listAudit` returns it, unfiltered) is an unbroken hash chain. */
export function verifyAuditChain(chain: readonly AuditEvent[]): AuditChainCheck {
  let prevHash = GENESIS_HASH
  for (const [index, event] of chain.entries()) {
    if (event.prevHash !== prevHash) {
      return { ok: false, index, reason: `prevHash ${event.prevHash} does not continue the chain (${prevHash})` }
    }
    const { hash, ...unhashed } = event
    if (hashAuditEvent(unhashed) !== hash)
      return { ok: false, index, reason: `event ${event.id} does not match its hash` }
    prevHash = hash
  }
  return { ok: true, length: chain.length, head: prevHash }
}
