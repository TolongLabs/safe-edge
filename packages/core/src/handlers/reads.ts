import { DAY, falseFlagReport } from '../policy.ts'
import { ok, type Handlers } from './handler.ts'

type ReadOperation =
  | 'listAssets'
  | 'listSegments'
  | 'getSegment'
  | 'listUsers'
  | 'getMe'
  | 'listDocks'
  | 'listDroneProfiles'
  | 'listPatrolPlans'
  | 'listPatrols'
  | 'listInventoryChecks'
  | 'listCandidates'
  | 'getFalseFlags'
  | 'getCandidate'
  | 'listFindings'
  | 'getFinding'
  | 'listTasks'
  | 'listWorkOrders'
  | 'getWorkOrder'
  | 'listPasses'
  | 'getPass'
  | 'listAudit'
  | 'listNotices'

const matches = <T>(value: T, filter: T | undefined) => filter === undefined || value === filter

/** Reads change nothing and append no audit event (a refused read is still audited by `dispatch`). */
export const reads: Handlers<ReadOperation> = {
  listAssets: (tx) => ok(tx.all('assets')),
  listSegments: (tx) => ok(tx.all('segments')),
  getSegment: (tx, { params }) => {
    const segment = tx.get('segments', params.id)
    if (!segment) return tx.notFound(`No segment ${params.id}`)
    return ok({
      segment,
      asset: tx.must('assets', segment.assetId),
      pass: segment.passId === null ? null : tx.must('passes', segment.passId),
      baseline: segment.baselineId === null ? null : tx.must('baselines', segment.baselineId)
    })
  },
  listUsers: (tx) => ok(tx.all('users')),
  getMe: (tx) => ok(tx.actor),
  listDocks: (tx) => ok(tx.all('docks')),
  listDroneProfiles: (tx) => ok(tx.all('droneProfiles')),
  listPatrolPlans: (tx) => ok(tx.all('patrolPlans')),
  listPatrols: (tx) => ok(tx.all('patrols')),
  listInventoryChecks: (tx, { query }) =>
    ok(
      tx
        .all('inventoryChecks')
        .filter((c) => matches(c.segmentId, query.segmentId) && matches(c.patrolId ?? undefined, query.patrolId))
    ),
  listCandidates: (tx, { query }) =>
    ok(tx.all('candidates').filter((c) => matches(c.status, query.status) && matches(c.segmentId, query.segmentId))),
  getFalseFlags: (tx) => ok(falseFlagReport(tx)),
  getCandidate: (tx, { params }) => {
    const candidate = tx.get('candidates', params.id)
    if (!candidate) return tx.notFound(`No candidate ${params.id}`)
    const segment = tx.must('segments', candidate.segmentId)
    return ok({
      candidate,
      segment,
      observations: candidate.observationIds.map((id) => tx.must('observations', id)),
      baseline: segment.baselineId === null ? null : tx.must('baselines', segment.baselineId)
    })
  },
  listFindings: (tx, { query }) =>
    ok(tx.all('findings').filter((f) => matches(f.status, query.status) && matches(f.segmentId, query.segmentId))),
  getFinding: (tx, { params }) => {
    const finding = tx.get('findings', params.id)
    return finding ? ok(finding) : tx.notFound(`No finding ${params.id}`)
  },
  listTasks: (tx, { query }) =>
    ok(tx.all('tasks').filter((t) => matches(t.status, query.status) && matches(t.segmentId, query.segmentId))),
  listWorkOrders: (tx, { query }) =>
    ok(
      tx
        .all('workOrders')
        .filter(
          (w) => matches(w.status, query.status) && matches(w.installerUserId ?? undefined, query.installerUserId)
        )
    ),
  getWorkOrder: (tx, { params }) => {
    const workOrder = tx.get('workOrders', params.id)
    return workOrder ? ok(workOrder) : tx.notFound(`No work order ${params.id}`)
  },
  listPasses: (tx, { query }) => {
    const now = Date.parse(tx.now)
    const within = query.expiresWithinDays
    return ok(
      tx.all('passes').filter((p) => {
        if (!matches(p.state, query.state)) return false
        if (within === undefined) return true
        if (p.validTo === null) return false
        const validTo = Date.parse(p.validTo)
        return validTo >= now && validTo <= now + within * DAY
      })
    )
  },
  getPass: (tx, { params }) => {
    const pass = tx.get('passes', params.id)
    return pass ? ok(pass) : tx.notFound(`No pass ${params.id}`)
  },
  listAudit: (tx, { query }) => ok(tx.audit(query.subject)),
  listNotices: (tx, { query }) => ok(tx.all('notices').filter((n) => matches(n.status, query.status)))
}
