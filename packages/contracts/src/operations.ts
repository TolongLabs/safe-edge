import type * as z from 'zod'
import { Actor, type Role, type Scope } from './actors.ts'
import {
  AgentAnswer,
  AgentStopped,
  AskAgentRequest,
  AssetList,
  AuditEventList,
  CandidateDecision,
  CandidateEvidence,
  CandidateList,
  CompletePatrolRequest,
  CompleteWorkOrderRequest,
  CreateOpeningRequest,
  CreatePatrolPlanRequest,
  CreateRemedyRequest,
  CreateRouteRequest,
  CreateWorkOrderRequest,
  DecideCandidateRequest,
  DemoResetResult,
  DockList,
  DraftInboxRequest,
  DraftMonthlyReportRequest,
  DraftNoticeRequest,
  DroneProfileList,
  EdgeContext,
  EdgePassList,
  EvidenceUrl,
  FalseFlagReport,
  FindingList,
  HandOffRetry,
  IdParam,
  InboxDraft,
  InventoryCheckList,
  InventoryCheckResult,
  ListAuditQuery,
  ListCandidatesQuery,
  ListFindingsQuery,
  ListInventoryChecksQuery,
  ListNoticesQuery,
  ListPassesQuery,
  ListTasksQuery,
  ListWorkOrdersQuery,
  MonthlyReportDraft,
  NoticeList,
  PatrolList,
  PatrolPlanList,
  RaiseCandidateRequest,
  RecordAgentSummaryRequest,
  RecordClearanceRequest,
  RecordInventoryCheckRequest,
  RecordObservationRequest,
  RecordRetestRequest,
  RecordWorkOrderExternalErrorRequest,
  RegisterWebhookRequest,
  RegisteredWebhook,
  ReportDamageRequest,
  RetestOutcome,
  RouteClosure,
  RouteClosureRequest,
  ScenarioClock,
  SegmentList,
  SetScenarioClockRequest,
  SetWorkOrderExternalRefRequest,
  StartPatrolRequest,
  SubmitWorkOrderRequest,
  TaskList,
  TriageImagesRequest,
  TriageImagesResponse,
  UpdateWorkOrderRequest,
  UploadEvidenceRequest,
  UserList,
  WebhookList,
  WorkOrderList
} from './api.ts'
import {
  Candidate,
  EdgePass,
  Finding,
  Notice,
  Observation,
  Opening,
  Patrol,
  PatrolPlan,
  Remedy,
  Route,
  Task,
  WorkOrder
} from './entities.ts'
import { EdgeEvent, type EventType, Webhook } from './events.ts'
import { EvidenceRef } from './primitives.ts'

/**
 * One row of the operations table: the single source for the HTTP routes, the SDK client, core's `dispatch`
 * and the generated OpenAPI document.
 *
 * Access: a non-agent actor may call the operation when its role is in `roles` (or `roles` is 'any').
 * An agent actor may call it only when `agentScope` is set and the agent's token carries that scope.
 *
 * `handledBy`: 'core' operations go through `dispatch` on both transports; 'api' operations exist only on the
 * HTTP API (they call Claude, stream, or store files); 'memory' operations exist only in the SDK memory transport.
 */
export interface OperationSpec {
  readonly method: 'get' | 'post' | 'patch'
  /** OpenAPI path under the `/v1` base path. */
  readonly path: `/${string}`
  readonly summary: string
  readonly handledBy: 'core' | 'api' | 'memory'
  readonly roles: readonly Role[] | 'any'
  readonly agentScope: Scope | null
  readonly params?: z.ZodObject
  readonly query?: z.ZodObject
  readonly body?: z.ZodType
  /** The JSON body on success; for streamed operations, the schema of each server-sent event's data. */
  readonly response: z.ZodType
  readonly status: 200 | 201
  /** Responses besides `status` and the shared errors (400, 401, 403, 404), each with its JSON body. */
  readonly responses?: { readonly [status: number]: { readonly description: string; readonly schema: z.ZodType } }
  readonly stream?: true
  readonly events: readonly EventType[]
}

export const operations = {
  // Reads
  listAssets: {
    method: 'get',
    path: '/assets',
    summary: 'List water assets',
    handledBy: 'core',
    roles: 'any',
    agentScope: 'edge.read',
    response: AssetList,
    status: 200,
    events: []
  },
  listSegments: {
    method: 'get',
    path: '/segments',
    summary: 'List edge segments for the board',
    handledBy: 'core',
    roles: 'any',
    agentScope: 'edge.read',
    response: SegmentList,
    status: 200,
    events: []
  },
  getSegment: {
    method: 'get',
    path: '/segments/{id}',
    summary: 'Read a segment with its asset, inventory, baseline and pass',
    handledBy: 'core',
    roles: 'any',
    agentScope: 'edge.read',
    params: IdParam.segment,
    response: EdgeContext,
    status: 200,
    events: []
  },
  listUsers: {
    method: 'get',
    path: '/users',
    summary: 'List users and their roles',
    handledBy: 'core',
    roles: 'any',
    agentScope: 'edge.read',
    response: UserList,
    status: 200,
    events: []
  },
  getMe: {
    method: 'get',
    path: '/me',
    summary: 'Who the bearer token acts as: type, ID, role and scopes',
    handledBy: 'core',
    roles: 'any',
    agentScope: 'edge.read',
    response: Actor,
    status: 200,
    events: []
  },
  listDocks: {
    method: 'get',
    path: '/docks',
    summary: 'List drone docks',
    handledBy: 'core',
    roles: 'any',
    agentScope: 'edge.read',
    response: DockList,
    status: 200,
    events: []
  },
  listDroneProfiles: {
    method: 'get',
    path: '/drone-profiles',
    summary: 'List drone and camera profiles',
    handledBy: 'core',
    roles: 'any',
    agentScope: 'edge.read',
    response: DroneProfileList,
    status: 200,
    events: []
  },

  // Patrols
  listPatrolPlans: {
    method: 'get',
    path: '/patrol-plans',
    summary: 'List patrol plans',
    handledBy: 'core',
    roles: 'any',
    agentScope: 'edge.read',
    response: PatrolPlanList,
    status: 200,
    events: []
  },
  getPatrolPlan: {
    method: 'get',
    path: '/patrol-plans/{id}',
    summary: 'Read a patrol plan',
    handledBy: 'core',
    roles: 'any',
    agentScope: 'edge.read',
    params: IdParam.patrolPlan,
    response: PatrolPlan,
    status: 200,
    events: []
  },
  createPatrolPlan: {
    method: 'post',
    path: '/patrol-plans',
    summary: 'Score segments and build a route; a pilot must still approve it',
    handledBy: 'core',
    roles: ['manager', 'system'],
    agentScope: 'patrol.propose',
    body: CreatePatrolPlanRequest,
    response: PatrolPlan,
    status: 201,
    events: ['edge.patrol.planned.v1']
  },
  approvePatrolPlan: {
    method: 'post',
    path: '/patrol-plans/{id}/approve',
    summary:
      'Allow the plan to fly; a plan a re-plan superseded is refused (plan_superseded). Approving a re-plan of a plan in flight moves its patrol onto the re-plan, which the drone then flies',
    handledBy: 'core',
    roles: ['pilot'],
    agentScope: null,
    params: IdParam.patrolPlan,
    response: PatrolPlan,
    status: 200,
    events: []
  },
  releasePlanHold: {
    method: 'post',
    path: '/patrol-plans/{id}/holds/{segmentId}/release',
    summary: "Record that the pilot or observer saw a waiting segment's path, or the dock, clear",
    handledBy: 'core',
    roles: ['pilot'],
    agentScope: null,
    params: IdParam.planHold,
    response: PatrolPlan,
    status: 200,
    events: []
  },
  listPatrols: {
    method: 'get',
    path: '/patrols',
    summary: 'List patrols',
    handledBy: 'core',
    roles: 'any',
    agentScope: 'edge.read',
    response: PatrolList,
    status: 200,
    events: []
  },
  getPatrol: {
    method: 'get',
    path: '/patrols/{id}',
    summary: 'Read a patrol',
    handledBy: 'core',
    roles: 'any',
    agentScope: 'edge.read',
    params: IdParam.patrol,
    response: Patrol,
    status: 200,
    events: []
  },
  startPatrol: {
    method: 'post',
    path: '/patrols',
    summary:
      "Start a patrol from an approved plan that no re-plan superseded and no patrol is flying (invalid_transition), inside the plan's window (outside_window) and after its launch holds (weather_hold)",
    handledBy: 'core',
    roles: ['pilot'],
    agentScope: null,
    body: StartPatrolRequest,
    response: Patrol,
    status: 201,
    events: ['edge.patrol.started.v1']
  },
  completePatrol: {
    method: 'post',
    path: '/patrols/{id}/complete',
    summary: 'Record landing and coverage per segment; unknown coverage creates field tasks',
    handledBy: 'core',
    roles: ['provider', 'pilot'],
    agentScope: null,
    params: IdParam.patrol,
    body: CompletePatrolRequest,
    response: Patrol,
    status: 200,
    events: ['edge.patrol.completed.v1']
  },
  recordObservation: {
    method: 'post',
    path: '/observations',
    summary: 'Ingest a drone or phone image with its quality data',
    handledBy: 'core',
    roles: ['provider', 'crew'],
    agentScope: null,
    body: RecordObservationRequest,
    response: Observation,
    status: 201,
    events: []
  },
  recordInventoryCheck: {
    method: 'post',
    path: '/inventory-checks',
    summary:
      "Report every item an observation's viewpoint expects as present, missing, changed or not visible; core raises a candidate for each item not present",
    handledBy: 'core',
    roles: ['provider', 'crew', 'system'],
    agentScope: null,
    body: RecordInventoryCheckRequest,
    response: InventoryCheckResult,
    status: 201,
    events: ['edge.candidate.raised.v1', 'edge.pass.suspended.v1']
  },
  listInventoryChecks: {
    method: 'get',
    path: '/inventory-checks',
    summary: 'Per-item results at fixed viewpoints, by segment or patrol',
    handledBy: 'core',
    roles: 'any',
    agentScope: 'inspection.read',
    query: ListInventoryChecksQuery,
    response: InventoryCheckList,
    status: 200,
    events: []
  },

  // Inbox
  listCandidates: {
    method: 'get',
    path: '/candidates',
    summary: 'The Inbox queue',
    handledBy: 'core',
    roles: ['manager'],
    agentScope: 'inspection.read',
    query: ListCandidatesQuery,
    response: CandidateList,
    status: 200,
    events: []
  },
  getCandidate: {
    method: 'get',
    path: '/candidates/{id}',
    summary: 'A candidate with its observations and baseline',
    handledBy: 'core',
    // The system reads it to send an accepted finding's photos to the work-order system.
    roles: ['manager', 'engineer', 'reviewer', 'system'],
    agentScope: 'inspection.read',
    params: IdParam.candidate,
    response: CandidateEvidence,
    status: 200,
    events: []
  },
  raiseCandidate: {
    method: 'post',
    path: '/candidates',
    summary: 'Raise a candidate (provider, system) or propose one (agent); core assigns the tier',
    handledBy: 'core',
    roles: ['provider', 'system'],
    agentScope: 'finding.propose',
    body: RaiseCandidateRequest,
    response: Candidate,
    status: 201,
    events: ['edge.candidate.raised.v1', 'edge.pass.suspended.v1']
  },
  reportDamage: {
    method: 'post',
    path: '/damage-reports',
    summary:
      'A person reports damage they saw: core files it as a Tier 2 candidate, which suspends a valid or expiring pass',
    handledBy: 'core',
    // The walk crew on the edges, and the manager, who takes reports from residents and the council.
    roles: ['crew', 'manager'],
    agentScope: null,
    body: ReportDamageRequest,
    response: Candidate,
    status: 201,
    events: ['edge.candidate.raised.v1', 'edge.pass.suspended.v1']
  },
  reportMissedPatrol: {
    method: 'post',
    path: '/segments/{id}/missed-patrol',
    summary:
      "Report that no patrol inspected the segment for a whole patrolIntervalDays (counted from lastPatrolledAt, or from the pass's validFrom when later): core raises a Tier 2 missed_patrol candidate, which suspends the valid or expiring pass",
    handledBy: 'core',
    roles: ['system'],
    agentScope: null,
    params: IdParam.segment,
    response: Candidate,
    status: 201,
    events: ['edge.candidate.raised.v1', 'edge.pass.suspended.v1']
  },
  decideCandidate: {
    method: 'post',
    path: '/candidates/{id}/decision',
    summary:
      'Confirm, reject (with reason) or recapture (with reason; opens a recapture task); a missed patrol cannot be confirmed (invalid_transition)',
    handledBy: 'core',
    roles: ['manager'],
    agentScope: null,
    params: IdParam.candidate,
    body: DecideCandidateRequest,
    response: CandidateDecision,
    status: 200,
    events: ['edge.candidate.decided.v1', 'edge.work_order.drafted.v1']
  },
  getFalseFlags: {
    method: 'get',
    path: '/false-flags',
    summary: 'False flags per patrol and class against the budget, and the classes over it, for the board',
    handledBy: 'core',
    roles: 'any',
    agentScope: 'edge.read',
    response: FalseFlagReport,
    status: 200,
    events: []
  },
  recordAgentSummary: {
    method: 'post',
    path: '/candidates/{id}/agent-summary',
    summary:
      "Store the agent's Inbox summary on a candidate, replacing the last, until a manager decides it (then 403 invalid_transition: the summary stays the one the decision was made on); agents only, so a person's words are never labelled an AI suggestion",
    handledBy: 'core',
    roles: [],
    agentScope: 'finding.propose',
    params: IdParam.candidate,
    body: RecordAgentSummaryRequest,
    response: Candidate,
    status: 200,
    events: []
  },
  listFindings: {
    method: 'get',
    path: '/findings',
    summary: 'List findings with owners and states',
    handledBy: 'core',
    roles: 'any',
    agentScope: 'edge.read',
    query: ListFindingsQuery,
    response: FindingList,
    status: 200,
    events: []
  },
  getFinding: {
    method: 'get',
    path: '/findings/{id}',
    summary: 'Read a finding',
    handledBy: 'core',
    roles: 'any',
    agentScope: 'edge.read',
    params: IdParam.finding,
    response: Finding,
    status: 200,
    events: []
  },
  listTasks: {
    method: 'get',
    path: '/tasks',
    summary: 'List interim protection, field-check and recapture tasks',
    handledBy: 'core',
    roles: 'any',
    agentScope: 'edge.read',
    query: ListTasksQuery,
    response: TaskList,
    status: 200,
    events: []
  },
  completeTask: {
    method: 'post',
    path: '/tasks/{id}/complete',
    summary: 'Mark a task done; interim protection moves the finding to interim_protected',
    handledBy: 'core',
    roles: ['manager', 'crew', 'installer'],
    agentScope: null,
    params: IdParam.task,
    response: Task,
    status: 200,
    events: []
  },

  // Fix Lens
  createOpening: {
    method: 'post',
    path: '/openings',
    summary: 'Mark an opening on a photo',
    handledBy: 'core',
    roles: ['manager', 'engineer'],
    agentScope: null,
    body: CreateOpeningRequest,
    response: Opening,
    status: 201,
    events: []
  },
  createRoute: {
    method: 'post',
    path: '/routes',
    summary: 'Link an observed approach to its openings',
    handledBy: 'core',
    roles: ['manager', 'engineer'],
    agentScope: null,
    body: CreateRouteRequest,
    response: Route,
    status: 201,
    events: []
  },
  createRemedy: {
    method: 'post',
    path: '/remedies',
    summary: 'Propose a remedy that blocks openings',
    handledBy: 'core',
    roles: ['manager', 'engineer'],
    agentScope: null,
    body: CreateRemedyRequest,
    response: Remedy,
    status: 201,
    events: []
  },
  approveRemedy: {
    method: 'post',
    path: '/remedies/{id}/approve',
    summary: 'Engineer approval of a remedy, required before a work order is submitted',
    handledBy: 'core',
    roles: ['engineer'],
    agentScope: null,
    params: IdParam.remedy,
    response: Remedy,
    status: 200,
    events: []
  },
  previewRouteClosure: {
    method: 'post',
    path: '/segments/{id}/route-closure',
    summary: 'Show which recorded routes the selected remedies close (changes nothing)',
    handledBy: 'core',
    roles: 'any',
    agentScope: 'edge.read',
    params: IdParam.segment,
    body: RouteClosureRequest,
    response: RouteClosure,
    status: 200,
    events: []
  },
  deleteOpening: {
    method: 'post',
    path: '/openings/{id}/delete',
    summary: 'Remove a mis-marked opening; refused while a route or remedy uses it, or once confirmed or blocked',
    handledBy: 'core',
    roles: ['manager', 'engineer'],
    agentScope: null,
    params: IdParam.opening,
    response: Opening,
    status: 200,
    events: []
  },
  deleteRoute: {
    method: 'post',
    path: '/routes/{id}/delete',
    summary: 'Remove a mis-linked route; refused once confirmed or named by a pass or re-test',
    handledBy: 'core',
    roles: ['manager', 'engineer'],
    agentScope: null,
    params: IdParam.route,
    response: Route,
    status: 200,
    events: []
  },
  deleteRemedy: {
    method: 'post',
    path: '/remedies/{id}/delete',
    summary: 'Remove a remedy; refused once approved or used by a work order',
    handledBy: 'core',
    roles: ['manager', 'engineer'],
    agentScope: null,
    params: IdParam.remedy,
    response: Remedy,
    status: 200,
    events: []
  },
  confirmOpening: {
    method: 'post',
    path: '/openings/{id}/confirm',
    summary: 'Engineer confirms an opening marking; recorded, not yet required for approval',
    handledBy: 'core',
    roles: ['engineer'],
    agentScope: null,
    params: IdParam.opening,
    response: Opening,
    status: 200,
    events: []
  },
  confirmRoute: {
    method: 'post',
    path: '/routes/{id}/confirm',
    summary: 'Engineer confirms a route link; recorded, not yet required for approval',
    handledBy: 'core',
    roles: ['engineer'],
    agentScope: null,
    params: IdParam.route,
    response: Route,
    status: 200,
    events: []
  },

  // Work orders and proof
  listWorkOrders: {
    method: 'get',
    path: '/work-orders',
    summary: 'List work orders',
    handledBy: 'core',
    roles: 'any',
    agentScope: 'edge.read',
    query: ListWorkOrdersQuery,
    response: WorkOrderList,
    status: 200,
    events: []
  },
  getWorkOrder: {
    method: 'get',
    path: '/work-orders/{id}',
    summary: 'Read a work order',
    handledBy: 'core',
    roles: 'any',
    agentScope: 'edge.read',
    params: IdParam.workOrder,
    response: WorkOrder,
    status: 200,
    events: []
  },
  createWorkOrder: {
    method: 'post',
    path: '/work-orders',
    summary:
      'Create a draft from a finding and a remedy. A finding has one open work order: refused while one is past draft, and its draft comes back instead when it has one',
    handledBy: 'core',
    roles: ['manager'],
    agentScope: 'workorder.draft',
    body: CreateWorkOrderRequest,
    response: WorkOrder,
    status: 201,
    responses: {
      200: {
        description: "The finding's open draft, unchanged (confirming a candidate drafts one); nothing was created",
        schema: WorkOrder
      }
    },
    events: ['edge.work_order.drafted.v1']
  },
  updateWorkOrder: {
    method: 'patch',
    path: '/work-orders/{id}',
    summary: 'Edit a draft work order (remedy, notes); the agent edits only the drafts it drafted',
    handledBy: 'core',
    roles: ['manager'],
    agentScope: 'workorder.draft',
    params: IdParam.workOrder,
    body: UpdateWorkOrderRequest,
    response: WorkOrder,
    status: 200,
    events: []
  },
  setWorkOrderExternalRef: {
    method: 'post',
    path: '/work-orders/{id}/external-ref',
    summary: "Record the external work-order system's record for a work order, once (system only)",
    handledBy: 'core',
    roles: ['system'],
    agentScope: null,
    params: IdParam.workOrder,
    body: SetWorkOrderExternalRefRequest,
    response: WorkOrder,
    status: 200,
    events: []
  },
  recordWorkOrderExternalError: {
    method: 'post',
    path: '/work-orders/{id}/external-error',
    summary:
      'Record why handing a work order to the external work-order system failed (system only; once, until a person retries it)',
    handledBy: 'core',
    roles: ['system'],
    agentScope: null,
    params: IdParam.workOrder,
    body: RecordWorkOrderExternalErrorRequest,
    response: WorkOrder,
    status: 200,
    events: []
  },
  retryWorkOrderHandOff: {
    method: 'post',
    path: '/work-orders/{id}/external-retry',
    summary:
      'Retry a failed hand-off to the external work-order system from the step that failed (a manager or engineer)',
    handledBy: 'core',
    roles: ['manager', 'engineer'],
    agentScope: null,
    params: IdParam.workOrder,
    response: HandOffRetry,
    status: 200,
    events: []
  },
  submitWorkOrder: {
    method: 'post',
    path: '/work-orders/{id}/submit',
    summary: 'Submit; engineer approval of the remedy required',
    handledBy: 'core',
    roles: ['manager', 'engineer'],
    agentScope: null,
    params: IdParam.workOrder,
    body: SubmitWorkOrderRequest,
    response: WorkOrder,
    status: 200,
    events: ['edge.work_order.submitted.v1']
  },
  startWorkOrder: {
    method: 'post',
    path: '/work-orders/{id}/start',
    summary: 'The installer starts the repair',
    handledBy: 'core',
    roles: ['installer'],
    agentScope: null,
    params: IdParam.workOrder,
    response: WorkOrder,
    status: 200,
    events: []
  },
  completeWorkOrder: {
    method: 'post',
    path: '/work-orders/{id}/complete',
    summary: 'Record the repair as done',
    handledBy: 'core',
    roles: ['installer'],
    agentScope: null,
    params: IdParam.workOrder,
    body: CompleteWorkOrderRequest,
    response: WorkOrder,
    status: 200,
    events: ['edge.repair.completed.v1']
  },
  recordRetest: {
    method: 'post',
    path: '/retests',
    summary: 'Record a re-test; acceptance issues the pass',
    handledBy: 'core',
    roles: ['reviewer'],
    agentScope: null,
    body: RecordRetestRequest,
    response: RetestOutcome,
    status: 201,
    events: ['edge.retest.recorded.v1', 'edge.pass.issued.v1']
  },
  recordClearance: {
    method: 'post',
    path: '/candidates/{id}/clearance',
    summary:
      'Record a clearance re-test of a rejected or recapture Tier 2 candidate (a false alarm); acceptance restores its suspended pass once nothing else is open on the segment',
    handledBy: 'core',
    roles: ['reviewer'],
    agentScope: null,
    params: IdParam.candidate,
    body: RecordClearanceRequest,
    response: RetestOutcome,
    status: 201,
    events: ['edge.retest.recorded.v1', 'edge.pass.issued.v1']
  },
  listPasses: {
    method: 'get',
    path: '/passes',
    summary: 'Pass states for the board',
    handledBy: 'core',
    roles: 'any',
    agentScope: 'edge.read',
    query: ListPassesQuery,
    response: EdgePassList,
    status: 200,
    events: []
  },
  getPass: {
    method: 'get',
    path: '/passes/{id}',
    summary: 'Read a pass',
    handledBy: 'core',
    roles: 'any',
    agentScope: 'edge.read',
    params: IdParam.pass,
    response: EdgePass,
    status: 200,
    events: []
  },
  listAudit: {
    method: 'get',
    path: '/audit',
    summary: 'The audit trail, including refused attempts',
    handledBy: 'core',
    roles: ['manager', 'gm'],
    agentScope: null,
    query: ListAuditQuery,
    response: AuditEventList,
    status: 200,
    events: []
  },

  // Notices
  listNotices: {
    method: 'get',
    path: '/notices',
    summary: 'List escalation and report drafts',
    handledBy: 'core',
    roles: ['manager', 'gm'],
    agentScope: 'notice.draft',
    query: ListNoticesQuery,
    response: NoticeList,
    status: 200,
    events: []
  },
  draftNotice: {
    method: 'post',
    path: '/notices',
    summary: 'Save an internal escalation or report draft; never sends',
    handledBy: 'core',
    roles: ['manager', 'gm'],
    agentScope: 'notice.draft',
    body: DraftNoticeRequest,
    response: Notice,
    status: 201,
    events: []
  },
  sendNotice: {
    method: 'post',
    path: '/notices/{id}/send',
    summary: 'A person sends a draft to the recipient set by policy',
    handledBy: 'core',
    roles: ['manager', 'gm'],
    agentScope: null,
    params: IdParam.notice,
    response: Notice,
    status: 200,
    events: []
  },

  // HTTP API only
  uploadEvidence: {
    method: 'post',
    path: '/evidence',
    summary: 'Store an image; returns its evidence reference',
    handledBy: 'api',
    roles: ['provider', 'crew', 'manager', 'engineer', 'installer', 'reviewer'],
    agentScope: null,
    body: UploadEvidenceRequest,
    response: EvidenceRef,
    status: 201,
    events: []
  },
  getEvidenceUrl: {
    method: 'get',
    path: '/evidence/{id}/url',
    summary: 'A short-lived URL for an evidence image',
    handledBy: 'api',
    roles: 'any',
    agentScope: 'inspection.read',
    params: IdParam.evidence,
    response: EvidenceUrl,
    status: 200,
    events: []
  },
  triageImages: {
    method: 'post',
    path: '/triage/images',
    summary: 'Claude vision triage on a real photo pair; returns AI suggestions, unvalidated',
    handledBy: 'api',
    roles: ['manager'],
    agentScope: null,
    body: TriageImagesRequest,
    response: TriageImagesResponse,
    status: 200,
    events: ['edge.candidate.raised.v1', 'edge.pass.suspended.v1']
  },
  askAgent: {
    method: 'post',
    path: '/agent/ask',
    summary:
      'Ask the agent; streams `delta` events, then one `answer` event citing record IDs, or one `stopped` event (AgentStopped) when Claude refuses or cannot finish',
    handledBy: 'api',
    roles: ['manager', 'gm'],
    agentScope: null,
    body: AskAgentRequest,
    response: AgentAnswer,
    status: 200,
    stream: true,
    events: []
  },
  // The agent's own writes (createWorkOrder, draftNotice) go through the API with the agent's token and emit their
  // events there, so these two operations list none of their own.
  draftInbox: {
    method: 'post',
    path: '/agent/inbox-drafts',
    summary:
      "The agent summarises a candidate for its Inbox card, stored as the candidate's agentSummary while it awaits a decision (a decided candidate keeps the summary it was decided on), and once it is a finding, drafts its work order (getting back the open draft); 502 AgentStopped when Claude refuses or skips the draft",
    handledBy: 'api',
    roles: ['manager'],
    agentScope: null,
    body: DraftInboxRequest,
    response: InboxDraft,
    status: 200,
    responses: {
      502: {
        description: 'Claude refused, or finished without the draft the workflow asked for; the summary is not stored',
        schema: AgentStopped
      }
    },
    events: []
  },
  draftMonthlyReport: {
    method: 'post',
    path: '/agent/monthly-reports',
    summary:
      'The agent drafts the monthly governance report as a notice draft; 502 AgentStopped when Claude refuses or skips the draft',
    handledBy: 'api',
    roles: ['gm', 'manager'],
    agentScope: null,
    body: DraftMonthlyReportRequest,
    response: MonthlyReportDraft,
    status: 200,
    responses: {
      502: {
        description: 'Claude refused, or finished without saving exactly one monthly report',
        schema: AgentStopped
      }
    },
    events: []
  },
  streamEvents: {
    method: 'get',
    path: '/events',
    summary: 'Server-sent CloudEvents (see asyncapi.yaml)',
    handledBy: 'api',
    roles: 'any',
    agentScope: 'edge.read',
    response: EdgeEvent,
    status: 200,
    stream: true,
    events: []
  },
  listWebhooks: {
    method: 'get',
    path: '/webhooks',
    summary: 'List webhook endpoints with their failed deliveries',
    handledBy: 'api',
    roles: ['integrator'],
    agentScope: null,
    response: WebhookList,
    status: 200,
    events: []
  },
  registerWebhook: {
    method: 'post',
    path: '/webhooks',
    summary:
      'Register a webhook endpoint for CloudEvents, signed per Standard Webhooks; its origin must be on the allowlist (SAFE_EDGE_WEBHOOK_ORIGINS)',
    handledBy: 'api',
    roles: ['integrator'],
    agentScope: null,
    body: RegisterWebhookRequest,
    response: RegisteredWebhook,
    status: 201,
    events: []
  },
  setScenarioClock: {
    method: 'post',
    path: '/scenario/clock',
    summary:
      'Set the time the API stamps on records, as a scenario player does before each event (dev and demo runs ' +
      'started with SAFE_EDGE_CLOCK=scenario only; production refuses it, and the wall-clock API answers 501). ' +
      'The clock moves forward only: an earlier time is refused (403 clock_backwards), so audit times stay ordered',
    handledBy: 'api',
    roles: ['system'],
    agentScope: null,
    body: SetScenarioClockRequest,
    response: ScenarioClock,
    status: 200,
    events: []
  },

  // SDK memory transport only
  resetDemo: {
    method: 'post',
    path: '/demo/reset',
    summary: 'Restore the seeded, labelled fixtures (demo mode only; the HTTP API has no such route)',
    handledBy: 'memory',
    roles: 'any',
    agentScope: null,
    response: DemoResetResult,
    status: 200,
    events: []
  }
} as const satisfies Record<string, OperationSpec>

export type Operations = typeof operations
export type OperationId = keyof Operations
