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
  Vector2,
  WebGLRenderer
} from 'three'
import { LineMaterial } from 'three/addons/lines/LineMaterial.js'
import { MapControls } from 'three/addons/controls/MapControls.js'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js'
import { toLocal } from './frame.ts'
import { basePalette, buildBaseLayers, type ElminaLayers } from './layers.ts'
import { buildSegmentRibbons, segmentAt, segmentMidpoint, type SegmentView } from './segments.ts'

/** Orbit rotates around the target with the left button; map pans with it, like a web map. */
export type ControlMode = 'orbit' | 'map'

export interface ElminaScene {
  setControlMode(mode: ControlMode): void
  /** Outlines a segment (or none) and, with `focus`, flies the camera to it. */
  select(segmentId: string | null, options?: { focus?: boolean }): void
  dispose(): void
}

export interface SceneOptions {
  /** Edge segments to draw in their pass-state colours. */
  segments?: SegmentView[]
  /** Called with the clicked segment's ID, or null when a click misses every segment. */
  onSelect?: (segmentId: string | null) => void
}

const MAX_PIXEL_RATIO = 1.5
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
  renderer.setPixelRatio(Math.min(devicePixelRatio, MAX_PIXEL_RATIO))
  container.append(renderer.domElement)

  const scene = new Scene()
  scene.background = new Color(basePalette.sky)
  scene.add(new HemisphereLight(0xffffff, basePalette.ground, 2))
  const sun = new DirectionalLight(0xffffff, 1.5)
  sun.position.set(-1, 2, 1)
  scene.add(sun)

  const ground = new Mesh(
    new PlaneGeometry(GROUND_SIZE_M, GROUND_SIZE_M).rotateX(-Math.PI / 2),
    new MeshBasicMaterial({ color: basePalette.ground, depthWrite: false })
  )
  ground.name = 'ground'
  const segments = options.segments ?? []
  const ribbons = buildSegmentRibbons(segments)
  const objects = [ground, ...buildBaseLayers(layers), ...ribbons]
  ribbons.forEach((r) => (r.renderOrder = objects.length + 1))
  scene.add(...objects)

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
  const outlineMaterial = new LineMaterial({ color: 0x1c2925, linewidth: 16, worldUnits: true })
  let outline: LineSegments2 | null = null
  const select = (segmentId: string | null, { focus = false } = {}) => {
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
      positions.push(ae, 1, -an, be, 1, -bn)
    }
    outline = new LineSegments2(new LineSegmentsGeometry().setPositions(positions), outlineMaterial)
    outline.name = 'selected segment'
    outline.renderOrder = objects.length
    outlineMaterial.resolution.set(container.clientWidth, container.clientHeight)
    scene.add(outline)
    if (focus) {
      const [x, z] = segmentMidpoint(segment)
      const offset = camera.position.clone().sub(active.target).setLength(FOCUS_DISTANCE_M)
      for (const c of Object.values(controls)) c.target.set(x, 0, z)
      camera.position.set(x, 0, z).add(offset)
      active.update()
    }
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

  const resize = () => {
    const { clientWidth: width, clientHeight: height } = container
    renderer.setSize(width, height)
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

  renderer.setAnimationLoop(() => {
    active.update()
    renderer.render(scene, camera)
  })

  return {
    setControlMode,
    select,
    dispose() {
      renderer.setAnimationLoop(null)
      renderer.domElement.removeEventListener('pointerdown', onPointerDown)
      renderer.domElement.removeEventListener('pointerup', onPointerUp)
      select(null)
      outlineMaterial.dispose()
      observer.disconnect()
      for (const c of Object.values(controls)) c.dispose()
      for (const o of objects) {
        o.geometry.dispose()
        o.material.dispose()
      }
      renderer.dispose()
      renderer.domElement.remove()
      attribution.remove()
    }
  }
}
