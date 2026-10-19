import type { ContextSnapshot, PassState, PriorityScore, Severity } from '@safe-edge/contracts'

/** TRD "Patrol planner" step 2. The weights are a product hypothesis to tune with SDP. */
export const PRIORITY_WEIGHTS = { expiry: 0.25, reviewedFlag: 0.35, rain: 0.25, waterLevel: 0.15 } as const

/** A reading older than this many hours is stale, and its part scores unknown. A policy hypothesis to tune with SDP. */
export const MAX_INPUT_AGE_H = { pass: 24, flag: 24, rainfall: 3, water_level: 3 } as const

/** The expiry part rises from 0 to 1 over the 30 days a pass spends `expiring` (TRD state machine). */
const EXPIRING_DAYS = 30
const DAY_MS = 86_400_000
const HOUR_MS = 3_600_000

const SEVERITY_SCORE: Record<Severity, number> = { low: 1 / 3, medium: 2 / 3, high: 1 }

/** A segment's pass as read from the register at `readAt`. */
export interface PassReading {
  segmentId: string
  state: PassState
  validTo: string | null
  readAt: string
}

/** The highest human-reviewed severity among a segment's open findings, read at `readAt`; `null` when none is open. */
export interface FlagReading {
  segmentId: string
  severity: Severity | null
  readAt: string
}

/** The water-level gauge's status thresholds in metres (JPS Normal, Alert, Warning, Danger). */
export interface WaterLevelBands {
  alertM: number
  warningM: number
  dangerM: number
}

export interface ScoreInputs {
  /** The reference time for staleness. */
  now: string
  passes: PassReading[]
  flags: FlagReading[]
  /** The latest `rainfall` and `water_level` snapshots score the rain and water-level parts for every segment. */
  context: ContextSnapshot[]
  waterLevelBands: WaterLevelBands
}

/**
 * Scores one segment. A part whose reading is missing or stale is `null` ("unknown", asks for review), never 0, and
 * then the total is `null` too.
 */
export function scorePriority(segmentId: string, inputs: ScoreInputs): PriorityScore {
  const now = Date.parse(inputs.now)
  const fresh = (readAt: string, maxAgeH: number) => now - Date.parse(readAt) <= maxAgeH * HOUR_MS

  const pass = only(inputs.passes, segmentId, 'pass')
  const expiry = pass && fresh(pass.readAt, MAX_INPUT_AGE_H.pass) ? expiryScore(pass, now) : null

  const flag = only(inputs.flags, segmentId, 'flag')
  const reviewedFlag =
    flag && fresh(flag.readAt, MAX_INPUT_AGE_H.flag) ? (flag.severity ? SEVERITY_SCORE[flag.severity] : 0) : null

  const latest = (kind: 'rainfall' | 'water_level') => {
    const snapshot = inputs.context
      .filter((c) => c.kind === kind)
      .reduce<ContextSnapshot | null>((a, c) => (a && a.observedAt >= c.observedAt ? a : c), null)
    if (!snapshot || !fresh(snapshot.observedAt, MAX_INPUT_AGE_H[kind])) return null
    if (snapshot.validTo !== null && now > Date.parse(snapshot.validTo)) return null
    if (snapshot.value === null) throw new Error(`${kind} snapshot observed at ${snapshot.observedAt} has no value`)
    return snapshot.value
  }
  const rainMm = latest('rainfall')
  const rain = rainMm === null ? null : rainScore(rainMm)
  const levelM = latest('water_level')
  const waterLevel = levelM === null ? null : waterLevelScore(levelM, inputs.waterLevelBands)

  const parts = { expiry, reviewedFlag, rain, waterLevel }
  const known = Object.values(parts).every((p) => p !== null)
  return { ...parts, total: known ? weighted(parts, 0) : null }
}

/** The total for ranking: an unknown part counts as 1, so missing data moves a segment up rather than hiding it. */
export function rankingPriority(score: PriorityScore): number {
  return score.total ?? weighted(score, 1)
}

function weighted(parts: Omit<PriorityScore, 'total'>, unknownAs: number): number {
  const sum = (Object.keys(PRIORITY_WEIGHTS) as (keyof typeof PRIORITY_WEIGHTS)[]).reduce(
    (total, part) => total + PRIORITY_WEIGHTS[part] * (parts[part] ?? unknownAs),
    0
  )
  return Math.min(sum, 1) // the weights sum to 1; this only absorbs rounding
}

function expiryScore(pass: PassReading, now: number): number {
  if (pass.state === 'suspended' || pass.validTo === null) return 1
  const daysLeft = (Date.parse(pass.validTo) - now) / DAY_MS
  return Math.min(Math.max(1 - daysLeft / EXPIRING_DAYS, 0), 1)
}

/** JPS one-hour rainfall categories (TRD), treating a reading in mm/h as the hour's total. */
function rainScore(mm: number): number {
  if (mm < 1) return 0 // below "light"
  if (mm <= 10) return 0.25 // light, 1–10 mm
  if (mm <= 30) return 0.5 // moderate, 11–30 mm
  if (mm <= 60) return 0.75 // heavy, 31–60 mm
  return 1 // very heavy
}

function waterLevelScore(levelM: number, { alertM, warningM, dangerM }: WaterLevelBands): number {
  if (!(alertM < warningM && warningM < dangerM))
    throw new RangeError('water-level bands must rise alert < warning < danger')
  if (levelM >= dangerM) return 1
  if (levelM >= warningM) return 2 / 3
  if (levelM >= alertM) return 1 / 3
  return 0
}

function only<T extends { segmentId: string }>(readings: T[], segmentId: string, what: string): T | undefined {
  const matches = readings.filter((r) => r.segmentId === segmentId)
  if (matches.length > 1) throw new Error(`${matches.length} ${what} readings for ${segmentId}; expected at most one`)
  return matches[0]
}
