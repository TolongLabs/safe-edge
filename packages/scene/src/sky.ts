import { Color, MathUtils } from 'three'
import { ELMINA_ORIGIN } from './frame.ts'

const RAD = Math.PI / 180

/**
 * The sun's height above the horizon and its bearing clockwise from north, in degrees, from NOAA's low-precision
 * solar equations (within about a degree, plenty to light a scene).
 */
export function sunPosition(at: Date, { lon, lat }: { lon: number; lat: number } = ELMINA_ORIGIN) {
  const startOfYear = Date.UTC(at.getUTCFullYear(), 0, 1)
  const hours = at.getUTCHours() + at.getUTCMinutes() / 60 + at.getUTCSeconds() / 3600
  const dayOfYear = Math.floor((at.getTime() - startOfYear) / 86_400_000)
  const g = ((2 * Math.PI) / 365) * (dayOfYear + (hours - 12) / 24)
  const equationOfTimeMin =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(g) -
      0.032077 * Math.sin(g) -
      0.014615 * Math.cos(2 * g) -
      0.040849 * Math.sin(2 * g))
  const declination =
    0.006918 -
    0.399912 * Math.cos(g) +
    0.070257 * Math.sin(g) -
    0.006758 * Math.cos(2 * g) +
    0.000907 * Math.sin(2 * g) -
    0.002697 * Math.cos(3 * g) +
    0.00148 * Math.sin(3 * g)
  const solarMinutes = hours * 60 + equationOfTimeMin + 4 * lon
  const hourAngle = (solarMinutes / 4 - 180) * RAD
  const phi = lat * RAD
  const cosZenith = Math.sin(phi) * Math.sin(declination) + Math.cos(phi) * Math.cos(declination) * Math.cos(hourAngle)
  const elevationDeg = 90 - Math.acos(MathUtils.clamp(cosZenith, -1, 1)) / RAD
  const fromSouth = Math.atan2(
    Math.sin(hourAngle),
    Math.cos(hourAngle) * Math.sin(phi) - Math.tan(declination) * Math.cos(phi)
  )
  return { elevationDeg, azimuthDeg: (fromSouth / RAD + 180) % 360 }
}

export type DayPhase = 'night' | 'dawn' | 'day' | 'dusk'

/** How the scene is lit: sky colour, a level for unlit surfaces, light intensities and where the sun shines from. */
export interface Lighting {
  phase: DayPhase
  /** 0 at night, 1 in full day, in between through twilight. */
  daylight: number
  sky: Color
  /** Multiplies the colour of unlit surfaces (ground, parks, water, paths). */
  tint: Color
  hemisphere: number
  sun: number
  /** Unit vector toward the sun in scene axes (x east, y up, z south). */
  sunDirection: [x: number, y: number, z: number]
  /** 0 when dry, up to 1 in very heavy rain. */
  overcast: number
}

const colours = {
  daySky: new Color(0xdfe8ee),
  nightSky: new Color(0x15202b),
  horizon: new Color(0xf0c9a0),
  rainSky: new Color(0x8e989e),
  nightTint: new Color(0x4b5872)
}

/** Civil twilight: the sun up to 6° below the horizon. */
const TWILIGHT_DEG = 6

/** Lighting for a moment at Elmina and a rain rate in mm/h. Night stays legible: unlit surfaces keep 30% of daylight. */
export function lightingAt(at: Date, rainMmH: number): Lighting {
  const { elevationDeg, azimuthDeg } = sunPosition(at)
  const daylight = MathUtils.smoothstep(elevationDeg, -TWILIGHT_DEG - 2, TWILIGHT_DEG + 2)
  const nearHorizon = 1 - MathUtils.clamp(Math.abs(elevationDeg) / (TWILIGHT_DEG + 2), 0, 1)
  const overcast = MathUtils.clamp(rainMmH / 60, 0, 1)

  const sky = colours.nightSky.clone().lerp(colours.daySky, daylight)
  sky.lerp(colours.horizon, 0.35 * nearHorizon * (1 - overcast))
  sky.lerp(colours.rainSky.clone().multiplyScalar(0.25 + 0.75 * daylight), 0.65 * overcast)

  const tint = colours.nightTint.clone().lerp(new Color(0xffffff), daylight)
  tint.multiplyScalar(1 - 0.3 * overcast)

  const up = Math.max(elevationDeg, 5) * RAD
  const bearing = azimuthDeg * RAD
  const phase: DayPhase =
    elevationDeg >= TWILIGHT_DEG ? 'day' : elevationDeg < -TWILIGHT_DEG ? 'night' : azimuthDeg < 180 ? 'dawn' : 'dusk'
  return {
    phase,
    daylight,
    sky,
    tint,
    hemisphere: 2 * (0.3 + 0.7 * daylight) * (1 - 0.35 * overcast),
    sun: 1.5 * daylight * (1 - 0.8 * overcast),
    sunDirection: [Math.cos(up) * Math.sin(bearing), Math.sin(up), -Math.cos(up) * Math.cos(bearing)],
    overcast
  }
}
