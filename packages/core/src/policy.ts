import {
  Scope,
  type Actor,
  type Denial,
  type EdgePass,
  type InventoryItem,
  type ItemStatus,
  type OperationSpec,
  type PassState,
  type Retest,
  type Route,
  type RouteStatus,
  type Tier,
  type User
} from '@safe-edge/contracts'
import type { Tx } from './store.ts'

const deny = (rule: Denial['rule'], message: string): Denial => ({ ok: false, rule, message })

const isAgent = (actor: Actor) => actor.type === 'agent' || actor.role === 'agent'

/**
 * The operations-table access rule: a person or service passes when its role is listed; an agent passes only when the
 * operation names an agent scope and the agent's token carries it. Agents never reach an operation without one.
 */
export function authorize(operationId: string, op: OperationSpec, actor: Actor): Denial | null {
  if (isAgent(actor)) {
    if (op.agentScope === null) {
      return deny('agents_draft_only', `Agents read, propose and draft only; ${operationId} needs a person`)
    }
    if (!actor.scopes.includes(op.agentScope)) {
      return deny('scope_missing', `${operationId} needs the ${op.agentScope} scope`)
    }
    return null
  }
  if (op.roles === 'any' || op.roles.includes(actor.role)) return null
  return deny('role_forbidden', `${operationId} is for ${op.roles.join(', ')}; ${actor.id} acts as ${actor.role}`)
}

/** The Actor a seeded user acts as (memory transport `client.as(userId)`, dev tokens). Agents get every agent scope. */
export function actorFor(user: User): Actor {
  const type = user.role === 'agent' || user.role === 'system' || user.role === 'provider' ? user.role : 'user'
  return { type, id: user.id, role: user.role, scopes: type === 'agent' ? [...Scope.options] : [] }
}

/**
 * Core assigns tiers, never the caller: a missing or changed safety-critical item is Tier 2, an item that was not
 * visible is Tier 3 (a field check), and everything else, including every generic image change, is Tier 1.
 */
export function tierFor(item: InventoryItem | null, itemStatus: ItemStatus | null): Tier {
  if (itemStatus === 'not_visible') return 3
  if (item?.safetyCritical && (itemStatus === 'missing' || itemStatus === 'changed')) return 2
  return 1
}

/**
 * Fix Lens route closure: a route stays open until one of its openings is blocked, and a route with an unseen link
 * stays unknown whatever is blocked.
 */
export function routeStatus(route: Pick<Route, 'status' | 'openingIds'>, blocked: ReadonlySet<string>): RouteStatus {
  if (route.status === 'unknown') return 'unknown'
  return route.openingIds.some((id) => blocked.has(id)) ? 'closed' : 'open'
}

/** Edge Pass moves other than to `valid`, which any state reaches only through an accepted re-test. */
const PASS_MOVES: Record<PassState, readonly PassState[]> = {
  none: [],
  valid: ['expiring', 'expired', 'suspended'],
  expiring: ['expired', 'suspended'],
  expired: [],
  suspended: []
}

const DAY_MS = 86_400_000
const EXPIRING_WINDOW_DAYS = 30
const PASS_VALIDITY_MONTHS = 12

export type PassMove =
  { to: 'expiring' | 'expired' | 'suspended'; reason: string } | { to: 'valid'; retest: Retest; routeIds: string[] }

/**
 * Moves a pass and stages the write. The one-way rule lives here, so every caller gets it: only a reviewing person
 * with an accepted re-test can make a pass valid; system, agent and provider actors can only expire or suspend it.
 */
export function movePass(tx: Tx, pass: EdgePass, move: PassMove): EdgePass | Denial {
  if (move.to === 'valid') {
    if (tx.actor.type !== 'user' || tx.actor.role !== 'reviewer') {
      return tx.deny(
        'one_way_rule',
        `Only a reviewer can make ${pass.id} valid; ${tx.actor.type} ${tx.actor.id} cannot`,
        pass.id
      )
    }
    if (move.retest.result !== 'accepted') {
      return tx.deny('one_way_rule', `${pass.id} becomes valid only through an accepted re-test`, pass.id)
    }
    const validTo = new Date(tx.now)
    validTo.setUTCMonth(validTo.getUTCMonth() + PASS_VALIDITY_MONTHS)
    const issued: EdgePass = {
      ...pass,
      state: 'valid',
      stateReason: null,
      validFrom: tx.now,
      validTo: validTo.toISOString(),
      scope: { routeIds: move.routeIds, retestIds: [move.retest.id] },
      issuedBy: tx.actor.id,
      exceptions: []
    }
    tx.put('passes', issued)
    return issued
  }
  if (!PASS_MOVES[pass.state].includes(move.to)) {
    return tx.deny('invalid_transition', `${pass.id} cannot move from ${pass.state} to ${move.to}`, pass.id)
  }
  const moved: EdgePass = { ...pass, state: move.to, stateReason: move.reason }
  tx.put('passes', moved)
  return moved
}

/** When a valid pass starts expiring: 30 days before `validTo`. */
export const expiringFrom = (validTo: string) => Date.parse(validTo) - EXPIRING_WINDOW_DAYS * DAY_MS
export const DAY = DAY_MS
