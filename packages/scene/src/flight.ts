import {
  BoxGeometry,
  BufferGeometry,
  CameraHelper,
  CatmullRomCurve3,
  Color,
  CylinderGeometry,
  Group,
  Line,
  LineDashedMaterial,
  MathUtils,
  Mesh,
  MeshLambertMaterial,
  type Object3D,
  PerspectiveCamera,
  Vector3
} from 'three'
import { toLocal } from './frame.ts'
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'
import { labelChip } from './markers.ts'

/** One planner waypoint, as `PatrolPlan.waypoints` gives it: WGS84 and metres above ground. */
export interface FlightPoint {
  lon: number
  lat: number
  altM: number
  headingDeg: number
  kind: 'takeoff' | 'transit' | 'station' | 'landing'
}

/** A planned patrol: the dock it leaves from, the route it flies and the aircraft's battery and camera. */
export interface FlightView {
  dock: { lon: number; lat: number; altM: number }
  waypoints: FlightPoint[]
  usableBatteryWh: number
  camera: { hfovDeg: number; vfovDeg: number }
}

export type FlightPhase = 'docked' | 'takeoff' | 'transit' | 'station' | 'return' | 'landing' | 'landed'

export interface FlightState {
  phase: FlightPhase
  remainingWh: number
  /** Share of the usable battery left, 0 to 100. */
  batteryPercent: number
  altM: number
  /** Index of the waypoint the drone is flying to; the last one once it has landed. */
  toward: number
}

/** Where the simulated drone is and what it has left, as drone-sim's `DroneStatus` reports it. */
export interface DronePlacement {
  state: 'docked' | 'in_flight'
  pose: { lon: number; lat: number; altM: number; headingDeg: number; pitchDeg: number }
  batteryWh: number
}

export interface Flight {
  objects: Object3D[]
  /** Puts the drone on the route where drone-sim reports it and returns what it is doing. */
  place(drone: DronePlacement): FlightState
  /** Back on the dock before take-off: for a scenario played again from its start. */
  restart(): void
  /** Where the drone is now, for a camera that follows it. */
  dronePosition: Vector3
  dispose(): void
}

/** The dock aircraft is under a metre across; drawn true to size it vanishes at park scale, so it is drawn larger. */
export const DRONE_DRAWN_SCALE = 4
/** The camera frustum reaches as far as the planner's capture range. */
const FRUSTUM_RANGE_M = 15
/** The assumed facility under the dock: the seed puts the dock on a roof no OSM building marks (assumed site). */
const ROOF = { width: 14, depth: 9 }

const colours = {
  roof: 0xcfd6d2,
  wall: 0xb4bdb8,
  dock: 0x3a4743,
  pad: 0xe6eeea,
  drone: 0x1c2925,
  rotor: 0x5d6b66,
  route: 0x17302a,
  frustum: 0xfbfcfb
}

const lambert = (color: number) => new MeshLambertMaterial({ color })

const toScene = (p: { lon: number; lat: number; altM: number }) => {
  const [east, north] = toLocal([p.lon, p.lat])
  return new Vector3(east, p.altM, -north)
}

/** Route samples per leg between two waypoints, for finding where on the curve a reported pose is. */
const SAMPLES_PER_LEG = 16
/** How far ahead of the last placement to look for the next one, in samples: a few legs. */
const LOOK_AHEAD = SAMPLES_PER_LEG * 4

/**
 * The dock on its roof, the planned route as a smooth `CatmullRomCurve3`, and a procedural quadcopter with its camera
 * frustum. `place` puts the drone on the curve at the point nearest the pose drone-sim reports, searching forward from
 * the last placement, so it follows the flight in order even where the route crosses itself, and hovers where the
 * drone hovers.
 */
export function buildFlight(view: FlightView): Flight {
  const { waypoints } = view
  if (waypoints.length < 2) throw new Error('A flight needs at least a take-off and a landing waypoint')
  const points = waypoints.map(toScene)
  const curve = new CatmullRomCurve3(points, false, 'centripetal')

  const dockAt = toScene(view.dock)
  const site = new Group()
  site.name = 'dock (simulated)'
  const building = new Mesh(new BoxGeometry(ROOF.width, dockAt.y, ROOF.depth).translate(0, dockAt.y / 2, 0), [
    lambert(colours.wall),
    lambert(colours.wall),
    lambert(colours.roof),
    lambert(colours.wall),
    lambert(colours.wall),
    lambert(colours.wall)
  ])
  building.position.set(dockAt.x, 0, dockAt.z)
  const housing = new Mesh(new BoxGeometry(2.4, 0.9, 2.4).translate(0, 0.45, 0), lambert(colours.dock))
  housing.position.copy(dockAt)
  const pad = new Mesh(new CylinderGeometry(0.9, 0.9, 0.04, 24).translate(0, 0.92, 0), lambert(colours.pad))
  pad.position.copy(dockAt)
  site.add(building, housing, pad)
  const dockLabel = labelChip('Dock, assumed site · simulated')
  dockLabel.position.copy(dockAt).setY(dockAt.y + 3)
  site.add(dockLabel)

  const route = new Line(
    new BufferGeometry().setFromPoints(curve.getPoints(Math.max(200, waypoints.length * 12))),
    new LineDashedMaterial({ color: colours.route, dashSize: 4, gapSize: 3 })
  )
  route.computeLineDistances()
  route.name = 'patrol route (simulated)'

  const { drone, rotors, gimbal } = buildQuadcopter()
  const droneLabel = labelChip('Drone · simulated')
  droneLabel.position.set(0, 3, 0)
  drone.add(droneLabel)
  const camera = new PerspectiveCamera(
    view.camera.vfovDeg,
    Math.tan(MathUtils.degToRad(view.camera.hfovDeg / 2)) / Math.tan(MathUtils.degToRad(view.camera.vfovDeg / 2)),
    0.5,
    FRUSTUM_RANGE_M
  )
  gimbal.add(camera)
  const frustum = new CameraHelper(camera)
  const white = new Color(colours.frustum)
  frustum.setColors(white, white, white, white, white)
  frustum.name = 'camera frustum (simulated)'

  for (const o of [site, route, drone, frustum]) o.userData.layer = 'simulation'

  const last = waypoints.length - 1
  const samples: Array<{ t: number; at: Vector3 }> = []
  for (let i = 0; i <= last * SAMPLES_PER_LEG; i++) {
    const t = i / (last * SAMPLES_PER_LEG)
    samples.push({ t, at: curve.getPoint(t) })
  }
  let cursor = 0
  let flown = false
  const reported = new Vector3()
  const at = new Vector3()
  const nearest = (from: number, to: number) => {
    let best = from
    for (let i = from + 1; i <= to; i++) {
      if (samples[i]!.at.distanceToSquared(reported) < samples[best]!.at.distanceToSquared(reported)) best = i
    }
    return best
  }

  const place = ({ state, pose, batteryWh }: DronePlacement): FlightState => {
    if (state === 'in_flight') flown = true
    reported.copy(toScene(pose))
    if (state === 'docked') cursor = flown ? samples.length - 1 : 0
    else {
      cursor = nearest(cursor, Math.min(cursor + LOOK_AHEAD, samples.length - 1))
      // A scrub ahead outruns the window: look along the rest of the route.
      if (samples[cursor]!.at.distanceTo(reported) > FRUSTUM_RANGE_M) cursor = nearest(cursor, samples.length - 1)
    }
    // Between the nearest sample and the next, the share of the way the reported pose has come.
    const a = samples[cursor]!
    const b = samples[Math.min(cursor + 1, samples.length - 1)]!
    const leg = b.at.clone().sub(a.at)
    const share = leg.lengthSq() > 0 ? MathUtils.clamp(reported.clone().sub(a.at).dot(leg) / leg.lengthSq(), 0, 1) : 0
    const t = MathUtils.lerp(a.t, b.t, share)
    curve.getPoint(t, at)
    drone.position.copy(at)
    drone.rotation.set(0, -MathUtils.degToRad(pose.headingDeg), 0, 'YXZ')
    gimbal.rotation.x = MathUtils.degToRad(pose.pitchDeg)

    const toward = Math.min(last, Math.floor(t * last) + 1)
    const phase = phaseOf(state, flown, waypoints, toward)
    const spin = state === 'in_flight' ? 0.9 : 0
    for (const r of rotors) r.rotation.y += spin
    drone.updateMatrixWorld(true)
    frustum.visible = state === 'in_flight'
    frustum.update()
    return {
      phase,
      remainingWh: batteryWh,
      batteryPercent: (batteryWh / view.usableBatteryWh) * 100,
      altM: at.y,
      toward
    }
  }
  const restart = () => {
    cursor = 0
    flown = false
    place({
      state: 'docked',
      pose: { ...view.dock, headingDeg: waypoints[0]!.headingDeg, pitchDeg: 0 },
      batteryWh: view.usableBatteryWh
    })
  }
  restart()

  return {
    objects: [site, route, drone, frustum],
    place,
    restart,
    dronePosition: drone.position,
    dispose() {
      for (const o of [site, route, drone, frustum]) {
        o.traverse((child) => {
          if (child instanceof CSS2DObject) child.element.remove()
          if ('geometry' in child && child.geometry instanceof BufferGeometry) child.geometry.dispose()
          if ('material' in child) {
            const materials = Array.isArray(child.material) ? child.material : [child.material]
            for (const m of materials) (m as { dispose(): void }).dispose()
          }
        })
      }
      frustum.dispose()
    }
  }
}

function phaseOf(
  state: DronePlacement['state'],
  flown: boolean,
  waypoints: FlightPoint[],
  toward: number
): FlightPhase {
  if (state === 'docked') return flown ? 'landed' : 'docked'
  const a = waypoints[toward - 1]!
  const b = waypoints[toward]!
  if (a.kind === 'takeoff') return 'takeoff'
  if (b.kind === 'landing') return 'landing'
  // Along a segment's flight line, between and at its camera stations, the drone is taking its photos.
  if (a.kind === 'station' && b.kind === 'station') return 'station'
  return waypoints.slice(toward).some((w) => w.kind === 'station') ? 'transit' : 'return'
}

/**
 * A quadcopter from boxes and discs: a body, two crossed arms, four rotors and a gimbal camera under the nose. The
 * group is drawn `DRONE_DRAWN_SCALE` times life size; its forward is -z, like a camera's.
 */
function buildQuadcopter() {
  const drone = new Group()
  drone.name = 'drone (simulated)'
  const body = new Mesh(new BoxGeometry(0.28, 0.12, 0.36), lambert(colours.drone))
  const armGeometry = new BoxGeometry(0.9, 0.03, 0.05)
  const armA = new Mesh(armGeometry, lambert(colours.drone))
  armA.rotation.y = Math.PI / 4
  const armB = new Mesh(armGeometry, lambert(colours.drone))
  armB.rotation.y = -Math.PI / 4
  const rotors: Mesh[] = []
  const reach = 0.32
  for (const [x, z] of [
    [reach, reach],
    [-reach, reach],
    [reach, -reach],
    [-reach, -reach]
  ] as const) {
    const rotor = new Mesh(new BoxGeometry(0.34, 0.01, 0.04), lambert(colours.rotor))
    rotor.position.set(x, 0.06, z)
    rotors.push(rotor)
  }
  const frame = new Group()
  frame.scale.setScalar(DRONE_DRAWN_SCALE)
  frame.add(
    body,
    armA,
    armB,
    ...rotors,
    new Mesh(new BoxGeometry(0.08, 0.08, 0.08).translate(0, -0.1, -0.14), lambert(colours.drone))
  )
  // The gimbal sits outside the enlarged frame, so the camera frustum keeps its true range.
  const gimbal = new Group()
  gimbal.position.set(0, -0.1 * DRONE_DRAWN_SCALE, -0.14 * DRONE_DRAWN_SCALE)
  drone.add(frame, gimbal)
  return { drone, rotors, gimbal }
}
