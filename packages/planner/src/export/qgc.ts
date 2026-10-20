import { assumedEnergyModel } from '../patrol.ts'
import {
  NOT_FLIGHT_READY,
  missionWaypoints,
  notFlightReadyNotice,
  type MissionExportInput,
  type MissionWaypoint
} from './mission.ts'

// MAVLink common.xml and minimal.xml values.
const MAV_CMD = {
  NAV_WAYPOINT: 16,
  NAV_LAND: 21,
  NAV_TAKEOFF: 22,
  DO_MOUNT_CONTROL: 205,
  SET_CAMERA_ZOOM: 531,
  IMAGE_START_CAPTURE: 2000
}
/** CAMERA_ZOOM_TYPE: "Zoom value as horizontal field of view in degrees". */
const ZOOM_TYPE_HORIZONTAL_FOV = 4
/** MAV_CMD_SET_CAMERA_ZOOM's target camera ID: 0 is all cameras. */
const ALL_CAMERAS = 0
const MAV_FRAME_MISSION = 2
const MAV_FRAME_GLOBAL_RELATIVE_ALT = 3
const MAV_MOUNT_MODE_MAVLINK_TARGETING = 2
const MAV_AUTOPILOT_PX4 = 12
const MAV_TYPE_QUADROTOR = 2
/** QGroundControl's `AltitudeFrameRelative`: heights above home. */
const ALTITUDE_RELATIVE = 1

export interface QgcPlanExportInput extends MissionExportInput {
  /** Ground elevation above mean sea level at the dock. The plan holds heights above ground only. */
  groundAmslM: number
}

interface Item {
  command: number
  frame: number
  /** param1–4, then latitude, longitude, altitude. `null` is NaN ("unset"). */
  params: (number | null)[]
}

/**
 * The plan as a QGroundControl `.plan` file (JSON text) for a PX4 quadrotor, heights relative to home. The dock is
 * the planned home: the mission takes off there, climbs to the plan's first transit height, flies every waypoint and
 * lands back on it. At each station it holds for the assumed capture hover, then pitches the gimbal and takes one
 * photo, encoded as QGroundControl's own camera section writes them. Between the two it sets the station's zoom with
 * MAV_CMD_SET_CAMERA_ZOOM (PX4 runs it in missions), as the field of view the zoom narrows the camera's HFOV to: at
 * every station, since zoom stays set on the camera. QGroundControl 5.1.5 folds the gimbal pitch into the waypoint but
 * stops at the zoom, so it lists the zoom and the photo as their own items (docs/evidence/mission-exports.md).
 */
export function exportQgcPlan(input: QgcPlanExportInput): string {
  const waypoints = missionWaypoints(input, 'qgc_plan')
  const [takeoff, climb] = [waypoints[0]!, waypoints[1]!]
  const nav = (command: number, p1: number, w: MissionWaypoint, heightM = w.heightM): Item => ({
    command,
    frame: MAV_FRAME_GLOBAL_RELATIVE_ALT,
    params: [p1, 0, 0, w.headingDeg, w.lat, w.lon, heightM]
  })
  let photos = 0
  const items = waypoints.flatMap((w): Item[] => {
    if (w.kind === 'takeoff') return [nav(MAV_CMD.NAV_TAKEOFF, 0, w, climb.heightM)]
    if (w.kind === 'landing') return [nav(MAV_CMD.NAV_LAND, 0, w)]
    if (w.kind === 'transit') return [nav(MAV_CMD.NAV_WAYPOINT, 0, w)]
    photos += 1
    return [
      nav(MAV_CMD.NAV_WAYPOINT, assumedEnergyModel.stationHoverS, w),
      {
        command: MAV_CMD.DO_MOUNT_CONTROL,
        frame: MAV_FRAME_MISSION,
        params: [w.gimbalPitchDeg, 0, 0, 0, 0, 0, MAV_MOUNT_MODE_MAVLINK_TARGETING]
      },
      {
        command: MAV_CMD.SET_CAMERA_ZOOM,
        frame: MAV_FRAME_MISSION,
        params: [
          ZOOM_TYPE_HORIZONTAL_FOV,
          zoomedHfovDeg(input.drone.camera.hfovDeg, w.zoom),
          ALL_CAMERAS,
          null,
          0,
          0,
          0
        ]
      },
      { command: MAV_CMD.IMAGE_START_CAPTURE, frame: MAV_FRAME_MISSION, params: [0, 0, 1, photos, null, null, null] }
    ]
  })

  const file = {
    fileType: 'Plan',
    version: 1,
    groundStation: `Safe Edge planner (${NOT_FLIGHT_READY})`,
    notice: notFlightReadyNotice(input.plan),
    mission: {
      version: 2,
      firmwareType: MAV_AUTOPILOT_PX4,
      vehicleType: MAV_TYPE_QUADROTOR,
      cruiseSpeed: input.drone.cruiseSpeedMps,
      hoverSpeed: input.drone.cruiseSpeedMps,
      globalPlanAltitudeMode: ALTITUDE_RELATIVE,
      plannedHomePosition: [takeoff.lat, takeoff.lon, input.groundAmslM + takeoff.altM],
      items: items.map(({ command, frame, params }, i) => ({
        type: 'SimpleItem',
        command,
        frame,
        params,
        autoContinue: true,
        doJumpId: i + 1,
        ...(frame === MAV_FRAME_GLOBAL_RELATIVE_ALT
          ? { Altitude: params[6], AltitudeMode: ALTITUDE_RELATIVE, AMSLAltAboveTerrain: null }
          : {})
      }))
    },
    geoFence: { circles: [], polygons: [], version: 2 },
    rallyPoints: { points: [], version: 2 }
  }
  return `${JSON.stringify(file, null, 2)}\n`
}

/** Zoom magnifies: the tangent of half the field of view shrinks by the zoom factor. */
function zoomedHfovDeg(hfovDeg: number, zoom: number): number {
  const rad = Math.PI / 180
  return (2 * Math.atan(Math.tan((hfovDeg / 2) * rad) / zoom)) / rad
}
