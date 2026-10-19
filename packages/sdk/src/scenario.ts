import { PolicyRule, Timestamp, UserId, operations, type OperationId } from '@safe-edge/contracts'
import * as z from 'zod'

const operationIds = Object.keys(operations) as [OperationId, ...OperationId[]]

/**
 * One timed call in a scenario: who acts, which operation, its input. IDs made by earlier calls count from 1 after a
 * reset (`plan_1`, `cand_1`, …), so a scenario names them as literals. An event with `refusedWith` must be refused under
 * that rule. Operations the API handles (the agent's, which call Claude) run only against the API.
 */
export const ScenarioEvent = z.object({
  at: Timestamp,
  type: z.enum([
    'plan',
    'approval',
    'hold',
    'takeoff',
    'observation',
    'candidate',
    'decision',
    'task',
    'fix',
    'repair',
    'retest',
    'read',
    'report',
    'attempt'
  ]),
  as: UserId,
  operationId: z.enum(operationIds),
  input: z.object({
    params: z.record(z.string(), z.string()).optional(),
    query: z.record(z.string(), z.unknown()).optional(),
    body: z.unknown().optional()
  }),
  refusedWith: PolicyRule.optional(),
  note: z.string().min(1)
})
export type ScenarioEvent = z.infer<typeof ScenarioEvent>

/** A scripted, replayable demo story from `data/elmina/scenarios/` (S1 to S6 in the PRD). */
export const Scenario = z.object({
  id: z.enum(['s1', 's2', 's3', 's4', 's5', 's6']),
  title: z.string().min(1),
  summary: z.string().min(1),
  simulated: z.literal(true),
  source: z.literal('scenario'),
  /** The scenario this one continues from: the player plays it (and what it continues from) first. */
  after: z.enum(['s1', 's2', 's3', 's4', 's5']).nullable(),
  start: Timestamp,
  end: Timestamp,
  /** Calls that set the scene before the story starts, played at their times like the events. */
  setup: z.array(ScenarioEvent).default([]),
  events: z.array(ScenarioEvent),
  /** S6: the words painted on the sign. */
  signText: z.string().optional()
})
export type Scenario = z.infer<typeof Scenario>
