# Drone integration research

Fact-checked research behind Safe Edge's drone patrol, AI layer, SDK and Three.js simulation, gathered on 17 October 2026. Ten Codex workers (gpt-6-luna, max effort) each researched one topic, and a second worker per topic checked every claim against its source. The product decisions that rest on it are in [`PRODUCT.md`](/PRODUCT.md), the [PRD](/docs/PRD.md) and the [TRD](/docs/TRD.md).

Contents:

1.  [What changed in the design](#what-changed-in-the-design)
1.  [Findings by topic](#findings-by-topic)
    1.  [Drone rules](#drone-rules)
    1.  [Privacy and community](#privacy-and-community)
    1.  [Hardware and cost](#hardware-and-cost)
    1.  [Detection limits](#detection-limits)
    1.  [Mission planning](#mission-planning)
    1.  [Drone SDKs and Procore](#drone-sdks-and-procore)
    1.  [AI perception](#ai-perception)
    1.  [Agent layer and governance](#agent-layer-and-governance)
    1.  [Three.js and geodata](#threejs-and-geodata)
    1.  [Prior art](#prior-art)
1.  [Verification](#verification)
1.  [See also](#see-also)

## What changed in the design

1.  **Automated, never autonomous.** CAAM does not allow operations where the remote pilot cannot intervene, so a licensed pilot supervises every flight. This matches the team's "humans monitor and review" framing.
2.  **No real flight before submission.** A Standard ATF needs 14 working days, so the hackathon prototype is a labelled simulation on real Elmina map data.
3.  **Three detection tiers.** Published evidence supports flagging visible changes, not certifying hazards. Fence gaps and missing covers need a person to confirm; canopy and water need a field visit.
4.  **Phased drones.** A hired VLOS operator first, then a dock under a Special UAS Project, following CAAM's published dock approvals.
5.  **Prior art is real.** PUB's Smart Drain Inspector and DJI's change detection overlap the AI part, so the pitch leads with the accountable repair loop, not with drones or AI.

## Findings by topic

### Drone rules

- A Standard ATF needs at least 14 working days; CAAM lists RM250 per surveillance drone per location area, and one application covers up to 90 days.
- Elmina Central Park appears to sit inside Subang's Class C control zone, about 6.5 km from the airport.
- CAAM has published dock-based BVLOS approvals at a Rawang warehouse (2025) and at Bintulu Port and Samalaju (2026), each limited to its site.

Full pack: [CAAM rules](/docs/research/drone-integration/caam-rules.md).

### Privacy and community

- Identifiable photos are personal data under the PDPA; recurring patrols likely trigger a data protection officer and an impact assessment.
- Good practice: discard frames with people before storage, use fixed routes and capture windows, and publish bilingual notices.
- Malaysian acceptance evidence covers mosquito-surveillance drones, not water-edge inspection, so it must be tested locally.

Full pack: [privacy](/docs/research/drone-integration/privacy.md).

### Hardware and cost

- Malaysian listings: DJI Dock 3 at RM55,140 and Matrice 4TD at RM25,740; DJI announced Dock 4 on 14 October 2026.
- DJI docks fly in rain up to 2 mm/h; Subang averaged 211.8 rain days a year from 2020 to 2024.
- A first-year model gives RM23,017 to RM64,642 for a hired manual operator and RM88,548 for one docked park, before installation, approvals and insurance.

Full pack: [hardware and cost](/docs/research/drone-integration/hardware-cost.md).

### Detection limits

- Visible drain inlets, floating debris, vegetation and exposed bank change have published aerial results; missing covers, fence gaps and ring buoys do not.
- A 100 mm gap is optically resolvable in a close, sharp view, but no study validates it on routine patrols; canopy hides fence bases.
- No reusable Malaysian drone dataset labels these hazards, so the pilot must build one.

Full pack: [detection](/docs/research/drone-integration/detection.md).

### Mission planning

- Segment edges into tasks, offset flight lines with Turf.js 7.4.0, and route by priority per watt-hour with a battery reserve.
- data.gov.my provides forecasts and warnings under CC BY 4.0; JPS Public Infobanjir shows rainfall at Sungai Buloh (station 27880) without a documented API.
- Missions export as DJI WPML KMZ or QGroundControl `.plan` JSON.

Full pack: [mission planning](/docs/research/drone-integration/mission-planning.md).

### Drone SDKs and Procore

- DJI Cloud API uses MQTT, HTTPS and WebSocket and supports Dock 2 and Dock 3; the new Cloud API 2 terms restrict commercial use without DJI's permission.
- MAVSDK's JavaScript binding is a proof of concept, so a MAVLink adapter needs a server-side bridge.
- Procore can create Observation items with photo attachments, and its sandbox needs no verification.

Full pack: [drone SDKs](/docs/research/drone-integration/drone-sdk.md).

### AI perception

- Run the privacy gate on the aircraft or an edge server, alignment and change detection on an edge server, and send only redacted crops to a cloud model.
- The best open-vocabulary detector on an aerial benchmark scored 27.6 F1 with 69% false positives, so models propose and people decide.
- Image input to hosted vision models costs a fraction of a cent per image.

Full pack: [AI perception](/docs/research/drone-integration/ai-perception.md).

### Agent layer and governance

- The MCP specification is at revision 2026-07-28; the TypeScript server package is `@modelcontextprotocol/server` 2.3.1.
- Use one constrained agent in a deterministic workflow, with read, propose and draft scopes and server-side enforcement.
- Malaysia's AIGE guidelines are voluntary; the AI Governance Bill is expected to be tabled in early 2027.

Full pack: [agent layer](/docs/research/drone-integration/agent-layer.md).

### Three.js and geodata

- Three.js r186 (`three@0.186.1`) on `WebGLRenderer`; 3DTilesRendererJS 0.5.3 loads Google tiles, which may not be cached or analysed.
- The OSM extract for the Elmina window has 55 water features, 56 parks and playgrounds, 418 paths and 44 barriers, of which only 3 are lines. The [GeoJSON files](/docs/research/drone-integration/data/) carry the ODbL notice.
- Copernicus DEM and SRTM are 30 m; no open LiDAR for Elmina was found.

Full pack: [Three.js and geodata](/docs/research/drone-integration/threejs-geodata.md).

### Prior art

- Closest overlap: PUB's Smart Drain Inspector challenge (AI defect detection and mapping for drains) and PUB's reservoir drones.
- Rescue drones, smart lifebuoys and pool drowning detection act during or after an incident; Safe Edge acts before.
- No source found the full flag, owner, repair, independent re-test and expiring-pass loop for township water edges. That is a limit of the search, not proof of novelty.

Full pack: [prior art](/docs/research/drone-integration/prior-art.md).

## Verification

| Pack              | Checked | Confirmed | Corrected | Removed | Snippet only |
| ----------------- | ------: | --------: | --------: | ------: | -----------: |
| CAAM rules        |      48 |        22 |        20 |       2 |            4 |
| Privacy           |      48 |        37 |         6 |       1 |            4 |
| Hardware and cost |      44 |        21 |        15 |       2 |            6 |
| Detection         |      53 |        26 |         7 |       1 |           19 |
| Mission planning  |      51 |        28 |         9 |       2 |           12 |
| Drone SDKs        |      47 |        33 |         7 |       1 |            6 |
| AI perception     |      40 |        26 |         7 |       1 |            6 |
| Agent layer       |      50 |        44 |         4 |       0 |            2 |
| Three.js, geodata |      53 |        40 |         4 |       3 |            6 |
| Prior art         |      55 |        32 |        13 |       1 |            9 |
| **Total**         | **489** |   **309** |    **92** |  **14** |       **74** |

The packs show corrected values. A snippet-only claim comes from a search result whose page did not open; do not put one in the pitch without opening the source.

## See also

- [Safe Edge pitch and evidence plan](/docs/research/shortlist/safe-edge.md)
- [Water-edge checks](/docs/research/niche-problems/drowning/water-edge-checks.md) and [drowning prevention](/docs/research/niche-problems/drowning/drowning-prevention.md)
- [Hackathon brief](/docs/BRIEF.md)
