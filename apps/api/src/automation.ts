import type { EdgeEvent } from '@safe-edge/contracts'
import {
  createReplanSubscriber,
  queuedRetest,
  recordAutomationFailure,
  runSchedule,
  type AutomationStep,
  type Core
} from '@safe-edge/core'
import type { ApiClock } from './clock.ts'

/** Calls `run` every `ms` milliseconds: `setInterval` in a deployment, a timer the test fires by hand in tests. */
export type Every = (ms: number, run: () => void | Promise<void>) => void

/** How often the wall-clock API runs core's tick and the missed-patrol check. */
const SCHEDULE_MS = 60_000

/**
 * The automation core supports, run inside the API. Core's re-plan subscriber reacts to every published event. On the
 * wall clock, `every` repeats the scheduled pass (core's tick, then missed patrols); on a scenario clock, each
 * `clockSet()` runs it instead. A step that fails is recorded (`recordAutomationFailure`: the audit chain and the log)
 * and the API carries on.
 */
export function startAutomation({
  core,
  clock,
  every,
  subscribe,
  publish
}: {
  core: Core
  clock: ApiClock
  every: Every | undefined
  subscribe: (listener: (event: EdgeEvent) => void) => void
  publish: (events: EdgeEvent[]) => void
}) {
  const attempt = (step: AutomationStep, run: () => void) => {
    try {
      run()
    } catch (error) {
      recordAutomationFailure(core, step, error)
    }
  }
  const schedule = () => attempt('schedule', () => publish(runSchedule(core, clock.now())))

  const replan = createReplanSubscriber({
    dispatch: core.dispatch,
    clock,
    committedTasks: (patrol) => {
      throw new Error(`No drone reports ${patrol.id}'s progress`)
    },
    retest: queuedRetest(core)
  })
  subscribe((event) => attempt('replan', () => publish(replan.onEvent(event))))

  if (clock.set === undefined) {
    if (every === undefined) throw new Error('An API on the wall clock needs `every` to run its automation')
    every(SCHEDULE_MS, schedule)
  }
  return {
    /** The scenario clock moved: run what the timer runs on the wall clock. */
    clockSet: schedule
  }
}
