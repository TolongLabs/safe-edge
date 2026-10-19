import {
  PatrolPlan,
  type Patrol,
  type PatrolPlanner,
  type Segment,
  type SegmentCoverage,
  type Task,
  type ThirdParty
} from '@safe-edge/contracts'
import { canonicalJson } from '../audit.ts'
import { passesQualityGate } from '../policy.ts'
import type { Tx } from '../store.ts'
import { ok, type Handlers } from './handler.ts'

/** Coverage lengths are float sums in metres: a micrometre either way is rounding, not coverage. */
const ROUNDING_M = 1e-6

type PatrolOperation =
  'createPatrolPlan' | 'approvePatrolPlan' | 'releasePlanHold' | 'startPatrol' | 'completePatrol' | 'recordObservation'

/** `thirdParties` are the ones the site records (the seed's); a create-plan request may report more. */
export const patrolHandlers = (
  planner: PatrolPlanner | undefined,
  thirdParties: ThirdParty[]
): Handlers<PatrolOperation> => ({
  createPatrolPlan: (tx, { body }) => {
    const dock = tx.get('docks', body.dockId)
    if (!dock) return tx.notFound(`No dock ${body.dockId}`)
    const droneProfile = tx.get('droneProfiles', body.droneProfileId)
    if (!droneProfile) return tx.notFound(`No drone profile ${body.droneProfileId}`)
    const segments: Segment[] = []
    for (const id of body.segmentIds) {
      const segment = tx.get('segments', id)
      if (!segment) return tx.notFound(`No segment ${id}`)
      segments.push(segment)
    }
    const supersedes = body.replan?.supersedes ?? null
    const previous = supersedes && tx.get('patrolPlans', supersedes.planId)
    if (supersedes && !previous) return tx.notFound(`No patrol plan ${supersedes.planId}`)
    if (supersedes && previous) {
      const next = supersededBy(tx, previous)
      if (next) return tx.deny('invalid_transition', `${previous.id} was already re-planned as ${next.id}`, previous.id)
      if (supersedes.committedTasks > previous.tasks.length) {
        const message = `${previous.id} has ${previous.tasks.length} stops, so ${supersedes.committedTasks} cannot be committed`
        return tx.deny('invalid_transition', message, previous.id)
      }
    }
    if (planner === undefined) throw new Error('createPatrolPlan needs a planner: pass one to createCore({ planner })')
    const ids = new Set(body.segmentIds)
    const id = tx.id('plan')
    // The planner is outside core, so its output is checked against the contract and the approval gate first.
    const plan = PatrolPlan.parse(
      planner({
        id,
        now: tx.now,
        request: body,
        previous: previous ?? null,
        dock,
        droneProfile,
        segments,
        passes: segments.flatMap((s) => (s.passId === null ? [] : [tx.must('passes', s.passId)])),
        findings: tx.all('findings').filter((f) => ids.has(f.segmentId)),
        thirdParties: [...thirdParties, ...(body.thirdParties ?? []).map((p) => ({ ...p, source: tx.source }))]
      })
    )
    if (plan.id !== id || plan.status !== 'proposed' || plan.approvedBy !== null || plan.approvedAt !== null) {
      throw new Error(`The planner must return ${id} proposed and unapproved; it returned ${plan.id} ${plan.status}`)
    }
    if (canonicalJson(plan.replan) !== canonicalJson(body.replan ?? null)) {
      throw new Error(`The planner must record the requested re-plan on ${id}`)
    }
    tx.put('patrolPlans', plan)
    tx.emit('edge.patrol.planned.v1', {
      planId: plan.id,
      segmentIds: plan.tasks.map((t) => t.segmentId),
      simulated: plan.simulated
    })
    return ok(plan)
  },

  approvePatrolPlan: (tx, { params }) => {
    const plan = tx.get('patrolPlans', params.id)
    if (!plan) return tx.notFound(`No patrol plan ${params.id}`)
    if (plan.status !== 'proposed')
      return tx.deny('invalid_transition', `${plan.id} is already ${plan.status}`, plan.id)
    const next = supersededBy(tx, plan)
    if (next)
      return tx.deny('plan_superseded', `${plan.id} was re-planned as ${next.id}; approve that instead`, plan.id)
    const approved = { ...plan, status: 'approved' as const, approvedBy: tx.actor.id, approvedAt: tx.now }
    tx.put('patrolPlans', approved)
    return ok(approved)
  },

  // The planner never releases a hold; the pilot records what they or their observer saw. Audited like any write.
  releasePlanHold: (tx, { params }) => {
    const plan = tx.get('patrolPlans', params.id)
    if (!plan) return tx.notFound(`No patrol plan ${params.id}`)
    // `dock` names the take-off and landing hold, the separation hold without a segment.
    const at = params.segmentId === 'dock' ? null : params.segmentId
    const index = plan.holds.findIndex((h) => h.kind === 'separation' && h.segmentId === at)
    if (index < 0) return tx.notFound(`${plan.id} has no separation hold on ${params.segmentId}`)
    const hold = plan.holds[index]!
    if (hold.releasedBy !== null) {
      const message = `${plan.id}'s hold on ${params.segmentId} was released by ${hold.releasedBy} at ${hold.releasedAt}`
      return tx.deny('invalid_transition', message, plan.id)
    }
    const released = {
      ...plan,
      holds: plan.holds.with(index, { ...hold, releasedBy: tx.actor.id, releasedAt: tx.now })
    }
    tx.put('patrolPlans', released)
    return ok(released)
  },

  startPatrol: (tx, { body }) => {
    const plan = tx.get('patrolPlans', body.planId)
    if (!plan) return tx.notFound(`No patrol plan ${body.planId}`)
    if (plan.status !== 'approved') {
      return tx.deny('plan_not_approved', `${plan.id} needs a pilot's approval before it can fly`, plan.id)
    }
    const next = supersededBy(tx, plan)
    if (next) return tx.deny('plan_superseded', `${plan.id} was re-planned as ${next.id}; fly that instead`, plan.id)
    // Weather and lightning holds stop the launch until they end; separation holds on segments wait there in flight.
    const launchHolds = plan.holds.filter(
      (h) => h.segmentId === null && h.until !== null && Date.parse(tx.now) < Date.parse(h.until)
    )
    if (launchHolds.length > 0) {
      const holds = launchHolds.map((h) => `${h.kind} hold until ${h.until}: ${h.reason}`).join('; ')
      return tx.deny('weather_hold', `${plan.id} cannot launch yet: ${holds}`, plan.id)
    }
    // People within 30 m of the dock hold the take-off until the pilot records the dock clear.
    const dockHold = plan.holds.find((h) => h.kind === 'separation' && h.segmentId === null && h.releasedBy === null)
    if (dockHold) return tx.deny('separation_hold', `${plan.id} cannot take off yet: ${dockHold.reason}`, plan.id)
    // The agreed window: from its start, up to (not at) its end, and landing before the end.
    const now = Date.parse(tx.now)
    if (now < Date.parse(plan.window.start) || now >= Date.parse(plan.window.end)) {
      const message = `${plan.id} flies from ${plan.window.start} until ${plan.window.end}; it is ${tx.now}`
      return tx.deny('outside_window', message, plan.id)
    }
    const [takeoff, landing] = [plan.waypoints[0], plan.waypoints.at(-1)]
    const flightMs = takeoff && landing ? Date.parse(landing.eta) - Date.parse(takeoff.eta) : 0
    if (now + flightMs >= Date.parse(plan.window.end)) {
      const landsAt = new Date(now + flightMs).toISOString()
      const message = `${plan.id} would land at ${landsAt}, after its window closes at ${plan.window.end}`
      return tx.deny('outside_window', message, plan.id)
    }
    const patrol: Patrol = {
      id: tx.id('ptl'),
      planId: plan.id,
      provider: body.provider,
      droneId: body.droneId,
      pilotUserId: tx.actor.id,
      status: 'in_flight',
      startedAt: tx.now,
      completedAt: null,
      coverage: [],
      simulated: plan.simulated,
      source: tx.source
    }
    tx.put('patrols', patrol)
    tx.emit('edge.patrol.started.v1', { patrolId: patrol.id, planId: plan.id, simulated: patrol.simulated })
    return ok(patrol)
  },

  completePatrol: (tx, { params, body }) => {
    const patrol = tx.get('patrols', params.id)
    if (!patrol) return tx.notFound(`No patrol ${params.id}`)
    if (patrol.status !== 'in_flight')
      return tx.deny('invalid_transition', `${patrol.id} is already completed`, patrol.id)
    // Unknown is not inspected (TRD rule 4): every metre of a reported segment is inspected or unknown, so a report
    // naming a segment twice or claiming more than its length is refused, and any length it leaves out is unknown.
    const reported = new Set<string>()
    const covered: SegmentCoverage[] = []
    for (const c of body.coverage) {
      const segment = tx.get('segments', c.segmentId)
      if (!segment) return tx.notFound(`No segment ${c.segmentId}`)
      if (reported.has(segment.id)) {
        return tx.deny('invalid_coverage', `${segment.id} is reported twice on ${patrol.id}`, patrol.id)
      }
      reported.add(segment.id)
      const claimed = c.inspectedM + c.unknownM
      if (claimed > segment.lengthM + ROUNDING_M) {
        const message = `${patrol.id} reports ${claimed} m of ${segment.id}, which is ${segment.lengthM} m long`
        return tx.deny('invalid_coverage', message, patrol.id)
      }
      const left = segment.lengthM - claimed
      covered.push(left > ROUNDING_M ? { ...c, unknownM: segment.lengthM - c.inspectedM } : c)
    }
    // A planned segment the drone did not report on is unknown along its whole length, never inspected.
    const unreported: SegmentCoverage[] = tx
      .must('patrolPlans', patrol.planId)
      .tasks.filter((t) => !reported.has(t.segmentId))
      .map((t) => ({ segmentId: t.segmentId, inspectedM: 0, unknownM: tx.must('segments', t.segmentId).lengthM }))
    const coverage = [...covered, ...unreported]
    const completed: Patrol = { ...patrol, status: 'completed', completedAt: tx.now, coverage }
    tx.put('patrols', completed)
    // Inspecting a whole segment restarts its patrol interval and does a whole-segment recapture asked for before
    // take-off. Part of one does neither: its unknown rest gets a field check, and the patrol is still due.
    for (const c of coverage.filter((c) => c.unknownM === 0)) {
      tx.put('segments', { ...tx.must('segments', c.segmentId), lastPatrolledAt: tx.now })
      const tookOff = Date.parse(patrol.startedAt)
      closeRecaptures(tx, c.segmentId, (t) => t.viewpointId === null && Date.parse(t.createdAt) <= tookOff)
    }
    for (const c of coverage.filter((c) => c.unknownM > 0)) {
      const segment = tx.must('segments', c.segmentId)
      const task: Task = {
        id: tx.id('task'),
        kind: 'field_check',
        segmentId: segment.id,
        viewpointId: null,
        candidateId: null,
        findingId: null,
        assigneeUserId: tx.must('assets', segment.assetId).custodianUserId,
        status: 'open',
        reason: `${c.unknownM} m of ${segment.name} was not seen on ${patrol.id}; unknown is not inspected`,
        dueAt: null,
        createdAt: tx.now,
        simulated: patrol.simulated,
        source: tx.source
      }
      tx.put('tasks', task)
    }
    tx.emit('edge.patrol.completed.v1', { patrolId: patrol.id, planId: patrol.planId, simulated: patrol.simulated })
    return ok(completed)
  },

  recordObservation: (tx, { body }) => {
    const segment = tx.get('segments', body.segmentId)
    if (!segment) return tx.notFound(`No segment ${body.segmentId}`)
    if (!segment.viewpoints.some((v) => v.id === body.viewpointId)) {
      return tx.notFound(`Segment ${segment.id} has no viewpoint ${body.viewpointId}`)
    }
    if (body.patrolId !== null && !tx.get('patrols', body.patrolId)) return tx.notFound(`No patrol ${body.patrolId}`)
    const observation = { id: tx.id('obs'), ...body, source: tx.source }
    tx.put('observations', observation)
    // A frame taken since a recapture was asked for is the re-shoot, unless the privacy gate discarded it or it fails
    // the quality gate: low quality means recapture.
    if (observation.privacyAction !== 'discarded' && passesQualityGate(observation.quality)) {
      const takenAt = Date.parse(observation.capturedAt)
      closeRecaptures(
        tx,
        segment.id,
        (t) =>
          (t.viewpointId === null || t.viewpointId === observation.viewpointId) && takenAt >= Date.parse(t.createdAt)
      )
    }
    return ok(observation)
  }
})

/** Marks done the open recapture tasks on a segment that a new capture covers: its viewpoint's, or the segment's. */
function closeRecaptures(tx: Tx, segmentId: string, covers: (task: Task) => boolean): void {
  for (const task of tx.all('tasks')) {
    if (task.kind === 'recapture' && task.status === 'open' && task.segmentId === segmentId && covers(task)) {
      tx.put('tasks', { ...task, status: 'done' })
    }
  }
}

/** The re-plan that replaced `plan`, if any. A superseded plan is never approved or flown. */
const supersededBy = (tx: Tx, plan: PatrolPlan) =>
  tx.all('patrolPlans').find((p) => p.replan?.supersedes?.planId === plan.id)
