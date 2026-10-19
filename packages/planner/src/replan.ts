import type { ContextSnapshot, PatrolPlan, ReplanTrigger } from '@safe-edge/contracts'
import { buildPlan, planFresh, type PatrolPlanInput } from './patrol.ts'
import { rainCategory } from './score.ts'
import { rainAt } from './window.ts'

export interface PatrolProgress {
  /** Leading route stops (`plan.tasks`, in order) already flown or in progress. They stay exactly as planned. */
  committedTasks: number
}

/**
 * Re-plans the uncommitted part of `plan` after `trigger` (TRD "Patrol planner" step 5). The committed stops and every
 * waypoint up to the last committed station stay as they were; the rest of `input.segments` is scored and routed again
 * from there, within the battery and window left. A drone in flight comes home after its committed stops while rain
 * above the dock's limit or lightning holds. With nothing committed the plan starts over, window included. `plan` is
 * null when the trigger queues a patrol and no plan is open. A weather trigger adds its reading or warning to the
 * context. The result is a new proposed plan with ID `input.id`: a pilot approves it before it flies.
 */
export function replan(
  plan: PatrolPlan | null,
  progress: PatrolProgress,
  input: PatrolPlanInput,
  trigger: ReplanTrigger
): PatrolPlan {
  const committed = progress.committedTasks
  if (!Number.isInteger(committed) || committed < 0 || committed > (plan?.tasks.length ?? 0)) {
    throw new RangeError(`${committed} committed stops; ${plan?.id ?? 'a new patrol'} has ${plan?.tasks.length ?? 0}`)
  }
  const snapshot = triggerSnapshot(trigger)
  const next = { ...input, context: snapshot ? withSnapshot(input.context, snapshot) : input.context }
  const record = { trigger, supersedes: plan ? { planId: plan.id, committedTasks: committed } : null }
  if (plan === null || committed === 0) return planFresh(next, record)

  if (input.dock.id !== plan.dockId || input.drone.id !== plan.droneProfileId) {
    throw new Error(`${plan.id}'s committed stops fly from ${plan.dockId} with ${plan.droneProfileId}`)
  }
  const tasks = plan.tasks.slice(0, committed)
  const ids = new Set(tasks.map((t) => t.segmentId))
  const flown = plan.waypoints.findLastIndex((w) => w.segmentId === tasks.at(-1)!.segmentId) + 1
  return buildPlan(next, {
    window: plan.window,
    // Weather and lightning holds stay as the record of why the launch waited, and separation holds for committed stops.
    // The dock's separation hold is planned again for the way home.
    holds: plan.holds.filter((h) => (h.segmentId === null ? h.kind !== 'separation' : ids.has(h.segmentId))),
    replan: record,
    committed: {
      tasks,
      waypoints: plan.waypoints.slice(0, flown),
      rejected: plan.rejected.filter((r) => ids.has(r.segmentId)),
      simulated: plan.simulated
    }
  })
}

/**
 * The weather re-plan triggers in `context` at `now`: the latest rain reading, while it counts, when it is in the JPS
 * heavy or very heavy band; and every weather or lightning warning in force. A warning without `validTo` throws.
 */
export function weatherTriggers(context: ContextSnapshot[], now: string): ReplanTrigger[] {
  const at = Date.parse(now)
  const triggers: ReplanTrigger[] = []
  const reading = rainAt(context, at)
  if (reading) {
    if (reading.value === null) throw new Error(`rainfall reading observed at ${reading.observedAt} has no value`)
    const category = rainCategory(reading.value)
    if (category === 'heavy' || category === 'very_heavy') triggers.push({ kind: 'heavy_rain', reading })
  }
  for (const warning of context) {
    if (warning.kind !== 'weather_warning' && warning.kind !== 'lightning_warning') continue
    if (warning.validTo === null) throw new Error(`warning observed at ${warning.observedAt} has no validTo`)
    if (Date.parse(warning.observedAt) <= at && at < Date.parse(warning.validTo)) {
      triggers.push({ kind: 'weather_warning', warning })
    }
  }
  return triggers
}

function triggerSnapshot(trigger: ReplanTrigger): ContextSnapshot | null {
  if (trigger.kind === 'heavy_rain') {
    const { reading } = trigger
    if (reading.kind !== 'rainfall' || reading.value === null)
      throw new Error('a heavy_rain trigger needs a rainfall reading')
    const category = rainCategory(reading.value)
    if (category !== 'heavy' && category !== 'very_heavy') {
      throw new RangeError(`${reading.value} mm/h is ${category} rain, not heavy`)
    }
    return reading
  }
  if (trigger.kind === 'weather_warning') {
    if (trigger.warning.kind !== 'weather_warning' && trigger.warning.kind !== 'lightning_warning') {
      throw new Error(`a weather_warning trigger needs a warning, not a ${trigger.warning.kind} reading`)
    }
    return trigger.warning
  }
  return null
}

function withSnapshot(context: ContextSnapshot[], snapshot: ContextSnapshot): ContextSnapshot[] {
  return context.some((c) => sameSnapshot(c, snapshot)) ? context : [...context, snapshot]
}

/** The same published reading or warning. */
function sameSnapshot(a: ContextSnapshot, b: ContextSnapshot): boolean {
  return (['kind', 'publisher', 'stationId', 'observedAt', 'validTo', 'value', 'text'] as const).every(
    (k) => a[k] === b[k]
  )
}
