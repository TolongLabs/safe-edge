import { dispatchOrThrow, type Actor, type EdgeEvent } from '@safe-edge/contracts'
import type { Core } from './core.ts'
import { missedPatrolDue } from './policy.ts'
import type { ReplanSubscriberOptions } from './replan.ts'

/** The system running the checks a transport schedules, and recording the automation's failures. */
export const AUTOMATION_ACTOR: Actor = { type: 'system', id: 'core.automation', role: 'system', scopes: [] }

/** What a transport automates: the scheduled pass, re-planning, the weather poll and the drone bridge. */
export type AutomationStep = 'schedule' | 'replan' | 'weather' | 'drone'

/**
 * The time-driven pass at `now`, core's clock time: `tick` moves passes to expiring and expired, then every valid or
 * expiring pass whose segment has gone a whole patrol interval uninspected gets a missed patrol (`reportMissedPatrol`),
 * which suspends it. A suspended pass is not checked again, so repeating the pass reports each segment once. Returns
 * the events of every write it made, to publish. A missed patrol that fails is recorded (`recordAutomationFailure`)
 * and the other segments go on; only a failed `tick`, which writes nothing, throws.
 */
export function runSchedule(core: Pick<Core, 'dispatch' | 'tick' | 'recordStored'>, now: string): EdgeEvent[] {
  const events = core.tick(now)
  const attempt = (run: () => void) => {
    try {
      run()
    } catch (error) {
      recordAutomationFailure(core, 'schedule', error)
    }
  }
  attempt(() => {
    const passes = dispatchOrThrow(core.dispatch, 'listPasses', AUTOMATION_ACTOR, { query: {} }).data
    const byId = new Map(passes.map((p) => [p.id, p]))
    for (const segment of dispatchOrThrow(core.dispatch, 'listSegments', AUTOMATION_ACTOR, {}).data) {
      const pass = segment.passId === null ? undefined : byId.get(segment.passId)
      if (pass?.state !== 'valid' && pass?.state !== 'expiring') continue
      if (Date.parse(now) < missedPatrolDue(segment, pass).dueMs) continue
      attempt(() => {
        const missed = core.dispatch('reportMissedPatrol', AUTOMATION_ACTOR, { params: { id: segment.id } })
        if (!missed.ok) throw new Error(`reportMissedPatrol ${segment.id}: ${missed.message}`)
        events.push(...missed.events)
      })
    }
  })
  return events
}

/**
 * The re-test patrol a completed repair queues when no plan is open: from the township's first dock, with the first
 * drone it takes, under an assumed 60 m altitude cap (no cap has been agreed with air traffic control; the tests' figure).
 */
export function queuedRetest(core: Pick<Core, 'dispatch'>): ReplanSubscriberOptions['retest'] {
  const [dock] = dispatchOrThrow(core.dispatch, 'listDocks', AUTOMATION_ACTOR, {}).data
  if (dock === undefined || dock.droneProfileIds[0] === undefined) throw new Error('The seed has no dock with a drone')
  return { dockId: dock.id, droneProfileId: dock.droneProfileIds[0], altitudeCapM: 60 }
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
