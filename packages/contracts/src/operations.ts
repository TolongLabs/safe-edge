import type * as z from 'zod'
import type { Role, Scope } from './actors.ts'
import {
  AgentAnswer,
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
  FindingList,
  IdParam,
  InboxDraft,
  ListAuditQuery,
  ListCandidatesQuery,
  ListFindingsQuery,
  ListNoticesQuery,
  ListPassesQuery,
  ListTasksQuery,
  ListWorkOrdersQuery,
  MonthlyReportDraft,
  NoticeList,
  PatrolList,
  PatrolPlanList,
  RaiseCandidateRequest,
  RecordObservationRequest,
  RecordRetestRequest,
  RegisterWebhookRequest,
  RetestOutcome,
  RouteClosure,
  RouteClosureRequest,
  SegmentList,
  StartPatrolRequest,
  SubmitWorkOrderRequest,
  TaskList,
  TriageImagesRequest,
  TriageImagesResponse,
  UpdateWorkOrderRequest,
  UploadEvidenceRequest,
  UserList,
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
    summary: 'Allow the plan to fly',
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
    summary: "Record that the pilot or observer saw a waiting segment's path clear",
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
  startPatrol: {
    method: 'post',
    path: '/patrols',
    summary: 'Start a patrol from an approved plan',
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
    roles: ['manager', 'engineer', 'reviewer'],
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
  decideCandidate: {
    method: 'post',
    path: '/candidates/{id}/decision',
    summary: 'Confirm, reject (with reason) or recapture',
    handledBy: 'core',
    roles: ['manager'],
    agentScope: null,
    params: IdParam.candidate,
    body: DecideCandidateRequest,
    response: CandidateDecision,
    status: 200,
    events: ['edge.candidate.decided.v1', 'edge.work_order.drafted.v1']
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
    summary: 'List interim protection and field-check tasks',
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
    summary: 'Create a draft from a finding and a remedy',
    handledBy: 'core',
    roles: ['manager'],
    agentScope: 'workorder.draft',
    body: CreateWorkOrderRequest,
    response: WorkOrder,
    status: 201,
    events: ['edge.work_order.drafted.v1']
  },
  updateWorkOrder: {
    method: 'patch',
    path: '/work-orders/{id}',
    summary: 'Edit a draft work order (remedy, notes)',
    handledBy: 'core',
    roles: ['manager'],
    agentScope: 'workorder.draft',
    params: IdParam.workOrder,
    body: UpdateWorkOrderRequest,
    response: WorkOrder,
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
      'The agent summarises a candidate for its Inbox card and, once it is a finding, drafts its work order; 502 AgentStopped when Claude refuses or skips the draft',
    handledBy: 'api',
    roles: ['manager'],
    agentScope: null,
    body: DraftInboxRequest,
    response: InboxDraft,
    status: 200,
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
  registerWebhook: {
    method: 'post',
    path: '/webhooks',
    summary: 'Register a webhook endpoint for CloudEvents',
    handledBy: 'api',
    roles: ['integrator'],
    agentScope: null,
    body: RegisterWebhookRequest,
    response: Webhook,
    status: 201,
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
