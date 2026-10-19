import {
  dispatchOrThrow,
  type Actor,
  type ContextSnapshot,
  type CoreOperationId,
  type CreatePatrolPlanRequest,
  type Dispatch,
  type EdgeEvent,
  type OperationInput,
  type Patrol,
  type PatrolPlan,
  type ReplanTrigger
} from '@safe-edge/contracts'
import { canonicalJson } from './audit.ts'
import type { Clock } from './core.ts'

/** The system acting on re-plan triggers. The operations table lets `system` create plans, never approve them. */
export const REPLAN_ACTOR: Actor = { type: 'system', id: 'core.replan', role: 'system', scopes: [] }

export interface ReplanSubscriberOptions {
  /** Core's dispatch; every read and plan goes through it as `REPLAN_ACTOR`. */
  dispatch: Dispatch
  /** `notBefore` for plans that have not started. */
  clock: Clock
  /** How many of an in-flight patrol's route stops are flown or in progress, as its drone provider reports. */
  committedTasks(patrol: Patrol, plan: PatrolPlan): number
  /** The dock, drone and altitude cap of the re-test patrol a repair queues when no plan is open. */
  retest: Pick<CreatePatrolPlanRequest, 'dockId' | 'droneProfileId' | 'altitudeCapM'>
  /**
   * Receives each plan that could not be re-planned (an in-flight patrol whose progress no drone reports) and a re-test
   * that could not be queued. The other plans of the trigger are re-planned all the same.
   */
  onFailure(error: Error): void
}

export interface ReplanSubscriber {
  /**
   * Re-plans on `edge.candidate.decided.v1` (confirm or recapture), `edge.repair.completed.v1` and
   * `edge.pass.expiring.v1`.
   */
  onEvent(event: EdgeEvent): EdgeEvent[]
  /** Re-plans on any trigger, such as the planner's `weatherTriggers` from new weather snapshots. */
  onTrigger(trigger: ReplanTrigger): EdgeEvent[]
}

/**
 * Turns re-plan triggers into `createPatrolPlan` calls (TRD "Patrol planner" step 5). Every open plan (not superseded,
 * not yet flown to the end) is re-planned from its committed stops, considering its segments plus the trigger's. When
 * no plan is open, a completed repair queues a re-test patrol of its segment. Each plan is re-planned on its own: one that
 * fails goes to `onFailure` and the rest go ahead. Each call returns the events of every write it made, to publish.
 * A weather trigger a plan already holds in its context does not re-plan it again. Re-plans come back proposed, so a
 * pilot approves each before it flies.
 */
export function createReplanSubscriber({
  dispatch,
  clock,
  committedTasks,
  retest,
  onFailure
}: ReplanSubscriberOptions): ReplanSubscriber {
  const call = <K extends CoreOperationId>(op: K, input: OperationInput<K>) =>
    dispatchOrThrow(dispatch, op, REPLAN_ACTOR, input)
  const plan = (body: CreatePatrolPlanRequest) => call('createPatrolPlan', { body }).events

  const onTrigger = (trigger: ReplanTrigger): EdgeEvent[] => {
    const plans = call('listPatrolPlans', {}).data
    const patrols = call('listPatrols', {}).data
    const superseded = new Set(plans.flatMap((p) => (p.replan?.supersedes ? [p.replan.supersedes.planId] : [])))
    const open = plans
      .filter((p) => !superseded.has(p.id))
      .map((p) => ({ plan: p, patrol: patrols.findLast((x) => x.planId === p.id) ?? null }))
      .filter(({ patrol }) => patrol?.status !== 'completed')
    const segmentId = 'segmentId' in trigger ? trigger.segmentId : null
    const snapshot =
      trigger.kind === 'heavy_rain' ? trigger.reading : trigger.kind === 'weather_warning' ? trigger.warning : null

    const events: EdgeEvent[] = []
    const attempt = (failed: string, write: () => EdgeEvent[]) => {
      try {
        events.push(...write())
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        onFailure(new Error(`${failed}: ${message}`, { cause: error }))
      }
    }
    for (const { plan: current, patrol } of open) {
      if (snapshot && current.context.some((c) => sameSnapshot(c, snapshot))) continue
      attempt(`${current.id} was not re-planned`, () => {
        const committed = patrol ? committedTasks(patrol, current) : 0
        const flown = new Set(current.tasks.slice(0, committed).map((t) => t.segmentId))
        const segmentIds = [
          ...new Set([
            ...current.tasks.map((t) => t.segmentId),
            ...current.rejected.map((r) => r.segmentId),
            ...(segmentId ? [segmentId] : [])
          ])
        ]
        if (segmentIds.every((id) => flown.has(id))) return []
        return plan({
          dockId: current.dockId,
          droneProfileId: current.droneProfileId,
          segmentIds,
          context: current.context,
          notBefore: clock.now(),
          altitudeCapM: current.altitudeCapM,
          replan: { trigger, supersedes: { planId: current.id, committedTasks: committed } }
        })
      })
    }
    if (open.length === 0 && trigger.kind === 'repair_completed') {
      attempt(`No re-test of ${trigger.segmentId} was queued`, () =>
        plan({
          ...retest,
          segmentIds: [trigger.segmentId],
          context: [],
          notBefore: clock.now(),
          replan: { trigger, supersedes: null }
        })
      )
    }
    return events
  }

  const onEvent = (event: EdgeEvent): EdgeEvent[] => {
    switch (event.type) {
      case 'edge.candidate.decided.v1': {
        const { decision, findingId, segmentId, candidateId } = event.data
        if (decision === 'recapture') return onTrigger({ kind: 'recapture_requested', segmentId, candidateId })
        if (decision !== 'confirm') return []
        if (findingId === null) throw new Error(`confirmed candidate ${event.data.candidateId} has no finding`)
        return onTrigger({ kind: 'flag_confirmed', segmentId, findingId })
      }
      case 'edge.repair.completed.v1': {
        const { findingId, workOrderId } = event.data
        const { segmentId } = call('getFinding', { params: { id: findingId } }).data
        return onTrigger({ kind: 'repair_completed', segmentId, findingId, workOrderId })
      }
      case 'edge.pass.expiring.v1': {
        const { passId, segmentId, validTo } = event.data
        return onTrigger({ kind: 'pass_expiring', segmentId, passId, validTo })
      }
      default:
        return []
    }
  }

  return { onEvent, onTrigger }
}

function sameSnapshot(a: ContextSnapshot, b: ContextSnapshot): boolean {
  return canonicalJson(a) === canonicalJson(b)
}
