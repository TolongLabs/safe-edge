import type { Asset, AuditEvent, EdgePass, Finding, Segment, User } from '@safe-edge/contracts'
import type { client } from '../../../store'
import { can } from '../../../store'
import { must, personName } from '../board'

type Client = ReturnType<typeof client>

/** What the pack says in place of a re-test's details when the signed-in role may not read the audit trail. */
export const NEEDS_MANAGER = 'needs a manager or general manager'
/** The words the board uses for an edge with no pass; a pass in state none reads the same. */
export const NO_PASS = 'No pass yet: unknown'

/** simulated and source come from the re-test's own record in the audit trail, or from its pass when the audit is not readable. */
export type AcceptedRetest = {
  id: string
  segmentId: string
  passId: string
  labelsFrom: 'audit' | 'pass'
  simulated: boolean
  source: EdgePass['source']
  details: { at: string; actor: string } | typeof NEEDS_MANAGER
}

export type HandoverPack = {
  generatedAt: string
  generatedBy: string
  asset: Asset
  upkeepOwner: { name: string; role: User['role'] }
  segments: { segment: Segment; pass: EdgePass | null; passLabel: string }[]
  acceptedRetests: AcceptedRetest[]
  openFindings: Finding[]
}

/** The accepting re-test is found by its recorded command; a missing record is a bug in core, so the pack fails. */
function retestEvent(audit: AuditEvent[], id: string) {
  return must(
    audit.find((e) => e.action === 'recordRetest' && e.decision === 'allowed' && e.subjectId === id),
    `audit event for re-test ${id}`
  )
}

/** The re-test's record is what the audit event stored after the write. */
function provenanceOf(hit: AuditEvent, id: string): { simulated: boolean; source: EdgePass['source'] } {
  const after = hit.after
  if (typeof after !== 'object' || after === null || !('simulated' in after) || !('source' in after))
    throw new Error(`Audit event ${hit.id} does not record re-test ${id}`)
  if (typeof after.simulated !== 'boolean') throw new Error(`Re-test ${id} has no simulated flag`)
  return { simulated: after.simulated, source: after.source as EdgePass['source'] }
}

function acceptedRetest(
  audit: AuditEvent[] | null,
  users: User[],
  segmentId: string,
  pass: EdgePass,
  id: string
): AcceptedRetest {
  const base = { id, segmentId, passId: pass.id }
  if (audit === null)
    return { ...base, labelsFrom: 'pass', simulated: pass.simulated, source: pass.source, details: NEEDS_MANAGER }
  const hit = retestEvent(audit, id)
  return {
    ...base,
    labelsFrom: 'audit',
    ...provenanceOf(hit, id),
    details: { at: hit.at, actor: personName(users, hit.actor.id) }
  }
}

/** Reads one asset's handover pack as the signed-in person. Every record keeps its own simulated and source. */
export async function buildPack(c: Client, assetId: string, signedIn: User, now: Date): Promise<HandoverPack> {
  const [assets, segments, passes, findings, users] = await Promise.all([
    c.listAssets(),
    c.listSegments(),
    c.listPasses(),
    c.listFindings(),
    c.listUsers()
  ])
  const asset = must(
    assets.find((a) => a.id === assetId),
    `asset ${assetId}`
  )
  const custodian = must(
    users.find((u) => u.id === asset.custodianUserId),
    `user ${asset.custodianUserId}`
  )
  const own = segments.filter((s) => s.assetId === asset.id)
  const passById = new Map(passes.map((p) => [p.id, p]))
  const packSegments = own.map((segment) => {
    const pass =
      segment.passId === null ? null : must(passById.get(segment.passId), `pass ${segment.passId} of ${segment.id}`)
    return { segment, pass, passLabel: pass && pass.state !== 'none' ? pass.state : NO_PASS }
  })
  const audit = can('listAudit') ? await c.listAudit({}) : null
  const acceptedRetests = packSegments.flatMap(({ segment, pass }) =>
    pass ? pass.scope.retestIds.map((id) => acceptedRetest(audit, users, segment.id, pass, id)) : []
  )
  const ids = new Set(own.map((s) => s.id))
  return {
    generatedAt: now.toISOString(),
    generatedBy: personName(users, signedIn.id),
    asset,
    upkeepOwner: { name: personName(users, custodian.id), role: custodian.role },
    segments: packSegments,
    acceptedRetests,
    openFindings: findings.filter((f) => ids.has(f.segmentId) && f.status !== 'closed')
  }
}
