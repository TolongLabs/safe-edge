import type { Position } from 'geojson'

/** Elmina Valley Central Park centroid: the origin of the scene's east-north-up frame. */
export const ELMINA_ORIGIN = { lon: 101.5135, lat: 3.1784 } as const

const METRES_PER_DEGREE = (Math.PI / 180) * 6_371_008.8
const METRES_PER_DEGREE_EAST = METRES_PER_DEGREE * Math.cos((ELMINA_ORIGIN.lat * Math.PI) / 180)

/**
 * Projects a GeoJSON position to metres east and north of the origin. Equirectangular is accurate enough across the
 * 5 km window. In the scene, east is +x, up is +y and north is -z.
 */
export function toLocal([lon, lat]: Position): [east: number, north: number] {
  return [(lon! - ELMINA_ORIGIN.lon) * METRES_PER_DEGREE_EAST, (lat! - ELMINA_ORIGIN.lat) * METRES_PER_DEGREE]
}
