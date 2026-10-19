import type { Actor, EdgeEvent } from '@safe-edge/contracts'
import {
  AUTOMATION_ACTOR,
  createReplanSubscriber,
  queuedRetest,
  recordAutomationFailure,
  runSchedule,
  type AutomationStep,
  type Clock,
  type Core
} from '@safe-edge/core'
import { weatherTriggers } from '@safe-edge/planner'
import {
  bridgeDrone,
  createDroneSim,
  ELMINA_AREA,
  warningSnapshots,
  type DataGovMyClient,
  type SimDevice
} from '@safe-edge/providers'

/** Calls `run` every `ms` milliseconds: `setInterval` in a deployment, a timer the test fires by hand in tests. */
export type Every = (ms: number, run: () => void | Promise<void>) => void

/** How often the wall-clock API runs core's tick and the missed-patrol check. */
const SCHEDULE_MS = 60_000
/** How often the wall-clock API delivers drone-sim's events, which carry their own times. */
const DRONE_MS = 1_000
/** How often the API asks data.gov.my for warnings: one request, well inside its 4 a minute. */
const WEATHER_MS = 5 * 60_000
/** The seeded simulated drone provider, which reports what drone-sim sees. */
const DRONE_SIM: Actor = { type: 'provider', id: 'usr_drone_sim', role: 'provider', scopes: [] }

/**
 * The automation core supports, run inside the API. Core's re-plan subscriber reacts to every published event. A patrol
 * a pilot starts with provider `sim` flies on drone-sim, one simulated aircraft per dock and drone profile (`sim-1`,
 * …), whose events reach core through the drone bridge. On the wall clock, `every` delivers drone-sim's events every
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
  publish
}: {
  core: Core
  clock: Clock
  /** Whether the API runs on a scenario clock, which runs the automation when set, instead of on timers. */
  scenario: boolean
  every: Every | undefined
  weather: DataGovMyClient | undefined
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

  const read = <T>(result: { ok: true; data: T } | { ok: false; message: string }) => {
    if (!result.ok) throw new Error(result.message)
    return result.data
  }
  const profiles = read(core.dispatch('listDroneProfiles', AUTOMATION_ACTOR, {}))
  const devices = read(core.dispatch('listDocks', AUTOMATION_ACTOR, {})).flatMap((dock) =>
    dock.droneProfileIds.map((id) => {
      const drone = profiles.find((p) => p.id === id)
      if (drone === undefined) throw new Error(`${dock.id} takes ${id}, which is not a drone profile`)
      return { dock, drone }
    })
  )
  const sim = createDroneSim({
    clock,
    devices: devices.map(({ dock, drone }, i): SimDevice => ({
      id: `sim-${i + 1}`,
      name: `Simulated ${drone.name} on ${dock.name}`,
      dock,
      drone
    }))
  })
  const drone = bridgeDrone({
    provider: sim,
    dispatch: core.dispatch,
    actor: DRONE_SIM,
    publish,
    onFailure: (error) => recordAutomationFailure(core, 'drone', error)
  })
  const fly = async (patrolId: string) => {
    const patrol = read(core.dispatch('getPatrol', AUTOMATION_ACTOR, { params: { id: patrolId } }))
    if (patrol.provider !== 'sim')
      throw new Error(`This API flies only drone-sim; ${patrol.id} names ${patrol.provider}`)
    await drone.fly(patrol)
  }
  const flySim = () => attempt('drone', () => sim.tick())

  const replan = createReplanSubscriber({
    dispatch: core.dispatch,
    clock,
    committedTasks: drone.committedTasks,
    retest: queuedRetest(core),
    onFailure: (error) => recordAutomationFailure(core, 'replan', error)
  })
  subscribe((event) => {
    attempt('replan', () => publish(replan.onEvent(event)))
    if (event.type === 'edge.patrol.started.v1') {
      fly(event.data.patrolId).catch((error: unknown) => recordAutomationFailure(core, 'drone', error))
    }
  })

  // Live warnings are in force at wall-clock times, so a scenario clock never polls.
  const pollWeather = async (client: DataGovMyClient) => {
    const warnings = await client.warnings()
    const publisher = 'data.gov.my (MET Malaysia)'
    const snapshots = warningSnapshots({ publisher, warnings, simulated: false, source: 'provider' }, ELMINA_AREA)
    for (const trigger of weatherTriggers(snapshots, clock.now())) publish(replan.onTrigger(trigger))
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
    throw new Error('A scenario clock does not poll live weather; run the API on the wall clock to poll data.gov.my')
  }
  return {
    /** The scenario clock moved: run what the timers run on the wall clock, drone events first. */
    clockSet: () => {
      flySim()
      schedule()
    }
  }
}
