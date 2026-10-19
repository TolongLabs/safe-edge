import type {
  DroneDevice,
  DroneProvider,
  DroneStatus,
  HumanApproval,
  PatrolPlan,
  PatrolRun,
  ProviderEvent
} from '@safe-edge/contracts'
import { ProviderNotImplementedError } from './errors.ts'

/**
 * MAVLink adapter for a PX4 or ArduPilot aircraft (TRD "SDK and provider adapters": `drone-mavlink`). A typed stub:
 * every method throws `ProviderNotImplementedError` and documents the MAVLink messages it would map to. MAVLink runs
 * over UDP, so the real adapter talks to a small server-side bridge that holds the link and forwards JSON, never to the
 * vehicle from the browser. Message and command IDs are from MAVLink's [common messages] and the [mission protocol],
 * checked on 19 Oct 2026. Not exercised against a vehicle or PX4 SITL.
 *
 * [common messages]: https://mavlink.io/en/messages/common.html
 * [mission protocol]: https://mavlink.io/en/services/mission.html
 */
export class MavlinkDroneProvider implements DroneProvider {
  /**
   * One device per MAVLink system ID seen in `HEARTBEAT` (#0), identified with `AUTOPILOT_VERSION` (#148)
   * ([common messages]).
   *
   * [common messages]: https://mavlink.io/en/messages/common.html
   */
  listDevices(): Promise<DroneDevice[]> {
    throw new ProviderNotImplementedError('mavlink', 'listDevices')
  }

  /**
   * `GLOBAL_POSITION_INT` (#33: `lat`, `lon` in degrees × 1E7, `relative_alt` in mm above home, `hdg` in centidegrees),
   * `BATTERY_STATUS` (#147: `battery_remaining` %) and `EXTENDED_SYS_STATE` (#245: `landed_state`) ([common messages]).
   *
   * [common messages]: https://mavlink.io/en/messages/common.html
   */
  getStatus(_deviceId: string): Promise<DroneStatus> {
    throw new ProviderNotImplementedError('mavlink', 'getStatus')
  }

  /**
   * Upload the plan as a mission ([mission protocol]): `MISSION_COUNT` (#44), then answer each `MISSION_REQUEST_INT`
   * (#51) with a `MISSION_ITEM_INT` (#73), until `MISSION_ACK` (#47) returns `MAV_MISSION_ACCEPTED`. The items, in
   * `MAV_FRAME_GLOBAL_RELATIVE_ALT_INT`: `MAV_CMD_NAV_TAKEOFF` (22), a
   * `MAV_CMD_NAV_WAYPOINT` (16; param 1 hold seconds, param 4 yaw) per waypoint, `MAV_CMD_DO_GIMBAL_MANAGER_PITCHYAW`
   * (1000) and `MAV_CMD_IMAGE_START_CAPTURE` (2000) at each station, and `MAV_CMD_NAV_RETURN_TO_LAUNCH` (20) to land
   * ([common messages]). Uploading does not fly it.
   *
   * [mission protocol]: https://mavlink.io/en/services/mission.html
   * [common messages]: https://mavlink.io/en/messages/common.html
   */
  schedulePatrol(_plan: PatrolPlan): Promise<PatrolRun> {
    throw new ProviderNotImplementedError('mavlink', 'schedulePatrol')
  }

  /**
   * Check `approval` against the plan's recorded pilot approval first, as `drone-sim` does, and refuse with
   * `ApprovalRequiredError`. Then `COMMAND_LONG` (#76) with `MAV_CMD_COMPONENT_ARM_DISARM` (400) and
   * `MAV_CMD_MISSION_START` (300), each confirmed by `COMMAND_ACK` (#77) ([common messages]).
   *
   * [common messages]: https://mavlink.io/en/messages/common.html
   */
  dispatchPatrol(_runId: string, _approval: HumanApproval): Promise<void> {
    throw new ProviderNotImplementedError('mavlink', 'dispatchPatrol')
  }

  /**
   * A mission not yet started: `MISSION_CLEAR_ALL` (#45) ([mission protocol]). In flight: `COMMAND_LONG` with
   * `MAV_CMD_NAV_RETURN_TO_LAUNCH` (20) ([common messages]).
   *
   * [mission protocol]: https://mavlink.io/en/services/mission.html
   * [common messages]: https://mavlink.io/en/messages/common.html
   */
  cancelPatrol(_runId: string): Promise<void> {
    throw new ProviderNotImplementedError('mavlink', 'cancelPatrol')
  }

  /**
   * - `takeoff` and `landed`: `EXTENDED_SYS_STATE.landed_state` moving to `MAV_LANDED_STATE_IN_AIR` and back to
   *   `MAV_LANDED_STATE_ON_GROUND`.
   * - `waypoint`: `MISSION_ITEM_REACHED` (#46) `seq`, mapped from mission items back to plan waypoints;
   *   `MISSION_CURRENT` (#42) for the item in progress ([mission protocol]).
   * - `battery`: `BATTERY_STATUS` (#147).
   * - `observation`: `CAMERA_IMAGE_CAPTURED` (#263: `lat`, `lon`, `relative_alt`, `q`, `image_index`, `file_url`).
   *   Safe Edge matches the frame to its plan station.
   *
   * [mission protocol]: https://mavlink.io/en/services/mission.html
   */
  onEvent(_handler: (event: ProviderEvent) => void): () => void {
    throw new ProviderNotImplementedError('mavlink', 'onEvent')
  }
}
