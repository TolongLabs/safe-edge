import {
  Color,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Raycaster,
  Scene,
  Timer,
  Vector2,
  Vector3,
  WebGLRenderer
} from 'three'
import { LineMaterial } from 'three/addons/lines/LineMaterial.js'
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js'
import { MapControls } from 'three/addons/controls/MapControls.js'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js'
import { toLocal } from './frame.ts'
import { basePalette, buildBaseLayers, type ElminaLayers } from './layers.ts'
import { buildEdgeAssets, type EdgeAssetView } from './assets.ts'
import { buildFlight, type DronePlacement, type Flight, type FlightState, type FlightView } from './flight.ts'
import { buildMarkers, type SceneMarkers } from './markers.ts'
import { buildRain } from './rain.ts'
import { buildSegmentRibbons, segmentAt, segmentMidpoint, type PassState, type SegmentView } from './segments.ts'
import { lightingAt, type DayPhase } from './sky.ts'

/** Orbit rotates around the target with the left button; map pans with it, like a web map. */
export type ControlMode = 'orbit' | 'map'

export interface ElminaScene {
  setControlMode(mode: ControlMode): void
  /** Outlines a segment (or none) and, with `focus`, moves the camera to it, `distanceM` away (420 m by default). */
  select(segmentId: string | null, options?: { focus?: boolean; distanceM?: number }): void
  /** Draws a planned patrol (the dock, the route, the drone and its frustum), replacing any before; null removes it. */
  showFlight(flight: FlightView | null): void
  /** Puts the drone where drone-sim reports it. Needs a flight from `showFlight`. */
  placeDrone(drone: DronePlacement): FlightState
  /** Redraws the segments in new pass states, keyed by segment ID; segments left out keep theirs. */
  setPassStates(states: Record<string, PassState>): void
  /** Replaces the simulated markers: candidate pins, dropped-frame ticks and unknown stretches, each labelled. */
  setMarkers(markers: SceneMarkers): void
  /** With `true`, the camera moves to the drone and then keeps it in view as it flies. */
  followDrone(follow: boolean): void
  /** Lights the scene for a moment at Elmina (sun height and bearing) and draws rain at `rainMmH`, both simulated. */
  setConditions(conditions: { at: string; rainMmH: number }): DayPhase
  dispose(): void
}

export interface SceneOptions {
  /** Edge segments to draw in their pass-state colours. */
  segments?: SegmentView[]
  /** Expected inventory to model along its segments (fences, covers, gratings, gates, ring buoys, signs). */
  assets?: EdgeAssetView[]
  /** Called with the clicked segment's ID, or null when a click misses every segment. */
  onSelect?: (segmentId: string | null) => void
}

/** The TRD's frame budgets: 30 fps on a laptop, 24 fps on a phone (a coarse pointer), at these pixel ratios at most. */
const BUDGETS = {
  laptop: { frameMs: 1000 / 30, maxPixelRatio: 1.5 },
  phone: { frameMs: 1000 / 24, maxPixelRatio: 1 }
}
/** While frames miss the budget, the pixel ratio steps down by this much a window, to this floor. */
const PIXEL_RATIO_STEP = 0.25
const MIN_PIXEL_RATIO = 0.75
const BUDGET_WINDOW_FRAMES = 90
/** A longer gap between frames is a hidden tab or a one-off stall, not what drawing costs. */
const IGNORED_GAP_MS = 250
const GROUND_SIZE_M = 12_000
/** A press that moves further than this is a drag of the camera, not a click. */
const CLICK_SLOP_PX = 5
const FOCUS_DISTANCE_M = 420
const CLICK_TOLERANCE_M = 6

/** Mounts the Elmina base scene in `container`, which must have a size, and renders until `dispose`. */
export function createElminaScene(
  container: HTMLElement,
  layers: ElminaLayers,
  options: SceneOptions = {}
): ElminaScene {
  const renderer = new WebGLRenderer({ antialias: true })
  const budget = matchMedia('(pointer: coarse)').matches ? BUDGETS.phone : BUDGETS.laptop
  let pixelRatio = Math.min(devicePixelRatio, budget.maxPixelRatio)
  renderer.setPixelRatio(pixelRatio)
  renderer.domElement.dataset.pixelRatio = String(pixelRatio)
  container.append(renderer.domElement)

  const scene = new Scene()
  scene.background = new Color(basePalette.sky)
  const sky = new HemisphereLight(0xffffff, basePalette.ground, 2)
  const sun = new DirectionalLight(0xffffff, 1.5)
  sun.position.set(-1, 2, 1)
  const rain = buildRain()
  scene.add(sky, sun, rain.points)

  const ground = new Mesh(
    new PlaneGeometry(GROUND_SIZE_M, GROUND_SIZE_M).rotateX(-Math.PI / 2),
    new MeshBasicMaterial({ color: basePalette.ground, depthWrite: false })
  )
  ground.name = 'ground'
  let segments = options.segments ?? []
  let ribbons = buildSegmentRibbons(segments)
  const assets = buildEdgeAssets(options.assets ?? [])
  const objects = [ground, ...buildBaseLayers(layers), ...assets.objects]
  const ribbonOrder = objects.length + 1
  ribbons.forEach((r) => (r.renderOrder = ribbonOrder))
  // World-unit ribbons pass the depth test over anything near the ground, so the modelled assets draw after them.
  assets.objects.forEach((o) => (o.renderOrder = ribbonOrder + 1))
  scene.add(...objects, ...ribbons)
  // Flat surfaces are unlit, so the time of day dims them through their colour instead of the lights.
  const unlit = objects
    .map((o) => o.material)
    .filter((m): m is MeshBasicMaterial | LineMaterial => m instanceof MeshBasicMaterial || m instanceof LineMaterial)
    .map((material) => ({ material, base: material.color.clone() }))
  const setConditions = ({ at, rainMmH }: { at: string; rainMmH: number }) => {
    const lighting = lightingAt(new Date(at), rainMmH)
    ;(scene.background as Color).copy(lighting.sky)
    sky.intensity = lighting.hemisphere
    sun.intensity = lighting.sun
    sun.position.set(...lighting.sunDirection)
    for (const { material, base } of unlit) material.color.copy(base).multiply(lighting.tint)
    rain.setRate(rainMmH, lighting.daylight)
    return lighting.phase
  }
  const setPassStates = (states: Record<string, PassState>) => {
    if (!segments.some((s) => states[s.id] !== undefined && states[s.id] !== s.state)) return
    segments = segments.map((s) => ({ ...s, state: states[s.id] ?? s.state }))
    scene.remove(...ribbons)
    for (const r of ribbons) {
      r.geometry.dispose()
      r.material.dispose()
    }
    ribbons = buildSegmentRibbons(segments)
    ribbons.forEach((r) => {
      r.renderOrder = ribbonOrder
      r.material.resolution.set(container.clientWidth, container.clientHeight)
    })
    scene.add(...ribbons)
  }

  let markers: ReturnType<typeof buildMarkers> | null = null
  const setMarkers = (next: SceneMarkers) => {
    if (markers) {
      scene.remove(...markers.objects)
      markers.dispose()
    }
    markers = buildMarkers(next, { itemPositions: assets.itemPositions, segments })
    for (const o of markers.objects) {
      o.traverse((child) => {
        if ('material' in child && child.material instanceof LineMaterial) {
          child.material.resolution.set(container.clientWidth, container.clientHeight)
        }
      })
    }
    if (markers.objects.length > 0) scene.add(...markers.objects)
  }

  let flight: Flight | null = null
  const showFlight = (view: FlightView | null) => {
    if (flight) {
      scene.remove(...flight.objects)
      flight.dispose()
      following = false
    }
    flight = view ? buildFlight(view) : null
    if (flight) scene.add(...flight.objects)
  }

  // Start south of the lake, looking north over the retention ponds to Sungai Buloh.
  const camera = new PerspectiveCamera(45, 1, 1, 30_000)
  camera.position.set(400, 2200, 1600)
  const controls = {
    orbit: new OrbitControls(camera, renderer.domElement),
    map: new MapControls(camera, renderer.domElement)
  }
  for (const c of Object.values(controls)) {
    c.target.set(200, 0, -800)
    c.maxPolarAngle = Math.PI / 2 - 0.05
    c.minDistance = 30
    c.maxDistance = 9_000
  }
  let active: OrbitControls = controls.orbit
  const setControlMode = (mode: ControlMode) => {
    controls[mode].target.copy(active.target)
    active = controls[mode]
    controls.orbit.enabled = mode === 'orbit'
    controls.map.enabled = mode === 'map'
    active.update()
  }
  setControlMode('orbit')

  // The selected segment gets a dark outline under its ribbon.
  const outlineMaterial = new LineMaterial({ color: 0x1c2925, linewidth: 14, worldUnits: true, depthWrite: false })
  let outline: LineSegments2 | null = null
  const select = (segmentId: string | null, { focus = false, distanceM = FOCUS_DISTANCE_M } = {}) => {
    if (outline) {
      scene.remove(outline)
      outline.geometry.dispose()
      outline = null
    }
    const segment = segments.find((s) => s.id === segmentId)
    if (segmentId !== null && !segment) throw new Error(`No segment ${segmentId} in this scene`)
    if (!segment) return
    const positions: number[] = []
    const line = segment.geometry.coordinates
    for (let i = 1; i < line.length; i++) {
      const [ae, an] = toLocal(line[i - 1]!)
      const [be, bn] = toLocal(line[i]!)
      positions.push(ae, 0.2, -an, be, 0.2, -bn)
    }
    outline = new LineSegments2(new LineSegmentsGeometry().setPositions(positions), outlineMaterial)
    outline.name = 'selected segment'
    outline.renderOrder = objects.length
    outlineMaterial.resolution.set(container.clientWidth, container.clientHeight)
    scene.add(outline)
    if (focus) {
      const [x, z] = segmentMidpoint(segment)
      const offset = camera.position.clone().sub(active.target).setLength(distanceM)
      for (const c of Object.values(controls)) c.target.set(x, 0, z)
      camera.position.set(x, 0, z).add(offset)
      active.update()
    }
  }

  let following = false
  const followFrom = new Vector3()
  const followDrone = (follow: boolean) => {
    if (!flight) throw new Error('This scene has no flight to follow')
    following = follow
    if (!follow) return
    // Start close, behind and above the drone, looking down at it.
    const offset = new Vector3(-60, 45, 70)
    for (const c of Object.values(controls)) c.target.copy(flight.dronePosition)
    camera.position.copy(flight.dronePosition).add(offset)
    followFrom.copy(flight.dronePosition)
    active.update()
  }
  const placeDrone = (drone: DronePlacement) => {
    if (!flight) throw new Error('This scene has no flight to place')
    const state = flight.place(drone)
    if (following) {
      // Carry the camera along by the drone's move, so orbiting and zooming still work while it follows.
      const moved = flight.dronePosition.clone().sub(followFrom)
      for (const c of Object.values(controls)) c.target.add(moved)
      camera.position.add(moved)
      followFrom.copy(flight.dronePosition)
    }
    return state
  }

  const raycaster = new Raycaster()
  raycaster.camera = camera
  // World units for world-unit ribbons: a click up to this far outside a ribbon's edge still selects it.
  raycaster.params.Line2 = { threshold: CLICK_TOLERANCE_M }
  let pressedAt: Vector2 | null = null
  const onPointerDown = (event: PointerEvent) => (pressedAt = new Vector2(event.clientX, event.clientY))
  const onPointerUp = (event: PointerEvent) => {
    const moved = pressedAt?.distanceTo(new Vector2(event.clientX, event.clientY)) ?? Infinity
    pressedAt = null
    if (moved > CLICK_SLOP_PX || !options.onSelect) return
    const box = renderer.domElement.getBoundingClientRect()
    const ndc = new Vector2(
      ((event.clientX - box.left) / box.width) * 2 - 1,
      -((event.clientY - box.top) / box.height) * 2 + 1
    )
    raycaster.setFromCamera(ndc, camera)
    const [hit] = raycaster.intersectObjects(ribbons, false)
    const id = hit?.faceIndex != null ? segmentAt(hit.object as LineSegments2, hit.faceIndex) : null
    select(id)
    options.onSelect(id)
  }
  renderer.domElement.addEventListener('pointerdown', onPointerDown)
  renderer.domElement.addEventListener('pointerup', onPointerUp)

  const attribution = document.createElement('a')
  attribution.href = 'https://www.openstreetmap.org/copyright'
  attribution.target = '_blank'
  attribution.rel = 'noreferrer'
  attribution.textContent = '© OpenStreetMap contributors'
  Object.assign(attribution.style, {
    position: 'absolute',
    right: '0',
    bottom: '0',
    padding: '2px 6px',
    font: '12px system-ui, sans-serif',
    color: '#333',
    background: 'rgb(255 255 255 / 0.8)'
  })
  if (getComputedStyle(container).position === 'static') container.style.position = 'relative'
  container.append(attribution)

  // Labels on simulated things: HTML chips over the canvas, placed by the camera each frame.
  const labels = new CSS2DRenderer()
  Object.assign(labels.domElement.style, { position: 'absolute', inset: '0', pointerEvents: 'none' })
  container.append(labels.domElement)

  const resize = () => {
    const { clientWidth: width, clientHeight: height } = container
    renderer.setSize(width, height)
    labels.setSize(width, height)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    // Ribbon materials need the viewport size to place their vertices.
    scene.traverse((o) => {
      if ('material' in o && o.material instanceof LineMaterial) o.material.resolution.set(width, height)
    })
  }
  const observer = new ResizeObserver(resize)
  observer.observe(container)
  resize()

  // Fill rate is what a weak GPU runs out of, so frames that miss the budget cost resolution, not smoothness.
  let windowMs = 0
  let windowFrames = 0
  const keepToBudget = (frameMs: number) => {
    if (frameMs <= 0 || frameMs >= IGNORED_GAP_MS) return
    windowMs += frameMs
    if (++windowFrames < BUDGET_WINDOW_FRAMES) return
    if (windowMs / windowFrames > budget.frameMs && pixelRatio > MIN_PIXEL_RATIO) {
      pixelRatio = Math.max(MIN_PIXEL_RATIO, pixelRatio - PIXEL_RATIO_STEP)
      renderer.setPixelRatio(pixelRatio)
      renderer.domElement.dataset.pixelRatio = String(pixelRatio)
    }
    windowMs = windowFrames = 0
  }

  const timer = new Timer()
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')
  renderer.setAnimationLoop((time) => {
    timer.update(time)
    const seconds = timer.getDelta()
    keepToBudget(seconds * 1000)
    active.update()
    rain.update(reducedMotion.matches ? 0 : seconds, active.target, camera.position.distanceTo(active.target))
    renderer.render(scene, camera)
    labels.render(scene, camera)
  })

  return {
    setControlMode,
    select,
    showFlight,
    placeDrone,
    followDrone,
    setPassStates,
    setMarkers,
    setConditions,
    dispose() {
      showFlight(null)
      setMarkers({ pins: [], dropped: [], unknowns: [] })
      labels.domElement.remove()
      renderer.setAnimationLoop(null)
      rain.dispose()
      timer.dispose()
      renderer.domElement.removeEventListener('pointerdown', onPointerDown)
      renderer.domElement.removeEventListener('pointerup', onPointerUp)
      select(null)
      outlineMaterial.dispose()
      observer.disconnect()
      for (const c of Object.values(controls)) c.dispose()
      for (const o of [...objects, ...ribbons]) {
        o.geometry.dispose()
        o.material.dispose()
      }
      renderer.dispose()
      renderer.domElement.remove()
      attribution.remove()
    }
  }
}
