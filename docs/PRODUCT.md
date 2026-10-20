# Safe Edge

Safe Edge keeps the water edges in Sime Darby Property (SDP) townships closed to children. Drones patrol drain, pond and lake edges and flag what changed. A named owner confirms each flag and picks a fix that closes every recorded route to the water. A second person then proves the fix on site.

This is the product truth for the team. The [PRD](/docs/PRD.md) says what we build by 23 October 2026; the [TRD](/docs/TRD.md) says how. Evidence lives in the [Safe Edge pitch](/docs/research/shortlist/safe-edge.md) and the [drone integration research](/docs/research/drone-integration.md).

Contents:

1.  [Product in one sentence](#product-in-one-sentence)
1.  [Problem](#problem)
1.  [Users and jobs](#users-and-jobs)
1.  [How it works: the Edge Loop](#how-it-works-the-edge-loop)
1.  [Product principles](#product-principles)
1.  [Brand personality](#brand-personality)
1.  [Anti-references](#anti-references)
1.  [What makes it different](#what-makes-it-different)
1.  [Capabilities](#capabilities)
    1.  [Patrol planner](#patrol-planner)
    1.  [Edge Watch](#edge-watch)
    1.  [Phone patrol](#phone-patrol)
    1.  [Edge Inbox and the agent](#edge-inbox-and-the-agent)
    1.  [Fix Lens](#fix-lens)
    1.  [Proof and Edge Pass](#proof-and-edge-pass)
    1.  [Governance board](#governance-board)
    1.  [SDK and MCP server](#sdk-and-mcp-server)
1.  [AI layer at a glance](#ai-layer-at-a-glance)
1.  [Drone integration phases](#drone-integration-phases)
1.  [Register](#register)
1.  [Platform](#platform)
1.  [Success measures](#success-measures)
1.  [Constraints](#constraints)
1.  [Terminology](#terminology)
1.  [Open decisions](#open-decisions)
1.  [See also](#see-also)

## Product in one sentence

**Drones and AI find what changed at SDP's water edges; Safe Edge makes sure a named owner fixes it and a second person proves the fix.**

Hackathon frame: "Township of Tomorrow", People track, safety and security ([brief](/docs/BRIEF.md)).

## Problem

- **Children drown in township water.** The Fire and Rescue Department counted 371 child and teen drowning deaths from January 2023 to August 2026 ([The Star][star-371]). Of 21 news-reported clusters in Selangor and Kuala Lumpur township waters since 2023, 8 began in a drain, and in 2 of those a child went in after a ball ([incident table][incidents]).
- **Edges change after the handover check.** Fences break, covers go missing, informal paths wear through grass, banks erode and ring buoys disappear. Nobody walks every edge every week, and a weekly walk misses what happens after a storm.
- **Nobody owns the gap.** A former SDP Head of Township said: "The bigger issue is not who owns the drain or pond after handover, but whether there is clear accountability for maintenance and public safety" ([consultation][consult]).
- **No public edge inventory exists.** In a 5.5 km × 4.4 km OpenStreetMap window around Elmina Central Park, mappers recorded 18 ponds, lakes and retention basins and 28 rivers, streams and drains, but no fences: only 3 walls and 41 gates ([OSM extract][osm]). Missing map data is not missing fences. It shows that there is no public record to check an edge against.

[star-371]: https://www.thestar.com.my/news/nation/2026/10/16/371-youngsters-lost-to-drowning
[incidents]: /docs/research/niche-problems/drowning/drowning-incidents.md
[consult]: /docs/research/consultations/township-practitioner.md
[osm]: /docs/research/drone-integration/threejs-geodata.md#3-real-geodata-from-openstreetmap

## Users and jobs

| User                                           | Job                                                                      | Where they touch Safe Edge                |
| ---------------------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------- |
| SDP park maintenance manager, Elmina (primary) | Keep every retained water edge closed, and know which ones are not       | Edge Inbox each day; Fix Lens per repair  |
| Responsible drainage or project engineer       | Approve remedies that keep hydraulics, maintenance access and park paths | Remedy review and acceptance tests        |
| Independent reviewer                           | Prove a repair they did not install                                      | Proof re-test on a phone                  |
| Township general manager                       | Fund repairs and see overdue risk                                        | Governance board and monthly report       |
| Licensed remote pilot (SDP or drone service)   | Fly approved patrols and take control at any time                        | Patrol console                            |
| Later: councils and residents' associations    | Receive accepted records at handover; report damage                      | Handover pack; damage report link         |
| Developers inside SDP and partners             | Connect Procore, dashboards and AI assistants                            | TypeScript SDK, events and the MCP server |

These are roles to confirm by name, not commitments already obtained.

## How it works: the Edge Loop

1.  **Patrol.** The planner ranks every edge segment by pass expiry, open flags, recent rain and water level. It then plans a route inside an agreed flight window. A drone flies the route under a licensed remote pilot, who can take control at any time. Where a drone cannot fly, the existing walk crew captures the same fixed viewpoints on a phone, and the rest of the loop is identical.
2.  **Flag.** Edge Watch checks every expected item at each fixed viewpoint (is fence panel 4 still there? is cover C2 in place?), then compares the image with the segment's last accepted baseline. It raises a candidate flag for a change it can see and marks "unknown" anything it cannot see. A missing or changed safety item suspends the edge's pass at once.
3.  **Confirm.** The manager opens the Edge Inbox. Each card shows the before and after images, the reason and a drafted work order. One tap confirms, rejects or asks for another look.
4.  **Fix.** Fix Lens draws a proposed barrier or cover on the site photo and shows any recorded route it still leaves open. The engineer approves the complete remedy and the budget holder funds it.
5.  **Prove.** A reviewer who did not install the repair re-tests it on site. Only then does the pass return, with an expiry date.
6.  **Repeat.** The next patrol checks that the fix holds. Damage, missing coverage or an overdue review suspends the pass again.

## Product principles

1.  **Machines can only lower trust.** Automation can raise flags, suspend passes and draft work. Only named people can confirm a finding, accept a repair or issue a pass. No flag never means safe.
2.  **Watch edges, not people.** Patrols aim at assets. Frames that contain people are discarded before storage. There is no face recognition, tracking or audio.
3.  **A remote pilot can always intervene.** Flights are automated, never fully autonomous. CAAM does not allow operations where the remote pilot cannot intervene ([CAAM rules][caam]).
4.  **Unknown stays unknown.** Canopy, glare, water and occlusion produce "unknown", which creates a field task. Unknown never becomes a pass.
5.  **Two people per fix.** The person who records a repair cannot accept it.
6.  **Decisions in three taps.** People make the calls. The system does the walking, routing, drafting and chasing.
7.  **Simulated means labelled.** Every simulated flight, detection and repair in a demo carries a visible label. False or misleading claims would disqualify the team ([brief](/docs/BRIEF.md#rules)).
8.  **Fly when the park is empty.** Patrols run at first light or another agreed window, hold for lightning and wet surfaces, and keep CAAM's 50 m separation from people with zoom lenses and stand-off distance ([CAAM rules][caam]).
9.  **The drone is optional.** The protocol, not the aircraft, is the product. A phone patrol feeds the same Inbox, Fix Lens and proof.

[caam]: /docs/research/drone-integration/caam-rules.md

## Brand personality

Steady, civic, exact. Safe Edge reads as a public-works tool: reliable, owned by the township, and measured in metres and dates.

## Anti-references

- **Generic SaaS dashboard:** KPI tiles, identical cards, purple gradients, the template look.
- **CCTV control room:** a dark surveillance wall with red alarms and a feeling of watching people, which contradicts "watch edges, not people".
- **Dated government portal:** dense tables, tiny type, banner logos and forms from 2010.

## What makes it different

Drone inspection and AI change detection already exist. Safe Edge does not claim to be the first drone, AI inspector or water-safety patrol ([prior art][prior-art]).

| Closest comparator                      | What it does                                                            | What Safe Edge adds                                                                      |
| --------------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| PUB Smart Drain Inspector, Singapore    | Challenge for AI defect detection and mapping in open and closed drains | Open public water edges, a named owner, a route-closure repair test and an expiring pass |
| PUB reservoir drones, Singapore (2021)  | BVLOS drones watch water quality and water activities                   | Watches assets, not people, and follows every flag through to a proven repair            |
| DJI FlightHub 2 change detection        | Compares photos taken on the same route                                 | Per-edge inventory, a human queue, Fix Lens and an independent re-test                   |
| DroneDeploy property management         | Dated condition records and vendor-work checks                          | A water-edge hazard model, the two-person proof and the one-way trust rule               |
| GFE Smart Lifebuoy                      | Alerts when a lifebuoy is removed                                       | Checks the whole edge, buoys included, with no hardware per buoy                         |
| Rescue drones such as The Little Ripper | Drop flotation after someone is in the water                            | Acts before anyone reaches the water                                                     |

**The new part is the operating protocol:** a drone or a phone patrol flags a missing or changed item, a person confirms it, a named owner repairs it, Fix Lens checks that the repair closes every recorded route, a second person proves it, and the pass expires. The closest overlap a judge will raise is PUB's challenge; the answer is the open-edge scope, the accountable owner and the proof.

[prior-art]: /docs/research/drone-integration/prior-art.md

## Capabilities

### Patrol planner

- Splits each water edge into segments with a side, length, required views and expected inventory (fence runs, covers, gratings, gates, ring buoys, signs).
- Scores each segment: pass expiry, the highest human-reviewed open flag, recent rain and water level. The weights are a product hypothesis to tune with SDP.
- Builds offset flight lines, camera stations and a battery-aware route, and re-plans after heavy rain, a new flag, a pass nearing expiry or a finished repair.
- Plans inside a flight window (first light, the next dry window after rain, a lightning hold, the altitude cap air traffic control sets) and keeps 50 m from people, vehicles and structures not under the pilot's control. Geofences block capture over homes.
- Exports routes as DJI WPML and QGroundControl plans. A remote pilot approves every live flight.

### Edge Watch

- Checks each expected item at its fixed viewpoint first: present, missing, changed or not visible. This is the claim the evidence supports best.
- Compares the rest of the image with the accepted baseline after a quality and alignment check; generic image differences stay in Tier 1.
- Sorts every claim into three tiers (see [AI layer at a glance](#ai-layer-at-a-glance)), so the system never claims more than the evidence supports.
- Drops frames with people before storage.

### Phone patrol

- A phone screen walks the crew to each fixed viewpoint, ghosts the baseline photo over the camera, and sends the new photo into Edge Watch exactly like a drone image.
- It runs today with no aviation approval, so the pilot can start before the first flight.

### Edge Inbox and the agent

- One card per flag: before and after images, the reason, the uncertainty and a drafted work order. Actions: confirm, reject, recapture.
- A single AI agent summarises evidence, drafts work orders and escalations, and answers questions such as "which passes expire this month?". It cites the image and record IDs it used. It cannot approve, submit, send or close anything.

### Fix Lens

- Draws a proposed cover, barrier extension or gate on the site photo, labelled "proposed repair — not installed".
- Highlights any recorded route the proposal leaves open, such as the way around a fence end, before money is spent.
- Fills a work order with marked photos, quantities, the acceptance test and the owner. Quantities come from tape readings, or are estimated from the photo and marked "verify on site". Missing prices say "quote needed".

### Proof and Edge Pass

- A reviewer who did not install the repair re-takes the saved views and repeats the route and gauge checks on site.
- An accepted repair gives the segment an internal pass with an expiry date, at most 12 months. The pass covers only the listed routes and tests on that date. It is not a statutory certificate.
- Damage, changed access, a missed patrol or an overdue review suspends or expires the pass and opens a task.

### Governance board

- A township map and table: every edge with its pass state, owner, open flags, overdue work and unknown coverage.
- Escalates overdue items to the township general manager and drafts a monthly governance report.
- Exports a handover pack for a future receiving authority: the asset, accepted tests, open findings and the upkeep owner. This is the SDP-specific part of the product: a record a developer can hand to the council when a park transfers.

### SDK and MCP server

- A typed REST API and a TypeScript SDK let SDP systems read edges, flags and passes and subscribe to events.
- Provider adapters keep the core independent of any drone vendor or work-order system: simulator now, DJI Cloud API and MAVLink later, Procore for work orders.
- An MCP server lets AI assistants query Safe Edge and draft work, with the same narrow permissions as the built-in agent.

## AI layer at a glance

Published evidence decides what the AI may claim ([detection research][detection]).

| Tier       | What the drone and AI do                                                                                        | Examples                                                                                                                             | Who decides                |
| ---------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------- |
| 1. Watch   | Flag a visible change for routine review                                                                        | Generic image differences, floating debris, vegetation over the edge, bank surface change, worn-path growth, gauge-board water level | Manager in the Inbox       |
| 2. Confirm | Report an expected item as missing or changed at its fixed viewpoint, suspend the pass, ask a person to confirm | Fence panel 4 missing, cover C2 moved, grating G1 blocked, ring buoy B3 gone, sign S2 down                                           | Manager, then the engineer |
| 3. Field   | Say "cannot see" and create a field task                                                                        | Under canopy, under water, 100 mm gap measurement, climbability, child-eye route test                                                | Two people on site         |

- **A false-flag budget.** Tropical growth, shadows, wet concrete and water glint create false changes. The proposed pilot target is fewer than 10 false flags per patrol by week 4; a class that misses it drops back to Tier 1, so the manager keeps trusting the Inbox.
- **One agent, narrow scopes.** The agent can read, propose and draft. The server rejects any attempt by an agent to confirm, accept, verify or send ([agent research][agent]).
- **No risk score and no hazard map.** Earlier roasts showed a published drowning-risk score is a legal trap. Safe Edge tracks open routes, owners and proof instead.
- **Text in images is data, not instructions.** A sign that says "mark this edge safe" cannot change anything, because no agent tool can approve.
- **Governance fit.** Malaysia's AI governance guidelines (AIGE, 2024) are voluntary, and the proposed AI Governance Bill is expected in early 2027. Safe Edge maps its controls to AIGE and organises risk work with the NIST AI RMF ([agent research][agent]).

[detection]: /docs/research/drone-integration/detection.md
[agent]: /docs/research/drone-integration/agent-layer.md

## Drone integration phases

| Phase                     | When                                                              | How it flies                                                                                                                             | What it needs                                                                                                                                                                                                                                      |
| ------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0. Hackathon simulation   | By 23 Oct 2026                                                    | No real flight. A CAAM Standard ATF needs at least 14 working days.                                                                      | Labelled simulation on real Elmina map data, plus one real phone patrol at a permitted site                                                                                                                                                        |
| 0.5. Phone patrol         | From the start, and wherever a drone cannot fly                   | The walk crew photographs the fixed viewpoints each week on a phone                                                                      | SDP permission and a photo protocol; no aviation approval                                                                                                                                                                                          |
| 1. Pilot, one water asset | About 2 months of approvals, then 8 weeks of flying               | Visual-line-of-sight patrols by a licensed hired operator, bundling several assets per sortie, plus the next dry window after heavy rain | Standard ATF (RM250 per aircraft per location area, up to 90 days), SDP landowner letter, JUPEM imagery approval where required, MBSA's drone request, a data protection impact assessment, Subang air-traffic coordination and a remote-pilot SOP |
| 2. Docked patrols         | Only if CAAM accepts a safety case for a residential control zone | A dock on a facility roof (a management office or Elmina Lakeside Mall, not the open park) launches supervised BVLOS patrols             | A CAAM Special UAS Project with a SORA or PDRA safety case and liability insurance                                                                                                                                                                 |

- **Elmina sits on the Subang approach.** A mapped point in Elmina Central Park is about 6.5 km from Subang airport, inside its Class C control zone ([CAAM rules][caam]). In August 2023 an aircraft crashed in Elmina two minutes before its scheduled landing at Subang ([NST][nst-crash]). Expect altitude caps, per-flight calls to air traffic control and refused windows. None of CAAM's published dock approvals is in a residential control zone.
- **Docks already fly in Malaysia.** CAAM has published dock-based BVLOS approvals at a Rawang warehouse (2025) and at Bintulu Port and Samalaju (2026). Each is site-specific, so Elmina needs its own case ([CAAM rules][caam]).
- **Hardware is priced.** Malaysian listings show DJI Dock 3 at RM55,140 and Matrice 4TD at RM25,740; DJI announced Dock 4 on 14 October 2026. DJI docks fly in rain up to 2 mm/h, so Safe Edge patrols in the next dry window after rain, usually the next morning ([hardware and cost][hardware]).
- **Drones earn their cost on coverage, not labour.** One docked park costs about RM88,548 in its first year, against about RM1,800 of staff time for a weekly two-person walk. A drone buys long-edge coverage, a dated image record and a check soon after a storm; the pilot measures which edges justify one, and the phone patrol covers the rest ([hardware and cost][hardware]).
- **Vendor-neutral.** The same core drives a simulator, a DJI dock (Cloud API) or an open autopilot (MAVLink).

[hardware]: /docs/research/drone-integration/hardware-cost.md
[nst-crash]: https://www.nst.com.my/amp/news/nation/2023/08/944279/elmina-air-crash-what-we-know-so-far

## Register

product

## Platform

web

- A web app, desktop-first for the manager and engineer, with phone screens for field capture and re-test.
- A 3D simulation of Elmina in the browser, built on Three.js, for the demo and for planning views.
- A REST API, a TypeScript SDK and an MCP server.
- English first. Bahasa Malaysia for public notices and field screens later.
- Accessibility target: WCAG 2.2 AA.

## Success measures

**Pilot, one asset, 8 weeks** (full method in the [Safe Edge pitch](/docs/research/shortlist/safe-edge.md#impact-and-how-we-measure-it)):

- Sustained closure: confirmed open routes at baseline that stay closed at day 30, with raw counts.
- Days from finding to interim protection, and to independent acceptance.
- Share of edge length inspected each week, with the unknown share shown.
- False flags per patrol and review minutes per flag.
- Cost per kilometre-week of edge inspected, and hours from the end of a storm to inspection, each against the current walk.
- Repairs accepted at first re-test.

**Stop or scale back the drone layer if** (proposed thresholds): false flags stay above 10 per patrol by week 4, less than 80% of the planned edge length is inspected, or an approval is refused. The phone patrol then carries the loop.

**Hackathon demo:** a judge can follow the Edge Loop in 60 seconds; at least 4 of 5 adults in a comprehension test say which proposed fix leaves a route open; no simulated state appears without its label.

## Constraints

- **Rules:** CAAM ATF and SUP approvals, the 150 m and 50 m surveillance-drone distances, the Subang control zone and approach, JUPEM imagery approval, and the PDPA (a data protection officer and an impact assessment are likely before live capture) ([privacy research][privacy]).
- **Weather:** Subang averaged 211.8 rain days a year from 2020 to 2024 and logged 289 lightning days in 2024, so patrols fly the next dry window ([hardware and cost][hardware]).
- **Data:** there is no public edge inventory. Google 3D Tiles may be shown but not analysed, cached or used offline ([Three.js and geodata][geodata]).
- **Team and time:** four students, five build days (18 to 22 October 2026), submission at noon on 23 October.

[privacy]: /docs/research/drone-integration/privacy.md
[geodata]: /docs/research/drone-integration/threejs-geodata.md

## Terminology

- **Edge:** the boundary between a public path, park or play area and a drain, pond or lake.
- **Segment:** one inspectable stretch of an edge, with its own baseline, inventory and pass.
- **Route:** an observed way from a path, gate or play area to the water, through one or more openings.
- **Opening:** a gap, fence end, gate, missing cover or low barrier that a route uses.
- **Remedy:** an engineer-reviewed repair that blocks named openings.
- **Baseline:** the last human-accepted images and inventory of a segment.
- **Patrol:** one planned flight over a set of segments.
- **Candidate flag:** a change the AI proposes. It is not a finding until a person confirms it.
- **Finding:** a human-confirmed defect with an owner.
- **Re-test:** the on-site proof by a person who did not install the repair.
- **Edge Pass:** an internal, expiring record that the listed routes passed the listed tests on a date.
- **Unknown:** a segment or check the system could not see. It always creates a task.

## Open decisions

- The pilot asset. Proposed: a lake edge in Elmina Central Park, which SDP reportedly holds on a 21-year leaseback, or an asset in a phase not yet handed over. SDP must confirm custody.
- Who pays for upkeep after handover: SDP township management, MBSA, or a strata management body for strata ponds. This is the question we need SDP to answer.
- Named people for every role in [Users and jobs](#users-and-jobs).
- The hosting target for the live demo link (see the [TRD](/docs/TRD.md)).

## See also

- [PRD](/docs/PRD.md) and [TRD](/docs/TRD.md)
- [Safe Edge pitch and evidence plan](/docs/research/shortlist/safe-edge.md)
- [Drone integration research](/docs/research/drone-integration.md)
- [Hackathon brief](/docs/BRIEF.md)
