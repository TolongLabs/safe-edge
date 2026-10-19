import * as z from 'zod'
import {
  Asset,
  AuditEvent,
  Baseline,
  Candidate,
  CandidateClass,
  CandidateStatus,
  ContextSnapshot,
  Dock,
  DroneProfile,
  DroneProviderKind,
  EdgePass,
  Finding,
  FindingStatus,
  ImageQuality,
  ItemStatus,
  Notice,
  Observation,
  Opening,
  OpeningType,
  PassState,
  Patrol,
  PatrolPlan,
  PlanReplan,
  Remedy,
  RemedyType,
  Retest,
  RetestCheck,
  Route,
  RouteStatus,
  Segment,
  SegmentCoverage,
  Severity,
  Task,
  Uncertainty,
  User,
  WorkOrder,
  WorkOrderStatus
} from './entities.ts'
import { EventType } from './events.ts'
import {
  CandidateId,
  DockId,
  DroneProfileId,
  EvidenceId,
  EvidenceRef,
  FindingId,
  InventoryItemId,
  NoticeId,
  ObservationId,
  OpeningId,
  PassId,
  PatrolId,
  PatrolPlanId,
  PhotoMark,
  Pose,
  Quote,
  RemedyId,
  SegmentId,
  TaskId,
  Timestamp,
  UserId,
  ViewpointId,
  WorkOrderId,
  named
} from './primitives.ts'
import { TriageResult } from './triage.ts'

// Request and response bodies for the operations table. List responses are plain arrays.

const list = <T extends z.ZodType>(id: string, item: T) => named(id, z.array(item))

export const AssetList = list('AssetList', Asset)
export const AuditEventList = list('AuditEventList', AuditEvent)
export const SegmentList = list('SegmentList', Segment)
export const UserList = list('UserList', User)
export const DockList = list('DockList', Dock)
export const DroneProfileList = list('DroneProfileList', DroneProfile)
export const PatrolPlanList = list('PatrolPlanList', PatrolPlan)
export const PatrolList = list('PatrolList', Patrol)
export const CandidateList = list('CandidateList', Candidate)
export const FindingList = list('FindingList', Finding)
export const TaskList = list('TaskList', Task)
export const WorkOrderList = list('WorkOrderList', WorkOrder)
export const EdgePassList = list('EdgePassList', EdgePass)
export const NoticeList = list('NoticeList', Notice)

/** A segment with its asset, pass and baseline: what `get_edge_context` returns. */
export const EdgeContext = named(
  'EdgeContext',
  z.object({ segment: Segment, asset: Asset, pass: EdgePass.nullable(), baseline: Baseline.nullable() })
)
export type EdgeContext = z.infer<typeof EdgeContext>

/** A candidate with its observations and the segment baseline: the Inbox evidence card. */
export const CandidateEvidence = named(
  'CandidateEvidence',
  z.object({
    candidate: Candidate,
    segment: Segment,
    observations: z.array(Observation),
    baseline: Baseline.nullable()
  })
)
export type CandidateEvidence = z.infer<typeof CandidateEvidence>

export const CreatePatrolPlanRequest = named(
  'CreatePatrolPlanRequest',
  z.object({
    dockId: DockId,
    droneProfileId: DroneProfileId,
    segmentIds: z.array(SegmentId).min(1),
    context: z.array(ContextSnapshot),
    notBefore: Timestamp,
    altitudeCapM: z.number().positive().describe('Agreed with air traffic control'),
    replan: PlanReplan.optional().describe(
      "Re-plan `supersedes`' uncommitted stops after `trigger`; `segmentIds` are the segments to consider"
    )
  })
)
export type CreatePatrolPlanRequest = z.infer<typeof CreatePatrolPlanRequest>

export const StartPatrolRequest = named(
  'StartPatrolRequest',
  z.object({ planId: PatrolPlanId, provider: DroneProviderKind, droneId: z.string().min(1) })
)
export type StartPatrolRequest = z.infer<typeof StartPatrolRequest>

export const CompletePatrolRequest = named(
  'CompletePatrolRequest',
  z.object({
    coverage: z
      .array(SegmentCoverage)
      .describe(
        "At most one entry per segment, with inspectedM + unknownM no more than the segment's length (else 403 invalid_coverage). Length an entry leaves out, and every planned segment it omits, is unknown"
      )
  })
)
export type CompletePatrolRequest = z.infer<typeof CompletePatrolRequest>

export const RecordObservationRequest = named(
  'RecordObservationRequest',
  z.object({
    patrolId: PatrolId.nullable(),
    segmentId: SegmentId,
    viewpointId: ViewpointId,
    captureSource: z.enum(['drone', 'phone']),
    image: EvidenceRef.nullable(),
    pose: Pose,
    capturedAt: Timestamp,
    quality: ImageQuality,
    privacyAction: z.enum(['none', 'discarded']),
    simulated: z.boolean()
  })
)
export type RecordObservationRequest = z.infer<typeof RecordObservationRequest>

/** Core assigns the tier; callers cannot. */
export const RaiseCandidateRequest = named(
  'RaiseCandidateRequest',
  z.object({
    segmentId: SegmentId,
    observationIds: z.array(ObservationId),
    inventoryItemId: InventoryItemId.nullable(),
    itemStatus: ItemStatus.nullable(),
    class: CandidateClass,
    score: z.number().min(0).max(1),
    uncertainty: Uncertainty.nullable(),
    gridCell: z
      .string()
      .regex(/^[A-D][1-4]$/)
      .nullable(),
    rationale: z.string(),
    model: z.string().nullable(),
    simulated: z.boolean()
  })
)
export type RaiseCandidateRequest = z.infer<typeof RaiseCandidateRequest>

export const DecideCandidateRequest = named(
  'DecideCandidateRequest',
  z.discriminatedUnion('decision', [
    z.object({ decision: z.literal('confirm'), severity: Severity }),
    z.object({ decision: z.literal('reject'), reason: z.string().min(1) }),
    z.object({ decision: z.literal('recapture'), reason: z.string().min(1) })
  ])
)
export type DecideCandidateRequest = z.infer<typeof DecideCandidateRequest>

/** Confirming creates a finding, an interim protection task and a draft work order (PRD INBOX-3). */
export const CandidateDecision = named(
  'CandidateDecision',
  z.object({
    candidate: Candidate,
    finding: Finding.nullable(),
    tasks: z.array(Task),
    workOrder: WorkOrder.nullable()
  })
)
export type CandidateDecision = z.infer<typeof CandidateDecision>

export const CreateWorkOrderRequest = named(
  'CreateWorkOrderRequest',
  z.object({ findingId: FindingId, remedyId: RemedyId.nullable(), notes: z.string() })
)
export type CreateWorkOrderRequest = z.infer<typeof CreateWorkOrderRequest>

export const UpdateWorkOrderRequest = named(
  'UpdateWorkOrderRequest',
  z.object({ remedyId: RemedyId.nullable().optional(), notes: z.string().optional() })
)
export type UpdateWorkOrderRequest = z.infer<typeof UpdateWorkOrderRequest>

/** The record an external work-order system created for the work order's finding. */
export const SetWorkOrderExternalRefRequest = named(
  'SetWorkOrderExternalRefRequest',
  z.object({ externalRef: z.string().min(1) })
)
export type SetWorkOrderExternalRefRequest = z.infer<typeof SetWorkOrderExternalRefRequest>

export const SubmitWorkOrderRequest = named(
  'SubmitWorkOrderRequest',
  z.object({ installerUserId: UserId, dueAt: Timestamp })
)
export type SubmitWorkOrderRequest = z.infer<typeof SubmitWorkOrderRequest>

export const CompleteWorkOrderRequest = named(
  'CompleteWorkOrderRequest',
  z.object({ evidence: z.array(EvidenceRef), note: z.string() })
)
export type CompleteWorkOrderRequest = z.infer<typeof CompleteWorkOrderRequest>

export const RecordRetestRequest = named(
  'RecordRetestRequest',
  z.object({
    workOrderId: WorkOrderId,
    checklist: z.array(RetestCheck).min(1),
    evidence: z.array(EvidenceRef),
    result: z.enum(['accepted', 'rejected']),
    reason: z.string().min(1)
  })
)
export type RecordRetestRequest = z.infer<typeof RecordRetestRequest>

/** A clearance re-test: a reviewer checks the edge a rejected or recapture Tier 2 candidate suspended. */
export const RecordClearanceRequest = named('RecordClearanceRequest', RecordRetestRequest.omit({ workOrderId: true }))
export type RecordClearanceRequest = z.infer<typeof RecordClearanceRequest>

/** An accepted re-test issues the pass, once no other suspicion on the segment is open. */
export const RetestOutcome = named(
  'RetestOutcome',
  z.object({
    retest: Retest,
    pass: EdgePass.nullable().describe(
      "The pass this re-test issued; null when it was rejected or another Tier 2 candidate or finding on the segment is still open (the suspended pass's stateReason names them)"
    )
  })
)
export type RetestOutcome = z.infer<typeof RetestOutcome>

export const CreateOpeningRequest = named(
  'CreateOpeningRequest',
  z.object({
    segmentId: SegmentId,
    type: OpeningType,
    photoMarks: z.array(PhotoMark).min(1),
    measuredMm: z.number().nonnegative().nullable()
  })
)
export type CreateOpeningRequest = z.infer<typeof CreateOpeningRequest>

export const CreateRouteRequest = named(
  'CreateRouteRequest',
  z.object({
    segmentId: SegmentId,
    fromFeature: z.object({ kind: z.enum(['path', 'gate', 'play_area']), label: z.string() }),
    openingIds: z.array(OpeningId),
    status: z.enum(['open', 'unknown']).describe('An unseen end stays unknown')
  })
)
export type CreateRouteRequest = z.infer<typeof CreateRouteRequest>

export const CreateRemedyRequest = named(
  'CreateRemedyRequest',
  z.object({
    segmentId: SegmentId,
    type: RemedyType,
    label: z.string(),
    blocksOpeningIds: z.array(OpeningId).min(1),
    quantities: z.array(z.object({ item: z.string(), amount: z.number().positive(), unit: z.string() })),
    acceptanceTest: z.string(),
    quote: z.union([Quote, z.literal('quote_needed')])
  })
)
export type CreateRemedyRequest = z.infer<typeof CreateRemedyRequest>

export const RouteClosureRequest = named('RouteClosureRequest', z.object({ remedyIds: z.array(RemedyId) }))
export type RouteClosureRequest = z.infer<typeof RouteClosureRequest>

/** Fix Lens: which recorded routes the selected remedies would close. A route with an unknown link stays unknown. */
export const RouteClosure = named(
  'RouteClosure',
  z.object({
    segmentId: SegmentId,
    remedyIds: z.array(RemedyId),
    openings: z.array(Opening),
    remedies: z.array(Remedy),
    routes: z.array(Route.extend({ projectedStatus: RouteStatus }))
  })
)
export type RouteClosure = z.infer<typeof RouteClosure>

export const DraftNoticeRequest = named(
  'DraftNoticeRequest',
  z.object({
    kind: z.enum(['escalation', 'monthly_report']),
    subjectId: z.string().nullable(),
    title: z.string().min(1),
    body: z.string().min(1)
  })
)
export type DraftNoticeRequest = z.infer<typeof DraftNoticeRequest>

export const UploadEvidenceRequest = named(
  'UploadEvidenceRequest',
  z.object({
    mediaType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
    dataBase64: z.string().min(1),
    capturedAt: Timestamp.nullable(),
    simulated: z.boolean()
  })
)
export type UploadEvidenceRequest = z.infer<typeof UploadEvidenceRequest>

export const EvidenceUrl = named('EvidenceUrl', z.object({ url: z.string(), expiresAt: Timestamp }))
export type EvidenceUrl = z.infer<typeof EvidenceUrl>

const ImageInput = z.object({
  mediaType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  dataBase64: z.string().min(1)
})

/** A real baseline and current photo pair. The server sends the segment's expected inventory as data. */
export const TriageImagesRequest = named(
  'TriageImagesRequest',
  z.object({ segmentId: SegmentId, viewpointId: ViewpointId, baseline: ImageInput, current: ImageInput })
)
export type TriageImagesRequest = z.infer<typeof TriageImagesRequest>

/** Shown as "AI suggestion, unvalidated". `model` is the model that actually answered (after any fallback). */
export const TriageImagesResponse = named(
  'TriageImagesResponse',
  z.object({ model: z.string(), result: TriageResult, candidates: z.array(Candidate) })
)
export type TriageImagesResponse = z.infer<typeof TriageImagesResponse>

export const AskAgentRequest = named('AskAgentRequest', z.object({ question: z.string().min(1) }))
export type AskAgentRequest = z.infer<typeof AskAgentRequest>

/** A switch to a fallback model after the requested model declined (server-side fallback). */
export const AgentFallback = z.object({ from: z.string(), to: z.string() })
export type AgentFallback = z.infer<typeof AgentFallback>

/** Which records an agent's text rests on, and which model wrote it. Shared by every agent result. */
const agentProvenance = {
  citations: z
    .array(z.string())
    .describe('Record IDs that tool results returned and the text names, in order of first mention'),
  uncited: z.boolean().describe('True when the text names no record ID from a tool result; show it as uncited'),
  model: z.string().describe('The model that wrote the final turn, after any server-side fallback'),
  fallbacks: z.array(AgentFallback).describe('Every switch to a fallback model during the run; empty when none')
}

/** A `delta` server-sent event of `askAgent`: text as the agent writes it. The `answer` event replaces it. */
export const AgentDelta = z.object({ text: z.string() })
export type AgentDelta = z.infer<typeof AgentDelta>

/** The final `answer` server-sent event of `askAgent`. */
export const AgentAnswer = z.object({ answer: z.string(), ...agentProvenance })
export type AgentAnswer = z.infer<typeof AgentAnswer>

/**
 * The agent stopped without a usable result: Claude refused (`stopReason: 'refusal'`, with its category), ran out
 * of tokens or turns, or skipped the draft it was asked for. `askAgent` sends it as a `stopped` event instead of
 * `answer`; the draft operations return it with status 502.
 */
export const AgentStopped = z.object({
  ok: z.literal(false),
  error: z.literal('agent_stopped'),
  message: z.string(),
  stopReason: z.string().describe("Claude's stop_reason for the last turn"),
  category: z.string().nullable().describe('The refusal category, when Claude refused'),
  model: z.string()
})
export type AgentStopped = z.infer<typeof AgentStopped>

/** The agent summarises a candidate for its Inbox card and, once it is a finding, drafts its work order. */
export const DraftInboxRequest = named('DraftInboxRequest', z.object({ candidateId: CandidateId }))
export type DraftInboxRequest = z.infer<typeof DraftInboxRequest>

export const InboxDraft = named(
  'InboxDraft',
  z.object({
    candidateId: CandidateId,
    findingId: FindingId.nullable().describe('Null while the candidate is not confirmed; no work order then'),
    summary: z.string().describe("The agent's summary for the Inbox card"),
    workOrder: WorkOrder.nullable().describe("The agent's draft; a person edits and submits it"),
    ...agentProvenance
  })
)
export type InboxDraft = z.infer<typeof InboxDraft>

export const DraftMonthlyReportRequest = named(
  'DraftMonthlyReportRequest',
  z.object({
    month: z
      .string()
      .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
      .describe('YYYY-MM')
  })
)
export type DraftMonthlyReportRequest = z.infer<typeof DraftMonthlyReportRequest>

/** The agent's monthly governance report, saved as a notice draft that people review, export and send. */
export const MonthlyReportDraft = named(
  'MonthlyReportDraft',
  z
    .object({ month: z.string(), notice: Notice, ...agentProvenance })
    .describe('Citations are checked in the notice body')
)
export type MonthlyReportDraft = z.infer<typeof MonthlyReportDraft>

export const RegisterWebhookRequest = named(
  'RegisterWebhookRequest',
  z.object({ url: z.url(), eventTypes: z.array(EventType).min(1) })
)
export type RegisterWebhookRequest = z.infer<typeof RegisterWebhookRequest>

export const DemoResetResult = z.object({ reset: z.literal(true) })
export type DemoResetResult = z.infer<typeof DemoResetResult>

// Path and query parameters.

export const IdParam = {
  segment: z.object({ id: SegmentId }),
  patrolPlan: z.object({ id: PatrolPlanId }),
  planHold: z.object({ id: PatrolPlanId, segmentId: SegmentId }),
  patrol: z.object({ id: PatrolId }),
  candidate: z.object({ id: CandidateId }),
  finding: z.object({ id: FindingId }),
  task: z.object({ id: TaskId }),
  workOrder: z.object({ id: WorkOrderId }),
  pass: z.object({ id: PassId }),
  remedy: z.object({ id: RemedyId }),
  notice: z.object({ id: NoticeId }),
  evidence: z.object({ id: EvidenceId })
}

export const ListCandidatesQuery = z.object({ status: CandidateStatus.optional(), segmentId: SegmentId.optional() })
export const ListFindingsQuery = z.object({ status: FindingStatus.optional(), segmentId: SegmentId.optional() })
export const ListTasksQuery = z.object({ status: z.enum(['open', 'done']).optional(), segmentId: SegmentId.optional() })
export const ListWorkOrdersQuery = z.object({
  status: WorkOrderStatus.optional(),
  installerUserId: UserId.optional()
})
export const ListPassesQuery = z.object({
  state: PassState.optional(),
  expiresWithinDays: z.coerce.number().int().positive().optional()
})
export const ListAuditQuery = z.object({
  subject: z
    .string()
    .optional()
    .describe(
      "A record's events and those of records on a segment. Only the unfiltered list, oldest first, is a chain."
    )
})
export const ListNoticesQuery = z.object({ status: z.enum(['draft', 'sent']).optional() })
