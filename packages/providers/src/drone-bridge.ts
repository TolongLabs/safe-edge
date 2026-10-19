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
  /** The plan's station waypoints (by index) with a frame the privacy gate kept. */
  seen: Set<number>
  /** Route stops whose stations the drone has reached. */
  committed: number
}

/**
 * Feeds a drone provider's events to core, as a transport hosting the provider does. A frame at a station that carries
 * a viewpoint ID (the planner links each fixed viewpoint to a station) becomes an observation on the patrol; other
 * frames only count towards coverage. Landing completes the patrol. Coverage counts stations, not frames: a station is
 * seen once it has a frame the privacy gate kept, and each station seen stands for an equal share of its segment's
 * length. The rest is unknown (TRD rule 4), and core opens a field check for it.
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
      if (stop < 0) {
        const message = `${plan.id} has no station on ${event.segmentId}, which the drone reported reaching at waypoint ${event.index}`
        throw new Error(message)
      }
      flight.committed = Math.max(flight.committed, stop + 1)
    }
    if (event.type === 'observation') {
      const station = plan.waypoints[event.waypointIndex]
      if (station?.kind !== 'station' || station.segmentId !== event.segmentId) {
        throw new Error(`${plan.id} has no station on ${event.segmentId} at waypoint ${event.waypointIndex}`)
      }
      if (event.privacyAction !== 'discarded') flight.seen.add(event.waypointIndex)
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
      const coverage = plan.tasks.map(({ segmentId }) => {
        const lengthM = flight.lengthM.get(segmentId)!
        const stations = plan.waypoints.flatMap((w, i) =>
          w.kind === 'station' && w.segmentId === segmentId ? [i] : []
        )
        const seen = stations.filter((i) => flight.seen.has(i)).length
        const inspectedM = seen === stations.length ? lengthM : (lengthM * seen) / stations.length
        return { segmentId, inspectedM, unknownM: lengthM - inspectedM }
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
      const plan = call('getPatrolPlan', { params: { id: patrol.planId } })
      if (plan.approvedBy === null || plan.approvedAt === null) throw new Error(`${plan.id} has no pilot approval`)
      const lengthM = new Map(
        plan.tasks.map((t) => [t.segmentId, call('getSegment', { params: { id: t.segmentId } }).segment.lengthM])
      )
      const run = await provider.schedulePatrol(plan)
      flights.set(run.id, { patrol, plan, lengthM, seen: new Set(), committed: 0 })
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
