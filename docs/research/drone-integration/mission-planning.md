# Dynamic patrol planning and routing for drone water-edge inspection

Research pack for Safe Edge's drone and AI layer. One Codex worker researched it and a second worker checked every claim against its source on 17 October 2026. See the [summary](/docs/research/drone-integration.md) for how it changed the design.

Contents:

1.  [Summary](#summary)
1.  [Findings](#findings)
    1.  [1. Coverage path planning and patrol scheduling](#1-coverage-path-planning-and-patrol-scheduling)
        1.  [Coverage paths for linear water edges](#coverage-paths-for-linear-water-edges)
        1.  [Published methods and practical heuristics](#published-methods-and-practical-heuristics)
        1.  [Multi-asset scheduling under battery limits](#multi-asset-scheduling-under-battery-limits)
    1.  [2. Risk inputs and real Malaysian data sources](#2-risk-inputs-and-real-malaysian-data-sources)
        1.  [Weather APIs](#weather-apis)
        1.  [JPS rainfall and water-level data](#jps-rainfall-and-water-level-data)
        1.  [Time windows, geofences, and wind](#time-windows-geofences-and-wind)
    1.  [3. Mission file formats](#3-mission-file-formats)
        1.  [DJI WPML KMZ](#dji-wpml-kmz)
        1.  [PX4 and QGroundControl .plan JSON](#px4-and-qgroundcontrol-plan-json)
        1.  [MAVLink mission protocol](#mavlink-mission-protocol)
    1.  [4. TypeScript and JavaScript libraries](#4-typescript-and-javascript-libraries)
        1.  [Geometry and coverage](#geometry-and-coverage)
        1.  [Route optimization](#route-optimization)
        1.  [Three.js visualization](#threejs-visualization)
    1.  [5. Safe Edge dynamic patrol planner](#5-safe-edge-dynamic-patrol-planner)
        1.  [Data model](#data-model)
        1.  [Priority score](#priority-score)
        1.  [Routing and constraints](#routing-and-constraints)
        1.  [Replanning triggers](#replanning-triggers)
        1.  [Three.js display](#threejs-display)
1.  [Recommendations for Safe Edge](#recommendations-for-safe-edge)
1.  [What we can and cannot claim](#what-we-can-and-cannot-claim)
    1.  [Safe claims](#safe-claims)
    1.  [Claims to avoid](#claims-to-avoid)
1.  [Open questions](#open-questions)
1.  [Sources](#sources)

## Summary

- Analyst's read: optional risk-ranked patrol tasks fit a team-orienteering or prize-collecting model; mandatory service is closer to coverage or arc routing. The cited research abstracts describe linear-infrastructure coverage [4], zoned team orienteering [5], station-based inspection with battery-swap stations [6], and online UAV orienteering with time windows and newly arriving targets [7]. The cited publisher pages for these papers did not open directly, so these descriptions are limited to accessible abstract snippets.
- Use offset edge-following routes and camera stations derived from measured camera footprint. Bridge-inspection research is useful background, but the cited publisher pages did not open directly. Do not transfer unverified distances, pitch, or overlap settings to Safe Edge. [1](https://www.sciencedirect.com/science/article/pii/S0952197625012540) [2](https://doi.org/10.1016/j.autcon.2025.106101)
- Malaysia’s data.gov.my weather API documents forecast and warning endpoints, with access terms and a request limit. MET Malaysia’s own API portals are less clear: the older portal says V1 is deprecated, while V2.1 documentation has an authentication inconsistency and does not expose an accessible endpoint schema in the pages checked. [8](https://api.met.gov.my/) [9](https://metapi2.met.gov.my/) [10](https://developer.data.gov.my/realtime-api/weather) [11](https://developer.data.gov.my/rate-limit) [13](https://developer.data.gov.my/faq.en)
- Public Infobanjir provides interactive rainfall and river-level pages. Its live rainfall graph labels Rem KTM Sungai Buloh (F2); the station number comes from the graph URL parameter. Search-result-only station names and IDs, including Ladang Elmina, were not confirmed in the opened selectors. JPS also has station-information and hydrological-data application pages, but a nearest gauge, public machine API/schema, and open reuse licence for a named SDP pond were not verified. [15](https://publicinfobanjir.water.gov.my/hujan/data-hujan/?state=SEL&lang=en) [16](https://publicinfobanjir.water.gov.my/aras-air/data-paras-air/?state=SEL&lang=en) [17](https://publicinfobanjir.water.gov.my/rf-graph/?stationid=27880&lang=en) [46](https://www.water.gov.my/index.php/pages/view/2170) [47](https://publicinfobanjir.water.gov.my/cari-station/)
- Park opening hours do not reveal busy periods. Tourism Selangor lists Elmina Central Park as open 24 hours, but no hour-by-hour attendance data was found. Use SDP occupancy or event data and a park manager’s operating windows. [19](https://selangor.travel/listing/elmina-central-park/)
- CAAM’s UAS rules are planning gates. Its English page says Standard ATF applications need at least 14 working days and a KML/KMZ mission with activity, geofencing, risk, and boundary zones. It also identifies additional restrictions and approvals for some surveillance and imaging operations; check the selected aircraft and operation before any live flight. The demo should remain a simulation unless flight approvals are confirmed. [20](https://www.caam.gov.my/public/unmanned-aircraft-system-uas/) [21](https://www.caam.gov.my/bm/umum/sistem-kapal-udara-tanpa-pemandu-uas/)
- An early prototype can use Turf.js 7.4.0 and Three.js 0.186.1, both MIT-licensed, with a proposed deterministic greedy route builder. Google OR-Tools documents C++, Python, C#, and Java support, but no official JavaScript interface is listed. The cited npm pages for Three.js and the third-party or-tools-wasm package did not open; Three.js version and licence were checked separately against the official npm registry, while the or-tools-wasm version and licence remain unverified. [30](https://turfjs.org/docs/api/lineOffset) [35](https://github.com/Turfjs/turf) [39](https://www.npmjs.com/package/three?activeTab=versions) [40](https://github.com/mrdoob/three.js/blob/dev/LICENSE) [36](https://developers.google.com/optimization/install/) [38](https://www.npmjs.com/package/or-tools-wasm) [48](https://registry.npmjs.org/three/latest)
- Analyst's read: the key pilot dependency is not the optimizer. It is access to surveyed SDP edge geometry, a real accepted baseline and flag ledger, a named maintenance owner, and permission to fly at the selected asset.

## Findings

### 1. Coverage path planning and patrol scheduling

#### Coverage paths for linear water edges

Analyst's read: represent each water edge as a surveyed centerline or boundary polyline, broken at access changes, obstructions, sharp bends, and ownership changes. Treat each segment as an inspection task with a side, length, required views, accepted baseline, and service state. The abstract of [4] models multiple-UAV coverage of linear infrastructure as a Min–Max K-Chinese Postman variant; the cited MDPI page was rate-limited, so this source is snippet-only. [4](https://www.mdpi.com/2504-446X/7/9/563)

For each segment, generate a candidate flight line offset from the edge by a camera stand-off distance. Where both banks or both sides of a drain matter, create separate candidate passes. Clip or reject a candidate that intersects a no-fly polygon, building, tree canopy, or ground-access buffer. Use a local projected coordinate system for metre-based offsets and distances; do not apply metre assumptions directly to raw longitude/latitude.

A photo station interval should be derived from the camera footprint on the target surface and the required overlap. For a flat surface normal to the camera axis, a first-order footprint width is 2 × range × tan(horizontal field-of-view / 2); a nominal station spacing is footprint length times (1 − forward-overlap fraction). These are geometric approximations. Oblique views change the footprint shape and scale, so calculate the camera frustum intersection with the bank or drain plane, then confirm with sample imagery and the smallest defect the team needs to resolve. Bridge-inspection papers explicitly balance camera distance, view direction, overlap, image resolution, and path length. [1](https://www.sciencedirect.com/science/article/pii/S0952197625012540) [2](https://doi.org/10.1016/j.autcon.2025.106101)

Analyst's read: the sources reviewed do not establish a universal water-edge stand-off or gimbal pitch. The draft's bridge-study values of 10, 20, and 30 metres and near-horizontal pitch were not verified: the cited publisher page [2] did not open directly, and its indexed abstract does not show those settings. Remove those numbers from operating guidance. Derive parameters from the selected camera and validate them with sample imagery. [2](https://doi.org/10.1016/j.autcon.2025.106101)

Use a camera aim point on the bank/edge, not a fixed gimbal angle alone. At each waypoint, compute yaw from aircraft position to the aim point and choose pitch from target geometry, then enforce the selected aircraft’s gimbal and safety limits. The camera should capture the water-edge barrier, drain cover, signs, buoy locations, and route approach where visible; a single view may not prove the absence of a gap behind vegetation. Analyst's read: define a small, repeatable view set for each asset class, then mark occluded coverage as uncovered for human review.

#### Published methods and practical heuristics

The accessible abstract snippets describe these methods: [1] uses Voronoi preprocessing and a collaborative greedy viewpoint method with camera field-of-view and gimbal constraints; [3] describes genetic viewpoint search followed by greedy camera-pose selection; [4] models linear-network inspection as a coverage-path problem. These are design references, not proof of Elmina field performance. The cited publisher pages did not open directly, so these method descriptions are snippet-only. [1](https://www.sciencedirect.com/science/article/pii/S0952197625012540) [3](https://www.sciencedirect.com/science/article/pii/S0926580524005004) [4](https://www.mdpi.com/2504-446X/7/9/563)

For the prototype, use these practical rules:

1. Start with one offset pass on the accessible side of each edge and add a reverse or opposite-side pass only where visibility requirements demand it.
2. Split curved or obstructed edges into shorter tasks. Recompute offsets at bends and reject offset geometry that self-intersects or cuts across a barrier.
3. Densify turns and waypoints only as required by the selected drone’s turning and camera-capture behavior. Avoid tight turns at photo stations.
4. Store the required camera views and expected footprint with each task. Record “not visible” as a coverage gap rather than a successful inspection.
5. Use a repeatable image baseline and viewpoint where possible so a later pass can compare the same area. Keep human acceptance separate from AI detection.

#### Multi-asset scheduling under battery limits

Analyst's read: for optional tasks under limited flight time, team orienteering is a useful abstraction: select tasks to maximize priority within route or time budgets. Prize-collecting routing can represent explicit penalties for skipped tasks. Use vehicle routing when tasks must be assigned across drones and docks; use coverage or arc routing when every edge must be served. Abstract snippets describe a multi-weight Min–Max K-Chinese Postman formulation for linear infrastructure [4] and a zoned team-orienteering problem for multiple UAVs [5]. The cited publisher pages were not directly accessible, so treat those paper details as snippet-only. [4](https://www.mdpi.com/2504-446X/7/9/563) [5](https://link.springer.com/article/10.1007/s10846-025-02266-9)

Represent each dock as a start/end node and each edge task as a prize-bearing node or service arc. Feasibility must include outbound travel, task time, camera capture, turns, wind, climb, payload, and return to a compatible dock with a reserve. Distance alone is a weak battery proxy. The abstract snippet for the 2025 station-based inspection paper describes task allocation, battery capacity, operation-duration limits, and automatic battery-swap stations. Its publisher page did not open directly, so this detail is snippet-only. [6](https://www.sciencedirect.com/science/article/pii/S0305048324001373)

Dynamic replanning is appropriate when new damage reports arrive or weather changes. The 2014 online stochastic mission-planning abstract describes time windows and targets arriving during a mission; the 2025 zoning abstract describes local zones for flexible multi-UAV operations. Keep already-started or pilot-approved legs committed, and optimize only the uncommitted remainder. Both cited publisher pages were inaccessible directly, so these paper details are snippet-only. [5](https://link.springer.com/article/10.1007/s10846-025-02266-9) [7](https://www.sciencedirect.com/science/article/pii/S0377221714002288)

Analyst's read: for the hackathon, use a transparent heuristic rather than solving a large mixed-integer model. At each insertion step, select the feasible task with the largest added priority per added watt-hour, while checking a return route to a usable dock and the reserve. Break ties by earliest pass expiry, then by shortest added flight time. Apply a small local reorder to future stops, but do not reorder a flight leg already started. The weights and tie-breaks are proposal choices, not validated operational thresholds.

### 2. Risk inputs and real Malaysian data sources

#### Weather APIs

MET Malaysia’s older portal at api.met.gov.my describes a free JSON API, access-token registration, limits of 1,000 requests per day and 3 requests per minute, and says API version 1 is deprecated. Treat those limits and the V1 interface as legacy details, not as the new planner’s contract. The portal does not provide a clear current V1 removal date in the accessible page. [8](https://api.met.gov.my/)

The current MET API portal identifies API V2.1, JSON, an API key, and a limit of 60 requests per minute. Its FAQ also says the API is publicly accessible without authentication. That is an inconsistency in the official portal. Exact V2.1 endpoint paths, response schemas, and an explicit data licence were not found in the public pages accessible during this review; its documentation link led to a login page. Confirm access and terms with MET before depending on it. [9](https://metapi2.met.gov.my/)

The documented Government Open API alternative is:

| Resource           | Documented endpoint                                    | Documented use                                                                                             |
| ------------------ | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Forecast           | GET https://api.data.gov.my/weather/forecast           | General forecast data supplied by MET Malaysia; the page documents a daily-updated forecast for locations. |
| Weather warning    | GET https://api.data.gov.my/weather/warning            | Warnings updated as they are issued.                                                                       |
| Earthquake warning | GET https://api.data.gov.my/weather/warning/earthquake | Earthquake warning feed.                                                                                   |

The official API page documents these endpoints, data fields, and query filtering. The forecast schema provides general day-part forecast descriptions and temperature fields; it is not a local rain-gauge or numeric wind-speed feed. The API’s documented query parameters include location filtering and date/time filtering where supported by the endpoint. [10](https://developer.data.gov.my/realtime-api/weather) [14](https://developer.data.gov.my/request-query)

The data.gov.my quickstart says no API token is required. Its rate-limit page gives the weather endpoints a limit of 4 requests per minute, and its FAQ states the data is available under Creative Commons Attribution 4.0. Keep attribution and cache responses within the published limit. [11](https://developer.data.gov.my/rate-limit) [12](https://developer.data.gov.my/quickstart) [13](https://developer.data.gov.my/faq.en)

For current dispatch decisions, use official weather warnings as a no-go or review signal, not as proof that conditions at a specific pond are safe. Add a site-level wind reading and the selected aircraft manufacturer’s operating limits before allowing a flight. The public forecast schema checked here does not document numeric local wind speed. Analyst's read: if direct MET API access is not confirmed before the prototype, show the data.gov.my response with its timestamp and “regional forecast” label rather than pretending it is a site sensor.

#### JPS rainfall and water-level data

Public Infobanjir’s rainfall page has State, District, and Station selectors and displays rainfall intensity categories for the one-hour view: light 1–10 mm, moderate 11–30 mm, heavy 31–60 mm, and very heavy above 60 mm. The page warns that convective rain above 60 mm in 2–4 hours may cause flash floods. These are JPS rainfall categories and a general warning, not a pond-level prediction or a Safe Edge dispatch threshold. [15](https://publicinfobanjir.water.gov.my/hujan/data-hujan/?state=SEL&lang=en)

The Selangor rainfall graph for Rem KTM Sungai Buloh (F2), station ID 27880, is publicly viewable and provides date-range/frequency controls and PDF/PNG export. Use the live page to verify the current timestamp and station status before selecting it for a prototype. [17](https://publicinfobanjir.water.gov.my/rf-graph/?stationid=27880&lang=en)

Snippet-only and excluded from station selection: a search-result capture claimed Ladang Elmina station ID 3115053 under Kuala Selangor and showed an update date of 30 August 2026. Other snippets named Sg. Buloh di Paya Jaras and Sg. Buloh di Parit Mahang. None of these names, IDs, dates, proximity, or hydrological links appeared in the opened source content, so do not use them as verified station facts. [15](https://publicinfobanjir.water.gov.my/hujan/data-hujan/?state=SEL&lang=en) [16](https://publicinfobanjir.water.gov.my/aras-air/data-paras-air/?state=SEL&lang=en)

The water-level page exposes state, district, and station selection with river-level status bands Normal, Alert, Warning, and Danger. It reports river water level, not a verified stage reading for an SDP retention pond or lake. Analyst's read: use a nearby river gauge only as catchment context after the link is confirmed; use an SDP-installed sensor or approved site observation for the pond itself. [16](https://publicinfobanjir.water.gov.my/aras-air/data-paras-air/?state=SEL&lang=en)

The additional official-source checks found useful interface and access details, but no public JSON/API schema or open reuse licence. Public Infobanjir's Rainfall, Water Level Trend page has state, district, station, and date controls; it offers rainfall, water-level, combined graphs, and PDF/PNG plus CSV/PDF/DOC export options. JPS's Online Applications Usage Report lists hydrological-data applications for government/research and private projects, with aggregate payments for private-project applications; it does not state unit prices or reuse terms. The Info Stesen page includes station-ID and latitude/longitude fields, but showed no current station rows during this check. No nearest gauge or hydrological connection to a named SDP pond was verified. Use the public interface for the prototype or ask JPS/SDP about an approved feed, terms, and fees; do not depend on undocumented website requests. [45](https://publicinfobanjir.water.gov.my/trend-hujan-aras-air/?lang=en) [46](https://www.water.gov.my/index.php/pages/view/2170) [47](https://publicinfobanjir.water.gov.my/cari-station/)

#### Time windows, geofences, and wind

Tourism Selangor lists Elmina Central Park as open 24 hours and names public recreation facilities, but its listing has no hourly visitor counts. Do not infer that the park is empty at night or early morning. Analyst's read: ask SDP for event schedules, visitor counters, and the maintenance owner's operating windows; then select low-use windows and show the source and timestamp in the planner. [19](https://selangor.travel/listing/elmina-central-park/)

The English CAAM page describes Standard ATF as a low-risk route for VLOS or EVLOS flights with at most one visual observer, no spraying or dispensing, and below 400 ft AGL unless otherwise approved. It requires the application and supporting documents at least 14 working days before the proposed activity, a Google Earth Pro KML/KMZ plan with activity, geofencing, risk, and boundary zones, and submission of automated-flight-assistance missions by the Accountable Manager. CAAM also lists research and development under Special UAS Project approval. It says operators of UAS capable of surveillance or measuring activities such as aerial photography, aerial mapping, or LiDAR must seek JUPEM approval. For small unmanned surveillance aircraft, CAAM lists restrictions over or within 150 m of designated residential, commercial, industrial, or recreational areas; within 50 m of people, vessels, vehicles, or structures; and over open-air assemblies above 1,000 people, with a 30 m takeoff/landing exception for the proximity rule. CAAM's Malay page says the application should be submitted at least 14 days before the activity but does not specify working days; the English page explicitly says 14 working days. Confirm the applicable deadline with CAAM. Confirm the selected operation's category, airspace, and required approvals with an accountable pilot and the relevant agencies. [20](https://www.caam.gov.my/public/unmanned-aircraft-system-uas/) [21](https://www.caam.gov.my/bm/umum/sistem-kapal-udara-tanpa-pemandu-uas/)

The official Sime Darby Property hackathon page describes a 10–12-week programme, lists proposal submission on 23 October 2026 and final submission on 11 November 2026, and does not give an 18 October build or flight date. Do not treat that date as established. For any proposed live-flight date, compare the date with the English CAAM page's 14-working-day Standard ATF lead time and confirm whether other approvals apply. [49](https://www.simedarbyproperty.com/universityhackathon/) [20](https://www.caam.gov.my/public/unmanned-aircraft-system-uas/)

Create a hard geofence layer from CAAM-approved mission geometry, SDP property boundaries, public access areas, trees/buildings, and any pilot-defined buffer. Reject a route that intersects a prohibited zone; do not treat a colored map overlay as legal clearance. Do not set a numeric wind limit until the aircraft and payload are selected. The data.gov.my forecast schema does not document a numeric site-level wind field. JPS's Info Stesen page lists a wind-speed parameter category, but showed no current station rows during this check. Neither source verified a wind reading at a selected SDP asset; use a site instrument and the selected aircraft's manual as flight gates. [10](https://developer.data.gov.my/realtime-api/weather) [47](https://publicinfobanjir.water.gov.my/cari-station/) [20](https://www.caam.gov.my/public/unmanned-aircraft-system-uas/)

### 3. Mission file formats

#### DJI WPML KMZ

DJI WPML route files use the KMZ ZIP format. The documented structure includes wpmz/template.kml for template/business settings and wpmz/waylines.wpml for executable flight and payload instructions; wpmz/res/ stores auxiliary resources such as reference images when the route uses them. Include the resources required by the selected route. [22](https://github.com/dji-sdk/Cloud-API-Doc/blob/master/docs/en/60.api-reference/00.dji-wpml/10.overview.md)

    route.kmz
    └── wpmz/
        ├── template.kml
        ├── waylines.wpml
        └── res/                 optional

DJI's template example uses the WPML 1.0.2 XML namespace. The template reference lists product-support differences and route-template-specific fields, so confirm the exact model and template requirements before creating a file. The waylines reference page [24] did not expose readable content in this check; do not rely on it for an unverified field requirement. [23](https://github.com/dji-sdk/Cloud-API-Doc/blob/master/docs/en/60.api-reference/00.dji-wpml/20.template-kml.md)

Not found: one cross-model “minimal valid” DJI file. The documentation shows product-support differences and route-template-specific fields; it does not establish that one two-file skeleton is valid across models. Without selecting the aircraft and template, a hand-written file could be invalid. For the hackathon, generate a sample route in the intended DJI workflow, inspect its KMZ, and edit only fields documented for that product and template.

#### PX4 and QGroundControl .plan JSON

QGroundControl’s Stable v4.4 file-format page defines .plan as JSON with top-level fileType, groundStation, mission, optional geoFence and rallyPoints, and version fields. The page’s example contains one SimpleItem; the following compact sample retains the fields from that documented one-item mission shape. It is a schema example, not a flight-ready Elmina route. [26](https://docs.qgroundcontrol.com/Stable_V4.4/en/qgc-dev-guide/file_formats/plan.html)

    {
      "fileType": "Plan",
      "geoFence": { "circles": [], "polygons": [], "version": 2 },
      "groundStation": "QGroundControl",
      "mission": {
        "cruiseSpeed": 15,
        "firmwareType": 12,
        "globalPlanAltitudeMode": 1,
        "hoverSpeed": 5,
        "items": [{
          "AMSLAltAboveTerrain": null,
          "Altitude": 50,
          "AltitudeMode": 0,
          "autoContinue": true,
          "command": 22,
          "doJumpId": 1,
          "frame": 3,
          "params": [15, 0, 0, null, 47.3985099, 8.5451002, 50],
          "type": "SimpleItem"
        }],
        "plannedHomePosition": [47.3977419, 8.545594, 487.989],
        "vehicleType": 2,
        "version": 2
      },
      "rallyPoints": { "points": [], "version": 2 },
      "version": 1
    }

The example coordinates and altitude are copied from the QGroundControl schema example and are not site data. PX4’s mission documentation describes planning and uploading missions through QGroundControl; validate the saved plan with the selected firmware and vehicle before use. [26](https://docs.qgroundcontrol.com/Stable_V4.4/en/qgc-dev-guide/file_formats/plan.html) [27](https://docs.px4.io/v1.18/en/flying/missions)

#### MAVLink mission protocol

A mission upload uses a request/response sequence: the ground station sends MISSION_COUNT; the vehicle requests each sequence with MISSION_REQUEST_INT; the ground station sends each item with MISSION_ITEM_INT; the vehicle ends with MISSION_ACK and MAV_MISSION_ACCEPTED on success. The older MISSION_ITEM and MISSION_REQUEST messages are deprecated, but protocol implementations must still support them for compatibility. [28](https://mavlink.io/en/services/mission.html)

For MISSION_ITEM_INT, the x and y fields encode latitude and longitude in degrees multiplied by 10^7 only when the selected frame is global; local frames use local coordinates. Altitude is carried in z, and its reference depends on the frame. Upload the new mission and wait for an accepted acknowledgement before replacing the active plan; on upload failure, keep the previous approved plan. [28](https://mavlink.io/en/services/mission.html) [29](https://mavlink.io/en/messages/common.html)

### 4. TypeScript and JavaScript libraries

#### Geometry and coverage

Turf.js documentation is currently version 7.4.0 and the project is MIT-licensed. Its documented functions fit the prototype’s GeoJSON geometry work: lineOffset creates candidate edge-following offsets; buffer expands a hard exclusion/geofence polygon; lineChunk splits an edge into route tasks; along samples camera stations by distance; and bearing computes the direction to an aim point. [30](https://turfjs.org/docs/api/lineOffset) [31](https://turfjs.org/docs/api/buffer) [32](https://turfjs.org/docs/api/lineChunk) [33](https://turfjs.org/docs/api/along) [34](https://turfjs.org/docs/api/bearing) [35](https://github.com/Turfjs/turf)

Turf's geographic methods accept lon/lat GeoJSON and explicit distance units. Use the documented metre or kilometre units; the default unit is kilometres. If a planar local projection is used for a precision check, project and convert coordinates explicitly. Do not pass metre-valued projected coordinates to Turf as if they were longitude/latitude. Offset curves near corners still need topology checks and field validation. [30](https://turfjs.org/docs/api/lineOffset) [31](https://turfjs.org/docs/api/buffer)

#### Route optimization

Google OR-Tools documents C++, Python, C#, and Java interfaces; its official installation page lists no JavaScript interface. The repository states Apache License 2.0. The cited npm page for the third-party or-tools-wasm package returned an access error, so its version, licence, and availability could not be verified; do not rely on those package details. [36](https://developers.google.com/optimization/install/) [37](https://github.com/google/or-tools) [38](https://www.npmjs.com/package/or-tools-wasm)

Analyst's read: for a one-day build, implement a small deterministic greedy insertion heuristic in TypeScript and keep the optimizer behind a function boundary. Avoid making the demo depend on a native build, WASM initialization, or solver-specific model setup. If the pilot later requires optimized multi-drone schedules, evaluate OR-Tools in a supported language or validate a JS/WASM alternative against known routes.

#### Three.js visualization

The official npm registry reports Three.js version 0.186.1 and MIT licensing when checked on 17 October 2026. Use ESM imports. The project's CommonJS build is marked deprecated and is scheduled for removal in a future release. The cited npm webpage itself did not open; the version and licence were checked against the official registry JSON. [39](https://www.npmjs.com/package/three?activeTab=versions) [40](https://github.com/mrdoob/three.js/blob/dev/LICENSE) [41](https://github.com/mrdoob/three.js/blob/dev/build/three.cjs) [48](https://registry.npmjs.org/three/latest)

For the scene, use BufferGeometry.setFromPoints to build candidate paths and Line with LineBasicMaterial for route overlays. The renderer ignores LineBasicMaterial.linewidth on WebGL and WebGPU, so use a mesh ribbon or tubes if route width must encode coverage. [42](https://threejs.org/docs/pages/Line.html) [43](https://threejs.org/docs/pages/BufferGeometry.html) [44](https://threejs.org/docs/pages/LineBasicMaterial.html)

### 5. Safe Edge dynamic patrol planner

#### Data model

Store source provenance and timestamps with every input. A proposed model is:

| Record          | Minimum fields                                                                                                                                          |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Asset           | asset ID, asset type, owner, surveyed edge geometry, site/district, approved operating window, linked dock IDs                                          |
| SegmentTask     | segment ID, asset ID, edge geometry, required side/views, capture interval, estimated task time and energy, priority components, due/pass expiry        |
| PassRecord      | pass ID, segment ID, accepted/rejected status, reviewer, accepted baseline reference, acceptance time, expiry, reason                                   |
| Observation     | observation ID, timestamp, image reference, camera/pose, drone, source mission, coverage/occlusion status                                               |
| Flag            | flag ID, segment ID, class, model confidence, human-reviewed severity, open/closed state, recurrence, work-order reference                              |
| Dock and drone  | dock ID/location/compatibility; drone ID, payload, usable battery, current battery, reserve rule, supported mission format, aircraft wind limit         |
| ContextSnapshot | rainfall source/value/time window, river or pond-level source/value/time, forecast/warning, wind source/value, occupancy/event window, geofence version |
| Plan            | plan ID, generated time, source snapshot IDs, ordered tasks, route geometry, estimated energy, return dock, rejected candidates and reasons             |

The accepted baseline, pass expiry, and ownership fields should come from SDP’s real maintenance register. No public baseline, pass ledger, or asset-level defect feed was found in the sources reviewed. Use empty or “unknown” states in the demo instead of fabricated live defects.

#### Priority score

Analyst's read: start with a normalized score for ranking candidate tasks, not for declaring a water edge safe:

    priority = 0.25 × expiry + 0.35 × reviewedFlag + 0.25 × rain + 0.15 × waterLevel

These weights are an initial product hypothesis, not measured or published risk coefficients. The rainfall and water-level channels should retain their JPS source labels and timestamps. [15](https://publicinfobanjir.water.gov.my/hujan/data-hujan/?state=SEL&lang=en) [16](https://publicinfobanjir.water.gov.my/aras-air/data-paras-air/?state=SEL&lang=en)

- expiry: 0 for a current, valid pass; rising toward 1 as its due time approaches or has passed. Define the expiry window with SDP’s maintenance policy.
- reviewedFlag: highest human-reviewed unresolved severity, raised for recurrence. Do not use raw model confidence as a harm-severity score.
- rain: normalize recent measured rainfall and official warnings to a bounded score. The JPS one-hour intensity categories can seed bins, but the heavy-rain threshold must be calibrated with SDP; it is not a flight safety threshold. [15](https://publicinfobanjir.water.gov.my/hujan/data-hujan/?state=SEL&lang=en)
- waterLevel: use an SDP pond sensor if available. A JPS river gauge is a regional proxy only after a hydrologic link is confirmed. [16](https://publicinfobanjir.water.gov.my/aras-air/data-paras-air/?state=SEL&lang=en)
- If a source is stale, missing, or mismatched, mark that component unknown and require review. Do not silently map missing data to a low-risk zero.

#### Routing and constraints

Analyst's read: route construction can be a repeatable two-stage heuristic. First create viewpoints and segment tasks from surveyed edge geometry; then assign tasks to each drone and dock.

    buildTasks(assets, acceptedBaselines, flags):
        split surveyed edge lines at access, geometry, and ownership changes
        create one or more offset capture paths per edge segment
        sample viewpoints using measured camera footprint and overlap
        attach pass expiry, reviewed flags, real source timestamps, and task energy

    plan(tasks, drones, docks, geofences, windows, context):
        reject viewpoints outside approved airspace or inside hard exclusion zones
        precompute feasible travel-energy estimates between docks and tasks
        for each drone:
            route = [current position]
            while a feasible insertion remains:
                candidates = unassigned tasks with a valid time window
                keep tasks whose route plus task plus return to a compatible dock
                    fits usable battery minus the aircraft-specific reserve
                choose the feasible insertion with highest
                    added priority divided by added watt-hours
                insert after the current committed leg
                run a small local reorder on uncommitted future stops
            emit route, coverage, energy, return dock, and rejected-task reasons
        return plan with source snapshot IDs and freshness labels

Use site-approved polygons as hard constraints, not score penalties. Add occupancy windows, event closures, forecast warnings, live wind, and battery state before dispatch. The current plan must preserve enough energy to return to a compatible dock under a conservative wind estimate; set the reserve only after selecting the aircraft and validating the estimate. For a live mission update, upload and receive an accepted protocol acknowledgement before changing the active route. [20](https://www.caam.gov.my/public/unmanned-aircraft-system-uas/) [28](https://mavlink.io/en/services/mission.html)

A full pairwise travel-energy matrix over n tasks and d docks takes O((n + d)²) time and memory. If the proposed scan evaluates every remaining task once per accepted stop, without searching every possible insertion position, its worst-case scan cost is O(k n²) for k drones. Geometry splitting and camera sampling add work proportional to input vertices and generated viewpoints. These are complexity estimates for the proposed implementation, not paper results; a different insertion search changes the bound.

#### Replanning triggers

Recompute the uncommitted route when any of these events changes priority or feasibility:

- A new JPS heavy-rain observation or official weather warning arrives. Keep the JPS category and timestamp visible; do not equate rainfall alone with a pond flood level. [10](https://developer.data.gov.my/realtime-api/weather) [15](https://publicinfobanjir.water.gov.my/hujan/data-hujan/?state=SEL&lang=en)
- A human confirms a new hazard flag, a damage report arrives, or a work order remains unresolved.
- A pass approaches or passes its SDP-defined expiry.
- Wind, battery, geofence, occupancy, event schedule, dock availability, or flight permission changes.
- A repair is marked complete: capture a re-test, compare it with the baseline, and require independent human acceptance before refreshing the pass.

Do not let an AI detection close a work order or issue a valid pass. The plan should say “candidate route,” “not inspected,” “flag for review,” or “human-accepted pass” and show who accepted what.

#### Three.js display

Build the scene over real, permissioned SDP GIS or survey geometry for the park and water edges. SDP identifies City of Elmina and Elmina Central Park on its official site, but a public site page is not a surveyed fence, drain, or hazard baseline. [18](https://www.simedarbyproperty.com/city-of-elmina)

Draw the accepted edge centerlines, offset capture paths, geofence polygons, docks, task viewpoints, and estimated return path as separate layers. Color edge segments by pass state and flag state; show uncovered and occluded sections explicitly. Use a moving drone marker and camera frustum to explain the view direction. Add a timeline scrubber for real observation, weather, flag, and repair timestamps, plus a side panel with task score components, estimated energy, reserve, selected dock, source timestamp, and rejection reason. Three.js BufferGeometry, Line, and material APIs support the route overlays; use mesh ribbons for clearly visible route widths. [42](https://threejs.org/docs/pages/Line.html) [43](https://threejs.org/docs/pages/BufferGeometry.html) [44](https://threejs.org/docs/pages/LineBasicMaterial.html)

Analyst's read: the demo is strongest when its map geometry is real and its unknowns remain visibly unknown. Use real weather observations and public park geometry where licensing permits, and ask SDP for surveyed water-edge geometry, maintenance records, and accepted baselines. Do not create synthetic defect dots or label simulated detection output as a real site finding.

## Recommendations for Safe Edge

1. Model the water boundary as segmented service arcs and choose the optimization mode based on whether tasks are optional or mandatory. This follows Finding 1’s coverage-path and orienteering/arc-routing formulations. [4](https://www.mdpi.com/2504-446X/7/9/563) [5](https://link.springer.com/article/10.1007/s10846-025-02266-9)
2. Parameterize stand-off, gimbal aim, and capture overlap from the chosen drone-camera geometry. Calibrate against real edge imagery before setting a pilot threshold. This follows Finding 1’s inspection-geometry evidence. [1](https://www.sciencedirect.com/science/article/pii/S0952197625012540) [2](https://doi.org/10.1016/j.autcon.2025.106101)
3. For the prototype, use data.gov.my forecast/warning endpoints and Public Infobanjir’s live pages with visible timestamps. Treat river-level stations as context until SDP or JPS confirms the catchment link. This follows Finding 2’s API and station gaps. [10](https://developer.data.gov.my/realtime-api/weather) [15](https://publicinfobanjir.water.gov.my/hujan/data-hujan/?state=SEL&lang=en) [16](https://publicinfobanjir.water.gov.my/aras-air/data-paras-air/?state=SEL&lang=en)
4. Make airspace approval, geofences, public-use windows, wind, and return-to-dock energy hard feasibility checks. Demonstrate the patrol as a simulation until CAAM, JUPEM where applicable, and SDP approvals are confirmed. SDP's published judging criteria assign 20% to feasibility and deliverability and 10% to team, evidence, and pitch quality, so show these gates plainly. [20](https://www.caam.gov.my/public/unmanned-aircraft-system-uas/) [19](https://selangor.travel/listing/elmina-central-park/) [49](https://www.simedarbyproperty.com/universityhackathon/)
5. For an early planner, use Turf.js 7.4.0, a small deterministic greedy routine, and Three.js 0.186.1. Keep the data model replaceable so a later pilot can use a validated optimizer or the selected aircraft's mission format. [30](https://turfjs.org/docs/api/lineOffset) [35](https://github.com/Turfjs/turf) [48](https://registry.npmjs.org/three/latest) [26](https://docs.qgroundcontrol.com/Stable_V4.4/en/qgc-dev-guide/file_formats/plan.html) [22](https://github.com/dji-sdk/Cloud-API-Doc/blob/master/docs/en/60.api-reference/00.dji-wpml/10.overview.md)

## What we can and cannot claim

### Safe claims

- The planner can rank candidate patrol tasks using real, timestamped weather data and SDP-maintained pass/flag records, if those real records are supplied and integrated. Malaysia’s documented weather API and JPS interactive rainfall/river pages are available inputs, with limitations described in Finding 2. [10](https://developer.data.gov.my/realtime-api/weather) [15](https://publicinfobanjir.water.gov.my/hujan/data-hujan/?state=SEL&lang=en)
- The prototype can show candidate offset routes, planned viewpoints, geofence rejection, and uncovered edge sections over real site geometry supplied by SDP. SDP’s public City of Elmina page identifies the development, but does not supply the surveyed hazard baseline. [18](https://www.simedarbyproperty.com/city-of-elmina)
- The AI layer can raise review flags, draft work orders, and request a patrol; a human reviews observations and independently accepts repair verification. These are product behaviors proposed for Safe Edge, not a claim that an algorithm certifies safety.
- The prototype is a planning simulation unless the team confirms the selected drone, current mission file, accountable pilot, and all applicable regulatory and site approvals. CAAM's ATF page, JUPEM imaging requirement, and the selected aircraft's mission documentation are relevant gates. [20](https://www.caam.gov.my/public/unmanned-aircraft-system-uas/)

### Claims to avoid

- “The AI proves this edge is safe,” “the drone detects every hazard,” or “Safe Edge prevents drownings.” The inspected sources do not validate these claims, and a visible image can still miss an occluded defect.
- “The JPS river gauge is the level of this SDP pond” or “this is the nearest station to the asset.” The candidate stations were not matched to a surveyed asset or validated catchment.
- “We know the park’s quietest flight hours” or “wind is safe.” No hourly occupancy feed or documented numeric local wind feed was found in the sources checked.
- “The prototype has CAAM flight approval,” “the AI-issued pass certifies safety,” or “a route generated in the demo is ready for a real drone.” CAAM’s approval and aircraft-specific mission constraints must be confirmed for the selected flight. [20](https://www.caam.gov.my/public/unmanned-aircraft-system-uas/) [23](https://github.com/dji-sdk/Cloud-API-Doc/blob/master/docs/en/60.api-reference/00.dji-wpml/20.template-kml.md)

## Open questions

- Which drone, camera, controller, firmware, payload, gimbal range, and supported mission format will the pilot use?
- Which SDP water asset will be used, and can SDP provide surveyed edges, geofences, an accepted photo baseline, pass expiry rules, open flags, and work-order status?
- Who will own maintenance after handover, approve the repair budget, and independently accept re-tests?
- Can JPS or SDP confirm the rainfall and river gauge closest to the selected asset, the catchment relationship, and a machine-readable data arrangement?
- Which CAAM/landowner approvals apply to a live flight in the selected public recreation area, and what occupancy or event feed can define safe operating windows?

## Sources

1. [Coverage path planning of bridge inspection with Unmanned aerial vehicle](https://www.sciencedirect.com/science/article/pii/S0952197625012540) — Engineering Applications of Artificial Intelligence, 2025; direct page returned 403, abstract snippet only.
2. [Drone-based bridge inspections: Current practices and future directions](https://doi.org/10.1016/j.autcon.2025.106101) — Automation in Construction, May 2025; direct page returned 403, abstract snippet only.
3. [Optimized structural inspection path planning for automated unmanned aerial systems](https://www.sciencedirect.com/science/article/pii/S0926580524005004) — Automation in Construction, 1 December 2024; direct page returned 403, abstract snippet only.
4. [Constraint Programming Approach to Coverage-Path Planning for Autonomous Multi-UAV Infrastructure Inspection](https://www.mdpi.com/2504-446X/7/9/563) — Drones, 2023; direct page was rate-limited, abstract snippet only.
5. [A Team Orienteering Problem with Zoning for Safe and Flexible Operations of UAVs in a Dynamic Environment](https://link.springer.com/article/10.1007/s10846-025-02266-9) — Journal of Intelligent & Robotic Systems, published 21 May 2025; direct page fetch failed, abstract snippet only.
6. [Optimal allocation and route design for station-based drone inspection of large-scale facilities](https://www.sciencedirect.com/science/article/pii/S0305048324001373) — Omega, 2025; direct page returned 403, abstract snippet only.
7. [Online stochastic UAV mission planning with time windows and time-sensitive targets](https://www.sciencedirect.com/science/article/pii/S0377221714002288) — European Journal of Operational Research, 2014; direct page returned 403, abstract snippet only.
8. [MET Malaysia API portal](https://api.met.gov.my/) — Malaysian Meteorological Department, accessed 17 October 2026.
9. [MET Malaysia API V2.1 portal](https://metapi2.met.gov.my/) — Malaysian Meteorological Department, accessed 17 October 2026.
10. [Weather real-time API](https://developer.data.gov.my/realtime-api/weather) — data.gov.my, Government of Malaysia, accessed 17 October 2026.
11. [Rate limit](https://developer.data.gov.my/rate-limit) — data.gov.my, Government of Malaysia, accessed 17 October 2026.
12. [Quickstart](https://developer.data.gov.my/quickstart) — data.gov.my, Government of Malaysia, accessed 17 October 2026.
13. [Frequently asked questions](https://developer.data.gov.my/faq.en) — data.gov.my, Government of Malaysia, accessed 17 October 2026.
14. [Request query](https://developer.data.gov.my/request-query) — data.gov.my, Government of Malaysia, accessed 17 October 2026.
15. [Rainfall data, Selangor](https://publicinfobanjir.water.gov.my/hujan/data-hujan/?state=SEL&lang=en) — Department of Irrigation and Drainage Malaysia, Public Infobanjir, accessed 17 October 2026.
16. [Water-level data, Selangor](https://publicinfobanjir.water.gov.my/aras-air/data-paras-air/?state=SEL&lang=en) — Department of Irrigation and Drainage Malaysia, Public Infobanjir, accessed 17 October 2026.
17. [Rainfall graph, Rem KTM Sungai Buloh (F2), station 27880](https://publicinfobanjir.water.gov.my/rf-graph/?stationid=27880&lang=en) — Department of Irrigation and Drainage Malaysia, Public Infobanjir, accessed 17 October 2026.
18. [City of Elmina](https://www.simedarbyproperty.com/city-of-elmina) — Sime Darby Property, accessed 17 October 2026.
19. [Elmina Central Park](https://selangor.travel/listing/elmina-central-park/) — Tourism Selangor, accessed 17 October 2026.
20. [Unmanned aircraft system (UAS)](https://www.caam.gov.my/public/unmanned-aircraft-system-uas/) — Civil Aviation Authority of Malaysia, accessed 17 October 2026.
21. [Sistem kapal udara tanpa pemandu (UAS)](https://www.caam.gov.my/bm/umum/sistem-kapal-udara-tanpa-pemandu-uas/) — CAAM Malay page, accessed 17 October 2026; states at least 14 days, without specifying working days.
22. [DJI WPML overview](https://github.com/dji-sdk/Cloud-API-Doc/blob/master/docs/en/60.api-reference/00.dji-wpml/10.overview.md) — DJI, Cloud API documentation, accessed 17 October 2026.
23. [DJI WPML template.kml reference](https://github.com/dji-sdk/Cloud-API-Doc/blob/master/docs/en/60.api-reference/00.dji-wpml/20.template-kml.md) — DJI, Cloud API documentation, accessed 17 October 2026.
24. [DJI WPML waylines.wpml reference](https://developer.dji.com/doc/cloud-api-tutorial/en/api-reference/dji-wpml/waylines-wpml.html) — DJI Cloud API documentation, accessed 17 October 2026; page exposed no readable body in this check, snippet-only.
25. [Import flight routes](https://fh.dji.com/user-manual/en/flight-route-library/import-flight-routes.html) — DJI FlightHub, accessed 17 October 2026; page exposed no readable body in this check, snippet-only.
26. [Plan file format](https://docs.qgroundcontrol.com/Stable_V4.4/en/qgc-dev-guide/file_formats/plan.html) — QGroundControl, Stable v4.4 documentation, accessed 17 October 2026.
27. [Missions](https://docs.px4.io/v1.18/en/flying/missions) — PX4, v1.18 documentation, accessed 17 October 2026.
28. [Mission protocol](https://mavlink.io/en/services/mission.html) — MAVLink, accessed 17 October 2026.
29. [Common MAVLink messages](https://mavlink.io/en/messages/common.html) — MAVLink, accessed 17 October 2026.
30. [lineOffset API](https://turfjs.org/docs/api/lineOffset) — Turf.js, version 7.4.0, accessed 17 October 2026.
31. [buffer API](https://turfjs.org/docs/api/buffer) — Turf.js, version 7.4.0, accessed 17 October 2026.
32. [lineChunk API](https://turfjs.org/docs/api/lineChunk) — Turf.js, version 7.4.0, accessed 17 October 2026.
33. [along API](https://turfjs.org/docs/api/along) — Turf.js, version 7.4.0, accessed 17 October 2026.
34. [bearing API](https://turfjs.org/docs/api/bearing) — Turf.js, version 7.4.0, accessed 17 October 2026.
35. [Turf.js repository and licence](https://github.com/Turfjs/turf) — Turf.js, MIT licence, accessed 17 October 2026.
36. [Install OR-Tools](https://developers.google.com/optimization/install/) — Google for Developers, accessed 17 October 2026.
37. [Google OR-Tools repository](https://github.com/google/or-tools) — Google, Apache License 2.0, accessed 17 October 2026.
38. [or-tools-wasm package](https://www.npmjs.com/package/or-tools-wasm) — npm page returned 403; version and Apache-2.0 licence remain unverified, snippet-only.
39. [three package](https://www.npmjs.com/package/three?activeTab=versions) — npm page returned 403, snippet-only; current version checked against official registry [48].
40. [Three.js licence](https://github.com/mrdoob/three.js/blob/dev/LICENSE) — Three.js, MIT, accessed 17 October 2026.
41. [Three.js CommonJS build](https://github.com/mrdoob/three.js/blob/dev/build/three.cjs) — Three.js, deprecation notice, accessed 17 October 2026.
42. [Line](https://threejs.org/docs/pages/Line.html) — Three.js documentation, accessed 17 October 2026.
43. [BufferGeometry](https://threejs.org/docs/pages/BufferGeometry.html) — Three.js documentation, accessed 17 October 2026.
44. [LineBasicMaterial](https://threejs.org/docs/pages/LineBasicMaterial.html) — Three.js documentation, accessed 17 October 2026.
45. [Rainfall, Water Level Trend](https://publicinfobanjir.water.gov.my/trend-hujan-aras-air/?lang=en) — Public Infobanjir, accessed 17 October 2026.
46. [Online Applications Usage Report 2026](https://www.water.gov.my/index.php/pages/view/2170) — Department of Irrigation and Drainage Malaysia; page updated 10 July 2026, accessed 17 October 2026.
47. [Info Stesen](https://publicinfobanjir.water.gov.my/cari-station/) — Public Infobanjir, accessed 17 October 2026; station table displayed no current rows during this check.
48. [Three.js latest package metadata](https://registry.npmjs.org/three/latest) — official npm registry JSON; version 0.186.1 and MIT licence checked 17 October 2026.
49. [Township of Tomorrow | Sime Darby Property University Hackathon](https://www.simedarbyproperty.com/universityhackathon/) — official hackathon timeline and judging criteria, accessed 17 October 2026.
