# Licences

Every library, model, dataset and 3D asset that the Safe Edge prototype uses, with its licence, its source and the credit the app must show. The [TRD](/docs/TRD.md#security-and-privacy) requires this file. Each licence below was checked at its source on 18 October 2026.

Contents:

1.  [Rules](#rules)
1.  [Libraries](#libraries)
1.  [Models and AI services](#models-and-ai-services)
1.  [Data](#data)
    1.  [Data conditions](#data-conditions)
1.  [3D assets](#3d-assets)
1.  [Not used](#not-used)
1.  [See also](#see-also)

## Rules

- Add a row here before a library, model, dataset or asset lands in the repo. Check its licence on its live page.
- Use no AGPL or GPL model, and no code under a non-commercial licence.
- The app copies each **Credit** cell word for word. To change a credit, change it here first.
- MIT and Apache-2.0 require the licence text to travel with every distributed copy of the code. Keep the licence notices in the public build.

## Libraries

Versions are the latest on npm on 18 October 2026. `bun.lock` pins what is installed. Update a row when a major version or a licence changes. No library needs an on-screen credit.

| Package                                              | Version        | Licence    | Used in                             |
| ---------------------------------------------------- | -------------- | ---------- | ----------------------------------- |
| [`three`][three]                                     | 0.186.1        | MIT        | Web: scene engine                   |
| [`3d-tiles-renderer`][3d-tiles]                      | 0.5.3          | Apache-2.0 | Web: optional photoreal fly-in (P2) |
| [`@turf/turf`][turf]                                 | 7.4.0          | MIT        | Planner: edge geometry              |
| [`react`, `react-dom`][react]                        | 19.3.1         | MIT        | Web: 2D screens                     |
| [`zod`][zod]                                         | 4.6.7          | MIT        | Contracts: schemas                  |
| [`hono`][hono]                                       | 4.13.13        | MIT        | API: REST server                    |
| [`@anthropic-ai/sdk`][anthropic-sdk]                 | 0.135.0        | MIT        | API: Claude calls                   |
| [`@modelcontextprotocol/server`][mcp]                | 2.3.1          | Apache-2.0 | MCP server                          |
| [`vite`][vite], [`@vitejs/plugin-react`][vite-react] | 8.3.4, 6.1.2   | MIT        | Build only                          |
| [`typescript`][typescript]                           | 7.0.2          | Apache-2.0 | Build only                          |
| [`openapi-typescript`][openapi-ts]                   | 7.13.0         | MIT        | Build only: types from the contract |
| [`@playwright/test`][playwright]                     | 1.64.1         | Apache-2.0 | Tests only                          |
| `prettier`, `husky`, `lint-staged`, `@commitlint/*`  | See `bun.lock` | MIT        | Repo tooling only                   |

[three]: https://github.com/mrdoob/three.js
[3d-tiles]: https://github.com/NASA-AMMOS/3DTilesRendererJS
[turf]: https://github.com/Turfjs/turf
[react]: https://github.com/react/react
[zod]: https://github.com/colinhacks/zod
[hono]: https://github.com/honojs/hono
[anthropic-sdk]: https://github.com/anthropics/anthropic-sdk-typescript
[mcp]: https://github.com/modelcontextprotocol/typescript-sdk
[vite]: https://github.com/vitejs/vite
[vite-react]: https://github.com/vitejs/vite-plugin-react
[typescript]: https://github.com/microsoft/TypeScript
[openapi-ts]: https://github.com/openapi-ts/openapi-typescript
[playwright]: https://github.com/microsoft/playwright

## Models and AI services

The prototype runs no local model weights. Its only model is a hosted service.

| Model or service                                       | Terms                                                                        | Use                                                   | Credit                                                                                                                      |
| ------------------------------------------------------ | ---------------------------------------------------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `claude-opus-5-5` through the [Claude API][claude-api] | [Anthropic Commercial Terms][anthropic-terms]; the customer owns its outputs | Real-photo triage and drafting, on the local API only | "AI suggestion, unvalidated" on every result. A recorded output also shows the model that served it and the recording date. |

[claude-api]: https://platform.claude.com/docs
[anthropic-terms]: https://www.anthropic.com/legal/commercial-terms

## Data

| Source                                         | Licence or terms                                  | Use                                                         | Credit                                                                                                                                                                                  |
| ---------------------------------------------- | ------------------------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [OpenStreetMap][osm] via Overpass              | [ODbL 1.0][odbl]                                  | Base scene and edge geometry in `data/elmina/`              | "© OpenStreetMap contributors", linked to https://www.openstreetmap.org/copyright                                                                                                       |
| [data.gov.my weather API][data-gov-my]         | [CC BY 4.0][cc-by] ([FAQ][data-gov-my-faq])       | Forecasts and warnings for re-planning                      | "Weather: data.gov.my, CC BY 4.0", linked to the API page and the licence                                                                                                               |
| [JPS Public Infobanjir][infobanjir]            | No API or reuse licence found; terms not obtained | Rainfall at Sungai Buloh (station 27880) as dated snapshots | "Rainfall: JPS Public Infobanjir, station 27880, snapshot YYYY-MM-DD"                                                                                                                   |
| [Copernicus DEM GLO-30][copernicus-dem]        | Free licence for registered users                 | Broad terrain only, if it replaces the flat plane           | "produced using Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved" |
| [Google Photorealistic 3D Tiles][google-tiles] | [Map Tiles API policies][google-policies]         | Optional fly-in for the video (P2)                          | The Google logo, plus every displayed tile's `asset.copyright` text, joined in one line along the bottom of the view                                                                    |
| Team photos                                    | Taken by the team with permission                 | Real-photo triage and Fix Lens                              | None needed                                                                                                                                                                             |

[osm]: https://www.openstreetmap.org/copyright
[odbl]: https://opendatacommons.org/licenses/odbl/1-0/
[data-gov-my]: https://developer.data.gov.my/realtime-api/weather
[data-gov-my-faq]: https://developer.data.gov.my/faq
[cc-by]: https://creativecommons.org/licenses/by/4.0/
[infobanjir]: https://publicinfobanjir.water.gov.my/rf-graph/?stationid=27880&lang=en
[copernicus-dem]: https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM
[google-tiles]: https://developers.google.com/maps/documentation/tile/3d-tiles
[google-policies]: https://developers.google.com/maps/documentation/tile/policies

### Data conditions

- **OpenStreetMap.** Keep the ODbL notice with the GeoJSON in `data/elmina/`. A changed or merged database that we share publicly stays under ODbL. In a video, put the copyright URL in the end credits or the description ([OSMF attribution guidelines][osmf-attribution]).
- **data.gov.my.** CC BY 4.0 asks for the source, a licence link and a note of any changes. The weather endpoints allow 4 requests a minute and need no token.
- **JPS Public Infobanjir.** Reuse terms were not found. Show only dated snapshots, never a live feed.
- **Copernicus DEM.** Use the credit above because the terrain is adapted. The unmodified form drops "produced using Copernicus WorldDEM-30".
- **Google tiles.** Never prefetch, store or cache a tile, and never use one offline. Never use a tile for image analysis, object detection or geodata extraction. A video clip is at most 30 seconds, is marked "for promotional purposes only" and contains no Street View imagery.
- **Team photos.** No people in frame. Strip location data before the public build.

[osmf-attribution]: https://osmfoundation.org/wiki/Licence/Attribution_Guidelines

## 3D assets

None. The drone is a procedural mesh. Fences, covers, gratings, gates, ring buoys and signs are modelled in code.

Before a glTF model or texture lands, verify its licence on its live page. Then add a row here with its creator, licence, source URL and credit. The Sketchfab quadcopter named in the [geodata research](/docs/research/drone-integration/threejs-geodata.md#5-scene-assets-and-effects) is not verified and is not cleared.

## Not used

These are out of the prototype because of their licence or terms ([TRD key decision 6](/docs/TRD.md#key-decisions)).

| Item                                 | Licence or terms                            | Why it is out                                                        |
| ------------------------------------ | ------------------------------------------- | -------------------------------------------------------------------- |
| [Ultralytics YOLO][ultralytics]      | AGPL-3.0                                    | Copyleft model and code                                              |
| [YOLO-World][yolo-world]             | GPL-3.0                                     | Copyleft model and code                                              |
| [BIT change detection][bit]          | "Non-commercial and research purposes only" | Not licensed for a commercial pilot                                  |
| [DJI Cloud API 2 service][dji-terms] | DJI Cloud API 2 terms                       | DJI has not confirmed commercial use; the adapter stays a typed stub |

[ultralytics]: https://github.com/ultralytics/ultralytics/blob/main/LICENSE
[yolo-world]: https://github.com/AILab-CVC/YOLO-World/blob/master/LICENSE
[bit]: https://github.com/justchenhao/BIT_CD#license
[dji-terms]: https://developer.dji.com/cloud-api2-clause/terms/

## See also

- [TRD: data sources and licences](/docs/TRD.md#data-sources-and-licences)
- [Three.js and geodata research](/docs/research/drone-integration/threejs-geodata.md#7-recommended-stack-demo-composition-licences-and-risks): OSM, Google tiles and asset licences
- [AI perception research](/docs/research/drone-integration/ai-perception.md): licences of the candidate pilot models
