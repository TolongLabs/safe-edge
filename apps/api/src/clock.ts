import type { Clock } from '@safe-edge/core'

/** The API's clock. Only a scenario clock has `set`, which the setScenarioClock operation calls. */
export interface ApiClock extends Clock {
  set?: (now: string) => void
}

/** A clock that stays at `start` until it is set, like the one a scenario player hands the SDK memory transport. */
export function scenarioClock(start: string): Required<ApiClock> {
  let now = start
  return {
    now: () => now,
    set: (iso) => {
      now = iso
    }
  }
}

/**
 * The wall clock, or with `SAFE_EDGE_CLOCK=scenario` a scenario clock that starts at `start` (the seed's date) and
 * moves only when the scenario player sets it, so a replayed scenario's records carry its fixture's times. Production
 * (`NODE_ENV=production`) refuses the scenario clock.
 */
export function clockFrom(env: Record<string, string | undefined>, start: string): ApiClock {
  const { SAFE_EDGE_CLOCK: mode } = env
  if (mode === undefined) return { now: () => new Date().toISOString() }
  if (mode !== 'scenario') throw new Error(`SAFE_EDGE_CLOCK is scenario or unset, not ${mode}`)
  if (env.NODE_ENV === 'production') throw new Error('The API refuses the scenario clock in production')
  return scenarioClock(start)
}
