import * as z from 'zod'

/** Every schema with an `id` here becomes `components/schemas/<id>` in the generated OpenAPI document. */
export const contractRegistry = z.registry<{ id: string }>()

export const named = <T extends z.ZodType>(id: string, schema: T): T => {
  contractRegistry.add(schema, { id })
  return schema
}

/** ID prefixes (TRD: "IDs are prefixed strings"). Core's ID generator appends a seeded counter. */
export const ID_PREFIXES = {
  township: 'twp',
  user: 'usr',
  asset: 'ast',
  segment: 'seg',
  viewpoint: 'vp',
  inventoryItem: 'item',
  opening: 'opn',
  route: 'rte',
  remedy: 'rem',
  baseline: 'bsl',
  dock: 'dock',
  droneProfile: 'drn',
  patrolPlan: 'plan',
  patrol: 'ptl',
  observation: 'obs',
  candidate: 'cand',
  finding: 'fnd',
  task: 'task',
  workOrder: 'wo',
  retest: 'rt',
  pass: 'pass',
  audit: 'aud',
  notice: 'ntc',
  evidence: 'evd',
  webhook: 'whk',
  event: 'evt'
} as const

const id = (prefix: (typeof ID_PREFIXES)[keyof typeof ID_PREFIXES]) => z.string().regex(new RegExp(`^${prefix}_`))

export const TownshipId = id('twp')
export const UserId = id('usr')
export const AssetId = id('ast')
export const SegmentId = id('seg')
export const ViewpointId = id('vp')
export const InventoryItemId = id('item')
export const OpeningId = id('opn')
export const RouteId = id('rte')
export const RemedyId = id('rem')
export const BaselineId = id('bsl')
export const DockId = id('dock')
export const DroneProfileId = id('drn')
export const PatrolPlanId = id('plan')
export const PatrolId = id('ptl')
export const ObservationId = id('obs')
export const CandidateId = id('cand')
export const FindingId = id('fnd')
export const TaskId = id('task')
export const WorkOrderId = id('wo')
export const RetestId = id('rt')
export const PassId = id('pass')
export const AuditEventId = id('aud')
export const NoticeId = id('ntc')
export const EvidenceId = id('evd')
export const WebhookId = id('whk')
export const EventId = id('evt')

/** RFC 3339 UTC timestamp, as produced by `Date.prototype.toISOString()`. */
export const Timestamp = z.iso.datetime()
export const IsoDate = z.iso.date()

/** Where a record came from. Fixtures and scenario records are always `simulated: true`. */
export const Source = named('Source', z.enum(['fixture', 'scenario', 'user', 'agent', 'provider', 'model', 'system']))
export type Source = z.infer<typeof Source>

/** Spread into every record: TRD "Every record carries `simulated: boolean` and `source` provenance". */
export const provenance = { simulated: z.boolean(), source: Source }

/** GeoJSON position: [lon, lat] or [lon, lat, metres above ground]. */
export const Position = z.array(z.number()).min(2).max(3)
export const Point = named('Point', z.object({ type: z.literal('Point'), coordinates: Position }))
export type Point = z.infer<typeof Point>
export const LineString = named(
  'LineString',
  z.object({ type: z.literal('LineString'), coordinates: z.array(Position).min(2) })
)
export type LineString = z.infer<typeof LineString>
export const Polygon = named(
  'Polygon',
  z.object({ type: z.literal('Polygon'), coordinates: z.array(z.array(Position).min(4)) })
)
export type Polygon = z.infer<typeof Polygon>

/** Camera pose. Altitude is metres above ground level; heading is degrees clockwise from north. */
export const Pose = named(
  'Pose',
  z.object({
    lon: z.number(),
    lat: z.number(),
    altM: z.number(),
    headingDeg: z.number(),
    pitchDeg: z.number().describe('Gimbal pitch in degrees; negative looks down')
  })
)
export type Pose = z.infer<typeof Pose>

/** A stored image or document. Event payloads carry IDs only; consumers resolve `uri` or ask for a short-lived URL. */
export const EvidenceRef = named(
  'EvidenceRef',
  z.object({
    id: EvidenceId,
    mediaType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
    uri: z.string().describe('A static path for fixtures, or evidence://<id> for uploads; resolve with getEvidenceUrl'),
    sha256: z
      .string()
      .regex(/^[0-9a-f]{64}$/)
      .nullable(),
    capturedAt: Timestamp.nullable(),
    ...provenance
  })
)
export type EvidenceRef = z.infer<typeof EvidenceRef>

/** A point marked on a photo, in 0–1 image coordinates from the top-left corner. */
export const PhotoMark = named(
  'PhotoMark',
  z.object({ evidenceId: EvidenceId, x: z.number().min(0).max(1), y: z.number().min(0).max(1) })
)
export type PhotoMark = z.infer<typeof PhotoMark>

/** A dated, itemised quote. Fix Lens shows "quote needed" when there is none. */
export const Quote = named(
  'Quote',
  z.object({ amount: z.number().nonnegative(), currency: z.string().regex(/^[A-Z]{3}$/), date: IsoDate })
)
export type Quote = z.infer<typeof Quote>
