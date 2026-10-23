import type { RepairJourney } from '@safe-edge/contracts'
import { PAST_REPAIRS } from '../../sample/past-repairs'
import { issueTypeOf } from './reports'

export type { RepairJourney } from '@safe-edge/contracts'

const DAY_MS = 24 * 3600 * 1000
const MIN_JOBS = 3

const daysOf = (journey: RepairJourney): number | null => {
  if (journey.workOrder?.status !== 'accepted') return null
  const retest = journey.retest
  if (retest === null || retest.result !== 'accepted') return null
  const raisedAt = journey.report?.reportedAt ?? journey.candidate.raisedAt
  const ms = new Date(retest.recordedAt).getTime() - new Date(raisedAt).getTime()
  if (!Number.isFinite(ms) || ms <= 0) return null
  return ms / DAY_MS
}

const round = (days: number) => Math.round(days)
const word = (n: number) => (n === 1 ? 'day' : 'days')

/**
 * What past repairs of the same issue type took, without any model: min–max and median in whole days over
 * genuine accepted journeys (no duplicate work order, a positive duration from raised to accepted re-test,
 * the current job only once it is genuinely accepted too) plus the sample past repairs of that type.
 * Null when the type has fewer than four unknowns and three matching past jobs to speak of (#233).
 */
export function forecastFor(journey: RepairJourney, journeys: RepairJourney[]): string | null {
  const issueType = issueTypeOf(journey.candidate, journey.report)
  if (issueType === null) return null

  const seenWorkOrders = new Set<string>()
  const days: number[] = []
  for (const past of [journey, ...journeys]) {
    const workOrder = past.workOrder
    if (!workOrder || seenWorkOrders.has(workOrder.id)) continue
    seenWorkOrders.add(workOrder.id)
    if (issueTypeOf(past.candidate, past.report) !== issueType) continue
    const daysTaken = daysOf(past)
    if (daysTaken !== null) days.push(daysTaken)
  }
  const samples = PAST_REPAIRS.filter((p) => p.issueType === issueType).map((p) => p.days)

  const pool = [...days, ...samples]
  if (pool.length < MIN_JOBS) return null
  const sorted = [...pool].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  const median = sorted.length % 2 === 1 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2
  const min = sorted[0]!
  const max = sorted[sorted.length - 1]!
  const span =
    round(min) === round(max)
      ? `Usually ${round(min)} ${word(round(min))}`
      : `Usually ${round(min)}–${round(max)} ${word(round(max))}`
  return `${span} (median ${round(median)}), from ${pool.length} past jobs${samples.length > 0 ? ', includes sample data' : ''}`
}
