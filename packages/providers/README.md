# Safe Edge providers

Drone adapters behind the vendor-neutral `DroneProvider` port, which lives in `@safe-edge/contracts` with its `ProviderEvent` schema. `drone-sim` flies plans for the demo and the Three.js scene; `drone-dji-cloud` and `drone-mavlink` are typed stubs that document how a real DJI dock or MAVLink aircraft plugs in.

Contents:

1.  [Adapters](#adapters)
1.  [Running drone-sim](#running-drone-sim)
1.  [Event stream](#event-stream)
    1.  [Event types](#event-types)
    1.  [Event timing and order](#event-timing-and-order)
1.  [Approval gate](#approval-gate)
1.  [Feeding core](#feeding-core)
1.  [See also](#see-also)

## Adapters

| Adapter           | Export                  | Status     | Maps to                                                                                                       |
| ----------------- | ----------------------- | ---------- | ------------------------------------------------------------------------------------------------------------- |
| `drone-sim`       | `createDroneSim`        | Real       | A headless flight and battery model, driven by the scenario clock                                             |
| `drone-dji-cloud` | `DjiCloudDroneProvider` | Typed stub | DJI Cloud API MQTT for Dock 3: `update_topo`, aircraft OSD, `flighttask_prepare`, `flighttask_execute`, more  |
| `drone-mavlink`   | `MavlinkDroneProvider`  | Typed stub | MAVLink mission upload (`MISSION_COUNT`, `MISSION_REQUEST_INT`, `MISSION_ITEM_INT`, `MISSION_ACK`) and status |

Every stub method throws `ProviderNotImplementedError` (with `provider` and `method`). The doc comment on each method lists the vendor topics, methods or messages it maps to, with links to the vendor pages checked on 19 Oct 2026.

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

| `type`        | When                                                      | Other fields                                                                                                                                            |
| ------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `takeoff`     | At dispatch, leaving waypoint 0 on the dock               | `planId`, `pose`                                                                                                                                        |
| `waypoint`    | On reaching each waypoint 1 to n − 2 (transits, stations) | `index`, `kind`, `segmentId` (null on transits), `pose`                                                                                                 |
| `observation` | At each camera station, straight after its `waypoint`     | `waypointIndex`, `segmentId`, `viewpointId` (the plan station's, null when none), `captureSource: 'drone'`, `image`, `pose`, `quality`, `privacyAction` |
| `battery`     | Every 10 s of flight                                      | `remainingWh`, `percent` of the usable battery                                                                                                          |
| `landed`      | On reaching the last waypoint, or the dock after a cancel | `outcome` (`completed` or `cancelled`), `pose`, `remainingWh`                                                                                           |

The sim has no camera, so `observation.image` is null, `quality` is nominal (`sharpness: 1`, `occlusion: 0`) and `privacyAction` is `none`. A scenario that needs imagery attaches its fixture images. Validate events with `ProviderEvent.parse`.

### Event timing and order

- `at` is the take-off time plus the flight model's seconds, to the millisecond. Dispatched at the plan's `window.start`, every `waypoint.at` equals the plan's `eta` for that waypoint and `landed.remainingWh` equals the plan's `reserveWh`.
- `tick()` delivers every event with `at` at or before `clock.now()`, in time order. Events at the same moment keep their order: `waypoint`, then `observation`, then `battery`. With a 1 s step, an event arrives up to a second after its `at`.
- Every port method calls `tick()` first, so a handler can run inside `getStatus`, `schedulePatrol`, `dispatchPatrol` or `cancelPatrol`. Handlers get their own copy of each event; a throwing handler stops delivery loudly.

## Approval gate

`dispatchPatrol` rejects with `ApprovalRequiredError` unless the scheduled plan is `approved` and the `HumanApproval` equals what core recorded on `approvePatrolPlan` (`planId`, `approvedBy`, `approvedAt`). Only a pilot can approve in core, never an agent. Scheduling a proposed plan is allowed, but that run can never fly: once a pilot approves, schedule the approved plan again.

A `separation` hold (#79) waits for a person to confirm the path is clear. The sim does not model that wait at the segment, so it also refuses, with the same error, a plan that still has an unreleased separation hold: the pilot records the path clear with `releasePlanHold`, then schedules the released plan. Weather and lightning holds stop the launch in core's `startPatrol`, which the pilot calls before dispatching.

The DJI and MAVLink adapters must apply the same checks before they send any flight command.

## Feeding core

Whoever hosts the sim (the API or the scenario player) turns its events into core operations. `packages/providers/test/drone-sim.test.ts` does this end to end over real Elmina segments.

1.  After `approvePatrolPlan`, the pilot calls `startPatrol` with `provider: 'sim'` and `droneId: run.deviceId`. Then dispatch the run on the sim.
2.  `observation` becomes `recordObservation` (`POST /observations`) as the provider user `usr_drone_sim`, with `patrolId` from core and `capturedAt: at`. Core needs a `viewpointId` from the segment's fixed viewpoints, and #71's planner leaves plan stations unlinked, so match the frame's pose to a viewpoint (within a metre) and skip frames that match none.
3.  `landed` becomes `completePatrol` with one coverage entry per planned segment. A segment counts as inspected only when every one of its stations was captured; otherwise its whole length is unknown, and core opens a field check for it.

## See also

- [TRD: SDK and provider adapters](/docs/TRD.md#sdk-and-provider-adapters)
- [Drone integration research](/docs/research/drone-integration/drone-sdk.md)
- [DJI Cloud API: Dock 3 wayline management][dji-wayline]
- [MAVLink mission protocol][mavlink-mission]

[dji-wayline]: https://developer.dji.com/doc/cloud-api-tutorial/en/api-reference/dock-to-cloud/mqtt/dock/dock3/wayline.html
[mavlink-mission]: https://mavlink.io/en/services/mission.html
