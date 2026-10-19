import type { ContextSnapshot, PatrolPlan, PlanHold } from '@safe-edge/contracts'
import type { Position } from 'geojson'
import { MAX_INPUT_AGE_H } from './score.ts'

const DEG = Math.PI / 180
const DAY_MS = 86_400_000
const HOUR_MS = 3_600_000
const MINUTE_MS = 60_000
/** JPS one-hour "heavy" rain starts above 30 mm. */
const HEAVY_RAIN_MM_PER_H = 30
/** Heavy rain this recent keeps the launch for a morning that is dry from first light. */
const HEAVY_RAIN_LOOKBACK_MS = 24 * HOUR_MS
/** How many mornings to try before giving up. */
const MAX_MORNINGS = 14
/** Civil twilight starts when the sun's centre is 6° below the horizon: a zenith angle of 96°. */
const CIVIL_DAWN_ZENITH_DEG = 96

/**
 * First light at `[lon, lat]`: the first start of morning civil twilight at or after `after`. Uses NOAA's solar
 * equations (from Meeus, "Astronomical Algorithms"; gml.noaa.gov/grad/solcalc), so it needs no network.
 */
export function firstLightAfter(at: Position, after: string): string {
  const afterMs = Date.parse(after)
  const midnight = Math.floor(afterMs / DAY_MS) * DAY_MS
  // East of Greenwich, a UTC day's civil dawn can fall on the previous UTC day, so look one day either side.
  for (const day of [-1, 0, 1, 2]) {
    const dawn = civilDawn(at, midnight + day * DAY_MS)
    if (dawn >= afterMs) return new Date(Math.round(dawn)).toISOString()
  }
  throw new Error(`no civil dawn within two days after ${after} at ${at.join(', ')}`)
}

/** Civil dawn on the UTC day starting at `midnightMs`, in epoch milliseconds. */
function civilDawn(at: Position, midnightMs: number): number {
  const [lon, lat] = at as [number, number]
  let dawn = midnightMs + DAY_MS / 2 - (lon / 360) * DAY_MS
  // The sun's position is evaluated at the estimate and then at the refined time, as NOAA's day sheet does per row.
  for (let i = 0; i < 2; i++) {
    const { declination, equationOfTimeMin } = sunAt(dawn)
    const hourAngleDeg =
      Math.acos(
        Math.cos(CIVIL_DAWN_ZENITH_DEG * DEG) / (Math.cos(lat * DEG) * Math.cos(declination)) -
          Math.tan(lat * DEG) * Math.tan(declination)
      ) / DEG
    dawn = midnightMs + (720 - 4 * lon - equationOfTimeMin - 4 * hourAngleDeg) * MINUTE_MS
  }
  return dawn
}

/** NOAA solar calculation columns G to V at an instant: the sun's declination and the equation of time. */
function sunAt(ms: number) {
  const jc = (ms / DAY_MS + 2_440_587.5 - 2_451_545) / 36_525
  const meanLong = (280.46646 + jc * (36000.76983 + jc * 0.0003032)) % 360
  const meanAnom = 357.52911 + jc * (35999.05029 - 0.0001537 * jc)
  const eccentricity = 0.016708634 - jc * (0.000042037 + 0.0000001267 * jc)
  const centre =
    Math.sin(meanAnom * DEG) * (1.914602 - jc * (0.004817 + 0.000014 * jc)) +
    Math.sin(2 * meanAnom * DEG) * (0.019993 - 0.000101 * jc) +
    Math.sin(3 * meanAnom * DEG) * 0.000289
  const node = (125.04 - 1934.136 * jc) * DEG
  const apparentLong = (meanLong + centre - 0.00569 - 0.00478 * Math.sin(node)) * DEG
  const obliquity =
    (23 + (26 + (21.448 - jc * (46.815 + jc * (0.00059 - jc * 0.001813))) / 60) / 60 + 0.00256 * Math.cos(node)) * DEG
  const y = Math.tan(obliquity / 2) ** 2
  const [l0, m, e] = [meanLong * DEG, meanAnom * DEG, eccentricity]
  const equationOfTimeMin =
    (4 / DEG) *
    (y * Math.sin(2 * l0) -
      2 * e * Math.sin(m) +
      4 * e * y * Math.sin(m) * Math.cos(2 * l0) -
      0.5 * y * y * Math.sin(4 * l0) -
      1.25 * e * e * Math.sin(2 * m))
  return { declination: Math.asin(Math.sin(obliquity) * Math.sin(apparentLong)), equationOfTimeMin }
}

export interface WindowInput {
  /** The sun is calculated for the dock's position. */
  at: Position
  /** The launch is no earlier than this. */
  notBefore: string
  /** How long the agreed window stays open after first light. */
  windowMinutes: number
  /** The dock's limit: no launch above it. */
  rainLimitMmPerH: number
  /** `rainfall` readings and `lightning_warning`s; other kinds are ignored here. */
  context: ContextSnapshot[]
}

export interface FlightWindow {
  window: PatrolPlan['window']
  /** The `weather` and `lightning` holds that moved the launch past the first window's opening. */
  holds: PlanHold[]
}

/**
 * Picks the launch: the earliest time, no sooner than `notBefore`, inside a window that opens at first light and lasts
 * `windowMinutes`, when the weather gate passes. The gate fails while a rain reading above the dock's limit counts (until
 * its `validTo`, or for `MAX_INPUT_AGE_H.rainfall` hours) or a lightning warning is in force. Rain nobody has measured
 * does not block the plan; the dock checks the weather again at launch. After heavy rain (above 30 mm in the hour, the
 * JPS "heavy" band) in the 24 hours before a launch, the launch must come from a morning that is dry from first light.
 */
export function flightWindow({ at, notBefore, windowMinutes, rainLimitMmPerH, context }: WindowInput): FlightWindow {
  const rain = context.filter((c) => c.kind === 'rainfall')
  for (const r of rain)
    if (r.value === null) throw new Error(`rainfall reading observed at ${r.observedAt} has no value`)
  const warnings = context.filter((c) => c.kind === 'lightning_warning')
  for (const w of warnings) {
    if (w.validTo === null)
      throw new Error(`lightning warning observed at ${w.observedAt} has no validTo, so it never ends`)
  }
  const ms = Date.parse
  const rainEnds = (r: ContextSnapshot) =>
    r.validTo ? ms(r.validTo) : ms(r.observedAt) + MAX_INPUT_AGE_H.rainfall * HOUR_MS
  const rainAt = (t: number) => {
    const latest = rain
      .filter((r) => ms(r.observedAt) <= t)
      .reduce<ContextSnapshot | null>((a, r) => (a && a.observedAt >= r.observedAt ? a : r), null)
    return latest && t < rainEnds(latest) ? latest : null
  }
  const blockers = (t: number) => {
    const reading = rainAt(t)
    return [
      ...(reading && reading.value! > rainLimitMmPerH ? [reading] : []),
      ...warnings.filter((w) => ms(w.observedAt) <= t && t < ms(w.validTo!))
    ]
  }
  const heavyBefore = (t: number) =>
    rain.find(
      (r) => r.value! > HEAVY_RAIN_MM_PER_H && t - HEAVY_RAIN_LOOKBACK_MS <= ms(r.observedAt) && ms(r.observedAt) <= t
    )
  // The gate can only lift when a reading arrives or stops counting, or a warning ends.
  const changes = [...rain.flatMap((r) => [ms(r.observedAt), rainEnds(r)]), ...warnings.map((w) => ms(w.validTo!))]

  const blocked = new Set<ContextSnapshot>()
  let heavy: ContextSnapshot | undefined
  // The first window still open just after `notBefore`.
  let after = ms(notBefore) - windowMinutes * MINUTE_MS + 1
  for (let morning = 0; morning < MAX_MORNINGS; morning++) {
    const open = ms(firstLightAfter(at, new Date(after).toISOString()))
    const close = open + windowMinutes * MINUTE_MS
    const earliest = Math.max(open, ms(notBefore))
    const fromFirstLight = [open, ...changes.filter((t) => t > open && t < close)]
    const launches = [...new Set([earliest, ...fromFirstLight.filter((t) => t > earliest)])].toSorted((a, b) => a - b)
    for (const t of launches) {
      const now = blockers(t)
      now.forEach((b) => blocked.add(b))
      if (now.length > 0) continue
      const heavyRain = heavyBefore(t)
      if (heavyRain && fromFirstLight.some((u) => u <= t && blockers(u).length > 0)) {
        heavy = heavyRain
        break
      }
      return {
        window: {
          start: new Date(t).toISOString(),
          end: new Date(close).toISOString(),
          reason: blocked.size > 0 || heavy ? 'next_dry_window' : 'first_light'
        },
        holds: weatherHolds(new Date(t).toISOString(), [...blocked], heavy, rainLimitMmPerH)
      }
    }
    after = open + 1
  }
  throw new Error(`the weather gate fails in every window for ${MAX_MORNINGS} mornings from ${notBefore}`)
}

function weatherHolds(
  launch: string,
  blocked: ContextSnapshot[],
  heavy: ContextSnapshot | undefined,
  rainLimitMmPerH: number
): PlanHold[] {
  const byTime = (a: ContextSnapshot, b: ContextSnapshot) => a.observedAt.localeCompare(b.observedAt)
  const rain = blocked.filter((b) => b.kind === 'rainfall').toSorted(byTime)
  const lightning = blocked.filter((b) => b.kind === 'lightning_warning').toSorted(byTime)
  const holds: PlanHold[] = []
  if (rain.length > 0 || heavy) {
    const reasons = rain.map(
      (r) =>
        `rain ${r.value} mm/h at ${r.publisher}${r.stationId ? ` station ${r.stationId}` : ''} (observed ${r.observedAt}) is above the dock's ${rainLimitMmPerH} mm/h limit`
    )
    if (heavy) {
      reasons.push(
        `after heavy rain (observed ${heavy.observedAt}) the launch waits for a morning that is dry from first light`
      )
    }
    holds.push({
      kind: 'weather',
      segmentId: null,
      until: launch,
      reason: reasons.join('; '),
      releasedBy: null,
      releasedAt: null
    })
  }
  if (lightning.length > 0) {
    holds.push({
      kind: 'lightning',
      segmentId: null,
      until: lightning.map((w) => w.validTo!).reduce((a, b) => (a > b ? a : b)),
      reason: lightning
        .map(
          (w) =>
            `lightning warning from ${w.publisher} (observed ${w.observedAt}) is in force until ${w.validTo}${w.text ? `: "${w.text}"` : ''}`
        )
        .join('; '),
      releasedBy: null,
      releasedAt: null
    })
  }
  return holds
}
