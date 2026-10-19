import * as z from 'zod'
import { named } from './primitives.ts'

export const ActorType = named('ActorType', z.enum(['user', 'agent', 'system', 'provider']))
export type ActorType = z.infer<typeof ActorType>

/** PRD API-2 roles plus the TRD's non-human callers (system, provider, integrator) and the field crew. */
export const Role = named(
  'Role',
  z.enum([
    'manager',
    'engineer',
    'reviewer',
    'installer',
    'pilot',
    'gm',
    'crew',
    'integrator',
    'agent',
    'system',
    'provider'
  ])
)
export type Role = z.infer<typeof Role>

/**
 * The scopes an agent token may carry (TRD "Agent layer"). The approving scopes the TRD names
 * (edge.pass.accept, repair.verify, workorder.submit, notice.send) are deliberately absent, so no token can hold them.
 */
export const Scope = z.enum([
  'edge.read',
  'inspection.read',
  'finding.propose',
  'workorder.draft',
  'notice.draft',
  'patrol.propose'
])
export type Scope = z.infer<typeof Scope>

/** Who is acting. Bearer tokens map to an Actor; the memory transport builds one with `client.as(userId)`. */
export const Actor = named(
  'Actor',
  z.object({ type: ActorType, id: z.string().min(1), role: Role, scopes: z.array(Scope) })
)
export type Actor = z.infer<typeof Actor>

/** Who drafted a record: a person or the agent. */
export const ActorRef = named('ActorRef', z.object({ type: ActorType, id: z.string().min(1) }))
export type ActorRef = z.infer<typeof ActorRef>

/** The policy rule that refused an action (TRD "State machines and policy" plus access checks). */
export const PolicyRule = named(
  'PolicyRule',
  z.enum([
    'role_forbidden',
    'scope_missing',
    'one_way_rule',
    'two_person_rule',
    'agents_draft_only',
    'invalid_transition',
    'remedy_not_approved',
    'plan_not_approved',
    'plan_superseded',
    'weather_hold',
    'separation_hold',
    'outside_window',
    'invalid_coverage',
    'clock_backwards'
  ])
)
export type PolicyRule = z.infer<typeof PolicyRule>

/** A refused action. Returned (never thrown) by core, appended to the audit chain, and sent as the HTTP 403 body. */
export const Denial = named('Denial', z.object({ ok: z.literal(false), rule: PolicyRule, message: z.string() }))
export type Denial = z.infer<typeof Denial>

/** Non-policy failures. `not_found` comes from core; the others come from the HTTP API (400, 401, 404, 422, 501). */
export const ApiError = named(
  'ApiError',
  z.object({
    ok: z.literal(false),
    error: z.enum([
      'invalid_input',
      'unauthenticated',
      'not_found',
      'idempotency_conflict',
      'not_implemented',
      'agent_stopped'
    ]),
    message: z.string()
  })
)
export type ApiError = z.infer<typeof ApiError>
