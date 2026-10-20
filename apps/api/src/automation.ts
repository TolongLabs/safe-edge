import { dispatchOrThrow, type EdgeEvent } from '@safe-edge/contracts'
import {
  AUTOMATION_ACTOR,
  recordAutomationFailure,
  runSchedule,
  startReplanning,
  type AutomationStep,
  type Clock,
  type Core
} from '@safe-edge/core'
import { weatherTriggers } from '@safe-edge/planner'
import {
  DRONE_SIM_ACTOR,
  ELMINA_AREA,
  hostDroneSim,
  warningSnapshots,
  type DataGovMyClient
} from '@safe-edge/providers'

/** Calls `run` every `ms` milliseconds: `setInterval` in a deployment, a timer the test fires by hand in tests. */
export type Every = (ms: number, run: () => void | Promise<void>) => void

/** How often the wall-clock API runs core's tick and the missed-patrol check. */
const SCHEDULE_MS = 60_000
/** How often the wall-clock API delivers drone-sim's events, which carry their own times. */
const DRONE_MS = 1_000
/** How often the API asks data.gov.my for warnings: one request, well inside its 4 a minute. */
const WEATHER_MS = 5 * 60_000

/**
 * The automation core supports, run inside the API. Core's re-plan subscriber reacts to every published event. A patrol
 * a pilot starts with provider `sim` flies on drone-sim, one simulated aircraft per dock and drone profile (`sim-1`,
 * …), whose events reach core through the drone bridge (`hostDroneSim`); `planChanged()` hands it re-plans the pilot
 * approves and holds the pilot releases. The simulated aircraft live in this process: `interrupted()` completes, as
 * interrupted, every sim patrol a stopped process left in flight. On the wall clock, `every` delivers drone-sim's events every
 * second and runs the scheduled pass (core's tick, then missed patrols) every minute; on a scenario clock, each
 * `clockSet()` does both instead. With `weather` (wall clock only), it polls data.gov.my every 5 minutes through the
 * client's rate limiter, and each warning in force for Elmina re-plans the open plans. A step that fails is recorded
 * (`recordAutomationFailure`: the audit chain and the log) and the API carries on.
 */
export function startAutomation({
  core,
  clock,
  scenario,
  every,
  weather,
  subscribe,
  publish,
  atomic
}: {
  core: Core
  clock: Clock
  /** Whether the API runs on a scenario clock, which runs the automation when set, instead of on timers. */
  scenario: boolean
  every: Every | undefined
  weather: DataGovMyClient | undefined
  subscribe: (listener: (event: EdgeEvent) => void) => void
  publish: (events: EdgeEvent[]) => void
  /** The journal's `atomic`: writes inside it commit together or not at all. */
  atomic: <R>(run: () => R, alongside: (result: R) => void) => R
}) {
  const attempt = (step: AutomationStep, run: () => void) => {
    try {
      run()
    } catch (error) {
      recordAutomationFailure(core, step, error)
    }
  }
  const schedule = () => attempt('schedule', () => publish(runSchedule(core, clock.now())))

  const drone = hostDroneSim({
    dispatch: core.dispatch,
    clock,
    actor: AUTOMATION_ACTOR,
    publish,
    onFailure: (error) => recordAutomationFailure(core, 'drone', error)
  })
  const flySim = () => attempt('drone', () => drone.tick())

  const replan = startReplanning({ core, clock, committedTasks: drone.committedTasks, publish })
  subscribe((event) => {
    replan.onEvent(event)
    drone.onEvent(event)
  })

  // Live warnings are in force at wall-clock times, so a scenario clock never polls.
  const pollWeather = async (client: DataGovMyClient) => {
    const warnings = await client.warnings()
    const publisher = 'data.gov.my (MET Malaysia)'
    const snapshots = warningSnapshots({ publisher, warnings, simulated: false, source: 'provider' }, ELMINA_AREA)
    for (const trigger of weatherTriggers(snapshots, clock.now())) replan.onTrigger(trigger)
  }

  if (!scenario) {
    if (every === undefined) throw new Error('An API on the wall clock needs `every` to run its automation')
    every(DRONE_MS, flySim)
    every(SCHEDULE_MS, schedule)
    if (weather !== undefined) {
      every(WEATHER_MS, () =>
        pollWeather(weather).catch((error: unknown) => recordAutomationFailure(core, 'weather', error))
      )
    }
  } else if (weather !== undefined) {
    throw new Error(
      'A scenario clock does not poll live weather; run the API on the wall clock (SAFE_EDGE_CLOCK=wall) to poll data.gov.my'
    )
  }
  return {
    /** The scenario clock moved: run what the timers run on the wall clock, drone events first. */
    clockSet: () => {
      flySim()
      schedule()
    },
    /** The pilot approved a plan or released a hold: the drone flies its patrol's plan as core now records it. */
    planChanged: drone.planChanged,
    /**
     * After replay: the last process stopped with these sim patrols in the air, and its simulated aircraft with it, so
     * nothing reports where they got to. Each is completed as drone-sim, with nothing reported (every planned segment
     * unknown, so core opens field checks), and the interruption recorded, both in one transaction.
     */
    interrupted: () => {
      const flying = dispatchOrThrow(core.dispatch, 'listPatrols', AUTOMATION_ACTOR, {}).data.filter(
        (p) => p.status === 'in_flight' && p.provider === 'sim'
      )
      for (const patrol of flying) {
        const completed = atomic(
          () => {
            const message = `${patrol.id} was in flight on drone-sim when the API stopped; the simulated drone stopped with it, so the patrol is completed with every segment unknown`
            recordAutomationFailure(core, 'drone', new Error(message))
            return dispatchOrThrow(core.dispatch, 'completePatrol', DRONE_SIM_ACTOR, {
              params: { id: patrol.id },
              body: { coverage: [] }
            })
          },
          () => {}
        )
        publish(completed.events)
      }
    }
  }
}
