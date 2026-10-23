import type { DamageIssueType } from '@safe-edge/contracts'

/**
 * One past job of the park's repair history, standing in for the accepted repairs core has no seed for.
 * The forecast counts these beside genuine accepted journeys (#233) and says so when it did.
 */
export type PastRepair = {
  issueType: DamageIssueType
  /** Whole days from the job being raised to its re-test being accepted. */
  days: number
  sample: true
}

const repair = (issueType: DamageIssueType, days: number): PastRepair => ({ issueType, days, sample: true })

/**
 * Demo history: at least three jobs each for the three staged S1 issue types, so each reaches the
 * three-job minimum, and single odd jobs (debris) that leave their type without a forecast.
 */
export const PAST_REPAIRS: PastRepair[] = [
  repair('fence_missing', 4),
  repair('fence_missing', 6),
  repair('fence_missing', 5),
  repair('fence_missing', 9),
  repair('path_worn', 3),
  repair('path_worn', 5),
  repair('path_worn', 7),
  repair('ring_buoy_missing', 2),
  repair('ring_buoy_missing', 4),
  repair('ring_buoy_missing', 6),
  repair('debris', 1)
]
