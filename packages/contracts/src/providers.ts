import * as z from 'zod'
import { DroneProviderKind, ImageQuality, Waypoint, type PatrolPlan } from './entities.ts'
import {
  DockId,
  DroneProfileId,
  EvidenceRef,
  PatrolPlanId,
  Pose,
  SegmentId,
  Timestamp,
  UserId,
  ViewpointId,
  provenance
} from './primitives.ts'

// The DroneProvider port (TRD "SDK and provider adapters"). It is vendor-neutral: the adapters in
// `@safe-edge/providers` map it to the simulator, DJI Cloud API topics or MAVLink messages, and nothing here names a
// vendor payload. These types never cross the REST API, so they are not registered with `named()` and stay out of the
// generated OpenAPI and AsyncAPI documents.

const DeviceId = z.string().min(1)
const RunId = z.string().min(1)

/** An aircraft a provider can fly, on the dock it takes off from. */
export const DroneDevice = z.object({
  id: DeviceId,
  provider: DroneProviderKind,
  name: z.string(),
  dockId: DockId,
  droneProfileId: DroneProfileId,
  ...provenance
})
export type DroneDevice = z.infer<typeof DroneDevice>

/** Where an aircraft is and how much battery it has left. `pose` is the camera pose: aircraft heading, gimbal pitch. */
export const DroneStatus = z.object({
  deviceId: DeviceId,
  state: z.enum(['docked', 'in_flight']),
  runId: RunId.nullable(),
  pose: Pose,
  batteryWh: z.number().nonnegative(),
  batteryPercent: z.number().min(0).max(100),
  at: Timestamp,
  simulated: z.boolean()
})
export type DroneStatus = z.infer<typeof DroneStatus>

/**
 * A pilot's approval of a plan, exactly as core recorded it on `approvePatrolPlan` (`approvedBy`, `approvedAt`). A
 * provider flies only when the approval matches the plan it was given.
 */
export const HumanApproval = z.object({ planId: PatrolPlanId, approvedBy: UserId, approvedAt: Timestamp })
export type HumanApproval = z.infer<typeof HumanApproval>

/** A plan handed to a provider. `scheduled` holds the route on the device; only `dispatchPatrol` makes it fly. */
export const PatrolRun = z.object({
  id: RunId,
  planId: PatrolPlanId,
  deviceId: DeviceId,
  status: z.enum(['scheduled', 'in_flight', 'completed', 'cancelled']),
  scheduledAt: Timestamp,
  dispatchedAt: Timestamp.nullable(),
  approval: HumanApproval.nullable(),
  ...provenance
})
export type PatrolRun = z.infer<typeof PatrolRun>

const eventBase = { runId: RunId, deviceId: DeviceId, at: Timestamp, simulated: z.boolean() }

/**
 * The provider event stream, in time order. Waypoint indexes are the plan's `waypoints` indexes: `takeoff` leaves
 * waypoint 0, `waypoint` reaches 1 to n − 2, and `landed` reaches n − 1 (or the dock, after a cancel).
 */
export const ProviderEvent = z.discriminatedUnion('type', [
  z.object({ type: z.literal('takeoff'), ...eventBase, planId: PatrolPlanId, pose: Pose }),
  z.object({
    type: z.literal('waypoint'),
    ...eventBase,
    index: z.number().int().positive(),
    kind: Waypoint.shape.kind,
    segmentId: SegmentId.nullable(),
    pose: Pose
  }),
  /** One frame at a camera station. `viewpointId` is the plan station's, null when the plan links none. */
  z.object({
    type: z.literal('observation'),
    ...eventBase,
    waypointIndex: z.number().int().positive(),
    segmentId: SegmentId,
    viewpointId: ViewpointId.nullable(),
    captureSource: z.literal('drone'),
    image: EvidenceRef.nullable(),
    pose: Pose,
    quality: ImageQuality,
    privacyAction: z.enum(['none', 'discarded'])
  }),
  z.object({
    type: z.literal('battery'),
    ...eventBase,
    remainingWh: z.number().nonnegative(),
    percent: z.number().min(0).max(100)
  }),
  z.object({
    type: z.literal('landed'),
    ...eventBase,
    outcome: z.enum(['completed', 'cancelled']),
    pose: Pose,
    remainingWh: z.number().nonnegative()
  })
])
export type ProviderEvent = z.infer<typeof ProviderEvent>

/** How Safe Edge flies drones without knowing whose they are. Every adapter implements it. */
export interface DroneProvider {
  /** The aircraft this provider can fly. */
  listDevices(): Promise<DroneDevice[]>
  getStatus(deviceId: string): Promise<DroneStatus>
  /** Puts the plan's route on a device that matches its dock and drone profile, without flying it. */
  schedulePatrol(plan: PatrolPlan): Promise<PatrolRun>
  /** Flies a scheduled run. Rejects unless `approval` matches the pilot approval recorded on the run's plan. */
  dispatchPatrol(runId: string, approval: HumanApproval): Promise<void>
  /** Drops a scheduled run, or sends an in-flight one straight back to its dock. */
  cancelPatrol(runId: string): Promise<void>
  /** Subscribes to the event stream. Returns the unsubscribe function. */
  onEvent(handler: (event: ProviderEvent) => void): () => void
}
