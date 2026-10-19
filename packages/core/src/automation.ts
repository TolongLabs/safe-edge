import type { Actor, EdgeEvent } from '@safe-edge/contracts'
import type { Core } from './core.ts'
import { missedPatrolDue } from './policy.ts'

/** The system running the checks a transport schedules, and recording the automation's failures. */
export const AUTOMATION_ACTOR: Actor = { type: 'system', id: 'core.automation', role: 'system', scopes: [] }

/** What a transport automates: the scheduled pass, re-planning, the weather poll and the drone bridge. */
export type AutomationStep = 'schedule' | 'replan' | 'weather' | 'drone'

/**
 * The time-driven pass at `now`, core's clock time: `tick` moves passes to expiring and expired, then every valid or
 * expiring pass whose segment has gone a whole patrol interval uninspected gets a missed patrol (`reportMissedPatrol`),
 * which suspends it. A suspended pass is not checked again, so repeating the pass reports each segment once. Returns
 * the events to publish.
 */
export function runSchedule(core: Pick<Core, 'dispatch' | 'tick'>, now: string): EdgeEvent[] {
  const events = core.tick(now)
  const read = <T>(result: { ok: true; data: T } | { ok: false; message: string }) => {
    if (!result.ok) throw new Error(result.message)
    return result.data
  }
  const passes = new Map(read(core.dispatch('listPasses', AUTOMATION_ACTOR, { query: {} })).map((p) => [p.id, p]))
  for (const segment of read(core.dispatch('listSegments', AUTOMATION_ACTOR, {}))) {
    const pass = segment.passId === null ? undefined : passes.get(segment.passId)
    if (pass?.state !== 'valid' && pass?.state !== 'expiring') continue
    if (Date.parse(now) < missedPatrolDue(segment, pass).dueMs) continue
    const missed = core.dispatch('reportMissedPatrol', AUTOMATION_ACTOR, { params: { id: segment.id } })
    if (!missed.ok) throw new Error(`reportMissedPatrol ${segment.id}: ${missed.message}`)
    events.push(...missed.events)
  }
  return events
}

/**
 * Records a failed automation step where people can read it: on the audit chain as `runAutomation` by the system, with
 * subject `automation` (`GET /v1/audit?subject=automation`), and in the log.
 */
export function recordAutomationFailure(core: Pick<Core, 'recordStored'>, step: AutomationStep, error: unknown): void {
  console.error(`Safe Edge automation: ${step} failed`, error)
  const failure = { id: 'automation', step, error: error instanceof Error ? error.message : String(error) }
  core.recordStored('runAutomation', AUTOMATION_ACTOR, failure)
}
