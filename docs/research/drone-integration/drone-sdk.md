# Drone integration APIs and Safe Edge SDK architecture

Research pack for Safe Edge's drone and AI layer. One Codex worker researched it and a second worker checked every claim against its source on 17 October 2026. See the [summary](/docs/research/drone-integration.md) for how it changed the design.

Contents:

1.  [Summary](#summary)
1.  [Findings](#findings)
    1.  [1. DJI Cloud API, FlightHub 2 and FlightHub Sync](#1-dji-cloud-api-flighthub-2-and-flighthub-sync)
    1.  [2. DJI Mobile SDK v5 and Payload SDK](#2-dji-mobile-sdk-v5-and-payload-sdk)
    1.  [3. Open ecosystems and third-party dock integration](#3-open-ecosystems-and-third-party-dock-integration)
    1.  [4. Simulation and browser integration](#4-simulation-and-browser-integration)
    1.  [5. SDK design best practice](#5-sdk-design-best-practice)
    1.  [6. Procore API and third-party app requirements](#6-procore-api-and-third-party-app-requirements)
    1.  [7. Recommended Safe Edge SDK architecture](#7-recommended-safe-edge-sdk-architecture)
1.  [Recommendations for Safe Edge](#recommendations-for-safe-edge)
1.  [What we can and cannot claim](#what-we-can-and-cannot-claim)
1.  [Open questions](#open-questions)
1.  [Sources](#sources)

## Summary

- DJI Cloud API separates dock/device messaging over MQTT, backend and Pilot 2 requests over HTTPS, and server-to-Pilot 2 pushes over WebSocket; its Dock 2 and Dock 3 support tables include the Matrice 3D/3TD and 4D/4TD families. [DJI product introduction](https://developer.dji.com/doc/cloud-api-tutorial/en/overview/product-introduction.html), [product support](https://developer.dji.com/doc/cloud-api-tutorial/en/overview/product-support.html)
- DJI's older Cloud API demo repository says it is no longer maintained and is not production-ready; DJI's newer Cloud API 2 repository was updated on 16 October 2026, includes a virtual-device simulator, and has separate terms released 14 October 2026. [Cloud API demo](https://github.com/dji-sdk/DJI-Cloud-API-Demo), [Cloud API 2](https://github.com/dji-sdk/Cloud-API-2), [Cloud API 2 terms](https://developer.dji.com/cloud-api2-clause/terms/)
- FlightHub 2 has an OpenAPI path, while FlightHub Sync is described in FlightHub 2 On-Premises release notes as a route for media, telemetry, live streams, and events to third parties. Confirm which deployment SDP uses before designing around it. [FlightHub 2 release notes](https://developer.dji.com/doc/priv-deployment-document/en/getting-started/release-notes.html), [OpenAPI demo](https://github.com/dji-sdk/FlightHub-2-OpenAPI-V2-Demo)
- Analyst's read: Open ecosystems can sit behind an adapter boundary: MAVLink/MAVSDK, PX4, ArduPilot, Skydio Cloud API, FlytBase, and Auterion expose different device and cloud integration models. MAVSDK lists JavaScript as proof of concept and Go as work in progress, not as production-supported bindings. [MAVSDK language support](https://mavsdk.mavlink.io/v3/en/), [MAVSDK repository](https://github.com/mavlink/MAVSDK), [Skydio Cloud API](https://apidocs.skydio.com/docs/exploring-the-skydio-cloud-api), [FlytBase API](https://flytbase.com/drone-api), [Auterion app development](https://docs.auterion.com/app-development/app-development)
- Procore documents APIs for checklist inspections, observations, uploads, and webhooks. Observation items can be created with photo attachments. The linked Punch Items page was snippet-only, and the current material reviewed here did not establish a direct checklist-line creation plus photo-attachment flow. [Checklists](https://developers.procore.com/reference/rest/checklists), [Observations tutorial](https://procore.github.io/documentation/tutorial-observations), [uploads](https://procore.github.io/documentation/tutorial-uploads), [Punch Items](https://developers.procore.com/reference/rest/punch-items)
- Analyst's read: For the hackathon, make the provider boundary and event trail real, use a clearly labeled simulation for flight and detections, and defer live dock dispatch and Procore writes until SDP grants the required accounts, permissions, and terms review.

## Findings

### 1. DJI Cloud API, FlightHub 2 and FlightHub Sync

**Cloud API architecture.** DJI describes Cloud API as an IoT-style layer using MQTT, HTTPS, and WebSocket. MQTT carries device telemetry, state, events, requests, and service commands; HTTPS handles request/response flows such as Pilot 2 login and media management; WebSocket lets the server push business messages to Pilot 2. [DJI product introduction](https://developer.dji.com/doc/cloud-api-tutorial/en/overview/product-introduction.html), [HTTPS overview](https://developer.dji.com/doc/cloud-api-tutorial/en/overview/basic-concept/https.html), [WebSocket overview](https://developer.dji.com/doc/cloud-api-tutorial/en/overview/basic-concept/websocket.html)

Do not use `{gateway_sn}` for every MQTT topic. DJI's device-property reference uses device serials for `/osd` and `/state` device topics; gateway serials are used for dock `/events`, `/requests`, `/requests_reply`, `/services`, and `/services_reply` topics. Product-specific examples use the dock serial for dock-level device topics. Match each topic template to the specific device and operation. [DJI device property push](https://developer.dji.com/doc/cloud-api-tutorial/en/api-reference/dock-to-cloud/mqtt/dock/device.html), [DJI MQTT topic definition](https://developer.dji.com/doc/cloud-api-tutorial/cn/api-reference/dock-to-cloud/mqtt/topic-definition.html), [DJI Dock organization APIs](https://developer.dji.com/doc/cloud-api-tutorial/en/api-reference/dock-to-cloud/mqtt/dock/organization.html)

Analyst's read: Use the DJI product-specific reference rather than constructing topics from assumptions.

**Binding and dispatch.** The documented organization binding flow includes **airport_bind_status**, **airport_organization_get**, and **airport_organization_bind** requests on the dock's **/requests** topic. This binds the dock to the organization/workspace represented by the Cloud API backend. [DJI Dock organization APIs](https://developer.dji.com/doc/cloud-api-tutorial/en/api-reference/dock-to-cloud/mqtt/dock/organization.html)

For a Dock 3 wayline task, DJI's Chinese documentation search excerpt reports **flighttask_prepare** followed by **flighttask_execute**, with status/progress returned through device events. It says the task references a wayline file and its fingerprint. The page could not be opened in full here, so treat the exact method names and required fields as snippet-only and verify them in DJI's docs before implementation. DJI WPML defines the route package format, including a KMZ containing **template.kml** and **waylines.wpml**. An English counterpart to the Dock 3 wayline page was not found in the docs search. [Dock 3 wayline APIs, Chinese documentation](https://developer.dji.com/doc/cloud-api-tutorial/cn/api-reference/dock-to-cloud/mqtt/dock/dock3/wayline.html), [DJI WPML waylines](https://developer.dji.com/doc/cloud-api-tutorial/en/api-reference/dji-wpml/waylines-wpml.html)

Analyst's read: Heavy-rain scheduling is not itself a DJI dispatch feature. A Safe Edge weather/event adapter would have to decide when to prepare a patrol, then pass a DJI-compatible route to the dock. Require a named human approver before any real flight dispatch; in the prototype, display the same state transitions without sending a flight command.

**Streaming and media.** DJI's Dock 3 live-stream service uses MQTT service calls, including **live_start_push**, to send a stream to a configured endpoint. [DJI Dock 3 live stream APIs](https://developer.dji.com/doc/cloud-api-tutorial/en/api-reference/dock-to-cloud/mqtt/dock/dock3/live.html)

Analyst's read: A browser-facing Safe Edge page should receive the stream through a media service that can relay and play the selected stream format. MQTT is the control path, not the browser video player.

DJI's media-management flow uses developer-configured object storage and temporary credentials. The dock uploads media to that storage, then sends a file-upload callback containing the storage object reference. The documented Pilot 2 credential flow includes **POST /storage/api/v1/workspaces/{workspace_id}/sts**; the upload result callback is **POST /media/api/v1/workspaces/{workspace_id}/upload-callback**. [DJI Dock media management](https://developer.dji.com/doc/cloud-api-tutorial/en/feature-set/dock-feature-set/dock-media-management.html), [temporary credentials](https://developer.dji.com/doc/cloud-api-tutorial/en/api-reference/pilot-to-cloud/https/media-management/obtain-temporary-credential.html), [upload result callback](https://developer.dji.com/doc/cloud-api-tutorial/en/api-reference/pilot-to-cloud/https/media-management/mediafile-upload-result-report.html), [Dock file upload callback](https://developer.dji.com/doc/cloud-api-tutorial/en/api-reference/dock-to-cloud/mqtt/dock/dock2/file.html)

**Supported hardware.** DJI's current Cloud API product-support table lists Dock 2 with Matrice 3D/3TD and Dock 3 with Matrice 4D/4TD; it also lists earlier supported dock/aircraft combinations. [DJI Cloud API product support](https://developer.dji.com/doc/cloud-api-tutorial/en/overview/product-support.html)

Analyst's read: Check the exact firmware and aircraft pairing against the table before a pilot.

**Demo, maintenance and terms.** DJI's older Cloud API demo repository says it is no longer actively maintained or supported, is not production-ready, and may contain security issues. A separate repository, Cloud-API-Demo-Web, has an MIT license; that license applies to that repository's code and does not establish the service terms for DJI Cloud API. [DJI Cloud API Demo](https://github.com/dji-sdk/DJI-Cloud-API-Demo), [Cloud API Demo Web license](https://github.com/dji-sdk/Cloud-API-Demo-Web/blob/main/LICENSE)

DJI's Cloud API 2 repository describes an SDK, front-end components, an open-source demo, and a virtual-device simulator; its GitHub page showed an update on 16 October 2026 and an Apache-2.0 repository license when checked. DJI's Cloud API 2 terms were released on 14 October 2026. They grant a worldwide, royalty-free, non-assignable, non-sublicensable, non-transferable, non-exclusive license to use software provided as part of the Services. They prohibit commercial exploitation of the Services unless applicable law prevents that restriction or DJI gives written permission. The terms say Cloud API 2 is currently free, while some Services are paid and fees or availability may change; users must obtain any legally required certification or permission. [DJI Cloud API 2 repository](https://github.com/dji-sdk/Cloud-API-2), [Cloud API 2 terms](https://developer.dji.com/cloud-api2-clause/terms/)

Analyst's read: Ask DJI in writing whether the proposed SDP pilot fits the Services restriction or has written permission. The terms alone do not establish whether this particular pilot is a commercial exploitation of the Services. [Cloud API 2 terms](https://developer.dji.com/cloud-api2-clause/terms/)

Not found: a current standalone Cloud API 1 service-terms page. Searched DJI's Cloud API tutorial, developer terms pages, and the official Cloud API demo repository. The separate Cloud-API-Demo-Web MIT license is not a substitute for those terms.

**FlightHub 2.** DJI's official FlightHub 2 OpenAPI V2 demo shows REST-style integration and organization credentials such as **x-user-token**; some project operations also require **x-project-uuid**. The On-Premises release notes dated 6 August 2026 describe OpenAPI V2.0 as having more than 300 interfaces (V1.0 had 67). The current release-notes page also includes a V1.7.1 entry dated 17 August 2026. [FlightHub 2 OpenAPI V2 demo](https://github.com/dji-sdk/FlightHub-2-OpenAPI-V2-Demo), [FlightHub 2 On-Premises release notes](https://developer.dji.com/doc/priv-deployment-document/en/getting-started/release-notes.html)

The same On-Premises release notes say Cloud Interconnection Beta is being phased out in favor of FlightHub Sync. They describe syncing media to third-party buckets, telemetry to third parties, RTSP forwarding, and an Event API. These statements are from the On-Premises release notes; public-cloud feature parity and SDP's entitlement were not confirmed here. [FlightHub 2 On-Premises release notes](https://developer.dji.com/doc/priv-deployment-document/en/getting-started/release-notes.html)

Analyst's read: If SDP already runs FlightHub 2, compare its OpenAPI and Sync path with a direct Cloud API adapter before building a separate MQTT backend. The On-Premises documentation does not prove the same Sync features are enabled for SDP's tenant.

### 2. DJI Mobile SDK v5 and Payload SDK

DJI Mobile SDK v5 is for a custom mobile app that connects to DJI aircraft and controller workflows. DJI describes its MSDK architecture around a mobile application and supported DJI devices. [DJI Mobile SDK overview](https://developer.dji.com/doc/mobile-sdk-tutorial/en/basic-introduction/msdk-introduction.html), [MSDK architecture](https://developer.dji.com/doc/mobile-sdk-tutorial/en/basic-introduction/overview.html)

DJI Payload SDK is for integrating third-party payload hardware with supported aircraft or docks. [DJI Payload SDK documentation](https://developer.dji.com/payload-sdk/documentation/)

Analyst's read: Payload SDK is not the cloud control plane for a park patrol product.

Analyst's read: Neither SDK belongs in Safe Edge's first architecture. Use Cloud API or FlightHub for dock/cloud orchestration. Add MSDK only if Safe Edge needs a custom pilot-controller app; add Payload SDK only if the pilot later requires a payload that the aircraft does not already support.

### 3. Open ecosystems and third-party dock integration

**MAVLink and MAVSDK.** MAVLink is a lightweight drone messaging protocol with telemetry streams and request/response sub-protocols such as mission transfer. [MAVLink Developer Guide](https://mavlink.io/en/), [MAVLink protocol overview](https://mavlink.io/en/about/overview.html)

MAVSDK's current language guide lists C++, Swift, Python, and Java as production-supported. The official repository describes JavaScript, C#, and Rust as proof of concept and Go as work in progress; do not treat those as production-supported. Some language clients communicate with **mavsdk_server** over gRPC. [MAVSDK language guide](https://mavsdk.mavlink.io/v3/en/), [MAVSDK repository](https://github.com/mavlink/MAVSDK)

Not found: a production-supported TypeScript binding in MAVSDK's official language list. Searched the MAVSDK v3 language guide and official repository; the JavaScript binding is listed as proof-of-concept. [MAVSDK language guide](https://mavsdk.mavlink.io/v3/en/), [MAVSDK repository](https://github.com/mavlink/MAVSDK)

**PX4 and ArduPilot.** PX4 is an open flight stack with SITL and simulator interfaces; ArduPilot provides its own SITL and can forward MAVLink to a ground station or companion process. [PX4 simulation guide](https://docs.px4.io/main/en/simulation/), [ArduPilot SITL guide](https://ardupilot.ardupilot.org/dev/docs/sitl-simulator-software-in-the-loop.html)

Analyst's read: These stacks can test generic flight-state and mission adapters, but they do not make DJI Dock hardware compatible.

**Skydio.** Skydio Cloud API offers REST APIs for automation, API tokens scoped by permission, webhooks for event integrations, and WebSocket streaming for telemetry and live video. [Skydio Cloud API overview](https://apidocs.skydio.com/docs/exploring-the-skydio-cloud-api), [Skydio authentication](https://apidocs.skydio.com/reference/authentication)

**FlytBase.** FlytBase advertises a hardware-agnostic cloud API for telemetry, commands, and streaming. Its accessible supported-hardware page lists aircraft compatibility, including Matrice 3D/3TD and 4D/4TD. The linked device-setup page could not be opened in this review; the specific claims about Dock 1/2/3 integration and an Edge Kit were not verified. [FlytBase Drone API](https://flytbase.com/drone-api), [FlytBase device setup](https://docs.flytbase.com/device-management/add-and-setup-your-device), [FlytBase supported hardware](https://flytbase.com/supported-hardware)

**Auterion.** Auterion's app-development docs describe onboard app interfaces and a developer-program enrollment path tied to AuterionOS and its supported vehicle/software stack. [Auterion app development](https://docs.auterion.com/app-development/app-development), [Auterion SDK](https://docs.auterion.com/app-development/auterion-sdk)

Analyst's read: Treat Auterion as a stack-specific provider, not a universal cloud API for arbitrary docks.

**DroneDeploy.** DroneDeploy's setup material says DJI Dock provisioning connects the dock to its third-party cloud service, uses organization provisioning details, and requires MQTT gateway credentials supplied during setup. Its Robotics Toolkit DJI plugin documents linking supported DJI docks, monitoring telemetry, launching planned flights, receiving live camera feeds, and uploading captured media into projects. [DroneDeploy DJI dock provisioning](https://help.dronedeploy.com/hc/en-us/articles/30927637908247-DJI-dock-provisioning-and-set-up), [DroneDeploy DJI agent plugin](https://docs-automate.dronedeploy.com/robotics-toolkit/agent-plugins/dji/)

Analyst's read: DroneDeploy and FlytBase demonstrate two third-party patterns: the dock connects to a vendor cloud through vendor provisioning, or a local edge component brokers dock traffic. Safe Edge should model both behind a provider adapter, but neither vendor's support page proves SDP has a contract, credentials, or a supported configuration.

### 4. Simulation and browser integration

PX4 documents SITL with Gazebo using the command **make px4_sitl gz_x500**. ArduPilot SITL can run without flight hardware and supports external simulators; its documented first-instance setup forwards MAVLink to a ground station over UDP port 14550. [PX4 simulation guide](https://docs.px4.io/main/en/simulation/), [ArduPilot SITL guide](https://ardupilot.ardupilot.org/dev/docs/sitl-simulator-software-in-the-loop.html)

DJI MSDK has an app-oriented simulator/tooling path. DJI Cloud API 2's repository separately advertises virtual devices and operating-condition simulation. [DJI MSDK overview](https://developer.dji.com/doc/mobile-sdk-tutorial/en/basic-introduction/msdk-introduction.html), [DJI Cloud API 2 repository](https://github.com/dji-sdk/Cloud-API-2)

Analyst's read: Those sources do not establish that a DJI Dock's entire flight, camera, and media flow can be reproduced with site-level fidelity.

Analyst's read: A browser-based Three.js scene can receive normalized telemetry from a small local or server-side bridge that reads MAVLink UDP and forwards JSON events over WebSocket. Keep the bridge out of the browser and map only the fields the UI needs. That is a Safe Edge architecture proposal, not a documented DJI API.

Analyst's read: Estimate the team's SITL setup and bridge effort from its experience and environment. The official setup guides do not provide an implementation-time estimate. Add SITL if a teammate already has PX4/ArduPilot experience or if the demo needs to exercise a real MAVLink adapter; otherwise use the Three.js simulation and clearly label flight and detection events as simulated. [PX4 simulation guide](https://docs.px4.io/main/en/simulation/), [ArduPilot SITL guide](https://ardupilot.ardupilot.org/dev/docs/sitl-simulator-software-in-the-loop.html)

Analyst's read: Use genuine, permissioned Elmina imagery or a real site map for the visual baseline. Mark patrol paths, findings, weather triggers, and drone telemetry as simulated unless they came from an actual patrol. Do not show fabricated defects or incident statistics as observed data.

### 5. SDK design best practice

OpenAPI describes HTTP interfaces in a machine-readable contract; AsyncAPI describes message-driven interfaces across protocols including MQTT and WebSocket. CloudEvents provides a common event envelope. [OpenAPI specification](https://spec.openapis.org/oas/), [AsyncAPI specification](https://www.asyncapi.com/docs/reference/specification/v3.0.0), [CloudEvents](https://cloudevents.io/)

Analyst's read: Use OpenAPI for Safe Edge request/response endpoints and AsyncAPI for provider and Safe Edge events, with CloudEvents-shaped envelopes for normalized events.

The TypeScript generator options include openapi-typescript, which generates TypeScript types from an OpenAPI document, and Orval, which can generate clients and framework integrations from an OpenAPI document. [openapi-typescript documentation](https://openapi-ts.dev/readme), [Orval basics](https://orval.dev/docs/guides/basics/)

As checked on 17 October 2026, npm registry metadata showed openapi-typescript 7.13.0, Orval 8.43.0, and @hey-api/openapi-ts 0.99.0. The openapi-typescript documentation says it supports OpenAPI 3.0 and 3.1. The Hey API package page did not provide a verifiable basis for the claim that the package is in initial development or recommends pinning an exact version; that status claim is snippet-only and should not guide implementation. [openapi-typescript documentation](https://openapi-ts.dev/readme), [openapi-typescript package metadata](https://registry.npmjs.org/openapi-typescript/latest), [Orval package metadata](https://registry.npmjs.org/orval/latest), [Hey API package metadata](https://registry.npmjs.org/@hey-api%2fopenapi-ts/latest)

Analyst's read: Pin the selected generator version in the lockfile and regenerate from a reviewed contract; do not hand-maintain generated vendor request shapes.

Analyst's read: Start with openapi-typescript 7.13.0 and a small typed fetch client for the Safe Edge API. Use OpenAPI 3.1 for that generator unless the selected tool documents support for the chosen spec version; the OpenAPI version index lists 3.2.1. [openapi-typescript package](https://www.npmjs.com/package/openapi-typescript), [OpenAPI version index](https://spec.openapis.org/oas/). Use Orval only if the team needs generated query hooks or mocks. Do not spend the hackathon generating separate clients for every vendor's full API; wrap only the handful of operations in the Safe Edge domain.

Analyst's read: Version the public SDK with Semantic Versioning and keep the HTTP base path at **/v1**. Add a version suffix to event types such as **safeedge.finding.detected.v1**. Keep vendor schema/version metadata on adapter configuration, not in the core finding model. [Semantic Versioning 2.0.0](https://github.com/semver/semver.org/blob/gh-pages/spec/v2.0.0.md)

OAuth 2.0 defines client credentials for a confidential client acting on its own behalf or on resources arranged with the authorization server. Procore documents OAuth 2.0 through its Data Connector and says its developer-managed service account credentials are layered with user authorization rather than used alone for user-data access. [OAuth 2.0 RFC 6749](https://www.rfc-editor.org/info/rfc6749/), [Procore Data Connection apps](https://developers.procore.com/documentation/content/building-data-connection-apps)

Analyst's read: Keep provider secrets on the server, use the narrowest provider permissions available, and separate machine credentials from a named human approver. Add a Safe Edge operation ID or idempotency key to every create/dispatch command and deduplicate retries in Safe Edge; do not assume DJI or Procore honors a Safe Edge key unless its endpoint documents that behavior.

Procore documents an hourly limit and a 10-second spike window, returns rate-limit headers, and may return HTTP 429; its guidance is to read the response headers and back off rather than hardcode a quota. [Procore rate limiting guide](https://raw.githubusercontent.com/procore/documentation/main/plan_your_app/rate_limiting.md)

Analyst's read: Use a durable queue for webhook and provider events, record the external event ID, retry transient failures with backoff, and expose a dead-letter/replay view to operators. That provides an auditable event trail without claiming exactly-once delivery.

### 6. Procore API and third-party app requirements

**Inspection checklists.** Procore's current Checklists resource includes **GET /rest/v1.0/projects/{project_id}/checklist/lists** and **POST /rest/v1.1/projects/{project_id}/checklist/lists** to create an inspection instance from an existing template. The current create endpoint supports attachments by reference. The old **POST /rest/v1.0/checklist/lists** create endpoint was deprecated on 25 January 2022. [Procore Checklists API](https://developers.procore.com/reference/rest/checklists)

**Observations.** Procore's Observations tutorial documents **POST /rest/v1.0/observations/items**, update and response-log flows, and a create-item-with-attachment example. For new file integrations, create a project upload using **POST /rest/v1.1/projects/{project_id}/uploads**, upload the returned segments to the returned storage URL using the response headers, complete the upload with its UUID and ordered eTags, then associate the upload reference with the target resource. Do not hard-code storage URLs, headers, or a completion URL; the upload tutorial says these can vary by company and change over time. [Procore Observations tutorial](https://procore.github.io/documentation/tutorial-observations), [direct uploads tutorial](https://procore.github.io/documentation/tutorial-uploads)

**Punch items.** The linked Punch Items reference was snippet-only in this review, so its individual operation paths and attachment contract were not verified. Do not implement against the reported **POST /rest/v1.1/punch_items** or **PATCH /rest/v1.1/punch_items/{id}** paths without checking the current reference in Procore's sandbox. The Punch Item Assignments reference does document **GET /rest/v1.0/projects/{project_id}/punch_item_assignments/{id}** and **PATCH** on that path; the update accepts upload IDs. [Procore Punch Items API](https://developers.procore.com/reference/rest/punch-items), [Punch Item Assignments API](https://developers.procore.com/reference/rest/punch-item-assignments)

**Photos and attachment decision.** A third-party app can create a Procore Observation item with a photo attachment through the documented upload-and-associate flow. It can also create an inspection checklist from a configured template and attach evidence to the checklist instance using the current checklist create API's attachment-by-reference support. The linked Inspection Item Attachments reference was snippet-only in this review; a public create or associate flow for a photo on an individual checklist line item was not verified. [Observations tutorial](https://procore.github.io/documentation/tutorial-observations), [Checklists API](https://developers.procore.com/reference/rest/checklists), [Inspection Item Attachments API](https://developers.procore.com/reference/rest/inspection-item-attachments)

**Auth, webhooks, and access.** Procore apps use OAuth 2.0; project API calls also require the company identifier header shown in endpoint references. Procore documents webhooks for change events, but the exact available event set must be checked for the selected resource and tenant. [Procore developer introduction](https://developers.procore.com/documentation/content/introduction), [Procore webhooks](https://developers.procore.com/documentation/webhooks)

New Procore Developer Portal accounts can build and test in the Developer Sandbox without verification; production use has a separate organization-verification gate and, for Private Developers and Marketplace Partners, an app-level gate. A Procore customer building for its own company is a Customer; a consultant or contractor delivering an integration for one client is a Private Developer. A product or SaaS app, or a one-customer pilot before public listing, uses the Marketplace Partner path. Marketplace Partner verification requires technical feasibility and a signed Partnership Agreement; production apps require certification, although a single-customer pilot may be arranged before certification. [Procore verification and production access](https://developers.procore.com/documentation/content/verification-and-production-access)

Analyst's read: For the hackathon prototype, use the sandbox without waiting for production verification. Before production use for SDP, choose the correct role and access path. If Safe Edge is a product or SaaS app, or is piloted with one customer before listing, Procore's guide routes it through Marketplace Partner; a public listing itself is not required for the hackathon sandbox.

### 7. Recommended Safe Edge SDK architecture

Analyst's read: Use a provider-neutral core and keep each vendor adapter at the edge of the system. The package names below are proposed Safe Edge packages, not existing vendor APIs. The MCP tools guidance recommends that a human can deny tool calls and confirm sensitive actions; keep live flight dispatch approval-gated. [MCP tools guidance, draft](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/draft/server/tools.mdx)

    packages/contracts
      Domain types, OpenAPI description, AsyncAPI event descriptions, validation schemas

    packages/core
      DroneProvider, EvidenceStore, WorkOrderProvider, event normalization,
      human approval and retest state machines

    packages/provider-dji-cloud
      DJI Cloud API adapter; initially a fake client, later MQTT/HTTPS integration

    packages/provider-mavlink
      MAVLink/MAVSDK adapter for PX4/ArduPilot or simulator telemetry

    packages/procore
      OAuth connection, upload flow, observation/checklist/punch mapping

    packages/sdk
      SafeEdgeClient facade for township systems and internal agents

    packages/mcp-server
      Read/query tools and draft-work-order tools; flight dispatch remains approval-gated

    apps/simulator
      Three.js Elmina scene, scenario player, simulation labels, operator triage UI

Analyst's read: Keep the core data model independent from DJI topic payloads, MAVLink messages, and Procore response objects. Expose narrow interfaces such as:

    export interface DroneProvider {
      listDevices(): Promise<DroneDevice[]>;
      getStatus(deviceId: string): Promise<DroneStatus>;
      schedulePatrol(plan: PatrolPlan): Promise<PatrolRun>;
      dispatchPatrol(runId: string, approval: HumanApproval): Promise<void>;
      cancelPatrol(runId: string): Promise<void>;
      onEvent(handler: (event: ProviderEvent) => void): () => void;
    }

    export interface WorkOrderProvider {
      createFinding(input: Finding): Promise<ExternalRecordRef>;
      addEvidence(ref: ExternalRecordRef, evidence: EvidenceRef[]): Promise<void>;
      updateStatus(ref: ExternalRecordRef, status: ExternalWorkStatus): Promise<void>;
    }

    export interface EvidenceStore {
      put(input: EvidenceUpload): Promise<EvidenceRef>;
      getTemporaryUrl(ref: EvidenceRef): Promise<string>;
    }

Analyst's read: Use CloudEvents envelope fields for normalized delivery, then define Safe Edge-owned event names and payloads. Example event types are proposals, not DJI, MAVLink, or Procore event names.

    {
      specversion: "1.0",
      id: "event-id",
      source: "safe-edge://township/asset",
      type: "safeedge.finding.detected.v1",
      subject: "edges/{edgeId}",
      time: "ISO-8601 timestamp",
      data: {
        findingId: "finding-id",
        edgeId: "edge-id",
        category: "fence_gap",
        evidence: [{ mediaRef: "media-id", capturedAt: "timestamp" }],
        reviewStatus: "needs_human_review",
        simulated: true
      }
    }

Analyst's read: Keep the event vocabulary small and explicit: **edge.patrol.scheduled.v1**, **edge.patrol.started.v1**, **edge.patrol.completed.v1**, **edge.finding.detected.v1**, **edge.finding.reviewed.v1**, **edge.work_order.created.v1**, **edge.repair.retest_passed.v1**, and **edge.pass.expired.v1**. A pass is an internal workflow state with a named reviewer and retest evidence; it must not be presented as an AI safety certification.

| Safe Edge operation               | DJI Cloud API mapping                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | MAVLink mapping                                                                                                                                | Procore mapping                                                                                                                                                                                                                                                                                                                                       | Hackathon build status                                                                                  |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Bind and read device status       | Organization bind requests; use device serials for `/osd` and `/state` device topics and gateway serials for `/events` and request/service topics. [DJI device property push](https://developer.dji.com/doc/cloud-api-tutorial/en/api-reference/dock-to-cloud/mqtt/dock/device.html), [DJI topic definition](https://developer.dji.com/doc/cloud-api-tutorial/cn/api-reference/dock-to-cloud/mqtt/topic-definition.html), [DJI binding](https://developer.dji.com/doc/cloud-api-tutorial/en/api-reference/dock-to-cloud/mqtt/dock/organization.html) | Read telemetry and heartbeat messages from the selected vehicle/dialect. [MAVLink common messages](https://mavlink.io/en/messages/common.html) | No device call.                                                                                                                                                                                                                                                                                                                                       | Stub status and binding state.                                                                          |
| Schedule and dispatch a patrol    | Prepare and execute a wayline task; route package follows DJI WPML. [Dock 3 wayline](https://developer.dji.com/doc/cloud-api-tutorial/cn/api-reference/dock-to-cloud/mqtt/dock/dock3/wayline.html), [WPML](https://developer.dji.com/doc/cloud-api-tutorial/en/api-reference/dji-wpml/waylines-wpml.html)                                                                                                                                                                                                                                            | Transfer and start a mission using supported MAVLink mission flows. [MAVLink mission messages](https://mavlink.io/en/messages/common.html)     | Create a Procore record only when a human accepts a finding; Procore does not dispatch the drone.                                                                                                                                                                                                                                                     | Simulated route playback; no real flight command.                                                       |
| Stream and store evidence         | Start a configured live push; use DJI temporary credentials and upload callback for object storage. [DJI live stream](https://developer.dji.com/doc/cloud-api-tutorial/en/api-reference/dock-to-cloud/mqtt/dock/dock3/live.html), [media management](https://developer.dji.com/doc/cloud-api-tutorial/en/feature-set/dock-feature-set/dock-media-management.html)                                                                                                                                                                                    | MAVLink telemetry is separate from the selected camera/media transport. [MAVLink overview](https://mavlink.io/en/about/overview.html)          | Create upload, upload segments, complete it with UUID and eTags, then associate the upload reference with an observation or other supported resource. [Procore uploads](https://procore.github.io/documentation/tutorial-uploads), [observations](https://procore.github.io/documentation/tutorial-observations)                                      | Static, permissioned sample imagery or labeled placeholder; no real stream or object-store integration. |
| Create and triage a finding       | No DJI operation; Safe Edge owns detection and review.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | No MAVLink operation; Safe Edge owns detection and review.                                                                                     | Create Observation item with photo evidence; alternatively create a checklist instance from a template. [Observations](https://procore.github.io/documentation/tutorial-observations), [checklists](https://developers.procore.com/reference/rest/checklists)                                                                                         | Curated, labeled scenario events; AI detection is stubbed.                                              |
| Create a repair record and retest | No vendor safety certification call.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | No MAVLink safety certification call.                                                                                                          | Analyst's read: Map accepted findings to an Observation. Treat a Punch Item mapping as conditional until its current operations and attachment contract are confirmed in the Procore sandbox. [Observations](https://procore.github.io/documentation/tutorial-observations), [Punch Items](https://developers.procore.com/reference/rest/punch-items) | Manual simulated review and retest state; no Procore write.                                             |
| Expire an internal edge pass      | Safe Edge-owned schedule/state transition.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Safe Edge-owned schedule/state transition.                                                                                                     | Optional Procore status update after a human review.                                                                                                                                                                                                                                                                                                  | Local simulated state only.                                                                             |

Analyst's read: The following table is a proposed integration mapping. The Hackathon build status column is a proposed scope: make the site scene, edge records, evidence timeline, human triage, Fix Lens overlay, and retest state interactive. Use real site context where permitted, label all simulated patrol/detection data, and keep DJI, MAVLink, Procore, and the vision model behind interfaces with stub adapters. Do not imply that a DJI or Procore integration has been exercised until it has been tested against authorized accounts.

## Recommendations for Safe Edge

1. Analyst's read: From Finding 1, run a short DJI Cloud API 2 terms and compatibility check before choosing the production adapter. Keep an adapter seam for Cloud API 1 or FlightHub 2 while the license and SDP deployment path are clarified.
2. Analyst's read: From Findings 1 and 3, implement one DroneProvider port and normalize device, route, media, and event data before it reaches the Safe Edge domain model.
3. Analyst's read: From Finding 6, use Procore Observations as the first workflow candidate for accepted hazards with photos. Verify direct inspection-item attachment support in the Procore sandbox before promising checklist line-item creation.
4. Analyst's read: From Findings 4 and 7, prioritize the Three.js simulator and the human review/retest flow. Add PX4 or ArduPilot SITL only if the team already has a working environment or needs to demonstrate a real MAVLink adapter.
5. Analyst's read: From Findings 1, 5, and 7, require explicit human approval for live dispatch, retain the source image and reviewer identity for every finding, and make any internal pass expire unless independently retested.
6. Analyst's read: From Findings 4 and 7, use real, permissioned Elmina site evidence for context and mark synthetic flight paths, findings, and telemetry as simulated. Do not present demo simulation as observed site condition.

## What we can and cannot claim

**Safe claims**

- DJI documents Cloud API flows for supported docks, wayline dispatch, live streaming, and media transfer; the product table includes Dock 2 and Dock 3 aircraft pairings. [DJI product support](https://developer.dji.com/doc/cloud-api-tutorial/en/overview/product-support.html), [Dock 3 wayline](https://developer.dji.com/doc/cloud-api-tutorial/cn/api-reference/dock-to-cloud/mqtt/dock/dock3/wayline.html), [media management](https://developer.dji.com/doc/cloud-api-tutorial/en/feature-set/dock-feature-set/dock-media-management.html)
- Procore's APIs can create Observation items with photo attachments and create checklist inspection instances from a configured template. [Observations tutorial](https://procore.github.io/documentation/tutorial-observations), [Checklists API](https://developers.procore.com/reference/rest/checklists)
- Safe Edge's intended workflow can be described as AI-assisted flagging, human review, repair tracking, and independent retest, if the prototype labels simulated states accurately.

**Claims to avoid**

- Analyst's read: Avoid claims that “Safe Edge prevents drowning,” “AI detects every hazard,” or “this edge is safe.” The cited vendor API documents describe transport and workflow capabilities; they do not establish detection accuracy, injury reduction, or safety certification.
- Analyst's read: Avoid saying “DJI integration is live” or “Procore integration is production-ready” unless the team has used authorized equipment, accounts, permissions, and tested the actual endpoints.
- Analyst's read: Avoid saying “Procore can create a checklist line item with a photo in one call.” The direct item-level flow was not confirmed in the official material reviewed; Observation item attachments and checklist-level attachments are documented separately.
- Analyst's read: Avoid saying “Cloud API 2 is cleared for a commercial SDP pilot.” Its newly released terms contain restrictions that need DJI clarification for this use case. [Cloud API 2 terms](https://developer.dji.com/cloud-api2-clause/terms/)

## Open questions

- Which DJI dock and aircraft, if any, are available or planned for the Elmina pilot, and which Cloud API or FlightHub 2 deployment does SDP use?
- Will DJI confirm that Cloud API 2 terms permit the proposed SDP pilot and the intended commercial operating model?
- Does SDP's Procore tenant have an inspection template, Observation permissions, webhooks for relevant events, and an approved app path for production access?
- Can the team use real Elmina imagery or maps, and what township, privacy, and flight approvals govern capture and storage?
- Which exact Procore Inspection Item Attachments operation creates or associates a photo at checklist-line level? The linked reference was snippet-only in this review; no create/associate flow was verified in Procore's checklist, inspection attachment, observation, and upload material.
- No `./data/` folder was present in the working directory, so the requested query rerun or GeoJSON spot-check was not applicable.

## Sources

1. [Cloud API product introduction](https://developer.dji.com/doc/cloud-api-tutorial/en/overview/product-introduction.html) — DJI Developer; page dated 19 March 2025, accessed 17 October 2026.
2. [HTTPS overview](https://developer.dji.com/doc/cloud-api-tutorial/en/overview/basic-concept/https.html) — DJI Developer; page dated 19 March 2025, accessed 17 October 2026.
3. [WebSocket overview](https://developer.dji.com/doc/cloud-api-tutorial/en/overview/basic-concept/websocket.html) — DJI Developer; page dated 19 March 2025, accessed 17 October 2026.
4. [Cloud API product support](https://developer.dji.com/doc/cloud-api-tutorial/en/overview/product-support.html) — DJI Developer; page dated 19 March 2026, accessed 17 October 2026.
5. [Dock organization and binding APIs](https://developer.dji.com/doc/cloud-api-tutorial/en/api-reference/dock-to-cloud/mqtt/dock/organization.html) — DJI Developer; page dated 13 July 2023, accessed 17 October 2026.
6. [Dock 3 wayline APIs](https://developer.dji.com/doc/cloud-api-tutorial/cn/api-reference/dock-to-cloud/mqtt/dock/dock3/wayline.html) — DJI Developer; Chinese page, publication date not surfaced in retrieved content, accessed 17 October 2026.
7. [DJI WPML waylines](https://developer.dji.com/doc/cloud-api-tutorial/en/api-reference/dji-wpml/waylines-wpml.html) — DJI Developer; page dated 19 March 2026, accessed 17 October 2026.
8. [Dock 3 live stream APIs](https://developer.dji.com/doc/cloud-api-tutorial/en/api-reference/dock-to-cloud/mqtt/dock/dock3/live.html) — DJI Developer; page dated 12 November 2025, accessed 17 October 2026.
9. [Dock media management](https://developer.dji.com/doc/cloud-api-tutorial/en/feature-set/dock-feature-set/dock-media-management.html) — DJI Developer; page dated 19 March 2025, accessed 17 October 2026.
10. [Temporary media credentials](https://developer.dji.com/doc/cloud-api-tutorial/en/api-reference/pilot-to-cloud/https/media-management/obtain-temporary-credential.html) — DJI Developer; publication date not surfaced in retrieved content, accessed 17 October 2026.
11. [Media upload result callback](https://developer.dji.com/doc/cloud-api-tutorial/en/api-reference/pilot-to-cloud/https/media-management/mediafile-upload-result-report.html) — DJI Developer; page dated 19 March 2025, accessed 17 October 2026.
12. [Dock file upload callback](https://developer.dji.com/doc/cloud-api-tutorial/en/api-reference/dock-to-cloud/mqtt/dock/dock2/file.html) — DJI Developer; page dated 19 March 2026, accessed 17 October 2026.
13. [DJI Cloud API Demo](https://github.com/dji-sdk/DJI-Cloud-API-Demo) — DJI SDK on GitHub; maintenance notice dated 10 April 2025, accessed 17 October 2026.
14. [Cloud API Demo Web license](https://github.com/dji-sdk/Cloud-API-Demo-Web/blob/main/LICENSE) — DJI SDK on GitHub; MIT license for this separate repository, accessed 17 October 2026.
15. [Cloud API 2 official repository](https://github.com/dji-sdk/Cloud-API-2) — DJI SDK on GitHub; updated 16 October 2026, accessed 17 October 2026.
16. [DJI Software Terms of Use (Cloud API 2)](https://developer.dji.com/cloud-api2-clause/terms/) — DJI Developer; released 14 October 2026.
17. [FlightHub 2 On-Premises release notes](https://developer.dji.com/doc/priv-deployment-document/en/getting-started/release-notes.html) — DJI Developer; current page includes V1.7 dated 6 August 2026 and V1.7.1 dated 17 August 2026, accessed 17 October 2026.
18. [FlightHub 2 OpenAPI V2 demo](https://github.com/dji-sdk/FlightHub-2-OpenAPI-V2-Demo) — DJI SDK on GitHub; undated, accessed 17 October 2026.
19. [Mobile SDK introduction](https://developer.dji.com/doc/mobile-sdk-tutorial/en/basic-introduction/msdk-introduction.html) — DJI Developer; undated, accessed 17 October 2026.
20. [Mobile SDK overview](https://developer.dji.com/doc/mobile-sdk-tutorial/en/basic-introduction/overview.html) — DJI Developer; undated, accessed 17 October 2026.
21. [Payload SDK documentation](https://developer.dji.com/payload-sdk/documentation/) — DJI Developer; undated, accessed 17 October 2026.
22. [MAVLink Developer Guide](https://mavlink.io/en/) — MAVLink; undated, accessed 17 October 2026.
23. [MAVLink protocol overview](https://mavlink.io/en/about/overview.html) — MAVLink; undated, accessed 17 October 2026.
24. [MAVLink common messages](https://mavlink.io/en/messages/common.html) — MAVLink; undated, accessed 17 October 2026.
25. [MAVSDK language guide](https://mavsdk.mavlink.io/v3/en/) — MAVSDK; versioned documentation, accessed 17 October 2026.
26. [MAVSDK repository](https://github.com/mavlink/MAVSDK) — MAVLink on GitHub; undated, accessed 17 October 2026.
27. [PX4 simulation guide](https://docs.px4.io/main/en/simulation/) — PX4; current documentation, accessed 17 October 2026.
28. [ArduPilot SITL guide](https://ardupilot.ardupilot.org/dev/docs/sitl-simulator-software-in-the-loop.html) — ArduPilot; current documentation, accessed 17 October 2026.
29. [Skydio Cloud API overview](https://apidocs.skydio.com/docs/exploring-the-skydio-cloud-api) — Skydio; undated, accessed 17 October 2026.
30. [Skydio authentication](https://apidocs.skydio.com/reference/authentication) — Skydio; undated, accessed 17 October 2026.
31. [FlytBase Drone API](https://flytbase.com/drone-api) — FlytBase; undated, accessed 17 October 2026.
32. [FlytBase device setup](https://docs.flytbase.com/device-management/add-and-setup-your-device) — FlytBase; page could not be opened in this review, accessed 17 October 2026.
33. [FlytBase supported hardware](https://flytbase.com/supported-hardware) — FlytBase; undated, accessed 17 October 2026.
34. [Auterion app development](https://docs.auterion.com/app-development/app-development) — Auterion; current documentation, accessed 17 October 2026.
35. [Auterion SDK](https://docs.auterion.com/app-development/auterion-sdk) — Auterion; current documentation, accessed 17 October 2026.
36. [DJI dock provisioning and setup](https://help.dronedeploy.com/hc/en-us/articles/30927637908247-DJI-dock-provisioning-and-set-up) — DroneDeploy; updated 9 December 2025, accessed 17 October 2026.
37. [DroneDeploy DJI agent plugin](https://docs-automate.dronedeploy.com/robotics-toolkit/agent-plugins/dji/) — DroneDeploy; current documentation, accessed 17 October 2026.
38. [OpenAPI Specification](https://spec.openapis.org/oas/) — OpenAPI Initiative; current version index, accessed 17 October 2026.
39. [AsyncAPI Specification 3.0.0](https://www.asyncapi.com/docs/reference/specification/v3.0.0) — AsyncAPI Initiative; version 3.0.0, accessed 17 October 2026.
40. [CloudEvents](https://cloudevents.io/) — Cloud Native Computing Foundation CloudEvents project; version 1.0.2 release noted 5 February 2022, accessed 17 October 2026.
41. [openapi-typescript documentation](https://openapi-ts.dev/readme) — OpenAPI TypeScript; documentation for 7.x, accessed 17 October 2026.
42. [Orval basics](https://orval.dev/docs/guides/basics/) — Orval; undated, accessed 17 October 2026.
43. [Semantic Versioning 2.0.0](https://github.com/semver/semver.org/blob/gh-pages/spec/v2.0.0.md) — Semantic Versioning; version 2.0.0, accessed 17 October 2026.
44. [OAuth 2.0 Authorization Framework, RFC 6749](https://www.rfc-editor.org/info/rfc6749/) — RFC Editor / IETF; October 2012.
45. [Procore rate limiting](https://raw.githubusercontent.com/procore/documentation/main/plan_your_app/rate_limiting.md) — Procore Developer Documentation; current raw guide, accessed 17 October 2026.
46. [Procore Checklists API](https://developers.procore.com/reference/rest/checklists) — Procore Developer Documentation; current API reference, accessed 17 October 2026.
47. [Procore Observations tutorial](https://procore.github.io/documentation/tutorial-observations) — Procore Developer Documentation; current tutorial, accessed 17 October 2026.
48. [Procore direct uploads tutorial](https://procore.github.io/documentation/tutorial-uploads) — Procore Developer Documentation; current tutorial, accessed 17 October 2026.
49. [Procore Punch Items API](https://developers.procore.com/reference/rest/punch-items) — Procore Developer Documentation; page content was snippet-only in this review, accessed 17 October 2026.
50. [Procore Punch Item Assignments API](https://developers.procore.com/reference/rest/punch-item-assignments) — Procore Developer Documentation; current API reference, accessed 17 October 2026.
51. [Procore Inspection Item Attachments API](https://developers.procore.com/reference/rest/inspection-item-attachments) — Procore Developer Documentation; page content was snippet-only in this review, accessed 17 October 2026.
52. [Procore developer introduction](https://developers.procore.com/documentation/content/introduction) — Procore Developer Documentation; current documentation, accessed 17 October 2026.
53. [Procore webhooks](https://developers.procore.com/documentation/webhooks) — Procore Developer Documentation; current documentation, accessed 17 October 2026.
54. [Procore Data Connection apps](https://developers.procore.com/documentation/content/building-data-connection-apps) — Procore Developer Documentation; current documentation, accessed 17 October 2026.
55. [Procore verification and production access](https://developers.procore.com/documentation/content/verification-and-production-access) — Procore Developer Documentation; current production-access guidance, accessed 17 October 2026.
56. [MCP tools guidance](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/draft/server/tools.mdx) — Model Context Protocol project; draft specification, accessed 17 October 2026.
57. [openapi-typescript package metadata](https://registry.npmjs.org/openapi-typescript/latest) — npm registry; latest package metadata, version 7.13.0 on 17 October 2026.
58. [Orval package metadata](https://registry.npmjs.org/orval/latest) — npm registry; latest package metadata, version 8.43.0 on 17 October 2026.
59. [Hey API package metadata](https://registry.npmjs.org/@hey-api%2fopenapi-ts/latest) — npm registry; latest package metadata, version 0.99.0 on 17 October 2026. The separate initial-development/pinning claim was snippet-only.
60. [DJI MQTT topic definition](https://developer.dji.com/doc/cloud-api-tutorial/cn/api-reference/dock-to-cloud/mqtt/topic-definition.html) — DJI Developer; Chinese page, search excerpt showed device and gateway topic templates; full page was not extracted, accessed 17 October 2026.
61. [DJI device property push](https://developer.dji.com/doc/cloud-api-tutorial/en/api-reference/dock-to-cloud/mqtt/dock/device.html) — DJI Developer; search excerpt showed `/osd` and `/state` templates using device serials and device-specific examples; page itself did not open in this review, accessed 17 October 2026.
