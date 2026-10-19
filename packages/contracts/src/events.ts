import * as z from 'zod'
import { Tier } from './entities.ts'
import {
  CandidateId,
  EventId,
  FindingId,
  PassId,
  PatrolId,
  PatrolPlanId,
  RetestId,
  SegmentId,
  Timestamp,
  WebhookId,
  WorkOrderId,
  named
} from './primitives.ts'

/** The TRD "Events" list. `edge.pass.expiring.v1` and `edge.pass.expired.v1` come from core's `tick(now)`. */
export const EVENT_TYPES = [
  'edge.patrol.planned.v1',
  'edge.patrol.started.v1',
  'edge.patrol.completed.v1',
  'edge.candidate.raised.v1',
  'edge.candidate.decided.v1',
  'edge.pass.suspended.v1',
  'edge.work_order.drafted.v1',
  'edge.work_order.submitted.v1',
  'edge.repair.completed.v1',
  'edge.retest.recorded.v1',
  'edge.pass.issued.v1',
  'edge.pass.expiring.v1',
  'edge.pass.expired.v1'
] as const

export const EventType = named('EventType', z.enum(EVENT_TYPES))
export type EventType = z.infer<typeof EventType>

// Payloads carry IDs and `simulated`, never images. Consumers fetch records and evidence through the API.
const simulated = z.boolean()

export const EVENT_DATA = {
  'edge.patrol.planned.v1': z.object({ planId: PatrolPlanId, segmentIds: z.array(SegmentId), simulated }),
  'edge.patrol.started.v1': z.object({ patrolId: PatrolId, planId: PatrolPlanId, simulated }),
  'edge.patrol.completed.v1': z.object({ patrolId: PatrolId, planId: PatrolPlanId, simulated }),
  'edge.candidate.raised.v1': z.object({ candidateId: CandidateId, segmentId: SegmentId, tier: Tier, simulated }),
  'edge.candidate.decided.v1': z.object({
    candidateId: CandidateId,
    segmentId: SegmentId,
    decision: z.enum(['confirm', 'reject', 'recapture']),
    findingId: FindingId.nullable(),
    simulated
  }),
  'edge.pass.suspended.v1': z.object({
    passId: PassId,
    segmentId: SegmentId,
    candidateId: CandidateId.nullable(),
    simulated
  }),
  'edge.work_order.drafted.v1': z.object({ workOrderId: WorkOrderId, findingId: FindingId, simulated }),
  'edge.work_order.submitted.v1': z.object({ workOrderId: WorkOrderId, findingId: FindingId, simulated }),
  'edge.repair.completed.v1': z.object({ workOrderId: WorkOrderId, findingId: FindingId, simulated }),
  'edge.retest.recorded.v1': z.object({
    retestId: RetestId,
    workOrderId: WorkOrderId.nullable(),
    candidateId: CandidateId.nullable(),
    result: z.enum(['accepted', 'rejected']),
    simulated
  }),
  'edge.pass.issued.v1': z.object({
    passId: PassId,
    segmentId: SegmentId,
    retestId: RetestId,
    validTo: Timestamp,
    simulated
  }),
  'edge.pass.expiring.v1': z.object({ passId: PassId, segmentId: SegmentId, validTo: Timestamp, simulated }),
  'edge.pass.expired.v1': z.object({ passId: PassId, segmentId: SegmentId, simulated })
} as const satisfies Record<EventType, z.ZodObject>

/** One-line descriptions, used in the AsyncAPI document. */
export const EVENT_SUMMARIES: Record<EventType, string> = {
  'edge.patrol.planned.v1': 'The planner built a patrol plan; a pilot must approve it before it flies.',
  'edge.patrol.started.v1': 'A pilot started a patrol from an approved plan.',
  'edge.patrol.completed.v1': 'A patrol landed and reported coverage per segment.',
  'edge.candidate.raised.v1': 'A provider, the system or the agent raised a candidate; core assigned its tier.',
  'edge.candidate.decided.v1': 'A manager confirmed, rejected or asked to recapture a candidate.',
  'edge.pass.suspended.v1': "A segment's pass was suspended, e.g. by a Tier 2 candidate.",
  'edge.work_order.drafted.v1': 'A person or the agent drafted a work order.',
  'edge.work_order.submitted.v1': 'A manager or engineer submitted a work order with an approved remedy.',
  'edge.repair.completed.v1': 'The installer marked the repair complete.',
  'edge.retest.recorded.v1':
    'A reviewer recorded a re-test: of a repair they did not install (workOrderId), or a clearance of a rejected or recapture Tier 2 candidate they did not decide (candidateId).',
  'edge.pass.issued.v1': 'An accepted re-test issued a pass valid for at most 12 months.',
  'edge.pass.expiring.v1': 'A pass entered its last 30 days.',
  'edge.pass.expired.v1': 'A pass reached its validTo date.'
}

const envelope = <T extends EventType>(type: T) =>
  z.object({
    specversion: z.literal('1.0'),
    id: EventId,
    source: z.string().regex(/^safe-edge:\/\/townships\/.+/),
    type: z.literal(type),
    subject: z
      .string()
      .regex(/^segments\/.+/)
      .optional()
      .describe('segments/{id}; absent for events about several segments'),
    time: Timestamp,
    datacontenttype: z.literal('application/json'),
    data: EVENT_DATA[type]
  })

/** CloudEvents 1.0 envelopes, one per event type (TRD "Events"). */
export const EVENT_SCHEMAS = Object.fromEntries(EVENT_TYPES.map((type) => [type, envelope(type)])) as {
  [T in EventType]: ReturnType<typeof envelope<T>>
}

export const EdgeEvent = z.discriminatedUnion(
  'type',
  EVENT_TYPES.map((type) => EVENT_SCHEMAS[type]) as unknown as [
    (typeof EVENT_SCHEMAS)[EventType],
    ...(typeof EVENT_SCHEMAS)[EventType][]
  ]
)
export type EdgeEvent = { [T in EventType]: z.infer<(typeof EVENT_SCHEMAS)[T]> }[EventType]

/** A delivery that did not reach the endpoint. Nothing retries it. */
export const WebhookFailure = named(
  'WebhookFailure',
  z.object({
    eventId: EventId,
    at: Timestamp,
    error: z.string().min(1).describe('HTTP <status>: <body>, or the network error')
  })
)
export type WebhookFailure = z.infer<typeof WebhookFailure>

export const Webhook = named(
  'Webhook',
  z.object({
    id: WebhookId,
    url: z.url(),
    eventTypes: z.array(EventType),
    createdBy: z.string(),
    createdAt: Timestamp,
    failures: z.array(WebhookFailure).describe('Failed deliveries, oldest first; each is also on the audit chain')
  })
)
export type Webhook = z.infer<typeof Webhook>
