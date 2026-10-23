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

export type ActionKind = 'suspended' | 'expired' | 'expiring' | 'flags' | 'overdue'
export type Action = { kind: ActionKind; next: string }

/** The order issues #216 asks for: suspended, expired, expiring, then flags or overdue work. */
const ACTION_ORDER: Record<ActionKind, number> = { suspended: 0, expired: 1, expiring: 2, flags: 3, overdue: 3 }

const firstFlag = (reason: string | null) => reason?.match(/\b(?:cand|fnd)_\w+/)?.[0] ?? null

/**
 * What this edge needs next, in one plain step. A pass state leads because core's state is the strongest statement;
 * open flags and overdue work then make an otherwise valid or no-pass edge actionable too.
 */
export function actionOf(r: Row, titles: Record<string, string>): Action | null {
  const pass = r.pass
  if (pass?.state === 'suspended') {
    const id = firstFlag(pass.stateReason)
    const title = id === null ? undefined : titles[id]
    return {
      kind: 'suspended',
      next: title ? `Confirm the flag "${title}" in the Inbox.` : 'Review the flag holding this pass in the Inbox.'
    }
  }
  if (pass?.state === 'expired') return { kind: 'expired', next: 'Send the walk crew to check this edge again.' }
  if (pass?.state === 'expiring')
    return {
      kind: 'expiring',
      next: pass.validTo
        ? `Send the walk crew to check this edge again before ${day(pass.validTo)}.`
        : 'Send the walk crew to check this edge again before the pass runs out.'
    }
  if (r.openFlags > 0)
    return {
      kind: 'flags',
      next:
        r.openFlags === 1 ? 'Review the open flag in the Inbox.' : `Review the ${r.openFlags} open flags in the Inbox.`
    }
  if (r.overdue.length > 0) return { kind: 'overdue', next: 'Send a reminder about the overdue repair.' }
  return null
}

const worstOverdue = (r: Row) => (r.overdue.length === 0 ? 0 : Math.max(...r.overdue.map((o) => o.days)))

/** Split the board into the action cards and the two folded groups. Edges with nothing to do never become cards. */
export function groups(rs: Row[], titles: Record<string, string>) {
  const split = rs.map((r) => ({ r, action: actionOf(r, titles) }))
  const action = split
    .filter((entry): entry is { r: Row; action: Action } => entry.action !== null)
    .sort(
      (a, b) =>
        ACTION_ORDER[a.action.kind] - ACTION_ORDER[b.action.kind] ||
        worstOverdue(b.r) - worstOverdue(a.r) ||
        b.r.openFlags - a.r.openFlags ||
        a.r.segment.name.localeCompare(b.r.segment.name)
    )
    .map((entry) => entry.r)
  const rest = split.filter((entry) => entry.action === null).map((entry) => entry.r)
  return {
    action,
    valid: rest.filter((r) => r.pass?.state === 'valid'),
    none: rest.filter((r) => (r.pass?.state ?? 'none') === 'none')
  }
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
/** The month as YYYY-MM, in Malaysian time: what the agent's monthly report takes. */
export function monthKey(now: number) {
  const parts = intl({ year: 'numeric', month: '2-digit' }).formatToParts(new Date(now))
  const part = (type: 'year' | 'month') =>
    must(
      parts.find((p) => p.type === type),
      `${type} of ${now}`
    ).value
  return `${part('year')}-${part('month')}`
}
