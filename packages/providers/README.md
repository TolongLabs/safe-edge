# Safe Edge providers

Adapters behind the vendor-neutral `DroneProvider` and `WorkOrderProvider` ports, which live in `@safe-edge/contracts` with the `ProviderEvent` schema. `drone-sim` flies plans for the demo and the Three.js scene; `drone-dji-cloud` and `drone-mavlink` are typed stubs that document how a real DJI dock or MAVLink aircraft plugs in. `workorder-procore` files accepted findings, with their photos, as Procore Observations.

Contents:

1.  [Adapters](#adapters)
1.  [Running drone-sim](#running-drone-sim)
1.  [Event stream](#event-stream)
    1.  [Event types](#event-types)
    1.  [Event timing and order](#event-timing-and-order)
1.  [Approval gate](#approval-gate)
1.  [Window gate](#window-gate)
1.  [Feeding core](#feeding-core)
1.  [Sending findings to Procore](#sending-findings-to-procore)
    1.  [Procore does not notify assignees](#procore-does-not-notify-assignees)
    1.  [Procore requests](#procore-requests)
    1.  [Procore sandbox setup and smoke test](#procore-sandbox-setup-and-smoke-test)
1.  [See also](#see-also)

## Adapters

| Adapter             | Export                     | Status     | Maps to                                                                                                       |
| ------------------- | -------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------- |
| `drone-sim`         | `createDroneSim`           | Real       | A headless flight and battery model, driven by the scenario clock                                             |
| `drone-dji-cloud`   | `DjiCloudDroneProvider`    | Typed stub | DJI Cloud API MQTT for Dock 3: `update_topo`, aircraft OSD, `flighttask_prepare`, `flighttask_execute`, more  |
| `drone-mavlink`     | `MavlinkDroneProvider`     | Typed stub | MAVLink mission upload (`MISSION_COUNT`, `MISSION_REQUEST_INT`, `MISSION_ITEM_INT`, `MISSION_ACK`) and status |
| `workorder-procore` | `ProcoreWorkOrderProvider` | Sandbox    | Procore Observations: create, attach photos through a direct upload, update status                            |

Every drone stub method throws `ProviderNotImplementedError` (with `provider` and `method`). The doc comment on each method lists the vendor topics, methods or messages it maps to, with links to the vendor pages checked on 19 Oct 2026.

## Running drone-sim

```ts
import { createDroneSim } from '@safe-edge/providers'

const sim = createDroneSim({ clock, devices: [{ id: 'sim-1', name: 'Simulated dock aircraft', dock, drone }] })
const unsubscribe = sim.onEvent((event) => scene.apply(event))

const run = await sim.schedulePatrol(approvedPlan)
await sim.dispatchPatrol(run.id, {
  planId: approvedPlan.id,
  approvedBy: approvedPlan.approvedBy,
  approvedAt: approvedPlan.approvedAt
})

// On every fixed step of the scenario clock:
sim.tick()
```

- `clock` is `{ now(): string }`, the same clock core gets. `dock` and `drone` are the seeded `Dock` and `DroneProfile` records (`listDocks`, `listDroneProfiles`).
- The flight model is the planner's stated assumption (`assumedEnergyModel` from `@safe-edge/planner`): cruise speed and power along the ground, hover power for 3 m/s climbs and descents, a 3 s hover at each camera station, no wind. Each flight starts on a full battery, because the dock charges between flights.
- The sim is deterministic: the same plan, devices and clock give the same events. It is browser-safe (`bun run check:browser` bundles it).
- `getStatus(deviceId)` interpolates the pose and battery at `clock.now()`, for a smooth gauge between events.
- `cancelPatrol` drops a scheduled run, or flies an in-flight one straight over the dock at its current height, then down to land.
- The stream only moves forward. To rewind the scene, build a new sim and replay.

## Event stream

### Event types

Every event has `type`, `runId` (`simrun_<n>`), `deviceId`, `at` and `simulated: true`. A `pose` is the camera pose: `lon`, `lat`, `altM` above ground, `headingDeg` clockwise from north and gimbal `pitchDeg` (negative looks down). Indexes are the plan's `waypoints` indexes.

| `type`        | When                                                      | Other fields                                                                                                                                                                    |
| ------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `takeoff`     | At dispatch, leaving waypoint 0 on the dock               | `planId`, `pose`                                                                                                                                                                |
| `waypoint`    | On reaching each waypoint 1 to n − 2 (transits, stations) | `index`, `kind`, `segmentId` (null on transits), `pose`                                                                                                                         |
| `observation` | At each camera station, straight after its `waypoint`     | `waypointIndex`, `segmentId`, `viewpointId` (the plan station's, null when none), `zoom` (the station's), `captureSource: 'drone'`, `image`, `pose`, `quality`, `privacyAction` |
| `battery`     | Every 10 s of flight                                      | `remainingWh`, `percent` of the usable battery                                                                                                                                  |
| `landed`      | On reaching the last waypoint, or the dock after a cancel | `outcome` (`completed` or `cancelled`), `pose`, `remainingWh`                                                                                                                   |

The sim has no camera, so `observation.image` is null, `quality` is nominal (`sharpness: 1`, `occlusion: 0`) and `privacyAction` is `none`. A scenario that needs imagery attaches its fixture images. Validate events with `ProviderEvent.parse`.

### Event timing and order

- `at` is the take-off time plus the flight model's seconds, to the millisecond. Dispatched at the plan's `window.start`, every `waypoint.at` equals the plan's `eta` for that waypoint and `landed.remainingWh` equals the plan's `reserveWh`.
- `tick()` delivers every event with `at` at or before `clock.now()`, in time order. Events at the same moment keep their order: `waypoint`, then `observation`, then `battery`. With a 1 s step, an event arrives up to a second after its `at`.
- Every port method calls `tick()` first, so a handler can run inside `getStatus`, `schedulePatrol`, `dispatchPatrol` or `cancelPatrol`. Handlers get their own copy of each event; a throwing handler stops delivery loudly.

## Approval gate

`dispatchPatrol` rejects with `ApprovalRequiredError` unless the scheduled plan is `approved` and the `HumanApproval` equals what core recorded on `approvePatrolPlan` (`planId`, `approvedBy`, `approvedAt`). Only a pilot can approve in core, never an agent. Scheduling a proposed plan is allowed, but that run can never fly: once a pilot approves, schedule the approved plan again.

A `separation` hold (#79) waits for a person to confirm the path is clear, on a segment or (#125, people within 30 m) on the dock. The sim does not model that wait, so it also refuses, with the same error, a plan that still has an unreleased separation hold: the pilot records the path clear with `releasePlanHold`, then schedules the released plan. A released hold flies without the wait the plan budgeted for it, so that flight lands earlier than the plan's ETAs. Weather and lightning holds stop the launch in core's `startPatrol`, which the pilot calls before dispatching.

## Window gate

`dispatchPatrol` rejects with `OutsideWindowError` when the flight, launched now, would land at or after the plan's `window.end`. The run stays scheduled. Core's `startPatrol` refuses the same start as `outside_window`.

The DJI and MAVLink adapters must apply the same checks before they send any flight command.

## Feeding core

Whoever hosts the sim turns its events into core operations with `bridgeDrone({ provider, dispatch, actor, publish, onFailure })` (`src/drone-bridge.ts`). The API does this for every patrol a pilot starts with `provider: 'sim'` (`apps/api/src/automation.ts`); `packages/providers/test/drone-sim.test.ts` does it over core alone.

1.  After `approvePatrolPlan` and `startPatrol`, `bridge.fly(patrol)` schedules the plan on the provider and dispatches it with the approval core recorded. A refused dispatch drops the scheduled run and rejects.
2.  `observation` becomes `recordObservation` (`POST /observations`) as the provider actor, with `patrolId` from core and `capturedAt: at`, when the frame carries a `viewpointId`. The planner gives each fixed viewpoint's ID to the station nearest it, so the frame matches its viewpoint by ID. Other frames only count towards coverage.
3.  `landed` becomes `completePatrol` with one coverage entry per planned segment. Coverage counts stations, not frames: a station is seen once it has a frame the privacy gate kept, and each station seen stands for an equal share of its segment's length. The rest is unknown, and core opens a field check for it. A frame at a waypoint that is not a station of its segment, or a station on a segment the plan does not fly, is a failure.
4.  `bridge.committedTasks(patrol)` is how many route stops the drone has reached (`waypoint` events at stations), which core's re-plan subscriber asks for an in-flight patrol.

The bridge goes on after a write fails and hands the error to `onFailure`; the API records it as a failed `runAutomation` on the audit chain.

## Sending findings to Procore

When a manager or engineer submits a work order (`edge.work_order.submitted.v1`), it leaves Safe Edge. Drafts never do: neither the one confirming a candidate drafts nor the agent's, because only people edit and submit (PRD INBOX-4). If the API was started with the `PROCORE_*` variables, it sends the submitted work order's finding to Procore (`apps/api/src/work-orders.ts`):

1.  It reads the work order, the finding and the candidate's observations through `dispatch`, as the system actor `api.work-orders`.
2.  `createFinding` files an Observation of the type Safety Hazard in the configured project. Its name is `Safe Edge <finding>: <class> on <segment>`, its priority comes from the finding's severity, and its description is marked SIMULATED for demo data.
3.  The API stores the Observation ID as the work order's `externalRef` with `setWorkOrderExternalRef` (system only, set once, audited), before any photo goes.
4.  `addEvidence` uploads each observation photo and attaches it to the Observation.

A Procore failure (refused, unreachable, or an undocumented answer: `WorkOrderProviderError`) is recorded on the work order as `externalError` with the step that failed (`recordWorkOrderExternalError`, system only, audited), readable with `GET /v1/work-orders/{id}`, and logged. Any other error is a bug and is not recorded. A manager or engineer retries with `POST /v1/work-orders/{id}/external-retry`, which resumes from that step. Every submitted work order gets its own Observation, including the one a reopened finding gets. The repair moves it with `updateStatus`: a completed repair to `ready_for_review`, an accepted re-test to `closed`, a rejected one to `not_accepted`. The adapter maps `open`, `ready_for_review`, `rejected` and `closed` to Procore's `initiated`, `ready_for_review`, `not_accepted` and `closed`. Procore notifies the distribution list when an Observation's status changes.

### Procore does not notify assignees

**For the demo: an Observation created through the API does not email its assignee or distribution list.** Procore's Observations guide says so: "Unlike the behavior of the Procore web user interface, observations are not automatically sent to the assignee and distribution group members upon creation of an observation via the API. Email notifications must be explicitly sent using the Send Unsent Observation Items endpoint." The reference describes `date_notified` as "Null while the Observation is unsent". Safe Edge sets no assignee and sends nothing, so the hand-off emails nobody. Someone sends the Observation from Procore's Observations tool.

The same guide says that `POST /rest/v1.0/observations/items/send_unsent` sends every unsent Observation in the project, and that "Individual observations can only be sent using the Procore web user interface". The current reference also lists `POST /rest/v1.0/observations/items/{id}/send_email`, which "Sends an email for an Observation Item". Safe Edge calls neither.

### Procore requests

Every request follows Procore's [developer docs][procore-docs], read on 19 Oct 2026. The [contract double](/packages/providers/test/procore-double.ts) accepts only these shapes, and the tests run against it.

1.  `POST {login}/oauth/token` with JSON `{ grant_type: "client_credentials", client_id, client_secret }` gives `{ access_token, expires_in }` (5400 s). The token is reused until a minute before it expires.
1.  Every REST call sends `Authorization: Bearer <token>` and the required `Procore-Company-Id` header.
1.  `GET /rest/v1.0/observations/types?project_id=` finds the Safety Hazard type ID, because Create Observation Item requires `type_id`.
1.  `POST /rest/v1.0/observations/items` with `{ project_id, observation: { name, type_id, description, priority } }` gives the Observation `id`.
1.  For each photo, `POST /rest/v1.1/projects/{project_id}/uploads` with `{ response_filename, response_content_type }` gives `{ uuid, url, fields }`. The adapter then POSTs multipart form data to `url`, with every field unaltered and the file part named `file` last, without the Procore token (the non-segmented direct upload).
1.  `PATCH /rest/v1.0/observations/items/{id}` with `{ project_id, observation: { upload_ids } }` attaches the uploads.

Procore's segmented upload flow PUTs parts of at least 5 MB to presigned URLs, then completes with `PATCH /rest/v1.1/projects/{project_id}/uploads/{uuid}`. The adapter doesn't use it, because a photo fits the non-segmented flow.

### Procore sandbox setup and smoke test

No credentials are checked in. To get them:

1.  Run `scripts/procore-sandbox-wizard.sh`. It walks you through creating the Developer Portal account and an app with a service account (Service Account Authentication), and installing the app in its Developer Sandbox. It then checks the credentials against the sandbox and writes `PROCORE_CLIENT_ID`, `PROCORE_CLIENT_SECRET`, `PROCORE_COMPANY_ID` and `PROCORE_PROJECT_ID` to the gitignored root `.env`.
1.  Run `bun run procore:smoke`. It files one Observation with a photo in the sandbox (`login-sandbox.procore.com`, `sandbox.procore.com`) through this adapter, then prints the Observation's ID and API URL. The photo is the repo's Safe Edge workflow diagram. The script fails when any variable is missing, and it refuses to run in CI.
1.  `bun run dev` loads the root `.env` into the API, so submitted work orders go to the sandbox. With no `PROCORE_*` variable set, the API keeps work orders in Safe Edge. With only some of them set, it refuses to start.
1.  Run `bun run procore:e2e` for the whole path. It starts the dev API, plays S1 over HTTP with the dev tokens up to the manager's submit, reads the work order's `externalRef`, then fetches that Observation from the sandbox and checks its photo is the uploaded one, byte for byte. Like the smoke test, it fails when any variable is missing and refuses to run in CI. A recorded run is in [Procore sandbox hand-off](/docs/evidence/procore-sandbox.md).

## See also

- [TRD: SDK and provider adapters](/docs/TRD.md#sdk-and-provider-adapters)
- [Drone integration research](/docs/research/drone-integration/drone-sdk.md)
- [DJI Cloud API: Dock 3 wayline management][dji-wayline]
- [MAVLink mission protocol][mavlink-mission]
- [Procore: Working with Observations][procore-observations]
- [Procore: Working with Direct File Uploads][procore-uploads]

[dji-wayline]: https://developer.dji.com/doc/cloud-api-tutorial/en/api-reference/dock-to-cloud/mqtt/dock/dock3/wayline.html
[mavlink-mission]: https://mavlink.io/en/services/mission.html
[procore-docs]: https://developers.procore.com/documentation/introduction
[procore-observations]: https://developers.procore.com/documentation/tutorial-observations
[procore-uploads]: https://developers.procore.com/documentation/tutorial-uploads
