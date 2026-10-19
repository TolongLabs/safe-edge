import { describe, expect, test } from 'bun:test'
import type { EdgeEvent } from '@safe-edge/contracts'
import { verifyAuditChain } from '@safe-edge/core'
import { join } from 'node:path'
import { SafeEdgeApiError, SafeEdgeDeniedError, createElminaPlanner, createSafeEdgeClient } from '../src/index.ts'
import { S1, playS1toS3 } from './story.ts'

/** A memory client on a scenario clock, as the scenario player (#64) creates it. */
function startDemo() {
  let now = '2026-10-20T00:00:00.000Z'
  const demo = createSafeEdgeClient({ transport: 'memory', userId: 'usr_manager', clock: { now: () => now } })
  const stage = { as: (userId: string) => demo.as(userId), setNow: (iso: string) => (now = iso) }
  return { demo, stage }
}

describe('memory transport: the core in the browser on the labelled seed', () => {
  test('every seeded record a demo user reads is labelled a simulated fixture', async () => {
    const demo = createSafeEdgeClient({ transport: 'memory', userId: 'usr_manager' })
    const reads = [
      ...(await demo.listUsers()),
      ...(await demo.listAssets()),
      ...(await demo.listSegments()),
      ...(await demo.listPasses()),
      ...(await demo.listDocks()),
      ...(await demo.listDroneProfiles())
    ]
    expect((await demo.listSegments()).length).toBe(47)
    expect(reads.length).toBeGreaterThan(100)
    for (const record of reads)
      expect({ id: record.id, simulated: record.simulated, source: record.source }).toEqual({
        id: record.id,
        simulated: true,
        source: 'fixture'
      })
  })

  test('S1 to S3 as the demo users issues a valid pass, and subscribers see every core event in order', async () => {
    const { demo, stage } = startDemo()
    const seen: EdgeEvent[] = []
    demo.subscribe((event) => seen.push(event))

    const { retest } = await playS1toS3(stage)

    expect(retest.pass).toMatchObject({
      segmentId: S1.segmentId,
      state: 'valid',
      validTo: '2027-10-23T01:00:00.000Z',
      issuedBy: 'usr_reviewer',
      simulated: true
    })
    expect(seen.map((e) => e.type)).toEqual([
      'edge.candidate.raised.v1',
      'edge.pass.suspended.v1',
      'edge.candidate.decided.v1',
      'edge.work_order.drafted.v1',
      'edge.work_order.submitted.v1',
      'edge.repair.completed.v1',
      'edge.retest.recorded.v1',
      'edge.pass.issued.v1'
    ])
    expect(seen.every((e) => e.subject === `segments/${S1.segmentId}` && e.data.simulated)).toBe(true)
    const segment = await demo.as('usr_gm').getSegment({ params: { id: S1.segmentId } })
    // The seeded pass stays labelled a fixture after a real re-test moves it.
    expect(segment.pass).toMatchObject({ state: 'valid', source: 'fixture', simulated: true })
    const audit = await demo.listAudit()
    expect(audit.map((e) => e.actor.id)).toContain('usr_reviewer')
    expect(verifyAuditChain(audit)).toMatchObject({ ok: true, length: audit.length })
  })

  test('a refused action throws a typed 403 error naming the rule, and the refusal is on the audit chain', async () => {
    const { demo, stage } = startDemo()
    const { workOrderId } = await playS1toS3(stage)

    const agentSubmit = demo.as('usr_agent').submitWorkOrder({
      params: { id: workOrderId },
      body: { installerUserId: 'usr_installer', dueAt: '2026-10-24T09:00:00.000Z' }
    })
    await expect(agentSubmit).rejects.toBeInstanceOf(SafeEdgeDeniedError)
    await expect(agentSubmit).rejects.toMatchObject({ status: 403, rule: 'agents_draft_only' })

    const installerDecides = demo.as('usr_installer').decideCandidate({
      params: { id: 'cand_1' },
      body: { decision: 'reject', reason: 'Looks fine to me' }
    })
    await expect(installerDecides).rejects.toMatchObject({ status: 403, rule: 'role_forbidden' })

    const denied = (await demo.listAudit()).filter((e) => e.decision === 'denied')
    expect(denied.map((e) => [e.actor.id, e.action, e.subjectId])).toEqual([
      ['usr_agent', 'submitWorkOrder', workOrderId],
      ['usr_installer', 'decideCandidate', 'cand_1']
    ])
  })

  test('a missing record and a malformed input throw typed 404 and 400 errors, as over HTTP', async () => {
    const { demo } = startDemo()
    const missing = demo.getFinding({ params: { id: 'fnd_404' } })
    await expect(missing).rejects.toBeInstanceOf(SafeEdgeApiError)
    await expect(missing).rejects.toMatchObject({ status: 404, error: 'not_found' })
    const malformed = demo.getSegment({ params: { id: 'not-a-segment' } })
    await expect(malformed).rejects.toMatchObject({ status: 400, error: 'invalid_input' })
  })

  test('Reset demo restores the seeded records and an empty audit chain, for every user and subscriber', async () => {
    const { demo, stage } = startDemo()
    const before = { segments: await demo.listSegments(), passes: await demo.listPasses() }
    const firstRun = await playS1toS3(stage)
    const firstAudit = await demo.listAudit()
    expect(firstAudit.length).toBeGreaterThan(20)

    await expect(demo.as('usr_agent').resetDemo()).rejects.toMatchObject({ status: 403, rule: 'agents_draft_only' })
    const seen: EdgeEvent[] = []
    demo.subscribe((event) => seen.push(event))
    expect(await demo.as('usr_installer').resetDemo()).toEqual({ reset: true })

    // Every client of the demo sees the seed again: the S1 pass is back to its fixture state, nothing was raised.
    expect(await demo.listAudit()).toEqual([])
    expect(await demo.listSegments()).toEqual(before.segments)
    expect(await demo.as('usr_gm').listPasses()).toEqual(before.passes)
    const s1Pass = before.passes.find((p) => p.segmentId === S1.segmentId)!
    expect(s1Pass).toMatchObject({ state: 'valid', validTo: '2027-04-15T02:00:00.000Z', source: 'fixture' })
    expect(await demo.listCandidates()).toEqual([])
    expect(await demo.listFindings()).toEqual([])
    expect(seen).toEqual([])

    // Replaying gives the same IDs and the same audit chain as the first run, and subscribers still hear it.
    const secondRun = await playS1toS3(stage)
    expect(secondRun.decision.finding!.id).toBe(firstRun.decision.finding!.id)
    expect(await demo.listAudit()).toEqual(firstAudit)
    expect(seen.length).toBe(8)
  })

  test('with the Elmina planner injected, a planned patrol is proposed and only the pilot can approve it', async () => {
    // The browser fetches the layers; here Bun reads them from the repo.
    const repoRoot = join(import.meta.dir, '../../..')
    const planner = await createElminaPlanner((path) => Bun.file(join(repoRoot, path)).json(), { thirdParties: [] })
    const demo = createSafeEdgeClient({ transport: 'memory', userId: 'usr_manager', planner })
    const seen: string[] = []
    demo.subscribe((event) => seen.push(event.type))

    const plan = await demo.createPatrolPlan({
      body: {
        dockId: 'dock_elmina_roof',
        droneProfileId: 'drn_assumed',
        segmentIds: [S1.segmentId, 'seg_866518980_5'],
        context: [],
        notBefore: '2026-10-21T23:30:00.000Z',
        altitudeCapM: 60
      }
    })
    expect(plan).toMatchObject({ id: 'plan_1', status: 'proposed', approvedBy: null, simulated: true })
    expect(plan.tasks.map((t) => t.segmentId).toSorted()).toEqual([S1.segmentId, 'seg_866518980_5'].toSorted())
    expect(seen).toEqual(['edge.patrol.planned.v1'])

    await expect(demo.as('usr_agent').approvePatrolPlan({ params: { id: plan.id } })).rejects.toMatchObject({
      rule: 'agents_draft_only'
    })
    expect(await demo.as('usr_pilot').approvePatrolPlan({ params: { id: plan.id } })).toMatchObject({
      status: 'approved',
      approvedBy: 'usr_pilot'
    })
  })
})
