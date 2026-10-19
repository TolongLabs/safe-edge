import type { OperationId } from '@safe-edge/contracts'

/** Where an operation's input names the record it is about; null when it names none (lists, `getMe`, uploads). */
type SubjectField = 'params.id' | 'body.segmentId' | 'body.workOrderId' | 'body.findingId' | 'body.planId' | null

/** The audit subject of each operation, explicit per row of the operations table. */
const AUDIT_SUBJECT: { readonly [K in OperationId]: SubjectField } = {
  listAssets: null,
  listSegments: null,
  getSegment: 'params.id',
  listUsers: null,
  getMe: null,
  listDocks: null,
  listDroneProfiles: null,
  listPatrolPlans: null,
  createPatrolPlan: null,
  approvePatrolPlan: 'params.id',
  releasePlanHold: 'params.id',
  listPatrols: null,
  startPatrol: 'body.planId',
  completePatrol: 'params.id',
  recordObservation: 'body.segmentId',
  listCandidates: null,
  getCandidate: 'params.id',
  raiseCandidate: 'body.segmentId',
  decideCandidate: 'params.id',
  listFindings: null,
  getFinding: 'params.id',
  listTasks: null,
  completeTask: 'params.id',
  createOpening: 'body.segmentId',
  createRoute: 'body.segmentId',
  createRemedy: 'body.segmentId',
  approveRemedy: 'params.id',
  previewRouteClosure: 'params.id',
  listWorkOrders: null,
  getWorkOrder: 'params.id',
  createWorkOrder: 'body.findingId',
  updateWorkOrder: 'params.id',
  setWorkOrderExternalRef: 'params.id',
  recordWorkOrderExternalError: 'params.id',
  submitWorkOrder: 'params.id',
  startWorkOrder: 'params.id',
  completeWorkOrder: 'params.id',
  recordRetest: 'body.workOrderId',
  recordClearance: 'params.id',
  listPasses: null,
  getPass: 'params.id',
  listAudit: null,
  listNotices: null,
  draftNotice: null,
  sendNotice: 'params.id',
  uploadEvidence: null,
  getEvidenceUrl: 'params.id',
  triageImages: 'body.segmentId',
  askAgent: null,
  draftInbox: null,
  draftMonthlyReport: null,
  streamEvents: null,
  listWebhooks: null,
  registerWebhook: null,
  setScenarioClock: null,
  resetDemo: null
}

/**
 * The subject of a refused call's audit event: the record its operation names, or the operation itself when it names
 * none. The access check runs before the input is validated, so a refused call whose input lacks that field (a caller
 * may send anything) names no record either, and is about the operation.
 */
export function refusedSubject(operationId: OperationId, input: { params?: unknown; body?: unknown }): string {
  const field = AUDIT_SUBJECT[operationId]
  if (field === null) return operationId
  const [part, key] = field.split('.') as ['params' | 'body', string]
  const value = (input[part] as Record<string, unknown> | null | undefined)?.[key]
  return typeof value === 'string' ? value : operationId
}
