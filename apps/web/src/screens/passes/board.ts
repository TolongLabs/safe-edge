import type { Asset, EdgePass, Finding, Notice, Patrol, Segment, Task, User, WorkOrder } from '@safe-edge/contracts'

export type Data = {
  segments: Segment[]
  assets: Asset[]
  passes: EdgePass[]
  findings: Finding[]
  workOrders: WorkOrder[]
  tasks: Task[]
  patrols: Patrol[]
  users: User[]
  /** null when the signed-in role may not read notices (managers and the general manager may). */
  notices: Notice[] | null
}

/** A share of the segment, or an open field check whose length core did not record. */
export type Unknown = { kind: 'never' } | { kind: 'share'; share: number } | { kind: 'unrecorded' }

export type Overdue = { workOrder: WorkOrder; days: number }

export type Row = {
  segment: Segment
  pass: EdgePass | null
  owner: string
  name: string
  plate: string
  openFlags: number
  overdue: Overdue[]
  unknown: Unknown
}

/** A lookup that must succeed: a broken reference is a bug in the data, so say so instead of showing a fallback. */
export function must<T>(value: T | null | undefined, what: string): T {
  if (value === undefined || value === null) throw new Error(`Missing ${what}`)
  return value
}

const DAY = 86_400_000
const RANK: Record<EdgePass['state'], number> = { suspended: 0, expired: 1, none: 2, expiring: 3, valid: 4 }
const DONE = new Set<WorkOrder['status']>(['completed', 'accepted'])

/** "Elmina Central Park lake, segment 12" -> place "Elmina Central Park lake", plate "S12". */
export function plain(segment: Segment) {
  const m = /^(.*?),?\s*segment (\d+)$/.exec(segment.name)
  const place = (m?.[1] ?? segment.name).replace(/\(way\/(\d+)\)/, '$1')
  return { name: place.charAt(0).toUpperCase() + place.slice(1), plate: m ? `S${m[2]}` : segment.id }
}

/**
 * Unknown share of one segment, from data every role may read:
 * never patrolled -> all of it; an open field check -> unknownM / lengthM from the newest completed patrol that covers
 * the segment, or "length not recorded" when that patrol recorded none (an Inbox field check); otherwise none.
 * A segment with no pass is not counted as unknown for that reason alone.
 */
export function unknownOf(segment: Segment, tasks: Task[], patrols: Patrol[]): Unknown {
  if (segment.lastPatrolledAt === null) return { kind: 'never' }
  const open = tasks.some((t) => t.kind === 'field_check' && t.status === 'open' && t.segmentId === segment.id)
  if (!open) return { kind: 'share', share: 0 }
  const newest = patrols
    .flatMap((p) => {
      const entry = p.coverage.find((c) => c.segmentId === segment.id)
      // A patrol with no completion time cannot be the newest completed one.
      return p.status === 'completed' && p.completedAt !== null && entry
        ? [{ at: Date.parse(p.completedAt), entry }]
        : []
    })
    .sort((a, b) => b.at - a.at)[0]
  return newest && newest.entry.unknownM > 0
    ? { kind: 'share', share: Math.min(1, newest.entry.unknownM / segment.lengthM) }
    : { kind: 'unrecorded' }
}

export const personName = (users: User[], id: string) =>
  must(
    users.find((u) => u.id === id),
    `user ${id}`
  ).name.replace(/\s*\([^)]*\)$/, '')

export function rows(d: Data, now: number): Row[] {
  const passById = new Map(d.passes.map((p) => [p.id, p]))
  const assetById = new Map(d.assets.map((a) => [a.id, a]))
  const segOfFinding = new Map(d.findings.map((f) => [f.id, f.segmentId]))
  const userName = (id: string) => personName(d.users, id)
  return d.segments
    .map((segment): Row => {
      const asset = must(assetById.get(segment.assetId), `asset ${segment.assetId} of ${segment.id}`)
      const overdue = d.workOrders
        .filter(
          (w) =>
            segOfFinding.get(w.findingId) === segment.id &&
            !DONE.has(w.status) &&
            w.dueAt !== null &&
            Date.parse(w.dueAt) < now
        )
        .map((workOrder) => ({ workOrder, days: Math.max(1, Math.floor((now - Date.parse(workOrder.dueAt!)) / DAY)) }))
      return {
        segment,
        pass:
          segment.passId === null
            ? null
            : must(passById.get(segment.passId), `pass ${segment.passId} of ${segment.id}`),
        owner: userName(asset.custodianUserId),
        ...plain(segment),
        openFlags: d.findings.filter((f) => f.segmentId === segment.id && f.status !== 'closed').length,
        overdue,
        unknown: unknownOf(segment, d.tasks, d.patrols)
      }
    })
    .sort((a, b) => RANK[a.pass?.state ?? 'none'] - RANK[b.pass?.state ?? 'none'])
}

export const counts = (rs: Row[]) => {
  const by = (s: EdgePass['state']) => rs.filter((r) => (r.pass?.state ?? 'none') === s).length
  return {
    suspended: by('suspended'),
    expired: by('expired'),
    none: by('none'),
    expiring: by('expiring'),
    valid: by('valid'),
    flags: rs.reduce((n, r) => n + r.openFlags, 0),
    overdue: rs.reduce((n, r) => n + r.overdue.length, 0),
    unknownStretches: rs.filter((r) => r.unknown.kind !== 'share' || r.unknown.share > 0).length
  }
}

// Every date and time the board shows is Malaysian time, whatever the machine's zone.
const KL = 'Asia/Kuala_Lumpur'
const intl = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-GB', { ...o, timeZone: KL })
export const day = (iso: string | number) =>
  intl({ day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso))
export const dayTime = (iso: string) =>
  intl({ day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
export const month = (now: number) => intl({ month: 'long' }).format(new Date(now))
