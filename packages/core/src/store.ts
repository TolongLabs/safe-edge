import {
  ID_PREFIXES,
  type Actor,
  type Asset,
  type AuditEvent,
  type Baseline,
  type Candidate,
  type Denial,
  type Dock,
  type DroneProfile,
  type EdgeEvent,
  type EdgePass,
  type EVENT_DATA,
  type EventType,
  type Finding,
  type NotFound,
  type Notice,
  type Observation,
  type Opening,
  type Patrol,
  type PatrolPlan,
  type PolicyRule,
  type Remedy,
  type Retest,
  type Route,
  type Segment,
  type Source,
  type Task,
  type User,
  type WorkOrder
} from '@safe-edge/contracts'
import type * as z from 'zod'
import { GENESIS_HASH, POLICY_VERSION, hashAuditEvent } from './audit.ts'
import type { Seed } from './seed.ts'

export interface Collections {
  users: User
  assets: Asset
  segments: Segment
  baselines: Baseline
  passes: EdgePass
  docks: Dock
  droneProfiles: DroneProfile
  patrolPlans: PatrolPlan
  patrols: Patrol
  observations: Observation
  candidates: Candidate
  findings: Finding
  tasks: Task
  workOrders: WorkOrder
  retests: Retest
  openings: Opening
  routes: Route
  remedies: Remedy
  notices: Notice
}
export type CollectionName = keyof Collections
export type AnyRecord = Collections[CollectionName]

/** Which collection holds an ID, by its prefix. */
const COLLECTION_BY_PREFIX: Partial<Record<string, CollectionName>> = {
  [ID_PREFIXES.user]: 'users',
  [ID_PREFIXES.asset]: 'assets',
  [ID_PREFIXES.segment]: 'segments',
  [ID_PREFIXES.baseline]: 'baselines',
  [ID_PREFIXES.pass]: 'passes',
  [ID_PREFIXES.dock]: 'docks',
  [ID_PREFIXES.droneProfile]: 'droneProfiles',
  [ID_PREFIXES.patrolPlan]: 'patrolPlans',
  [ID_PREFIXES.patrol]: 'patrols',
  [ID_PREFIXES.observation]: 'observations',
  [ID_PREFIXES.candidate]: 'candidates',
  [ID_PREFIXES.finding]: 'findings',
  [ID_PREFIXES.task]: 'tasks',
  [ID_PREFIXES.workOrder]: 'workOrders',
  [ID_PREFIXES.retest]: 'retests',
  [ID_PREFIXES.opening]: 'openings',
  [ID_PREFIXES.route]: 'routes',
  [ID_PREFIXES.remedy]: 'remedies',
  [ID_PREFIXES.notice]: 'notices'
}

/** One link of the chain, plus the segment it concerns so `listAudit?subject=seg_…` returns a segment's history. */
interface AuditEntry {
  event: AuditEvent
  segmentId: string | null
}

export type State = { [C in CollectionName]: Map<string, Collections[C]> } & { audit: AuditEntry[] }

export function createState(seed: Seed): State {
  const byId = <T extends { id: string }>(records: T[]) => new Map(records.map((r) => [r.id, r]))
  return {
    users: byId(seed.users),
    assets: byId(seed.assets),
    segments: byId(seed.segments),
    baselines: byId(seed.baselines),
    passes: byId(seed.passes),
    docks: byId(seed.docks),
    droneProfiles: byId(seed.droneProfiles),
    patrolPlans: new Map(),
    patrols: new Map(),
    observations: new Map(),
    candidates: new Map(),
    findings: new Map(),
    tasks: new Map(),
    workOrders: new Map(),
    retests: new Map(),
    openings: new Map(),
    routes: new Map(),
    remedies: new Map(),
    notices: new Map(),
    audit: []
  }
}

export type IdPrefix = (typeof ID_PREFIXES)[keyof typeof ID_PREFIXES]
export type EventData<T extends EventType> = z.output<(typeof EVENT_DATA)[T]>

interface StagedWrite {
  collection: CollectionName
  before: AnyRecord | null
  after: AnyRecord
}

/**
 * One dispatch (or tick). Writes are staged and only reach the state, the audit chain and the event list on commit,
 * so a denial or a throw part-way through changes nothing. Every write becomes one audit event.
 */
export class Tx {
  readonly source: Source
  readonly events: EdgeEvent[] = []
  private readonly writes: StagedWrite[] = []
  /** Staged records by `<collection>:<id>`. */
  private readonly staged = new Map<string, AnyRecord>()

  constructor(
    private readonly state: State,
    readonly actor: Actor,
    readonly now: string,
    private readonly newId: (prefix: IdPrefix) => string,
    private readonly townshipId: string
  ) {
    this.source = actor.type
  }

  id(prefix: IdPrefix): string {
    const id = this.newId(prefix)
    if (this.find(id) !== undefined) throw new Error(`ID generator returned ${id}, which already exists`)
    return id
  }

  get<C extends CollectionName>(collection: C, id: string): Collections[C] | undefined {
    return (this.staged.get(`${collection}:${id}`) ?? this.state[collection].get(id)) as Collections[C] | undefined
  }

  /** A record another record points at. Missing means the store is corrupt, so it throws. */
  must<C extends CollectionName>(collection: C, id: string): Collections[C] {
    const record = this.get(collection, id)
    if (record === undefined) throw new Error(`store integrity: ${collection} has no ${id}`)
    return record
  }

  /** Any record, found by its ID prefix. */
  find(id: string): AnyRecord | undefined {
    const collection = COLLECTION_BY_PREFIX[id.slice(0, id.indexOf('_'))]
    return collection === undefined ? undefined : this.get(collection, id)
  }

  all<C extends CollectionName>(collection: C): Collections[C][] {
    const stored = [...this.state[collection].keys()]
    const added = this.writes.filter((w) => w.collection === collection && !this.state[collection].has(w.after.id))
    const ids = new Set([...stored, ...added.map((w) => w.after.id)])
    return [...ids].map((id) => this.must(collection, id))
  }

  put<C extends CollectionName>(collection: C, record: Collections[C]): void {
    this.writes.push({ collection, before: this.get(collection, record.id) ?? null, after: record })
    this.staged.set(`${collection}:${record.id}`, record)
  }

  emit<T extends EventType>(type: T, data: EventData<T>, segmentId?: string): void {
    this.events.push({
      specversion: '1.0',
      id: this.id('evt'),
      source: `safe-edge://townships/${this.townshipId}`,
      type,
      ...(segmentId === undefined ? {} : { subject: `segments/${segmentId}` }),
      time: this.now,
      datacontenttype: 'application/json',
      data
    } as EdgeEvent)
  }

  /** The audit trail; with a subject, its own events and those of records on that segment. */
  audit(subject?: string): AuditEvent[] {
    const entries =
      subject === undefined
        ? this.state.audit
        : this.state.audit.filter((e) => e.event.subjectId === subject || e.segmentId === subject)
    return entries.map((e) => e.event)
  }

  /** The record a handler refused to change, for the denial's audit event. */
  deniedSubject: string | undefined

  deny(rule: PolicyRule, message: string, subjectId?: string): Denial {
    this.deniedSubject = subjectId
    return { ok: false, rule, message }
  }

  notFound(message: string): NotFound {
    return { ok: false, error: 'not_found', message }
  }

  /** Applies the staged writes and their audit events together, after every hash is computed. */
  commit(action: string): void {
    const entries: AuditEntry[] = []
    for (const { before, after } of this.writes) {
      entries.push(this.entry(entries, action, after.id, before, after, null, this.segmentOf(after)))
    }
    for (const { collection, after } of this.writes)
      (this.state[collection] as Map<string, AnyRecord>).set(after.id, after)
    this.state.audit.push(...entries)
  }

  /** Appends a refused attempt; nothing staged in this transaction is kept. */
  commitDenial(action: string, rule: PolicyRule, subjectId: string): void {
    const subject = this.findCommitted(subjectId)
    this.state.audit.push(
      this.entry([], action, subjectId, subject ?? null, null, rule, subject ? this.segmentOf(subject) : null)
    )
  }

  private findCommitted(id: string): AnyRecord | undefined {
    const collection = COLLECTION_BY_PREFIX[id.slice(0, id.indexOf('_'))]
    return collection === undefined ? undefined : this.state[collection].get(id)
  }

  private segmentOf(record: AnyRecord): string | null {
    if (record.id.startsWith(`${ID_PREFIXES.segment}_`)) return record.id
    if ('segmentId' in record && typeof record.segmentId === 'string') return record.segmentId
    if ('findingId' in record && typeof record.findingId === 'string')
      return this.must('findings', record.findingId).segmentId
    if ('workOrderId' in record) return this.segmentOf(this.must('workOrders', record.workOrderId))
    return null
  }

  /** The next link of the chain, after the committed events and any `pending` ones. */
  private entry(
    pending: AuditEntry[],
    action: string,
    subjectId: string,
    before: unknown,
    after: unknown,
    rule: PolicyRule | null,
    segmentId: string | null
  ): AuditEntry {
    const prevHash = (pending.at(-1) ?? this.state.audit.at(-1))?.event.hash ?? GENESIS_HASH
    const unhashed = {
      id: this.id('aud'),
      at: this.now,
      actor: { type: this.actor.type, id: this.actor.id, role: this.actor.role },
      action,
      subjectId,
      before: structuredClone(before),
      after: structuredClone(after),
      decision: rule === null ? ('allowed' as const) : ('denied' as const),
      rule,
      policyVersion: POLICY_VERSION,
      prevHash
    }
    return { event: { ...unhashed, hash: hashAuditEvent(unhashed) }, segmentId }
  }
}
