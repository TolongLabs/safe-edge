import type { DroneProfile, PatrolPlan, Waypoint } from '@safe-edge/contracts'

export const NOT_FLIGHT_READY = 'NOT FLIGHT-READY'

/**
 * Written into every exported file, in a field its format keeps. Neither format holds a time window or a hold, so the
 * notice carries the plan's window and the places that wait for a person to confirm the path clear.
 */
export function notFlightReadyNotice(plan: PatrolPlan): string {
  const waits = plan.holds
    .filter((h) => h.kind === 'separation' && h.releasedBy === null)
    .map((h) => h.segmentId ?? 'the dock')
  return [
    `${NOT_FLIGHT_READY}: a format sample generated from a Safe Edge patrol plan. It has not been validated on any aircraft or ground station; a remote pilot must review and approve every live flight.`,
    `Fly only inside the plan's window, ${plan.window.start} to ${plan.window.end}.`,
    ...(waits.length > 0 ? [`Wait for the pilot or observer to confirm the path clear at ${waits.join(', ')}.`] : [])
  ].join(' ')
}

export interface MissionExportInput {
  plan: PatrolPlan
  /** The plan's drone profile: its cruise speed sets the mission speeds. */
  drone: DroneProfile
}

export interface MissionWaypoint extends Waypoint {
  /** Height above the take-off point. The plan's heights are above ground, so this assumes level ground. */
  heightM: number
}

/** The plan's waypoints with heights relative to take-off, after checking the drone flies this plan and format. */
export function missionWaypoints(
  { plan, drone }: MissionExportInput,
  format: DroneProfile['missionFormats'][number]
): MissionWaypoint[] {
  if (drone.id !== plan.droneProfileId) throw new Error(`plan ${plan.id} flies ${plan.droneProfileId}, not ${drone.id}`)
  if (!drone.missionFormats.includes(format)) throw new Error(`drone ${drone.id} does not take ${format} missions`)
  const takeoff = plan.waypoints[0]
  if (!takeoff) throw new Error(`plan ${plan.id} has no waypoints: every segment was rejected`)
  return plan.waypoints.map((w) => ({ ...w, heightM: w.altM - takeoff.altM }))
}
