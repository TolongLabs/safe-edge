import {
  Color,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  WebGLRenderer
} from 'three'
import { LineMaterial } from 'three/addons/lines/LineMaterial.js'
import { MapControls } from 'three/addons/controls/MapControls.js'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { basePalette, buildBaseLayers, type ElminaLayers } from './layers.ts'

/** Orbit rotates around the target with the left button; map pans with it, like a web map. */
export type ControlMode = 'orbit' | 'map'

export interface ElminaScene {
  setControlMode(mode: ControlMode): void
  dispose(): void
}

const MAX_PIXEL_RATIO = 1.5
const GROUND_SIZE_M = 12_000

/** Mounts the Elmina base scene in `container`, which must have a size, and renders until `dispose`. */
export function createElminaScene(container: HTMLElement, layers: ElminaLayers): ElminaScene {
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
  const objects = [ground, ...buildBaseLayers(layers)]
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
    dispose() {
      renderer.setAnimationLoop(null)
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
