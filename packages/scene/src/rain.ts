import { BufferAttribute, BufferGeometry, Color, Points, PointsMaterial, type Vector3 } from 'three'

const MAX_DROPS = 12_000
/** How fast drops cross the rain box, in box heights a second. A look, not a measurement. */
const FALL_PER_S = 0.9
/** Drops darker than a pale daytime map, lighter than the night. */
const DROP_COLOURS = { day: new Color(0x4f6675), night: new Color(0xc9d6de) }

/**
 * The share of drops drawn at a rain rate, stepped by the JPS one-hour bins the planner uses (TRD): light 1–10 mm,
 * moderate 11–30 mm, heavy 31–60 mm, very heavy above 60 mm.
 */
export function rainDensity(rainMmH: number): number {
  if (rainMmH <= 0) return 0
  if (rainMmH <= 10) return 0.2
  if (rainMmH <= 30) return 0.45
  if (rainMmH <= 60) return 0.75
  return 1
}

export interface Rain {
  points: Points<BufferGeometry, PointsMaterial>
  /** Draws drops for `rainMmH`, coloured to show against the map at `daylight` (0 night to 1 day). */
  setRate(rainMmH: number, daylight: number): void
  /** Moves the rain box over `target`, sized to the camera's distance, and lets the drops fall for `seconds`. */
  update(seconds: number, target: Vector3, cameraDistanceM: number): void
  dispose(): void
}

/** Rain as falling points in a box that follows the camera's target, so it shows wherever the view goes. */
export function buildRain(): Rain {
  // A fixed seed draws the same drops every time, so screenshots of the same moment match.
  let seed = 7
  const random = () => ((seed = (seed * 16_807) % 2_147_483_647) - 1) / 2_147_483_646
  const unit = new Float32Array(MAX_DROPS * 3)
  for (let i = 0; i < unit.length; i++) unit[i] = random() - 0.5
  const geometry = new BufferGeometry()
  const positions = new BufferAttribute(unit, 3)
  geometry.setAttribute('position', positions)
  geometry.setDrawRange(0, 0)
  const material = new PointsMaterial({
    color: DROP_COLOURS.night,
    size: 2,
    sizeAttenuation: false,
    transparent: true,
    opacity: 0.6,
    depthWrite: false,
    fog: false
  })
  const points = new Points(geometry, material)
  points.name = 'rain'
  points.userData.layer = 'simulated'
  points.frustumCulled = false
  points.visible = false

  return {
    points,
    setRate(rainMmH, daylight) {
      material.color.copy(DROP_COLOURS.night).lerp(DROP_COLOURS.day, daylight)
      const drawn = Math.round(MAX_DROPS * rainDensity(rainMmH))
      geometry.setDrawRange(0, drawn)
      points.visible = drawn > 0
    },
    update(seconds, target, cameraDistanceM) {
      if (!points.visible) return
      const width = Math.min(Math.max(cameraDistanceM * 0.9, 200), 2_500)
      points.scale.set(width, width * 0.6, width)
      points.position.set(target.x, (width * 0.6) / 2, target.z)
      if (seconds <= 0) return
      const fall = FALL_PER_S * seconds
      for (let i = 1; i < unit.length; i += 3) {
        unit[i]! -= fall
        if (unit[i]! < -0.5) unit[i]! += 1
      }
      positions.needsUpdate = true
    },
    dispose() {
      geometry.dispose()
      material.dispose()
    }
  }
}
