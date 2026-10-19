import { createElminaPlanner } from '@safe-edge/sdk'
import barriersUrl from '../../../data/elmina/osm/barriers.geojson?url'
import parksUrl from '../../../data/elmina/osm/parks.geojson?url'
import pathsUrl from '../../../data/elmina/osm/paths.geojson?url'
import waterUrl from '../../../data/elmina/osm/water.geojson?url'

// The planner asks for its layers by their repo paths (elminaLayerPaths); the browser fetches the built copies.
const plannerFiles: Record<string, string> = {
  'data/elmina/osm/water.geojson': waterUrl,
  'data/elmina/osm/barriers.geojson': barriersUrl,
  'data/elmina/osm/paths.geojson': pathsUrl,
  'data/elmina/osm/parks.geojson': parksUrl
}

async function readJson(path: string): Promise<unknown> {
  const url = plannerFiles[path]
  if (!url) throw new Error(`The planner asked for ${path}, which the scene does not serve`)
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${path} answered ${response.status}`)
  return response.json()
}

/** The Elmina planner in the browser, for the scenarios that plan a patrol (S1), as the API runs it. */
export function loadPlanner(): ReturnType<typeof createElminaPlanner> {
  return createElminaPlanner(readJson, { thirdParties: [] })
}
