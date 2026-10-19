import {
  dispatchOrThrow,
  type Actor,
  type Dispatch,
  type DroneStatus,
  type EdgeEvent,
  type Patrol,
  type PatrolPlan
} from '@safe-edge/contracts'
import { bridgeDrone } from './drone-bridge.ts'
import { createDroneSim, type SimDevice } from './drone-sim.ts'

/** The seeded simulated drone provider, which reports what drone-sim sees. */
export const DRONE_SIM_ACTOR: Actor = { type: 'provider', id: 'usr_drone_sim', role: 'provider', scopes: [] }

export interface DroneSimHostOptions {
  /** Core's dispatch. */
  dispatch: Dispatch
  /** The clock core runs on: the drone flies on it. */
  clock: { now(): string }
  /** The system actor the host reads docks, drone profiles and patrols as. */
  actor: Actor
  /** Receives the events of the writes the drone's reports make, for the transport to publish. */
  publish(events: EdgeEvent[]): void
  /** Records a step that failed: a patrol it cannot fly, a report it cannot write, a re-plan the drone refused. */
  onFailure(error: unknown): void
}

export interface DroneSimHost {
  /** Subscribe it to every published event: a patrol started with provider `sim` takes off on drone-sim. */
  onEvent(event: EdgeEvent): void
  /** Delivers drone-sim's events due by the clock, and the writes they make. */
  tick(): void
  /**
   * Call it after the pilot approves a plan or releases a hold: each flight gets its patrol's current plan from core
   * (a re-plan to switch to, or released holds to stop waiting at).
   */
  planChanged(): void
  /** For core's re-plan subscriber: the committed stops of an in-flight patrol's plan. */
  committedTasks(patrol: Patrol, plan: PatrolPlan): number
  /** Where a simulated drone is by the clock, with its battery: for the scene to draw it. */
  status(deviceId: string): Promise<DroneStatus>
}

/**
 * drone-sim as a transport runs it (the API, and the memory transport in the browser): one simulated aircraft per dock
 * and drone profile (`sim-1`, …), fed to core through the drone bridge as `usr_drone_sim`. A patrol started on another
 * provider is a failure: nothing here flies it.
 */
export function hostDroneSim({ dispatch, clock, actor, publish, onFailure }: DroneSimHostOptions): DroneSimHost {
  const profiles = dispatchOrThrow(dispatch, 'listDroneProfiles', actor, {}).data
  const devices = dispatchOrThrow(dispatch, 'listDocks', actor, {}).data.flatMap((dock) =>
    dock.droneProfileIds.map((id) => {
      const drone = profiles.find((p) => p.id === id)
      if (drone === undefined) throw new Error(`${dock.id} takes ${id}, which is not a drone profile`)
      return { dock, drone }
    })
  )
  const sim = createDroneSim({
    clock,
    devices: devices.map(({ dock, drone }, i): SimDevice => ({
      id: `sim-${i + 1}`,
      name: `Simulated ${drone.name} on ${dock.name}`,
      dock,
      drone
    }))
  })
  const bridge = bridgeDrone({ provider: sim, dispatch, actor: DRONE_SIM_ACTOR, publish, onFailure })
  const fly = async (patrolId: string) => {
    const patrol = dispatchOrThrow(dispatch, 'getPatrol', actor, { params: { id: patrolId } }).data
    if (patrol.provider !== 'sim') throw new Error(`Only drone-sim flies here; ${patrol.id} names ${patrol.provider}`)
    await bridge.fly(patrol)
  }
  return {
    onEvent: (event) => {
      if (event.type === 'edge.patrol.started.v1') fly(event.data.patrolId).catch(onFailure)
    },
    tick: () => sim.tick(),
    planChanged: () => void bridge.sync().catch(onFailure),
    committedTasks: (patrol, plan) => bridge.committedTasks(patrol, plan),
    status: (deviceId) => sim.getStatus(deviceId)
  }
}
