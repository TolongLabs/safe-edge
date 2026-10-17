# Three.js simulation stack and real geodata for Elmina Central Park

Research pack for Safe Edge's drone and AI layer. One Codex worker researched it and a second worker checked every claim against its source on 17 October 2026. See the [summary](/docs/research/drone-integration.md) for how it changed the design.

Contents:

1.  [Summary](#summary)
1.  [Findings](#findings)
    1.  [1. Three.js, React Three Fiber, and performance](#1-threejs-react-three-fiber-and-performance)
    1.  [2. Real 3D context and Google Photorealistic 3D Tiles](#2-real-3d-context-and-google-photorealistic-3d-tiles)
    1.  [3. Real geodata from OpenStreetMap](#3-real-geodata-from-openstreetmap)
    1.  [4. Elevation and LiDAR](#4-elevation-and-lidar)
    1.  [5. Scene assets and effects](#5-scene-assets-and-effects)
    1.  [6. Recording and offline fallback](#6-recording-and-offline-fallback)
    1.  [7. Recommended stack, demo composition, licences, and risks](#7-recommended-stack-demo-composition-licences-and-risks)
1.  [Recommendations for Safe Edge](#recommendations-for-safe-edge)
1.  [What we can and cannot claim](#what-we-can-and-cannot-claim)
1.  [Open questions](#open-questions)
1.  [Sources](#sources)

## Summary

- Three.js lists `r186` as its latest release, dated `24 September 2026`; official npm registry metadata reports `three@0.186.1` as latest and licensed MIT. Three.js describes `WebGPURenderer` as experimental and recommends `WebGLRenderer` for pure WebGL 2 applications. [GitHub releases](https://github.com/mrdoob/three.js/releases), [npm package page](https://www.npmjs.com/package/three?activeTab=versions), [official npm registry metadata](https://registry.npmjs.org/three/latest), [Three.js WebGPU manual](https://threejs.org/manual/pages/webgpurenderer)
- Analyst's read: For a time-boxed student build, use plain Three.js with `WebGLRenderer` unless the team already has a working React scene. The WebGL path fits the water shader and post-processing APIs and avoids adding React conventions under time pressure.
- Google Photorealistic 3D Tiles may cover the area, but an exact Elmina Central Park coverage result was not found. Google also prohibits image analysis, object detection, offline use, and caching outside limited terms. [Google 3D Tiles](https://developers.google.com/maps/documentation/tile/3d-tiles), [Google Map Tiles API policies](https://developers.google.com/maps/documentation/tile/policies?hl=en)
- The four OpenStreetMap GeoJSON files identify an OSM editing API map response as their source. OSMF says this API is for editing, not read-only projects. The pack includes an Overpass query but no response or run log, so its execution result cannot be verified. These mapped objects are not a verified site inventory. [OSM API policy](https://operations.osmfoundation.org/policies/api/), [OSM attribution guidelines](https://osmfoundation.org/wiki/Licence/Attribution_Guidelines)
- The saved extract has `55` water, `56` park/playground, `418` path, and `44` barrier features; `3` barrier features are lines. All four GeoJSON files parse as FeatureCollections, their geometries passed validity checks, and the reported feature counts and breakdowns match. Recomputed approximate spherical lengths and areas match the table to one decimal. One saved barrier gate point falls just outside the stated bbox. Sparse OSM barrier mapping cannot establish that physical barriers are absent.
- Copernicus DEM and SRTM have approximately `30 m` products for this region; that is broad terrain context, not drain-cover or bank inspection resolution. Not found: an openly downloadable, licence-clear LiDAR dataset for Elmina Central Park. JUPEM lists a DSM/DTM LiDAR product for part of Selangor through Seremban from `2022`, but its page gives a request route and does not show exact coverage or open terms. [Copernicus DEM](https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM), [USGS global elevation data FAQ](https://www.usgs.gov/faqs/where-can-i-get-global-elevation-data), [JUPEM geospatial services](https://sites.google.com/jupem.gov.my/jupemgeospatialwebservices/home), [MYSA open data](https://rsopendata.mysa.gov.my/)
- Analyst's read: Build an offline-first OSM scene with explicitly modelled water edges and clearly labelled simulated detections. Keep Google tiles as an optional, online-only visual layer after a live coverage and billing check; analyze only independently captured drone imagery.

## Findings

### 1. Three.js, React Three Fiber, and performance

As checked on `17 October 2026`, the Three.js GitHub release page marks `r186` as latest and dates that release to `24 September 2026`. The official npm registry metadata reports `three@0.186.1` as the latest package version and gives its license as MIT; the npm web listing could not be fetched during this check. [Three.js releases](https://github.com/mrdoob/three.js/releases), [three on npm](https://www.npmjs.com/package/three?activeTab=versions), [official npm registry metadata](https://registry.npmjs.org/three/latest)

Three.js says `WebGPURenderer` uses WebGPU when available and falls back to WebGL 2. Its manual still calls the renderer experimental and notes feature or performance gaps; the same manual recommends `WebGLRenderer` for pure WebGL 2 applications. The manual also says the WebGPU renderer does not support `EffectComposer` or custom `ShaderMaterial`/`RawShaderMaterial` workflows without migration to its node material system. [WebGPU renderer manual](https://threejs.org/manual/pages/webgpurenderer), [WebGLRenderer API](https://threejs.org/docs/pages/WebGLRenderer)

React Three Fiber (R3F) is a React renderer for Three.js that expresses scene objects as reusable components. Its compatibility guidance pairs R3F `8` with React `18`, and R3F `9` with React `19`; Drei is a collection of helpers and abstractions for R3F. [R3F introduction](https://r3f.docs.pmnd.rs/getting-started/introduction), [Drei introduction](https://github.com/pmndrs/drei/blob/master/docs/getting-started/introduction.mdx)

Three.js identifies draw-call count as a common cost for many objects and recommends merged geometry for repeated static geometry; `InstancedMesh` reduces draw calls when many objects share geometry and materials. `WebGLRenderer.setPixelRatio()` controls drawing resolution. [Optimize lots of objects](https://threejs.org/manual/pages/optimize-lots-of-objects.html), [InstancedMesh API](https://threejs.org/docs/pages/InstancedMesh.html), [WebGLRenderer API](https://threejs.org/docs/pages/WebGLRenderer)

Analyst's read: Use plain Three.js for this time-boxed simulation unless the team already has a React application and R3F experience. R3F and Drei can speed up component-based UI and helper setup, but require matching React/R3F versions and a team comfortable with hooks and render-loop state. For the outdoor scene, reuse materials, batch static paths and vegetation, instance repeated fence posts, hide distant detail, cap pixel ratio on phones, and keep reflections and shadow maps limited. These are implementation recommendations based on the documented draw-call and resolution controls.

### 2. Real 3D context and Google Photorealistic 3D Tiles

Google describes its Photorealistic 3D Tiles as textured 3D meshes available in many populated areas. Its public documentation does not provide a coverage result for the exact Elmina Central Park site. Not found: verified tile coverage for Elmina Central Park. A live check needs a Google Maps Platform project with billing enabled and an API key. [Google Photorealistic 3D Tiles](https://developers.google.com/maps/documentation/tile/3d-tiles)

Google's documented root tileset URL is [`https://tile.googleapis.com/v1/3dtiles/root.json?key=YOUR_API_KEY`](https://tile.googleapis.com/v1/3dtiles/root.json?key=YOUR_API_KEY). One root request supports at least `3 hours` of renderer tile requests. The Map Tiles API session-token guide says `createSession` tokens are required for 2D and Street View tiles, but not for 3D tiles. [Google 3D Tiles](https://developers.google.com/maps/documentation/tile/3d-tiles), [Google session tokens](https://developers.google.com/maps/documentation/tile/session_tokens), [Google renderer guide](https://developers.google.com/maps/documentation/tile/use-renderer)

NASA-AMMOS `3d-tiles-renderer` is at version `0.5.3` in its current package metadata and changelog; its package declares Apache-2.0 and a Three.js peer range of `>=0.167.0`. The package exports the Three.js renderer from `3d-tiles-renderer/three`, core plugins from `3d-tiles-renderer/core/plugins`, and its plugin bundle from `3d-tiles-renderer/plugins`. The documented `GoogleCloudAuthPlugin` accepts `{ apiToken }` and handles Google API authentication and session management. Its R3F guide uses `TilesRenderer`, `TilesPlugin`, `GoogleCloudAuthPlugin`, and `TilesAttributionOverlay`. [NASA-AMMOS package metadata](https://github.com/NASA-AMMOS/3DTilesRendererJS/blob/master/package.json), [NASA-AMMOS changelog](https://github.com/NASA-AMMOS/3DTilesRendererJS/blob/master/CHANGELOG.md), [NASA-AMMOS plugin API](https://github.com/NASA-AMMOS/3DTilesRendererJS/blob/master/src/core/plugins/API.md), [NASA-AMMOS R3F guide](https://github.com/NASA-AMMOS/3DTilesRendererJS/blob/master/src/r3f/README.md)

Example integration shape, with the key kept out of source control:

```js
import { TilesRenderer } from '3d-tiles-renderer/three'
import { GoogleCloudAuthPlugin } from '3d-tiles-renderer/core/plugins'

const tiles = new TilesRenderer('https://tile.googleapis.com/v1/3dtiles/root.json')
tiles.registerPlugin(new GoogleCloudAuthPlugin({ apiToken: mapsApiKey }))
scene.add(tiles.group)
// In the render loop, update the tiles renderer with the active camera and render size.
```

Use the current auth plugin rather than the deprecated `GooglePhotorealisticTilesRenderer` class: the NASA changelog marks that class deprecated in favor of authentication plugins. The current R3F guide uses a `GoogleTilesRenderer` wrapper function; it is not identified there as a deprecated renderer class. Google requires an API key and billing; it recommends restricting the key to the intended API and website/app to reduce abuse and unexpected charges. [NASA-AMMOS changelog](https://github.com/NASA-AMMOS/3DTilesRendererJS/blob/master/CHANGELOG.md), [Google API key security guidance](https://developers.google.com/maps/api-security-best-practices)

As of `17 October 2026`, the global pricing list gives Photorealistic 3D Tiles a free usage cap of `1,000` billable events per month, then `USD $6.00` per `1,000` events in the first paid tier, with lower rates at higher volumes. Google defines a billable event as a request that returns a 3D tile. The daily quota is `10,000` root tileset queries per project; renderer-originating tile requests are unlimited per day, and the timed session supports up to `3 hours` of requests from one root request. Prices and quotas can change; this is the global price list, not an MYR quote. [Google global pricing](https://developers.google.com/maps/billing-and-pricing/pricing?authuser=57), [Google SKU details](https://developers.google.com/maps/billing-and-pricing/sku-details?hl=en), [Map Tiles usage and billing](https://developers.google.com/maps/documentation/tile/usage-and-billing?authuser=3)

Google's Map Tiles API policies prohibit prefetching, indexing, storing, or caching content except under limited agreement terms. They restrict non-visualization use, including image analysis, machine interpretation, object detection or identification, geodata extraction, resale, and offline use. For display, Google Maps logo or text and the variable provider attributions must remain visible and unaltered, with third-party attribution separate. Google permits promotional videos with Photorealistic 3D Tiles only under conditions: no Street View, a maximum duration of `30 seconds`, the video must show application capabilities, it must be marked “for promotional purposes only,” and required attribution must remain visible. [Google Map Tiles API policies](https://developers.google.com/maps/documentation/tile/policies?hl=en)

Analyst's read: The Google layer can serve as visual context only. It must not be the imagery source for Safe Edge's computer vision or barrier-gap claims. Any AI analysis should use separately captured drone imagery, with the capture and processing permissions confirmed with the asset owner. Do not cache Google tiles for an offline pitch; record an allowed short promotional clip only after checking that attribution is visible in the final recording.

Alternatives:

- CesiumJS can load Google tiles with `Cesium.createGooglePhotorealistic3DTileset()`; Cesium's guide says to target CesiumJS `1.124` or later and use an ion account/token. This provides an integrated geospatial viewer but does not remove Google's Map Tiles terms. [Cesium Google tiles guide](https://cesium.com/learn/cesiumjs-learn/cesiumjs-photorealistic-3d-tiles), [Cesium token guidance](https://cesium.com/learn/ion/cesium-ion-access-tokens/)
- Cesium OSM Buildings is a global 3D Tiles building layer derived from OSM and requires the attribution “© OpenStreetMap contributors.” It offers building massing and metadata, not a verified photographic model of the park's safety features. [Cesium OSM Buildings](https://cesium.com/platform/cesium-ion/content/cesium-osm-buildings/)
- OSM2World converts OSM data to 3D models and can export glTF, GLB, OBJ, and POV. Its official repository identifies the software as MIT licensed; source OSM data remains under ODbL. This is a procedural, tag-driven scene, not photogrammetry. [OSM2World](https://osm2world.org/), [OSM2World repository](https://github.com/tordanik/OSM2World), [OSM attribution guidelines](https://osmfoundation.org/wiki/Licence/Attribution_Guidelines)
- Mapbox GL JS's official example shows a building layer with `fill-extrusion` and a Mapbox access token. This can suit a map-led interface, but it is not a drop-in source of a local photogrammetric park mesh. The cited style-specification page did not return readable content during this check, so the report does not rely on its separate claims about Mapbox Standard or `light-v11`. [Mapbox 3D buildings example](https://docs.mapbox.com/mapbox-gl-js/example/3d-buildings/)

### 3. Real geodata from OpenStreetMap

The study window used was west `101.490`, south `3.160`, east `101.540`, north `3.200` (longitude/latitude). This is a working bbox around Elmina Central Park and nearby township features, not a legal park boundary. OSM's API documentation uses `left,bottom,right,top` order for its map bbox; Overpass bbox filters use south, west, north, east order. [OSM API documentation](https://wiki.openstreetmap.org/wiki/OpenStreetMap_API), [Overpass language guide](https://wiki.openstreetmap.org/wiki/Overpass_API/Language_Guide), [SDP Elmina Central Park reference](https://www.simedarbyproperty.com/press-releases/blazing-fast-internet-speed-sime-darby-propertys-elmina-homes)

The pack includes the following proposed Overpass QL query, but it contains no response body or run log. I could not verify whether it ran successfully or whether any endpoint returned an error. The Overpass guide documents the query language and public instances; OSMF's policy for the editing API is separate and should not be treated as Overpass usage guidance. [Overpass API guide](https://wiki.openstreetmap.org/wiki/Overpass_API), [OSM API usage policy](https://operations.osmfoundation.org/policies/api/)

Proposed Overpass QL (execution not verified):

```overpassql
[out:json][timeout:60];
(
  nwr["natural"="water"](3.160,101.490,3.200,101.540);
  nwr["water"~"^(pond|lake|reservoir|basin)$"](3.160,101.490,3.200,101.540);
  nwr["waterway"~"^(drain|ditch|canal|stream|river)$"](3.160,101.490,3.200,101.540);
  nwr["leisure"~"^(park|playground)$"](3.160,101.490,3.200,101.540);
  way["highway"~"^(footway|path|cycleway)$"](3.160,101.490,3.200,101.540);
  nwr["barrier"~"^(fence|wall|gate|guard_rail)$"](3.160,101.490,3.200,101.540);
);
out geom;
```

Each saved GeoJSON file's metadata identifies its source as an OpenStreetMap map API response and records the bbox, attribution, licence, and retrieval date `17 October 2026`. The linked OSM editing API response could not be opened during verification, so its raw response and timestamp are not independently verified. OSMF states that the editing API is provided for editing map data, not read-only projects. Do not treat that endpoint as a repeatable read-only extraction route; use a service intended for read-only extracts and follow its usage policy. [OSM map API request](https://api.openstreetmap.org/api/0.6/map?bbox=101.49%2C3.16%2C101.54%2C3.20), [OSM API usage policy](https://operations.osmfoundation.org/policies/api/), [GeoJSON RFC 7946](https://www.rfc-editor.org/rfc/rfc7946)

Feature counts and lengths/areas below were checked against the saved OSM geometries. All four files parse as GeoJSON FeatureCollections, all geometries passed Shapely validity checks, and the reported feature counts and geometry breakdowns match. Approximate spherical great-circle line lengths and spherical ring areas recomputed from the coordinates match the table to one decimal. The saved geometries were not clipped to the bbox: `23` feature bounds extend beyond it, and one barrier gate point lies just south of it and does not intersect the bbox. Totals are not survey measurements.

| Layer                 | Features | Geometry breakdown     | Total line length | Total polygon area |
| --------------------- | -------: | ---------------------- | ----------------: | -----------------: |
| Water                 |       55 | 28 lines; 27 polygons  |        51,507.3 m |       222,731.8 m² |
| Parks and playgrounds |       56 | 29 points; 27 polygons |               0 m |       491,181.7 m² |
| Paths                 |      418 | 418 lines              |        84,824.7 m |               0 m² |
| Barriers              |       44 | 41 points; 3 lines     |           684.6 m |               0 m² |

The extract has many mapped park and path objects but only `3` barrier line objects; points in the barrier layer may represent gates or other tagged nodes. OSM tags cannot confirm that an untagged physical feature is absent. The files are `data/water.geojson`, `data/parks.geojson`, `data/paths.geojson`, and `data/barriers.geojson`. The pack has no raw response or processing log to substantiate the earlier claim that an incomplete relation was excluded.

OpenStreetMap data is distributed under the Open Database License (ODbL) `1.0`. For a public interactive scene, OSMF's attribution guidance calls for a legible nearby credit such as “© OpenStreetMap contributors” linked to the copyright/licence page. ODbL also requires an appropriate notice when a produced work is publicly used; a publicly used derivative database has share-alike and machine-readable access conditions. Keep the notices with the GeoJSON and any public export. [ODbL 1.0 legal text](https://opendatacommons.org/licenses/odbl/1-0/), [OSMF attribution guidelines](https://osmfoundation.org/wiki/Licence/Attribution_Guidelines), [OSMF legal FAQ](https://osmfoundation.org/wiki/Licence_and_Legal_FAQ), [OpenStreetMap copyright page](https://www.openstreetmap.org/copyright)

### 4. Elevation and LiDAR

Copernicus DEM is a Digital Surface Model that includes buildings, infrastructure, and vegetation. Its global products are GLO-30 and GLO-90 at `30 m` and `90 m` resolution, with data acquired by TanDEM-X between `2011` and `2015`. The provider lists worldwide free-licence access to GLO-30 and GLO-90 for registered users, including download access for the general public. A separate notice says that, from `28 July 2026`, the `30 m` view service requires an authorized Copernicus Contributing Missions user category and profile setting. The distinction is between product download access and the 30 m view service. [Copernicus DEM collection](https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM), [Copernicus DEM access notice dated 17 July 2026](https://dataspace.copernicus.eu/news/2026-7-17-copernicus-dem-30m-view-service-license-acceptance)

USGS lists global SRTM `1 arc-second` data at about `30 m` spatial resolution and says it was acquired in `2000`. [USGS global elevation data FAQ](https://www.usgs.gov/faqs/where-can-i-get-global-elevation-data)

The sources checked did not establish an openly downloadable, licence-clear LiDAR point cloud or DEM for Elmina Central Park. JUPEM's catalogue lists “DSM/DTM LiDAR” for part of Selangor through Seremban from `2022`, and a separate Kuala Lumpur and Putrajaya LiDAR product from `2015`; it directs users to request products through eBiz or an inquiry. The page does not establish whether Elmina is in the Selangor coverage, whether the data can be openly downloaded, or what licence applies. MyGDI describes a formal data-sharing request route through custodial agencies and lists categories including G2B and G2E; this is a request mechanism, not evidence that this LiDAR is open or covers Elmina. MYSA's catalogue lists SPOT, Landsat TM, MODIS, and NOAA satellite imagery, and states that its open satellite data have spatial resolutions greater than `5 m` and are non-commercial. The PLANMalaysia page's search preview says data may be requested by formal letter, but its page fetch was blocked (snippet only). [JUPEM geospatial services](https://sites.google.com/jupem.gov.my/jupemgeospatialwebservices/home), [MyGDI data sharing](https://www.mygeoportal.gov.my/index.php/en/perkongsian-data-mygdi), [MYSA open-data terms and catalogue](https://rsopendata.mysa.gov.my/), [PLANMalaysia Selangor geospatial data page](https://ftp.jpbdselangor.gov.my/index.php/en/perkhidmatan/sistem-maklumat-geografi-gis/pembelian-data-geospatial.html)

Analyst's read: Copernicus DEM or SRTM can give a broad terrain backdrop. Neither resolves an individual drain cover, fence gap, or bank defect. For edge inspection, request SDP or council as-built drawings, asset boundaries, and a site survey or approved drone capture; model the smaller features only as labelled demo objects until those data exist.

### 5. Scene assets and effects

A Sketchfab search preview for “Quadcopter drone” by Annelida shows a download button, `65.7k` triangles, and Creative Commons Attribution licensing, but the listing could not be opened; treat these item-specific details as snippet-only and unverified. Sketchfab's download-documentation page was also inaccessible; its search preview describes a glTF archive, which is snippet-only. Khronos defines glTF `2.0` as a runtime 3D asset format, and Three.js provides `GLTFLoader`. Verify a candidate's live listing, download availability, licence, and file contents before bundling it. [Sketchfab model listing](https://sketchfab.com/3d-models/quadcopter-drone-ca8f0f70a1014e77a6777dc248e9bf5a), [Sketchfab download documentation](https://sketchfab.com/developers/download-api/downloading-models), [Khronos glTF 2.0 specification](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.pdf), [Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/), [Three.js GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html)

Three.js provides `Water` in `three/addons/objects/Water.js` for `WebGLRenderer`; it is a reflective shader, and higher reflection texture dimensions cost more. `WaterMesh` is the corresponding documented addon for `WebGPURenderer`. [Three.js Water API](https://threejs.org/docs/pages/Water.html), [Three.js WaterMesh API](https://threejs.org/docs/pages/WaterMesh.html)

The Three.js examples include a GPU-compute rain effect under WebGPU. For a WebGL-first demo, a restrained point/sprite rain layer is a simpler visual cue. Use `DirectionalLight` and `HemisphereLight` to create day and night variants by changing light and sky colours; the hemisphere light blends sky and ground colour and does not cast shadows. [Three.js rain example](https://threejs.org/examples/webgpu_compute_particles_rain.html), [Points API](https://threejs.org/docs/pages/Points.html), [DirectionalLight API](https://threejs.org/docs/pages/DirectionalLight.html), [HemisphereLight API](https://threejs.org/docs/pages/HemisphereLight.html)

`CameraHelper` draws the camera frustum and can be updated when the camera projection or transform changes. `CSS2DRenderer` and `CSS2DObject` provide DOM labels in the 3D scene; its docs note support for translation and 2D rotation and require normal browser/display zoom. `CatmullRomCurve3` interpolates a smooth 3D curve, and `getPoint(t)` returns a point for `t` in `[0,1]`, suitable for moving a drone along a patrol path. [CameraHelper API](https://threejs.org/docs/pages/CameraHelper.html), [CSS2DRenderer API](https://threejs.org/docs/pages/CSS2DRenderer.html), [CatmullRomCurve3 API](https://threejs.org/docs/pages/CatmullRomCurve3.html)

`EffectComposer` runs ordered post-processing passes and only supports `WebGLRenderer`; the Three.js WebGPU manual identifies a separate node-based post-processing stack for `WebGPURenderer`. [EffectComposer API](https://threejs.org/docs/pages/EffectComposer.html), [WebGPU renderer manual](https://threejs.org/manual/pages/webgpurenderer)

Analyst's read: Use the drone asset only as a visual prop and decimate it if the phone scene struggles. Draw the patrol route, frustum, labels, barrier overlays, and detection markers with simple geometry. Use one water effect at low reflection resolution or a flat animated material, one directional shadow source, and a single restrained post-process pass. Keep rain and night effects clearly decorative; they do not represent actual weather or measured water level.

### 6. Recording and offline fallback

`HTMLCanvasElement.captureStream(frameRate)` creates a video `MediaStream` from a canvas; `MediaRecorder` records a `MediaStream`, and `MediaRecorder.isTypeSupported()` lets the app check whether a browser supports a requested MIME type. [MDN canvas captureStream](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/captureStream), [MDN MediaRecorder](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder), [W3C MediaStream Recording specification](https://www.w3.org/TR/mediastream-recording/)

Analyst's read: For a stable pitch clip, use a fixed camera path and deterministic simulation clock; reduce pixel ratio and reflection effects before recording. CSS2D labels are DOM elements, not canvas pixels, so a canvas-only `captureStream()` does not capture them. Either use an in-canvas label treatment for the clip or capture the browser display with `getDisplayMedia()`. A recording's actual frame rate can vary with browser and device load, so make a short local capture and review it before the pitch. If Google tiles are visible, follow Google's promotional-video limit and keep all attribution visible in the recorded frame. [MDN getDisplayMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia)

Google prohibits offline use and caching of its map content outside limited agreement terms. OSM data is reusable under ODbL with attribution and share-alike obligations for a redistributed derivative database. [Google Map Tiles API policies](https://developers.google.com/maps/documentation/tile/policies?hl=en), [OSMF attribution guidelines](https://osmfoundation.org/wiki/Licence/Attribution_Guidelines)

Analyst's read: The offline scene should load the four bundled OSM GeoJSON files, locally model a simple terrain plane, water polygons, paths, and illustrative edge assets, and show the same pre-scripted triage sequence. Label the event states “simulated” and the basemap “OpenStreetMap data.” This keeps the prototype available without a Google key or network, while making no claim that synthetic defects were observed at Elmina.

### 7. Recommended stack, demo composition, licences, and risks

Analyst's read: Recommended time-boxed stack: Three.js `0.186.1` with `WebGLRenderer`; the bundled OSM GeoJSON; `GLTFLoader` for one directly verified and licence-cleared model; `Water` only if a reflective view is worth the cost; DOM controls outside the canvas; and no live AI dependency. Add NASA-AMMOS `3d-tiles-renderer@0.5.3` with `GoogleCloudAuthPlugin` only as an optional online context layer after the exact area, attribution overlay, API key restriction, and billing project work. [Three.js package](https://www.npmjs.com/package/three?activeTab=versions), [NASA-AMMOS renderer package](https://github.com/NASA-AMMOS/3DTilesRendererJS/blob/master/package.json), [Google API key security guidance](https://developers.google.com/maps/api-security-best-practices)

Analyst's read: Compose the scene as follows.

1. **Real source geometry:** OSM water features, park/playground features, paths, and barriers from the saved GeoJSON. Preserve OSM IDs and tags; display an OSM attribution line.
2. **Modelled visuals:** terrain surface, water appearance, drone, fence sections, drain covers, buoys, signs, erosion patches, and “Fix Lens” barrier alternatives. These are visual stand-ins unless verified against SDP or council plans/site imagery.
3. **Simulated workflow:** drone movement, alert cards, manager review, draft work order, repair, and independent re-test. Mark each state as simulated; do not imply a live patrol or completed repair.
4. **Optional real 3D basemap:** Google tiles only for visual context and only with required attribution; never route those tiles into detection or comparison logic.

Analyst's read: Put a compact licence panel in the demo and include these notices wherever data or assets are distributed:

- OpenStreetMap: `© OpenStreetMap contributors`, linked to the [copyright and ODbL page](https://www.openstreetmap.org/copyright); keep the ODbL notice with the GeoJSON and any redistributed derivative database. [OSMF attribution guidelines](https://osmfoundation.org/wiki/Licence/Attribution_Guidelines)
- Drone model: the cited Sketchfab listing was snippet-only, so its availability and licence are not verified. If the team uses an asset verified as CC BY 4.0, credit its listed creator, link the licence, and note changes. [Model listing](https://sketchfab.com/3d-models/quadcopter-drone-ca8f0f70a1014e77a6777dc248e9bf5a), [CC BY 4.0 terms](https://creativecommons.org/licenses/by/4.0/)
- NASA-AMMOS renderer: Apache-2.0 notices if code is included in a distributed build. [NASA-AMMOS package metadata](https://github.com/NASA-AMMOS/3DTilesRendererJS/blob/master/package.json)
- Google tiles: Google Maps logo/text and the viewport's full variable provider attribution; keep it separate from OSM and app credit. Apply the Google video conditions to any pitch recording. [Google Map Tiles API policies](https://developers.google.com/maps/documentation/tile/policies?hl=en)
- Three.js: MIT license for the package. [Three.js npm package](https://www.npmjs.com/package/three?activeTab=versions)

Analyst's read: Main build risks are unverified Google coverage and key access; network dependence and changing usage charges; Google terms conflicting with any attempt to analyze its imagery; OSM's incomplete barrier mapping; coarse elevation; scene performance on phones; and the risk that a polished visualization looks like a verified safety inspection. Resolve these with an offline-first scene, visible provenance labels, a capped Google project if used, actual field data for any detection claim, and an SDP maintenance owner and approved asset boundary before proposing a live pilot.

## Recommendations for Safe Edge

1. Analyst's read: Keep the time-boxed prototype on plain Three.js `WebGLRenderer`; add R3F and Drei only if a React scene already exists and the team knows the matching version pair. This rests on Finding 1.
2. Analyst's read: Use OSM GeoJSON for the local structure and make the lack of mapped barriers visible as a data-quality limitation. Do not treat OSM geometry as a complete safety inventory. This rests on Finding 3.
3. Analyst's read: Test Google Photorealistic 3D Tiles at the exact park with a restricted API key before integrating them. Keep the tiles out of all image-analysis, baseline-diff, and defect-detection paths, and keep the scene usable if the service is unavailable. This rests on Finding 2.
4. Analyst's read: Use Copernicus DEM or SRTM only to suggest broad landform. Ask JUPEM whether its listed Selangor LiDAR product covers Elmina and what access/licence terms apply. Represent local banks, covers, fences, and buoys as explicitly modelled examples until SDP/council drawings or approved site survey data are available. This rests on Finding 4.
5. Analyst's read: Ship the offline scene and a browser-screen capture plan. Keep any clip containing Google tiles within Google's promotional-video terms and visible attribution requirements. This rests on Findings 2 and 6.

## What we can and cannot claim

**Safe claims for the pitch**

- “The prototype uses real OpenStreetMap features for mapped water, parks, paths, and barriers in its Elmina study window.” The layer counts are calculated from the saved extract; the data are ODbL and attributed. [OSMF attribution guidelines](https://osmfoundation.org/wiki/Licence/Attribution_Guidelines)
- “The demo illustrates a human-reviewed patrol and repair workflow.” Say that alerts, damage states, and repairs are simulated unless they come from authorized real imagery and records.
- “Google 3D Tiles are optional visual context.” Do not describe them as inspection input. [Google Map Tiles API policies](https://developers.google.com/maps/documentation/tile/policies?hl=en)

**Claims to avoid**

- “The map shows every drain, water edge, barrier, or gap at Elmina.” The extract has sparse mapped barrier lines; OSM absence is not physical absence.
- “AI found a real defect at Elmina” or “the prototype certifies an edge safe.” No authorized inspection imagery or validated detector result is included in these geodata files.
- “Google tiles can be used for AI defect detection, offline work, or an unrestricted pitch video.” Google's policies prohibit these uses or set conditions on promotional video and attribution. [Google Map Tiles API policies](https://developers.google.com/maps/documentation/tile/policies?hl=en)
- “The terrain model is accurate enough to assess a drain, bank, or water level.” Available public DEMs are regional context resolution, not local inspection data. [Copernicus DEM](https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM), [USGS global elevation data FAQ](https://www.usgs.gov/faqs/where-can-i-get-global-elevation-data)

## Open questions

- Does a Google Maps Platform key with billing enabled return tiles at the exact park coordinates, and what do those tiles show at usable zoom levels?
- Which water asset is retained by SDP, who owns it after handover, and who can approve a drone flight, image use, and pilot maintenance budget?
- Can SDP or the relevant council provide a current asset boundary, as-built drainage/fence drawings, accepted inspection records, and authorized drone imagery?
- Can the Overpass query be repeated successfully later or from an approved OSM extract provider? The current GeoJSON was sourced through the OSM editing API fallback, which OSMF says is not for read-only downloads.
- Does JUPEM's listed 2022 Selangor DSM/DTM LiDAR coverage include Elmina, what is its resolution, and can the team request it under a usable licence? [JUPEM geospatial services](https://sites.google.com/jupem.gov.my/jupemgeospatialwebservices/home)

## Sources

1. [Three.js releases](https://github.com/mrdoob/three.js/releases) — Three.js project, current releases; `r186` released 24 Sep 2026.
2. [Three on npm](https://www.npmjs.com/package/three?activeTab=versions) — npm package page; page content could not be fetched during this check. See official registry metadata at #65 for the current version and licence.
3. [WebGPURenderer manual](https://threejs.org/manual/pages/webgpurenderer) — Three.js, undated; accessed 17 Oct 2026.
4. [WebGLRenderer API](https://threejs.org/docs/pages/WebGLRenderer) — Three.js, undated; accessed 17 Oct 2026.
5. [React Three Fiber introduction](https://r3f.docs.pmnd.rs/getting-started/introduction) — pmndrs, undated; accessed 17 Oct 2026.
6. [Drei introduction](https://github.com/pmndrs/drei/blob/master/docs/getting-started/introduction.mdx) — pmndrs, undated; accessed 17 Oct 2026.
7. [Optimize lots of objects](https://threejs.org/manual/pages/optimize-lots-of-objects.html) — Three.js, undated; accessed 17 Oct 2026.
8. [InstancedMesh API](https://threejs.org/docs/pages/InstancedMesh.html) — Three.js, undated; accessed 17 Oct 2026.
9. [Photorealistic 3D Tiles](https://developers.google.com/maps/documentation/tile/3d-tiles) — Google for Developers, updated 15 Oct 2026.
10. [Work with a 3D Tiles renderer](https://developers.google.com/maps/documentation/tile/use-renderer) — Google for Developers, undated; accessed 17 Oct 2026.
11. [Session tokens](https://developers.google.com/maps/documentation/tile/session_tokens) — Google for Developers, undated; accessed 17 Oct 2026.
12. [NASA-AMMOS package metadata](https://github.com/NASA-AMMOS/3DTilesRendererJS/blob/master/package.json) — NASA-AMMOS, current package metadata; accessed 17 Oct 2026.
13. [NASA-AMMOS changelog](https://github.com/NASA-AMMOS/3DTilesRendererJS/blob/master/CHANGELOG.md) — NASA-AMMOS, includes release 0.5.3 dated 18 Sep 2026.
14. [NASA-AMMOS core plugins API](https://github.com/NASA-AMMOS/3DTilesRendererJS/blob/master/src/core/plugins/API.md) — NASA-AMMOS, undated; accessed 17 Oct 2026.
15. [NASA-AMMOS R3F guide](https://github.com/NASA-AMMOS/3DTilesRendererJS/blob/master/src/r3f/README.md) — NASA-AMMOS, undated; accessed 17 Oct 2026.
16. [Google API key security guidance](https://developers.google.com/maps/api-security-best-practices) — Google for Developers, undated; accessed 17 Oct 2026.
17. [Google Maps Platform pricing](https://developers.google.com/maps/billing-and-pricing/pricing?authuser=57) — Google for Developers, current global price list; accessed 17 Oct 2026; prices in USD.
18. [Google SKU details](https://developers.google.com/maps/billing-and-pricing/sku-details?hl=en) — Google for Developers, current SKU definitions; accessed 17 Oct 2026.
19. [Map Tiles API usage and billing](https://developers.google.com/maps/documentation/tile/usage-and-billing?authuser=3) — Google for Developers, undated; accessed 17 Oct 2026.
20. [Map Tiles API policies](https://developers.google.com/maps/documentation/tile/policies?hl=en) — Google for Developers, undated; accessed 17 Oct 2026.
21. [CesiumJS Google Photorealistic 3D Tiles](https://cesium.com/learn/cesiumjs-learn/cesiumjs-photorealistic-3d-tiles) — Cesium, undated; accessed 17 Oct 2026.
22. [Cesium ion access tokens](https://cesium.com/learn/ion/cesium-ion-access-tokens/) — Cesium, undated; accessed 17 Oct 2026.
23. [Cesium OSM Buildings](https://cesium.com/platform/cesium-ion/content/cesium-osm-buildings/) — Cesium, current product page; accessed 17 Oct 2026.
24. [OSM2World](https://osm2world.org/) — OSM2World project, current website; accessed 17 Oct 2026.
25. [OSM2World repository](https://github.com/tordanik/OSM2World) — OSM2World project, current repository and MIT licence; accessed 17 Oct 2026.
26. [Mapbox 3D buildings example](https://docs.mapbox.com/mapbox-gl-js/example/3d-buildings/) — Mapbox, current documentation; accessed 17 Oct 2026.
27. [Mapbox style layers](https://docs.mapbox.com/mapbox-gl-js/style-spec/layers/) — Mapbox style specification; page returned no readable content during this check (snippet-only). The related style-maintenance claim was removed.
28. [OpenStreetMap API documentation](https://wiki.openstreetmap.org/wiki/OpenStreetMap_API) — OpenStreetMap Wiki, current documentation; accessed 17 Oct 2026.
29. [Overpass API language guide](https://wiki.openstreetmap.org/wiki/Overpass_API/Language_Guide) — OpenStreetMap Wiki, current documentation; accessed 17 Oct 2026.
30. [Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API) — OpenStreetMap Wiki, query service documentation; accessed 17 Oct 2026. No Overpass response log was included in the pack.
31. [OSM API usage policy](https://operations.osmfoundation.org/policies/api/) — OpenStreetMap Foundation, editing API policy; says the editing API is for editing, not read-only projects; accessed 17 Oct 2026.
32. [OSM bbox map response](https://api.openstreetmap.org/api/0.6/map?bbox=101.49%2C3.16%2C101.54%2C3.20) — OpenStreetMap editing API endpoint; response could not be fetched to verify its contents or timestamp (snippet-only). The local GeoJSON metadata state retrieval date 17 Oct 2026.
33. [GeoJSON RFC 7946](https://www.rfc-editor.org/rfc/rfc7946) — Internet Engineering Task Force, Aug 2016.
34. [OSMF attribution guidelines](https://osmfoundation.org/wiki/Licence/Attribution_Guidelines) — OpenStreetMap Foundation, adopted 25 Jun 2021; accessed 17 Oct 2026.
35. [OSMF legal FAQ](https://osmfoundation.org/wiki/Licence_and_Legal_FAQ) — OpenStreetMap Foundation, current FAQ; accessed 17 Oct 2026.
36. [OpenStreetMap copyright](https://www.openstreetmap.org/copyright) — OpenStreetMap Foundation, current attribution and licence page; accessed 17 Oct 2026.
37. [Sime Darby Property Elmina reference](https://www.simedarbyproperty.com/press-releases/blazing-fast-internet-speed-sime-darby-propertys-elmina-homes) — Sime Darby Property, 2018; City of Elmina and Elmina Central Park overview.
38. [Copernicus DEM collection](https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM) — Copernicus Data Space Ecosystem, current collection page; accessed 17 Oct 2026.
39. [Copernicus DEM 30 m access notice](https://dataspace.copernicus.eu/news/2026-7-17-copernicus-dem-30m-view-service-license-acceptance) — Copernicus Data Space Ecosystem, 17 Jul 2026.
40. [Where can I get global elevation data?](https://www.usgs.gov/faqs/where-can-i-get-global-elevation-data) — U.S. Geological Survey, current FAQ; accessed 17 Oct 2026.
41. [MYSA Remote Sensing Open Data](https://rsopendata.mysa.gov.my/) — Malaysian Space Agency, current catalogue and terms; accessed 17 Oct 2026.
42. [PLANMalaysia Selangor geospatial data page](https://ftp.jpbdselangor.gov.my/index.php/en/perkhidmatan/sistem-maklumat-geografi-gis/pembelian-data-geospatial.html) — PLANMalaysia Selangor, search preview dated 21 May 2025 (snippet-only; page fetch blocked).
43. [Sketchfab Quadcopter drone](https://sketchfab.com/3d-models/quadcopter-drone-ca8f0f70a1014e77a6777dc248e9bf5a) — Annelida / Sketchfab, search preview dated 31 Mar 2024 (snippet-only; page fetch blocked; details not verified).
44. [Sketchfab downloading models](https://sketchfab.com/developers/download-api/downloading-models) — Sketchfab Developers, search preview only (snippet-only; page fetch blocked); accessed 17 Oct 2026.
45. [Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/) — Creative Commons, version 4.0 legal code.
46. [GLTFLoader API](https://threejs.org/docs/pages/GLTFLoader.html) — Three.js, undated; accessed 17 Oct 2026.
47. [glTF 2.0 specification](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.pdf) — Khronos Group, version 2.0; accessed 17 Oct 2026.
48. [Water API](https://threejs.org/docs/pages/Water.html) — Three.js, undated; accessed 17 Oct 2026.
49. [WaterMesh API](https://threejs.org/docs/pages/WaterMesh.html) — Three.js, undated; accessed 17 Oct 2026.
50. [Compute rain example](https://threejs.org/examples/webgpu_compute_particles_rain.html) — Three.js examples, undated; accessed 17 Oct 2026.
51. [Points API](https://threejs.org/docs/pages/Points.html) — Three.js, undated; accessed 17 Oct 2026.
52. [DirectionalLight API](https://threejs.org/docs/pages/DirectionalLight.html) — Three.js, undated; accessed 17 Oct 2026.
53. [HemisphereLight API](https://threejs.org/docs/pages/HemisphereLight.html) — Three.js, undated; accessed 17 Oct 2026.
54. [CameraHelper API](https://threejs.org/docs/pages/CameraHelper.html) — Three.js, undated; accessed 17 Oct 2026.
55. [CSS2DRenderer API](https://threejs.org/docs/pages/CSS2DRenderer.html) — Three.js, undated; accessed 17 Oct 2026.
56. [CatmullRomCurve3 API](https://threejs.org/docs/pages/CatmullRomCurve3.html) — Three.js, undated; accessed 17 Oct 2026.
57. [EffectComposer API](https://threejs.org/docs/pages/EffectComposer.html) — Three.js, undated; accessed 17 Oct 2026.
58. [Canvas captureStream](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/captureStream) — MDN Web Docs, current documentation; accessed 17 Oct 2026.
59. [MediaRecorder](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder) — MDN Web Docs, current documentation; accessed 17 Oct 2026.
60. [MediaStream Recording specification](https://www.w3.org/TR/mediastream-recording/) — World Wide Web Consortium, current specification; accessed 17 Oct 2026.
61. [Open Database License v1.0](https://opendatacommons.org/licenses/odbl/1-0/) — Open Data Commons, legal text for ODbL v1.0; accessed 17 Oct 2026.
62. [JUPEM geospatial services](https://sites.google.com/jupem.gov.my/jupemgeospatialwebservices/home) — Department of Survey and Mapping Malaysia (JUPEM), undated catalogue; accessed 17 Oct 2026.
63. [MediaDevices.getDisplayMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia) — MDN Web Docs, current documentation; accessed 17 Oct 2026.
64. [Google 3D Tiles root tileset endpoint](https://tile.googleapis.com/v1/3dtiles/root.json?key=YOUR_API_KEY) — endpoint template documented in Google's 3D Tiles guide; the placeholder URL was not live-tested.
65. [Three.js latest package metadata](https://registry.npmjs.org/three/latest) — official npm registry JSON; confirms version `0.186.1` and MIT licence; accessed 17 Oct 2026.
66. [MyGDI data sharing and release](https://www.mygeoportal.gov.my/index.php/en/perkongsian-data-mygdi) — Malaysia Geospatial Online Services, current data-sharing/request information; accessed 17 Oct 2026.
