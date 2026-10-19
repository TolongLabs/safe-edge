import * as z from 'zod'
import { ActorRef, ActorType, PolicyRule, Role } from './actors.ts'
import {
  AssetId,
  AuditEventId,
  BaselineId,
  CandidateId,
  DockId,
  DroneProfileId,
  EvidenceRef,
  FindingId,
  InventoryItemId,
  LineString,
  NoticeId,
  ObservationId,
  OpeningId,
  PassId,
  PatrolId,
  PatrolPlanId,
  PhotoMark,
  Polygon,
  Pose,
  Quote,
  RemedyId,
  RetestId,
  RouteId,
  SegmentId,
  TaskId,
  Timestamp,
  TownshipId,
  UserId,
  ViewpointId,
  WorkOrderId,
  named,
  provenance
} from './primitives.ts'

// Domain model from the TRD, plus the additions recorded in DECISIONS.md (#51).

export const User = named('User', z.object({ id: UserId, name: z.string(), role: Role, ...provenance }))
export type User = z.infer<typeof User>

export const AssetKind = named('AssetKind', z.enum(['drain', 'pond', 'lake', 'retention_pond', 'river_edge']))
export type AssetKind = z.infer<typeof AssetKind>

export const Asset = named(
  'Asset',
  z.object({
    id: AssetId,
    townshipId: TownshipId,
    kind: AssetKind,
    name: z.string(),
    osmId: z.string().nullable().describe('OpenStreetMap element, e.g. way/123456'),
    retainedBySdp: z.boolean(),
    custodianUserId: UserId,
    geometry: z.union([LineString, Polygon]),
    ...provenance
  })
)
export type Asset = z.infer<typeof Asset>

export const InventoryItemType = named(
  'InventoryItemType',
  z.enum(['fence_panel', 'cover', 'grating', 'gate', 'ring_buoy', 'sign'])
)
export type InventoryItemType = z.infer<typeof InventoryItemType>

export const InventoryItem = named(
  'InventoryItem',
  z.object({ id: InventoryItemId, type: InventoryItemType, label: z.string(), safetyCritical: z.boolean() })
)
export type InventoryItem = z.infer<typeof InventoryItem>

/** A fixed viewpoint and the inventory items it must show. */
export const Viewpoint = named(
  'Viewpoint',
  z.object({ id: ViewpointId, pose: Pose, expectedItemIds: z.array(InventoryItemId) })
)
export type Viewpoint = z.infer<typeof Viewpoint>

export const Segment = named(
  'Segment',
  z.object({
    id: SegmentId,
    assetId: AssetId,
    name: z.string(),
    geometry: LineString,
    side: z.enum(['left', 'right']).describe('Accessible side relative to the line direction (Turf lineOffset sign)'),
    lengthM: z.number().positive(),
    viewpoints: z.array(Viewpoint),
    expectedInventory: z.array(InventoryItem),
    baselineId: BaselineId.nullable(),
    passId: PassId.nullable(),
    ...provenance
  })
)
export type Segment = z.infer<typeof Segment>

export const OpeningType = named(
  'OpeningType',
  z.enum(['fence_gap', 'fence_end', 'gate', 'missing_cover', 'low_barrier'])
)
export type OpeningType = z.infer<typeof OpeningType>

export const Opening = named(
  'Opening',
  z.object({
    id: OpeningId,
    segmentId: SegmentId,
    type: OpeningType,
    photoMarks: z.array(PhotoMark),
    measuredMm: z.number().nonnegative().nullable(),
    status: z.enum(['open', 'blocked']),
    ...provenance
  })
)
export type Opening = z.infer<typeof Opening>

export const RouteStatus = named('RouteStatus', z.enum(['open', 'closed', 'unknown']))
export type RouteStatus = z.infer<typeof RouteStatus>

/** A recorded way from a path, gate or play area to the water edge, through one or more openings. */
export const Route = named(
  'Route',
  z.object({
    id: RouteId,
    segmentId: SegmentId,
    fromFeature: z.object({ kind: z.enum(['path', 'gate', 'play_area']), label: z.string() }),
    openingIds: z.array(OpeningId),
    status: RouteStatus,
    ...provenance
  })
)
export type Route = z.infer<typeof Route>

export const RemedyType = named(
  'RemedyType',
  z.enum(['panel_replacement', 'barrier_extension', 'cover', 'gate', 'other'])
)
export type RemedyType = z.infer<typeof RemedyType>

export const Remedy = named(
  'Remedy',
  z.object({
    id: RemedyId,
    segmentId: SegmentId,
    type: RemedyType,
    label: z.string(),
    blocksOpeningIds: z.array(OpeningId),
    quantities: z.array(z.object({ item: z.string(), amount: z.number().positive(), unit: z.string() })),
    acceptanceTest: z.string(),
    quote: z.union([Quote, z.literal('quote_needed')]),
    engineerApprovedBy: UserId.nullable(),
    ...provenance
  })
)
export type Remedy = z.infer<typeof Remedy>

export const ItemStatus = named('ItemStatus', z.enum(['present', 'missing', 'changed', 'not_visible']))
export type ItemStatus = z.infer<typeof ItemStatus>

export const Baseline = named(
  'Baseline',
  z.object({
    id: BaselineId,
    segmentId: SegmentId,
    capturedAt: Timestamp,
    images: z.array(EvidenceRef),
    inventorySnapshot: z.array(z.object({ itemId: InventoryItemId, status: ItemStatus })),
    acceptedBy: UserId.nullable(),
    ...provenance
  })
)
export type Baseline = z.infer<typeof Baseline>

export const CameraProfile = named(
  'CameraProfile',
  z.object({
    hfovDeg: z.number().positive(),
    vfovDeg: z.number().positive(),
    imageWidthPx: z.number().int().positive(),
    imageHeightPx: z.number().int().positive(),
    maxZoom: z.number().min(1)
  })
)
export type CameraProfile = z.infer<typeof CameraProfile>

/** An aircraft and camera model. The battery figures are a stated assumption until an aircraft is chosen. */
export const DroneProfile = named(
  'DroneProfile',
  z.object({
    id: DroneProfileId,
    name: z.string(),
    usableBatteryWh: z.number().positive(),
    reserveWh: z.number().nonnegative(),
    cruiseSpeedMps: z.number().positive(),
    cruisePowerW: z.number().positive(),
    hoverPowerW: z.number().positive(),
    maxWindMps: z.number().positive(),
    camera: CameraProfile,
    missionFormats: z.array(z.enum(['wpml', 'qgc_plan'])),
    ...provenance
  })
)
export type DroneProfile = z.infer<typeof DroneProfile>

export const Dock = named(
  'Dock',
  z.object({
    id: DockId,
    name: z.string(),
    position: Pose.pick({ lon: true, lat: true, altM: true }),
    rainLimitMmPerH: z.number().nonnegative().describe('No launch above this rain rate (TRD: 2 mm/h)'),
    droneProfileIds: z.array(DroneProfileId),
    ...provenance
  })
)
export type Dock = z.infer<typeof Dock>

/** A timestamped planning input (rain reading, water level, warning). Stale or missing inputs score "unknown". */
export const ContextSnapshot = named(
  'ContextSnapshot',
  z.object({
    kind: z.enum(['rainfall', 'water_level', 'lightning_warning', 'weather_warning']),
    value: z.number().nullable().describe('mm/h for rainfall, metres for water level, null for warnings'),
    text: z.string().nullable().describe('Warning text as published'),
    observedAt: Timestamp,
    validTo: Timestamp.nullable(),
    publisher: z.string().describe('e.g. "JPS Public Infobanjir" or "data.gov.my"'),
    stationId: z.string().nullable(),
    url: z.string().nullable(),
    ...provenance
  })
)
export type ContextSnapshot = z.infer<typeof ContextSnapshot>

/** Each part is 0–1, or null when its input is stale or missing ("unknown", never zero). */
export const PriorityScore = named(
  'PriorityScore',
  z.object({
    total: z.number().min(0).max(1).nullable(),
    expiry: z.number().min(0).max(1).nullable(),
    reviewedFlag: z.number().min(0).max(1).nullable(),
    rain: z.number().min(0).max(1).nullable(),
    waterLevel: z.number().min(0).max(1).nullable()
  })
)
export type PriorityScore = z.infer<typeof PriorityScore>

/** A camera position on a segment's offset flight line. */
export const CameraStation = named(
  'CameraStation',
  z.object({
    lon: z.number(),
    lat: z.number(),
    altM: z.number().describe('Metres above ground level'),
    headingDeg: z.number(),
    gimbalPitchDeg: z.number(),
    zoom: z
      .number()
      .min(1)
      .describe('Camera zoom; above 1 where the station stands further off to keep 50 m separation'),
    viewpointId: ViewpointId.nullable()
  })
)
export type CameraStation = z.infer<typeof CameraStation>

export const PatrolTask = named(
  'PatrolTask',
  z.object({
    segmentId: SegmentId,
    flightLine: LineString,
    stations: z.array(CameraStation),
    priority: PriorityScore,
    energyWh: z.number().nonnegative().describe('Flying the task and hovering at its stations, without transit')
  })
)
export type PatrolTask = z.infer<typeof PatrolTask>

/** One point of the ordered flight route, with its planned time and the energy used so far. */
export const Waypoint = named(
  'Waypoint',
  CameraStation.extend({
    kind: z.enum(['takeoff', 'transit', 'station', 'landing']),
    segmentId: SegmentId.nullable(),
    eta: Timestamp,
    energyWh: z.number().nonnegative().describe('Cumulative energy used on arrival')
  })
)
export type Waypoint = z.infer<typeof Waypoint>

export const PlanHold = named(
  'PlanHold',
  z.object({
    kind: z.enum(['weather', 'lightning', 'separation']),
    segmentId: SegmentId.nullable().describe('null holds the whole launch'),
    until: Timestamp.nullable().describe('null waits for a person to confirm the path is clear'),
    reason: z.string(),
    releasedBy: UserId.nullable().describe('The pilot who recorded the path clear; never set by the planner'),
    releasedAt: Timestamp.nullable()
  })
)
export type PlanHold = z.infer<typeof PlanHold>

/** Why a segment, or some of its stations, is not in the plan. `flight_line`: no offset flight line fits the stand-off. */
export const RejectionCode = named(
  'RejectionCode',
  z.enum(['battery', 'geofence', 'flight_line', 'weather_hold', 'separation_hold', 'stale_input', 'outside_window'])
)
export type RejectionCode = z.infer<typeof RejectionCode>

/**
 * Why a route was re-planned (TRD "Patrol planner" step 5). Weather triggers carry the reading or warning that fired
 * them; the others name the record core changed.
 */
export const ReplanTrigger = named(
  'ReplanTrigger',
  z.discriminatedUnion('kind', [
    z.object({
      kind: z.literal('heavy_rain'),
      reading: ContextSnapshot.describe('A `rainfall` reading in the JPS heavy (31–60 mm) or very heavy (> 60 mm) band')
    }),
    z.object({
      kind: z.literal('weather_warning'),
      warning: ContextSnapshot.describe('A `weather_warning` or `lightning_warning` in force')
    }),
    z.object({ kind: z.literal('flag_confirmed'), segmentId: SegmentId, findingId: FindingId }),
    z.object({ kind: z.literal('pass_expiring'), segmentId: SegmentId, passId: PassId, validTo: Timestamp }),
    z.object({
      kind: z.literal('repair_completed'),
      segmentId: SegmentId,
      findingId: FindingId,
      workOrderId: WorkOrderId
    })
  ])
)
export type ReplanTrigger = z.infer<typeof ReplanTrigger>

/**
 * A re-plan: the trigger, and the plan whose uncommitted stops it replaces. `supersedes` is null for a patrol the
 * trigger queued when no plan was open (a re-test after a repair).
 */
export const PlanReplan = named(
  'PlanReplan',
  z.object({
    trigger: ReplanTrigger,
    supersedes: z
      .object({
        planId: PatrolPlanId,
        committedTasks: z
          .number()
          .int()
          .nonnegative()
          .describe('Leading route stops already flown or in progress; they stay exactly as planned')
      })
      .nullable()
  })
)
export type PlanReplan = z.infer<typeof PlanReplan>

export const PatrolPlan = named(
  'PatrolPlan',
  z.object({
    id: PatrolPlanId,
    createdAt: Timestamp,
    status: z.enum(['proposed', 'approved']),
    dockId: DockId,
    returnDockId: DockId,
    droneProfileId: DroneProfileId,
    context: z.array(ContextSnapshot),
    window: z.object({
      start: Timestamp,
      end: Timestamp,
      reason: z.enum(['first_light', 'next_dry_window', 'requested'])
    }),
    altitudeCapM: z.number().positive(),
    holds: z.array(PlanHold),
    tasks: z.array(PatrolTask),
    waypoints: z.array(Waypoint),
    route: LineString,
    energyWh: z.number().nonnegative(),
    reserveWh: z.number().nonnegative().describe("Energy left on landing; at least the drone profile's reserve"),
    rejected: z.array(z.object({ segmentId: SegmentId, code: RejectionCode, reason: z.string() })),
    replan: PlanReplan.nullable().describe('null for a plan a person or the agent asked for'),
    approvedBy: UserId.nullable(),
    approvedAt: Timestamp.nullable(),
    ...provenance
  })
)
export type PatrolPlan = z.infer<typeof PatrolPlan>

export const SegmentCoverage = named(
  'SegmentCoverage',
  z.object({
    segmentId: SegmentId,
    inspectedM: z.number().nonnegative(),
    unknownM: z.number().nonnegative().describe('Never counts as inspected; creates a field task')
  })
)
export type SegmentCoverage = z.infer<typeof SegmentCoverage>

export const DroneProviderKind = named('DroneProviderKind', z.enum(['sim', 'dji_cloud', 'mavlink']))
export type DroneProviderKind = z.infer<typeof DroneProviderKind>

export const Patrol = named(
  'Patrol',
  z.object({
    id: PatrolId,
    planId: PatrolPlanId,
    provider: DroneProviderKind,
    droneId: z.string().min(1),
    pilotUserId: UserId,
    status: z.enum(['in_flight', 'completed']),
    startedAt: Timestamp,
    completedAt: Timestamp.nullable(),
    coverage: z.array(SegmentCoverage),
    ...provenance
  })
)
export type Patrol = z.infer<typeof Patrol>

export const ImageQuality = named(
  'ImageQuality',
  z.object({
    sharpness: z.number().min(0).max(1),
    alignmentResidualPx: z.number().nonnegative().nullable(),
    occlusion: z.number().min(0).max(1)
  })
)
export type ImageQuality = z.infer<typeof ImageQuality>

export const Observation = named(
  'Observation',
  z.object({
    id: ObservationId,
    patrolId: PatrolId.nullable().describe('null for a phone capture outside a patrol'),
    segmentId: SegmentId,
    viewpointId: ViewpointId,
    captureSource: z.enum(['drone', 'phone']),
    image: EvidenceRef.nullable().describe('null when the privacy gate discarded the frame'),
    pose: Pose,
    capturedAt: Timestamp,
    quality: ImageQuality,
    privacyAction: z.enum(['none', 'discarded']),
    ...provenance
  })
)
export type Observation = z.infer<typeof Observation>

export const Tier = named('Tier', z.union([z.literal(1), z.literal(2), z.literal(3)]))
export type Tier = z.infer<typeof Tier>

/** The triage "other changes" classes (TRD "Claude calls"). */
export const OTHER_CHANGE_CLASSES = [
  'worn_path',
  'bank_change',
  'vegetation',
  'floating_debris',
  'water_level_change',
  'text_in_image',
  'other'
] as const

/** `inventory_item` for expected-inventory results; the rest are the triage "other changes" classes. */
export const CandidateClass = named('CandidateClass', z.enum(['inventory_item', ...OTHER_CHANGE_CLASSES]))
export type CandidateClass = z.infer<typeof CandidateClass>

export const Uncertainty = named('Uncertainty', z.enum(['low', 'medium', 'high']))
export type Uncertainty = z.infer<typeof Uncertainty>

export const CandidateStatus = named(
  'CandidateStatus',
  z.enum(['candidate', 'confirmed', 'rejected', 'needs_recapture'])
)
export type CandidateStatus = z.infer<typeof CandidateStatus>

export const Candidate = named(
  'Candidate',
  z.object({
    id: CandidateId,
    segmentId: SegmentId,
    observationIds: z.array(ObservationId),
    inventoryItemId: InventoryItemId.nullable(),
    itemStatus: ItemStatus.nullable(),
    class: CandidateClass,
    tier: Tier.describe('Assigned by core: 2 for a missing or changed safety item, 3 for not visible, else 1'),
    score: z.number().min(0).max(1),
    uncertainty: Uncertainty.nullable(),
    gridCell: z
      .string()
      .regex(/^[A-D][1-4]$/)
      .nullable(),
    rationale: z.string(),
    model: z.string().nullable().describe('The model that proposed it; null for scripted or human input'),
    status: CandidateStatus,
    raisedBy: ActorRef,
    raisedAt: Timestamp,
    decidedBy: UserId.nullable(),
    decidedAt: Timestamp.nullable(),
    decisionReason: z.string().nullable(),
    ...provenance
  })
)
export type Candidate = z.infer<typeof Candidate>

export const Severity = named('Severity', z.enum(['low', 'medium', 'high']))
export type Severity = z.infer<typeof Severity>

export const FindingStatus = named(
  'FindingStatus',
  z.enum(['open', 'interim_protected', 'work_ordered', 'repaired', 'retest_pending', 'closed', 'reopened'])
)
export type FindingStatus = z.infer<typeof FindingStatus>

export const Finding = named(
  'Finding',
  z.object({
    id: FindingId,
    candidateId: CandidateId,
    segmentId: SegmentId,
    class: CandidateClass,
    severity: Severity.describe('Set by a person'),
    confirmedBy: UserId,
    custodianUserId: UserId,
    status: FindingStatus,
    createdAt: Timestamp,
    ...provenance
  })
)
export type Finding = z.infer<typeof Finding>

/** Interim protection after a confirmed finding, or a field check for unknown coverage. */
export const Task = named(
  'Task',
  z.object({
    id: TaskId,
    kind: z.enum(['interim_protection', 'field_check']),
    segmentId: SegmentId,
    findingId: FindingId.nullable(),
    assigneeUserId: UserId.nullable(),
    status: z.enum(['open', 'done']),
    reason: z.string(),
    dueAt: Timestamp.nullable(),
    createdAt: Timestamp,
    ...provenance
  })
)
export type Task = z.infer<typeof Task>

export const WorkOrderStatus = named(
  'WorkOrderStatus',
  z.enum(['draft', 'submitted', 'in_progress', 'completed', 'accepted', 'rejected'])
)
export type WorkOrderStatus = z.infer<typeof WorkOrderStatus>

export const WorkOrder = named(
  'WorkOrder',
  z.object({
    id: WorkOrderId,
    findingId: FindingId,
    remedyId: RemedyId.nullable(),
    draftedBy: ActorRef,
    status: WorkOrderStatus,
    notes: z.string(),
    installerUserId: UserId.nullable(),
    submittedBy: UserId.nullable(),
    dueAt: Timestamp.nullable(),
    completedAt: Timestamp.nullable(),
    completionEvidence: z.array(EvidenceRef),
    externalRef: z.string().nullable().describe('Procore observation ID'),
    createdAt: Timestamp,
    ...provenance
  })
)
export type WorkOrder = z.infer<typeof WorkOrder>

export const RetestCheck = named(
  'RetestCheck',
  z.object({
    kind: z.enum(['saved_view', 'route_check', 'gauge_reading', 'photo']),
    subjectId: z.string().nullable().describe('The viewpoint, route or opening checked'),
    result: z.enum(['pass', 'fail']),
    reason: z.string().min(1),
    measuredMm: z.number().nonnegative().nullable()
  })
)
export type RetestCheck = z.infer<typeof RetestCheck>

/** A repair re-test (`workOrderId`) or a clearance re-test of a false alarm (`candidateId`); exactly one is set. */
export const Retest = named(
  'Retest',
  z.object({
    id: RetestId,
    workOrderId: WorkOrderId.nullable().describe('The completed repair re-tested; null for a clearance'),
    candidateId: CandidateId.nullable().describe(
      'The rejected or recapture Tier 2 candidate a clearance re-test clears; null for a repair re-test'
    ),
    reviewerUserId: UserId,
    checklist: z.array(RetestCheck),
    evidence: z.array(EvidenceRef),
    result: z.enum(['accepted', 'rejected']),
    reason: z.string().min(1),
    recordedAt: Timestamp,
    ...provenance
  })
)
export type Retest = z.infer<typeof Retest>

export const PassState = named('PassState', z.enum(['none', 'valid', 'expiring', 'expired', 'suspended']))
export type PassState = z.infer<typeof PassState>

export const EdgePass = named(
  'EdgePass',
  z.object({
    id: PassId,
    segmentId: SegmentId,
    state: PassState,
    stateReason: z.string().nullable(),
    validFrom: Timestamp.nullable(),
    validTo: Timestamp.nullable().describe('At most 12 months after acceptance'),
    scope: z.object({ routeIds: z.array(RouteId), retestIds: z.array(RetestId) }),
    issuedBy: UserId.nullable(),
    exceptions: z.array(z.string()),
    ...provenance
  })
)
export type EdgePass = z.infer<typeof EdgePass>

/** One link of the hash chain. Refused attempts are recorded too (`decision: denied`). */
export const AuditEvent = named(
  'AuditEvent',
  z.object({
    id: AuditEventId,
    at: Timestamp,
    actor: z.object({ type: ActorType, id: z.string(), role: Role }),
    action: z.string().describe('The operationId or core command'),
    subjectId: z.string(),
    before: z.unknown(),
    after: z.unknown(),
    decision: z.enum(['allowed', 'denied']),
    rule: PolicyRule.nullable(),
    policyVersion: z.string(),
    prevHash: z
      .string()
      .regex(/^[0-9a-f]{64}$/)
      .describe("The previous event's hash; 64 zeros for the first event"),
    hash: z
      .string()
      .regex(/^[0-9a-f]{64}$/)
      .describe(
        'Hex SHA-256 of the UTF-8 text prevHash followed by the canonical JSON of this event without hash. ' +
          'Canonical JSON: object keys sorted, no whitespace, every value as JSON.stringify writes it.'
      )
  })
)
export type AuditEvent = z.infer<typeof AuditEvent>

/** An internal escalation or report draft. Only a person can send it; the recipient is set by policy, not input. */
export const Notice = named(
  'Notice',
  z.object({
    id: NoticeId,
    kind: z.enum(['escalation', 'monthly_report']),
    subjectId: z.string().nullable(),
    title: z.string(),
    body: z.string(),
    status: z.enum(['draft', 'sent']),
    draftedBy: ActorRef,
    recipientUserId: UserId.nullable(),
    sentBy: UserId.nullable(),
    sentAt: Timestamp.nullable(),
    createdAt: Timestamp,
    ...provenance
  })
)
export type Notice = z.infer<typeof Notice>
