import type {
  Actor,
  CoreOperationId,
  Dispatch,
  DroneProvider,
  EdgeEvent,
  OperationInput,
  Patrol,
  PatrolPlan,
  PatrolRun,
  ProviderEvent
} from '@safe-edge/contracts'

export interface DroneBridgeOptions {
  provider: DroneProvider
  /** Core's dispatch. The bridge reads, records observations and completes patrols as `actor`. */
  dispatch: Dispatch
  /** The drone provider's actor (role `provider`), which reports what its drone saw. */
  actor: Actor
  /** Receives the events each of the bridge's writes emits, for the transport to publish. */
  publish(events: EdgeEvent[]): void
  /**
   * Receives each provider event the bridge could not turn into a write, with the error. The bridge goes on with the
   * next event, so one failed write does not lose the rest of the flight.
   */
  onFailure(error: unknown): void
}

export interface DroneBridge {
  /**
   * Flies a patrol core has started: puts its plan on the provider and dispatches it with the pilot's approval exactly
   * as core recorded it. A refused dispatch (no approval, an unreleased hold, a landing after the window) drops the
   * scheduled run and throws.
   */
  fly(patrol: Patrol): Promise<PatrolRun>
  /**
   * How many of an in-flight patrol's route stops the drone has reached, for re-planning (core's replan subscriber).
   * Throws for a patrol this bridge does not fly.
   */
  committedTasks(patrol: Patrol): number
}

interface Flight {
  patrol: Patrol
  plan: PatrolPlan
  lengthM: Map<string, number>
  /** Frames taken on each segment. */
  frames: Map<string, number>
  /** Route stops whose stations the drone has reached. */
  committed: number
}

/**
 * Feeds a drone provider's events to core, as a transport hosting the provider does. A frame at a station that carries
 * a viewpoint ID (the planner links each fixed viewpoint to a station) becomes an observation on the patrol; other
 * frames only count towards coverage. Landing completes the patrol: a segment counts as inspected only when every one
 * of its stations was captured, otherwise its whole length stays unknown and core opens a field check.
 */
export function bridgeDrone({ provider, dispatch, actor, publish, onFailure }: DroneBridgeOptions): DroneBridge {
  const flights = new Map<string, Flight>()
  const call = <K extends CoreOperationId>(op: K, input: OperationInput<K>) => {
    const result = dispatch(op, actor, input)
    if (!result.ok) throw new Error(`${op} as ${actor.id} failed: ${result.message}`)
    publish(result.events)
    return result.data
  }

  const handle = (flight: Flight, event: ProviderEvent) => {
    const { patrol, plan } = flight
    if (event.type === 'waypoint' && event.kind === 'station') {
      const stop = plan.tasks.findIndex((t) => t.segmentId === event.segmentId)
      flight.committed = Math.max(flight.committed, stop + 1)
    }
    if (event.type === 'observation') {
      flight.frames.set(event.segmentId, (flight.frames.get(event.segmentId) ?? 0) + 1)
      if (event.viewpointId === null) return
      const { segmentId, viewpointId, captureSource, image, pose, quality, privacyAction, simulated } = event
      call('recordObservation', {
        body: {
          patrolId: patrol.id,
          segmentId,
          viewpointId,
          captureSource,
          image,
          pose,
          capturedAt: event.at,
          quality,
          privacyAction,
          simulated
        }
      })
    }
    if (event.type === 'landed') {
      flights.delete(event.runId)
      const coverage = plan.tasks.map(({ segmentId, stations }) => {
        const lengthM = flight.lengthM.get(segmentId)!
        const whole = flight.frames.get(segmentId) === stations.length
        return { segmentId, inspectedM: whole ? lengthM : 0, unknownM: whole ? 0 : lengthM }
      })
      call('completePatrol', { params: { id: patrol.id }, body: { coverage } })
    }
  }

  provider.onEvent((event) => {
    const flight = flights.get(event.runId)
    if (flight === undefined) return onFailure(new Error(`${event.type} from ${event.runId}, a run nobody started`))
    try {
      handle(flight, event)
    } catch (error) {
      onFailure(error)
    }
  })

  return {
    async fly(patrol) {
      const plan = call('listPatrolPlans', {}).find((p) => p.id === patrol.planId)
      if (plan === undefined) throw new Error(`No patrol plan ${patrol.planId}`)
      if (plan.approvedBy === null || plan.approvedAt === null) throw new Error(`${plan.id} has no pilot approval`)
      const lengthM = new Map(
        plan.tasks.map((t) => [t.segmentId, call('getSegment', { params: { id: t.segmentId } }).segment.lengthM])
      )
      const run = await provider.schedulePatrol(plan)
      flights.set(run.id, { patrol, plan, lengthM, frames: new Map(), committed: 0 })
      try {
        await provider.dispatchPatrol(run.id, {
          planId: plan.id,
          approvedBy: plan.approvedBy,
          approvedAt: plan.approvedAt
        })
      } catch (error) {
        // The run would otherwise hold the device: drop it, then report the refusal.
        flights.delete(run.id)
        await provider.cancelPatrol(run.id)
        throw error
      }
      return run
    },

    committedTasks(patrol) {
      const flight = [...flights.values()].find((f) => f.patrol.id === patrol.id)
      if (flight === undefined) throw new Error(`No drone this bridge flies reports ${patrol.id}'s progress`)
      return flight.committed
    }
  }
}
