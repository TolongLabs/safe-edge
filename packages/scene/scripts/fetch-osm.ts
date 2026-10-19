// Fetches the Elmina window from Overpass (DATA-1): the research query plus `building=*`, saved as one GeoJSON layer
// per kind in data/elmina/osm/ with the ODbL notice, then compared with the research extract. The only code that calls
// Overpass; the research extract came from the OSM editing API, which is not for read-only use.
// Run: bun run fetch:osm
import { join } from 'node:path'
import type { Feature, FeatureCollection, Geometry } from 'geojson'
import osmtogeojson from 'osmtogeojson'

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'
const BBOX = { west: 101.49, south: 3.16, east: 101.54, north: 3.2 }
const repoRoot = join(import.meta.dir, '../../..')
const outDir = join(repoRoot, 'data/elmina/osm')
const researchDir = join(repoRoot, 'docs/research/drone-integration/data')

// One line of the query per filter. A feature goes to the first layer whose filter it matches, so no feature is in
// two layers.
const filters = [
  { layer: 'water', element: 'nwr', key: 'natural', match: '^water$' },
  { layer: 'water', element: 'nwr', key: 'water', match: '^(pond|lake|reservoir|basin)$' },
  { layer: 'water', element: 'nwr', key: 'waterway', match: '^(drain|ditch|canal|stream|river)$' },
  { layer: 'parks', element: 'nwr', key: 'leisure', match: '^(park|playground)$' },
  { layer: 'paths', element: 'way', key: 'highway', match: '^(footway|path|cycleway)$' },
  { layer: 'barriers', element: 'nwr', key: 'barrier', match: '^(fence|wall|gate|guard_rail)$' },
  { layer: 'buildings', element: 'nwr', key: 'building', match: '.' }
] as const
type Layer = (typeof filters)[number]['layer']

// Overpass bbox filters take south, west, north, east.
const box = `(${[BBOX.south, BBOX.west, BBOX.north, BBOX.east].map((n) => n.toFixed(3)).join(',')})`
const query = `[out:json][timeout:180];
(
${filters.map((f) => `  ${f.element}["${f.key}"~"${f.match}"]${box};`).join('\n')}
);
out geom;`

const response = await fetch(OVERPASS_URL, {
  method: 'POST',
  headers: {
    'content-type': 'application/x-www-form-urlencoded',
    'user-agent': 'SafeEdge-osm-extract/1.0 (hackathon prototype; one manual request per run)'
  },
  body: new URLSearchParams({ data: query })
})
if (!response.ok) throw new Error(`${OVERPASS_URL} answered ${response.status}: ${await response.text()}`)
const body = (await response.json()) as { osm3s: { timestamp_osm_base: string }; remark?: string }
// Overpass answers 200 with a remark when the query times out or runs out of memory.
if (body.remark) throw new Error(`Overpass remark: ${body.remark}`)

type OsmProperties = { osm_type: string; osm_id: number } & Record<string, string | number>
const layers = Object.fromEntries(filters.map((f) => [f.layer, [] as Feature<Geometry, OsmProperties>[]])) as Record<
  Layer,
  Feature<Geometry, OsmProperties>[]
>

for (const feature of osmtogeojson(body, { flatProperties: false }).features) {
  const { type, id, tags, tainted } = feature.properties as {
    type: string
    id: number
    tags: Record<string, string>
    tainted?: boolean
  }
  if (tainted) throw new Error(`${type}/${id} has incomplete geometry`)
  const filter = filters.find(
    (f) => (f.element === 'nwr' || f.element === type) && new RegExp(f.match).test(tags[f.key] ?? '')
  )
  if (!filter) throw new Error(`${type}/${id} matches no layer`)
  const { geometry } = feature
  layers[filter.layer].push({
    type: 'Feature',
    id: `${type}/${id}`,
    properties: { osm_type: type, osm_id: id, ...tags },
    // osmtogeojson makes a closed wall an area. It is still a run of wall, so barriers stay lines, as in the research.
    geometry:
      filter.layer === 'barriers' && geometry.type === 'Polygon' && geometry.coordinates.length === 1
        ? { type: 'LineString', coordinates: geometry.coordinates[0]! }
        : geometry
  })
}

const retrieved = new Date().toISOString().slice(0, 10)
const rows = [
  '| Layer | Research | Overpass | Added | Removed | Geometry |',
  '| --- | ---: | ---: | ---: | ---: | --- |'
]
for (const [name, features] of Object.entries(layers)) {
  features.sort((a, b) => String(a.id).localeCompare(String(b.id)))
  const collection = {
    type: 'FeatureCollection',
    name,
    attribution: '© OpenStreetMap contributors; https://www.openstreetmap.org/copyright',
    license: 'Open Database License (ODbL) 1.0',
    source: `Overpass API ${OVERPASS_URL}; query in packages/scene/scripts/fetch-osm.ts; bbox 101.49,3.16,101.54,3.20`,
    osm_base: body.osm3s.timestamp_osm_base,
    retrieved,
    features
  }
  await Bun.write(join(outDir, `${name}.geojson`), `${JSON.stringify(collection)}\n`)

  const ids = new Set(features.map((f) => f.id))
  const researchFile = Bun.file(join(researchDir, `${name}.geojson`))
  const research = (await researchFile.exists())
    ? new Set(((await researchFile.json()) as FeatureCollection).features.map((f) => f.id))
    : undefined
  const kinds = new Map<string, number>()
  for (const f of features) kinds.set(f.geometry.type, (kinds.get(f.geometry.type) ?? 0) + 1)
  const geometry = [...kinds].map(([kind, n]) => `${n} ${kind}`).join(', ')
  rows.push(
    research
      ? `| ${name} | ${research.size} | ${ids.size} | ${[...ids].filter((id) => !research.has(id)).length} | ${[...research].filter((id) => !ids.has(id)).length} | ${geometry} |`
      : `| ${name} | none | ${ids.size} | | | ${geometry} |`
  )
}
console.log(`wrote ${Object.keys(layers).join(', ')} to ${outDir} (OSM base ${body.osm3s.timestamp_osm_base})`)
console.log(rows.join('\n'))
