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

/** One planner waypoint, as `PatrolPlan.waypoints` gives it: WGS84, metres above ground, a planned time. */
export interface FlightPoint {
  lon: number
  lat: number
  altM: number
  headingDeg: number
  gimbalPitchDeg: number
  kind: 'takeoff' | 'transit' | 'station' | 'landing'
  eta: string
  /** Cumulative energy used on arrival. */
  energyWh: number
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

export interface Flight {
  objects: Object3D[]
  /** Puts the drone where the plan has it at `atMs` (epoch milliseconds) and returns what it is doing. */
  update(atMs: number): FlightState
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

/**
 * The dock on its roof, the planned route as a smooth `CatmullRomCurve3`, and a procedural quadcopter with its camera
 * frustum. `update` places the drone on the curve at the planned time: between two waypoints it moves in proportion to
 * their ETAs, so it hovers at a station exactly as long as the plan holds it there.
 */
export function buildFlight(view: FlightView): Flight {
  const { waypoints } = view
  if (waypoints.length < 2) throw new Error('A flight needs at least a take-off and a landing waypoint')
  const etas = waypoints.map((w) => Date.parse(w.eta))
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

  const route = new Line(
    new BufferGeometry().setFromPoints(curve.getPoints(Math.max(200, waypoints.length * 12))),
    new LineDashedMaterial({ color: colours.route, dashSize: 4, gapSize: 3 })
  )
  route.computeLineDistances()
  route.name = 'patrol route (simulated)'

  const { drone, rotors, gimbal } = buildQuadcopter()
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

  const at = new Vector3()
  const update = (atMs: number): FlightState => {
    const last = waypoints.length - 1
    let toward: number
    let fraction: number
    if (atMs <= etas[0]!) [toward, fraction] = [0, 0]
    else if (atMs >= etas[last]!) [toward, fraction] = [last, 1]
    else {
      toward = etas.findIndex((eta) => eta > atMs)
      const span = etas[toward]! - etas[toward - 1]!
      fraction = span > 0 ? (atMs - etas[toward - 1]!) / span : 1
    }
    const from = Math.max(0, toward - 1)
    const a = waypoints[from]!
    const b = waypoints[toward]!
    // CatmullRomCurve3 spaces its points evenly in t, so waypoint i sits at t = i / last.
    curve.getPoint(atMs >= etas[last]! ? 1 : (from + (toward === 0 ? 0 : fraction)) / last, at)
    drone.position.copy(at)
    const heading = lerpAngle(a.headingDeg, b.headingDeg, fraction)
    drone.rotation.set(0, -MathUtils.degToRad(heading), 0, 'YXZ')
    gimbal.rotation.x = MathUtils.degToRad(MathUtils.lerp(a.gimbalPitchDeg, b.gimbalPitchDeg, fraction))

    const usedWh = MathUtils.lerp(a.energyWh, b.energyWh, toward === 0 ? 0 : fraction)
    const remainingWh = Math.max(0, view.usableBatteryWh - usedWh)
    const phase = phaseOf(atMs, etas, waypoints, toward)
    const spin = phase === 'docked' || phase === 'landed' ? 0 : 0.9
    for (const r of rotors) r.rotation.y += spin
    drone.updateMatrixWorld(true)
    frustum.visible = phase !== 'docked' && phase !== 'landed'
    frustum.update()
    return {
      phase,
      remainingWh,
      batteryPercent: (remainingWh / view.usableBatteryWh) * 100,
      altM: at.y,
      toward
    }
  }
  update(etas[0]!)

  return {
    objects: [site, route, drone, frustum],
    update,
    dronePosition: drone.position,
    dispose() {
      for (const o of [site, route, drone, frustum]) {
        o.traverse((child) => {
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

function phaseOf(atMs: number, etas: number[], waypoints: FlightPoint[], toward: number): FlightPhase {
  if (atMs <= etas[0]!) return 'docked'
  if (atMs >= etas.at(-1)!) return 'landed'
  const a = waypoints[toward - 1]!
  const b = waypoints[toward]!
  if (a.kind === 'takeoff') return 'takeoff'
  if (b.kind === 'landing') return 'landing'
  // Along a segment's flight line, between and at its camera stations, the drone is taking its photos.
  if (a.kind === 'station' && b.kind === 'station') return 'station'
  return waypoints.slice(toward).some((w) => w.kind === 'station') ? 'transit' : 'return'
}

/** Interpolates two compass headings the short way round. */
function lerpAngle(fromDeg: number, toDeg: number, t: number) {
  const delta = ((((toDeg - fromDeg) % 360) + 540) % 360) - 180
  return fromDeg + delta * t
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
