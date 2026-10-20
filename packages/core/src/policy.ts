import {
  Scope,
  type Actor,
  type Candidate,
  type CandidateClass,
  type Denial,
  type EdgePass,
  type FalseFlagReport,
  type FlagClass,
  type ImageQuality,
  type InventoryItem,
  type ItemStatus,
  type OperationSpec,
  type PassState,
  type Retest,
  type Route,
  type RouteStatus,
  type Segment,
  type Tier,
  type User
} from '@safe-edge/contracts'
import type { Tx } from './store.ts'

const deny = (rule: Denial['rule'], message: string): Denial => ({ ok: false, rule, message })

export const isAgent = (actor: Actor) => actor.type === 'agent' || actor.role === 'agent'

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
 * The quality gate a frame passes to count as a re-shoot (TRD perception routing: low quality means recapture).
 * Assumed figures: no perception model has calibrated them yet.
 */
const QUALITY_GATE = { minSharpness: 0.6, maxAlignmentResidualPx: 5, maxOcclusion: 0.3 }

/** Sharp enough, aligned to its baseline (a frame with none to align to has a null residual) and not occluded. */
export function passesQualityGate({ sharpness, alignmentResidualPx, occlusion }: ImageQuality): boolean {
  return (
    sharpness >= QUALITY_GATE.minSharpness &&
    (alignmentResidualPx === null || alignmentResidualPx <= QUALITY_GATE.maxAlignmentResidualPx) &&
    occlusion <= QUALITY_GATE.maxOcclusion
  )
}

/**
 * Core assigns tiers, never the caller: a missing or changed safety-critical item is Tier 2, an item that was not
 * visible is Tier 3 (a field check), and everything else, including every generic image change, is Tier 1. A flag
 * whose class is over its false-flag budget drops from Tier 2 to Tier 1, so noise stops suspending passes.
 */
export function tierFor(item: InventoryItem | null, itemStatus: ItemStatus | null, overBudget: boolean): Tier {
  if (itemStatus === 'not_visible') return 3
  if (item?.safetyCritical && (itemStatus === 'missing' || itemStatus === 'changed')) return overBudget ? 1 : 2
  return 1
}

/** The proposed false flags allowed per patrol and class (PRD WATCH-7); a hypothesis to tune with SDP. */
export const FALSE_FLAG_BUDGET = 10

/**
 * What a flag's false flags count against: the item type for an expected-inventory flag, else its class. Null for an
 * expected-inventory flag that names no item, and for a missed patrol, which core raises from the calendar rather than
 * from a frame: no budget covers either.
 */
export function flagClassOf(item: InventoryItem | null, candidateClass: CandidateClass): FlagClass | null {
  if (candidateClass === 'missed_patrol') return null
  if (candidateClass !== 'inventory_item') return candidateClass
  return item?.type ?? null
}

/**
 * Reviewed flags and false (rejected) flags per patrol and class. A flag belongs to the patrol of its first observation
 * made on one; flags from phone captures outside a patrol count against no patrol. A class is over budget when the
 * latest patrol with reviewed flags of that class rejected more than the budget. Only reviewed flags restore it: a later
 * patrol that raised no flags of the class leaves it as it was, and one whose reviewed flags stay within budget restores it.
 */
export function falseFlagReport(tx: Tx): FalseFlagReport {
  // Patrols that start at the same instant are ordered as they were created.
  const created = new Map(tx.all('patrols').map((p, i) => [p.id, i]))
  const byPatrol = new Map<string, Map<FlagClass, { reviewed: number; falseFlags: number }>>()
  for (const candidate of tx.all('candidates')) {
    if (candidate.status === 'candidate') continue
    const patrolId = candidate.observationIds.map((id) => tx.must('observations', id).patrolId).find((p) => p !== null)
    if (patrolId === undefined) continue
    const flagClass = flagClassOf(itemOf(tx, candidate), candidate.class)
    if (flagClass === null) continue
    const classes = byPatrol.get(patrolId) ?? new Map()
    const counts = classes.get(flagClass) ?? { reviewed: 0, falseFlags: 0 }
    classes.set(flagClass, {
      reviewed: counts.reviewed + 1,
      falseFlags: counts.falseFlags + (candidate.status === 'rejected' ? 1 : 0)
    })
    byPatrol.set(patrolId, classes)
  }
  const patrols = [...byPatrol]
    .map(([patrolId, classes]) => ({
      patrolId,
      startedAt: tx.must('patrols', patrolId).startedAt,
      classes: [...classes]
        .map(([flagClass, counts]) => ({ flagClass, ...counts }))
        .toSorted((a, b) => a.flagClass.localeCompare(b.flagClass))
    }))
    .toSorted((a, b) => a.startedAt.localeCompare(b.startedAt) || created.get(a.patrolId)! - created.get(b.patrolId)!)
  const latest = new Map<FlagClass, number>()
  for (const patrol of patrols) for (const c of patrol.classes) latest.set(c.flagClass, c.falseFlags)
  const overBudget = [...latest]
    .filter(([, falseFlags]) => falseFlags > FALSE_FLAG_BUDGET)
    .map(([flagClass]) => flagClass)
    .toSorted()
  return { budgetPerPatrol: FALSE_FLAG_BUDGET, patrols, overBudget }
}

/** The expected item a candidate names, or null. */
export function itemOf(tx: Tx, candidate: Pick<Candidate, 'segmentId' | 'inventoryItemId'>): InventoryItem | null {
  if (candidate.inventoryItemId === null) return null
  const item = tx
    .must('segments', candidate.segmentId)
    .expectedInventory.find((i) => i.id === candidate.inventoryItemId)
  if (item === undefined)
    throw new Error(`store integrity: ${candidate.segmentId} has no item ${candidate.inventoryItemId}`)
  return item
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
 * The one-way rule: only a reviewing person with an accepted re-test can make a pass valid. Checked by `movePass`, and
 * by any accepted re-test before it decides whether the pass can be restored at all.
 */
export function oneWayRule(tx: Tx, pass: EdgePass, retest: Retest): Denial | null {
  if (tx.actor.type !== 'user' || tx.actor.role !== 'reviewer') {
    return tx.deny(
      'one_way_rule',
      `Only a reviewer can make ${pass.id} valid; ${tx.actor.type} ${tx.actor.id} cannot`,
      pass.id
    )
  }
  if (retest.result !== 'accepted') {
    return tx.deny('one_way_rule', `${pass.id} becomes valid only through an accepted re-test`, pass.id)
  }
  return null
}

/**
 * Moves a pass and stages the write. The one-way rule lives here, so every caller gets it: only a reviewing person
 * with an accepted re-test can make a pass valid; system, agent and provider actors can only expire or suspend it.
 */
export function movePass(tx: Tx, pass: EdgePass, move: PassMove): EdgePass | Denial {
  if (move.to === 'valid') {
    const refused = oneWayRule(tx, pass, move.retest)
    if (refused) return refused
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

/**
 * What still holds a segment's pass suspended (TRD "Suspicion suspends"): Tier 2 candidates awaiting a decision, or a
 * recapture no one has cleared, and findings not yet closed. An accepted re-test restores the pass only when there are
 * none.
 */
export function openSuspicions(tx: Tx, segmentId: string): string[] {
  const cleared = new Set(
    tx.all('retests').flatMap((r) => (r.candidateId !== null && r.result === 'accepted' ? [r.candidateId] : []))
  )
  const candidates = tx
    .all('candidates')
    .filter((c) => c.tier === 2 && (c.status === 'candidate' || (c.status === 'needs_recapture' && !cleared.has(c.id))))
  const findings = tx.all('findings').filter((f) => f.status !== 'closed')
  return [...candidates, ...findings].filter((r) => r.segmentId === segmentId).map((r) => r.id)
}

/** When a valid pass starts expiring: 30 days before `validTo`. */
export const expiringFrom = (validTo: string) => Date.parse(validTo) - EXPIRING_WINDOW_DAYS * DAY_MS
export const DAY = DAY_MS

/**
 * When a segment's patrol is missed: a whole patrol interval after the last patrol that inspected some of it (`since`),
 * or after its pass's `validFrom` when that is later, because the re-test that issued the pass was an inspection on site.
 */
export function missedPatrolDue(segment: Segment, pass: EdgePass): { since: string; dueMs: number } {
  const since = [segment.lastPatrolledAt, pass.validFrom]
    .filter((at) => at !== null)
    .reduce((a, b) => (Date.parse(a) >= Date.parse(b) ? a : b))
  return { since, dueMs: Date.parse(since) + segment.patrolIntervalDays * DAY_MS }
}
