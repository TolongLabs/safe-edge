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
 * DJI Cloud API adapter for a DJI Dock 3 with a Matrice 4D/4TD (TRD "SDK and provider adapters": `drone-dji-cloud`).
 * A typed stub: every method throws `ProviderNotImplementedError` and documents the DJI messages it would map to. All
 * messages are MQTT. Topics take the dock's serial (`{gateway_sn}`), except OSD and state pushes, which take each
 * device's own serial (`{device_sn}`) ([topic definition]). Replies arrive on the matching `_reply` topic.
 *
 * Checked against DJI's live English docs on 19 Oct 2026, including the wayline methods `flighttask_prepare` and
 * `flighttask_execute`, which the research had only from a search snippet ([Dock 3 wayline], last updated 10 Oct 2026).
 * The same methods appear on DJI's Dock 2 wayline page. Not exercised against a dock: there is no SDP account,
 * dock or Cloud API terms clearance yet (docs/research/drone-integration/drone-sdk.md).
 *
 * [topic definition]: https://developer.dji.com/doc/cloud-api-tutorial/en/api-reference/dock-to-cloud/mqtt/topic-definition.html
 * [Dock 3 wayline]: https://developer.dji.com/doc/cloud-api-tutorial/en/api-reference/dock-to-cloud/mqtt/dock/dock3/wayline.html
 */
export class DjiCloudDroneProvider implements DroneProvider {
  /**
   * The dock reports itself and its aircraft with `update_topo` on `sys/product/{gateway_sn}/status` ([Dock 3
   * device]). Before that, the dock must be bound to the organisation with `airport_bind_status`,
   * `airport_organization_get` and `airport_organization_bind` on `thing/product/{gateway_sn}/requests` ([Dock 3
   * organization]).
   *
   * [Dock 3 device]: https://developer.dji.com/doc/cloud-api-tutorial/en/api-reference/dock-to-cloud/mqtt/dock/dock3/device.html
   * [Dock 3 organization]: https://developer.dji.com/doc/cloud-api-tutorial/en/api-reference/dock-to-cloud/mqtt/dock/dock3/organization.html
   */
  listDevices(): Promise<DroneDevice[]> {
    throw new ProviderNotImplementedError('dji_cloud', 'listDevices')
  }

  /**
   * The aircraft's OSD push on `thing/product/{device_sn}/osd`: `latitude`, `longitude`, `elevation` (relative to
   * the take-off point; `height` is ellipsoid height), `attitude_head`, `battery.capacity_percent` and `mode_code`
   * ([M4D properties]). The dock's own `mode_code` comes on its OSD ([Dock 3 properties]). Safe Edge altitudes are
   * above ground, so `elevation` needs the dock's height above ground added.
   *
   * [M4D properties]: https://developer.dji.com/doc/cloud-api-tutorial/en/api-reference/dock-to-cloud/mqtt/aircraft/m4d-properties.html
   * [Dock 3 properties]: https://developer.dji.com/doc/cloud-api-tutorial/en/api-reference/dock-to-cloud/mqtt/dock/dock3/properties.html
   */
  getStatus(_deviceId: string): Promise<DroneStatus> {
    throw new ProviderNotImplementedError('dji_cloud', 'getStatus')
  }

  /**
   * Export the plan as a WPML KMZ (`wpmz/template.kml`, `wpmz/waylines.wpml`; [WPML], #73), put it in object
   * storage, then send `flighttask_prepare` on `thing/product/{gateway_sn}/services` with `flight_id` (the run ID),
   * `task_type`, `execute_time` and `file { url, fingerprint }` (the KMZ's MD5) ([Dock 3 wayline]). The dock holds
   * the task without flying it.
   *
   * [WPML]: https://developer.dji.com/doc/cloud-api-tutorial/en/api-reference/dji-wpml/waylines-wpml.html
   * [Dock 3 wayline]: https://developer.dji.com/doc/cloud-api-tutorial/en/api-reference/dock-to-cloud/mqtt/dock/dock3/wayline.html
   */
  schedulePatrol(_plan: PatrolPlan): Promise<PatrolRun> {
    throw new ProviderNotImplementedError('dji_cloud', 'schedulePatrol')
  }

  /**
   * Check `approval` against the plan's recorded pilot approval first, as `drone-sim` does, and refuse with
   * `ApprovalRequiredError`. Then send `flighttask_execute` with the run's `flight_id` on
   * `thing/product/{gateway_sn}/services` ([Dock 3 wayline]).
   *
   * [Dock 3 wayline]: https://developer.dji.com/doc/cloud-api-tutorial/en/api-reference/dock-to-cloud/mqtt/dock/dock3/wayline.html
   */
  dispatchPatrol(_runId: string, _approval: HumanApproval): Promise<void> {
    throw new ProviderNotImplementedError('dji_cloud', 'dispatchPatrol')
  }

  /**
   * A task not yet flying: `flighttask_undo` with `flight_ids`. In flight: `return_home` (one-key return). Both on
   * `thing/product/{gateway_sn}/services` ([Dock 3 wayline]).
   *
   * [Dock 3 wayline]: https://developer.dji.com/doc/cloud-api-tutorial/en/api-reference/dock-to-cloud/mqtt/dock/dock3/wayline.html
   */
  cancelPatrol(_runId: string): Promise<void> {
    throw new ProviderNotImplementedError('dji_cloud', 'cancelPatrol')
  }

  /**
   * - `takeoff`, `waypoint`, `landed`: `flighttask_progress` on `thing/product/{gateway_sn}/events`, with `status`,
   *   `progress.percent`, `ext.current_waypoint_index` and `ext.wayline_mission_state`; `return_home_info` on the same
   *   topic during a return ([Dock 3 wayline]).
   * - `battery`: `battery.capacity_percent` from the aircraft OSD (see `getStatus`).
   * - `observation`: `file_upload_callback` on `thing/product/{gateway_sn}/events` once the dock has uploaded a frame
   *   to the storage `storage_config_get` hands out. Its `file.metadata` has `shoot_position { lat, lng }`,
   *   `relative_altitude`, `gimbal_yaw_degree` and `create_time`, and `file.ext.flight_id` names the run ([Dock 3
   *   media]). Safe Edge matches the frame to its plan station.
   *
   * Live video (`live_start_push`, [Dock 3 live]) goes to a media relay, not through this port.
   *
   * [Dock 3 wayline]: https://developer.dji.com/doc/cloud-api-tutorial/en/api-reference/dock-to-cloud/mqtt/dock/dock3/wayline.html
   * [Dock 3 media]: https://developer.dji.com/doc/cloud-api-tutorial/en/api-reference/dock-to-cloud/mqtt/dock/dock3/media.html
   * [Dock 3 live]: https://developer.dji.com/doc/cloud-api-tutorial/en/api-reference/dock-to-cloud/mqtt/dock/dock3/live.html
   */
  onEvent(_handler: (event: ProviderEvent) => void): () => void {
    throw new ProviderNotImplementedError('dji_cloud', 'onEvent')
  }
}
