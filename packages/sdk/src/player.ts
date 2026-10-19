import { operations, type PolicyRule } from '@safe-edge/contracts'
import type { PatrolPlanner } from '@safe-edge/core'
import { SafeEdgeDeniedError } from './errors.ts'
import { createMemoryClient, type MemoryClient } from './memory.ts'
import type { Scenario, ScenarioEvent } from './scenario.ts'

/** What playing one event did. */
export type Played =
  | { event: ScenarioEvent; outcome: 'done'; result: unknown }
  | { event: ScenarioEvent; outcome: 'refused'; rule: PolicyRule }
  /** The agent's operations call Claude, so only the API plays them; the memory transport skips them. */
  | { event: ScenarioEvent; outcome: 'needs_api' }

export interface ScenarioPlayer {
  readonly scenario: Scenario
  /** The demo the scenario plays on. `reset` and a backward seek replace it. */
  readonly client: MemoryClient
  /** Where playback is: the time a seek last reached. */
  readonly now: string
  /** Everything played since the last reset, the scenarios this one continues from included. */
  readonly played: readonly Played[]
  /** Plays on to `iso`; a time before `now` resets and replays to it. Resolves with what it played. */
  seek(iso: string): Promise<Played[]>
  /** Back to the scenario's start: a fresh demo, with the scenarios it continues from played through. */
  reset(): Promise<void>
  /**
   * Plays in real time until `pause` or the scenario's end: `speed` scenario seconds a second with a drone in the air,
   * and at least `GROUND_PLAYBACK_RATE` on the ground.
   */
  play(): void
  pause(): void
  setSpeed(speed: number): void
  readonly playing: boolean
  readonly speed: number
  /** Whether a patrol is in the air. */
  readonly airborne: boolean
  /** Called after every seek, play, pause and reset. Returns the unsubscribe function. */
  subscribe(listener: () => void): () => void
}

export interface ScenarioPlayerOptions {
  /** Every scenario, so `after` can name the one a scenario continues from. */
  scenarios: readonly Scenario[]
  id: Scenario['id']
  /** The Elmina planner (`createElminaPlanner`), for the scenarios that plan a patrol. */
  planner?: PatrolPlanner
  /** Scenario seconds per real second; 1 by default. */
  speed?: number
  /** Real-time frames for `play`; animation frames by default. Returns the function that stops them. */
  frames?: (onFrame: (elapsedMs: number) => void) => () => void
}

/** The fixed step the clock ticks at while a drone is in the air, in scenario milliseconds. */
export const FLIGHT_STEP_MS = 200
/** The fixed step it ticks at on the ground: passes expire and patrols fall due between events. */
export const GROUND_STEP_MS = 600_000
/** On the ground, real-time playback runs at least this fast (two scenario hours a second), so holds pass quickly. */
export const GROUND_PLAYBACK_RATE = 7_200

/**
 * Plays a scenario on the SDK's memory transport with a deterministic, fixed-step clock. The clock ticks the demo only
 * at fixed grid points from the scenario's start (every `FLIGHT_STEP_MS` with a drone in the air, every
 * `GROUND_STEP_MS` otherwise) and runs each event at its own time, so a run is the same however playback is chunked:
 * play, pause, scrub and speed change only how fast it gets there.
 */
export async function createScenarioPlayer(options: ScenarioPlayerOptions): Promise<ScenarioPlayer> {
  const scenario = byId(options.scenarios, options.id)
  const chain = continuesFrom(options.scenarios, scenario)
  const start = Date.parse(scenario.start)
  const end = Date.parse(scenario.end)
  const frames = options.frames ?? animationFrames
  const listeners = new Set<() => void>()
  const notify = () => listeners.forEach((l) => l())

  let clock = start
  let position = start
  let client: MemoryClient
  let queue: ScenarioEvent[] = []
  let played: Played[] = []
  let airborne = 0
  let speed = options.speed ?? 1
  let stopFrames: (() => void) | null = null
  // One seek at a time: frames, scrubs and resets queue behind each other.
  let busy: Promise<unknown> = Promise.resolve()
  const serial = <T>(work: () => Promise<T>): Promise<T> => {
    const next = busy.then(work)
    busy = next.catch(() => undefined)
    return next
  }

  const run = async (event: ScenarioEvent): Promise<Played> => {
    if (operations[event.operationId].handledBy !== 'core') return { event, outcome: 'needs_api' }
    const call = (client.as(event.as) as unknown as Record<string, (input: unknown) => Promise<unknown>>)[
      event.operationId
    ]!
    try {
      const result = await call(event.input)
      if (event.refusedWith) throw new Error(`${event.operationId} at ${event.at} should be refused but was not`)
      return { event, outcome: 'done', result }
    } catch (error) {
      if (event.refusedWith && error instanceof SafeEdgeDeniedError && error.rule === event.refusedWith) {
        return { event, outcome: 'refused', rule: error.rule }
      }
      throw new Error(`${event.operationId} by ${event.as} at ${event.at} failed: ${(error as Error).message}`, {
        cause: error
      })
    }
  }

  /** Ticks every grid point up to `to`, running each event at its own time on the way. */
  const advance = async (to: number) => {
    const done: Played[] = []
    for (;;) {
      const step = airborne > 0 ? FLIGHT_STEP_MS : GROUND_STEP_MS
      const grid = start + (Math.floor((clock - start) / step) + 1) * step
      const next = queue[0] ? Date.parse(queue[0].at) : Infinity
      if (next <= Math.min(grid, to)) {
        clock = next
        done.push(await run(queue.shift()!))
        continue
      }
      if (grid > to) break
      clock = grid
      await client.tick(new Date(clock).toISOString())
    }
    played.push(...done)
    return done
  }

  const reset = async () => {
    client = createMemoryClient({
      transport: 'memory',
      userId: 'usr_manager',
      planner: options.planner,
      clock: { now: () => new Date(clock).toISOString() }
    })
    airborne = 0
    client.subscribe((event) => {
      if (event.type === 'edge.patrol.started.v1') airborne++
      if (event.type === 'edge.patrol.completed.v1') airborne--
    })
    played = []
    // The scenarios this one continues from, played through to their ends, then this one's setup and events.
    for (const before of chain) {
      clock = Date.parse(before.start)
      queue = timeline(before)
      await advance(Date.parse(before.end))
    }
    clock = Math.max(clock, start)
    position = start
    queue = timeline(scenario)
    await advance(start)
  }
  await reset()

  const seek = (iso: string) =>
    serial(async () => {
      const target = Math.min(Date.parse(iso), end)
      if (target < position) await reset()
      const done = await advance(target)
      position = Math.max(position, target)
      notify()
      return done
    })

  const pause = () => {
    stopFrames?.()
    stopFrames = null
    notify()
  }

  return {
    scenario,
    get client() {
      return client
    },
    get now() {
      return new Date(position).toISOString()
    },
    get played() {
      return played
    },
    seek,
    reset: () =>
      serial(async () => {
        pause()
        await reset()
        notify()
      }),
    play() {
      if (stopFrames) return
      if (position >= end) void seek(scenario.start)
      // Frames add up the real time that passed; one seek at a time spends it, from wherever playback is by then, so a
      // frame queued before a pause or a scrub never moves the clock afterwards.
      let owedMs = 0
      let seeking = false
      stopFrames = frames((elapsedMs) => {
        owedMs += elapsedMs
        if (seeking) return
        seeking = true
        void serial(async () => {
          if (!stopFrames) return
          const rate = airborne > 0 ? speed : Math.max(speed, GROUND_PLAYBACK_RATE)
          const target = Math.min(position + owedMs * rate, end)
          owedMs = 0
          await advance(target)
          position = Math.max(position, target)
          if (position >= end) {
            stopFrames?.()
            stopFrames = null
          }
          notify()
        }).finally(() => (seeking = false))
      })
      notify()
    },
    pause,
    setSpeed(next) {
      if (!(next > 0)) throw new Error(`Speed must be above 0, not ${next}`)
      speed = next
      notify()
    },
    get playing() {
      return stopFrames !== null
    },
    get speed() {
      return speed
    },
    get airborne() {
      return airborne > 0
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    }
  }
}

function byId(scenarios: readonly Scenario[], id: Scenario['id']) {
  const found = scenarios.find((s) => s.id === id)
  if (!found) throw new Error(`No scenario ${id}; have ${scenarios.map((s) => s.id).join(', ')}`)
  return found
}

/** The scenarios `scenario` continues from, earliest first. */
function continuesFrom(scenarios: readonly Scenario[], scenario: Scenario): Scenario[] {
  const chain: Scenario[] = []
  for (let s = scenario; s.after !== null;) {
    s = byId(scenarios, s.after)
    if (chain.includes(s)) throw new Error(`Scenario ${scenario.id} continues from itself through ${s.id}`)
    chain.unshift(s)
  }
  return chain
}

/** A scenario's setup and events in time order; setup first where they share a time. */
function timeline(scenario: Scenario): ScenarioEvent[] {
  return [...scenario.setup, ...scenario.events].toSorted((a, b) => Date.parse(a.at) - Date.parse(b.at))
}

function animationFrames(onFrame: (elapsedMs: number) => void): () => void {
  let last = performance.now()
  let id = requestAnimationFrame(function frame(time) {
    onFrame(time - last)
    last = time
    id = requestAnimationFrame(frame)
  })
  return () => cancelAnimationFrame(id)
}
