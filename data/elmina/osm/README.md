# Elmina OpenStreetMap extract

GeoJSON layers for the Elmina study window, fetched from Overpass by [`fetch-osm.ts`](/packages/scene/scripts/fetch-osm.ts). The planner reads the water, barrier, path and park layers through `elminaLayerPaths`; the scene also draws the buildings.

Contents:

1.  [Licence](#licence)
1.  [Layers](#layers)
1.  [Refresh the extract](#refresh-the-extract)

## Licence

© OpenStreetMap contributors. The data is under the [Open Database License 1.0](https://opendatacommons.org/licenses/odbl/1-0/). Wherever it appears, show "© OpenStreetMap contributors" linked to the [copyright page](https://www.openstreetmap.org/copyright). Each file repeats the notice in its `attribution` and `license` members. A public derivative database must also be shared under the ODbL.

## Layers

Fetched on 19 Oct 2026 against OSM base `2026-10-19T07:53:46Z`, for west 101.490, south 3.160, east 101.540, north 3.200. Features that cross the window keep their whole geometry; nothing is clipped. The comparison is with the [research extract](/docs/research/drone-integration/data/), which came from the OSM editing API on 17 Oct 2026.

| Layer     | Features | Geometry               | Research extract | Difference                                                                     |
| --------- | -------: | ---------------------- | ---------------: | ------------------------------------------------------------------------------ |
| water     |       56 | 28 polygons, 28 lines  |               55 | Adds relation 18162987, Tasik Subang (Subang Reservoir), a multipolygon        |
| parks     |       56 | 29 points, 27 polygons |               56 | Same features                                                                  |
| paths     |      418 | 418 lines              |              418 | Same features                                                                  |
| barriers  |       43 | 40 points, 3 lines     |               44 | Drops node 5701087205, a gate just south of the window                         |
| buildings |    5,197 | 5,196 polygons, 1 line |             none | New, from `building=*`; way 1125174813 is an unclosed way tagged as a building |

The four pilot water edges, the lake and three retention ponds, have the same geometry in both extracts, so [`seed.json`](/data/elmina/fixtures/seed.json) regenerates unchanged.

## Refresh the extract

```bash
bun run fetch:osm
bun run generate:seed
```

The script sends one request to the public Overpass instance and prints the table above. Under load the instance answers 429 or 504; wait a minute and run it again. Segment IDs in the seed come from the water edges, so check that `seed.json` has no diff after `generate:seed`.
