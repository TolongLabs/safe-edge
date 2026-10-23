import { afterAll, describe, expect, test } from 'bun:test'
import {
  Candidate,
  CandidateDecision,
  DamageReport,
  DamageReportList,
  EdgePass,
  EvidenceRef,
  Finding,
  Observation,
  WorkOrder
} from '@safe-edge/contracts'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { devTokens } from '../src/tokens.ts'
import { startApiProcess } from './process.ts'
import { S1, seed, startApi, type Api } from './support.ts'

// FF D8 FF E0 followed by "safe-edge", as in evidence.test.ts.
const PHOTO_BASE64 = '/9j/4HNhZmUtZWRnZQ=='
const PASS_ID = `pass_${S1.segmentId.slice('seg_'.length)}`

async function createObservation(
  api: Api,
  segmentId: string = S1.segmentId,
  viewpointId: string = S1.viewpointId
): Promise<Observation> {
  const capturedAt = '2026-10-20T08:00:00.000Z'
  const photoRes = await api.request('post', '/evidence', {
    token: 'tok_crew',
    body: {
      mediaType: 'image/jpeg',
      dataBase64: PHOTO_BASE64,
      capturedAt,
      simulated: true
    }
  })
  expect(photoRes.status).toBe(201)
  const photo = EvidenceRef.parse(await photoRes.json())

  const viewpoint = seed.segments.find((s) => s.id === segmentId)!.viewpoints.find((v) => v.id === viewpointId)!
  const obsRes = await api.request('post', '/observations', {
    token: 'tok_crew',
    body: {
      patrolId: null,
      segmentId,
      viewpointId,
      captureSource: 'phone',
      image: photo,
      pose: viewpoint.pose,
      capturedAt,
      quality: { sharpness: 0.9, alignmentResidualPx: 2, occlusion: 0 },
      privacyAction: 'none',
      simulated: true
    }
  })
  expect(obsRes.status).toBe(201)
  return Observation.parse(await obsRes.json())
}

describe('Damage reporting HTTP integration tests (#219-226)', () => {
  test('rich reportDamage persists a DamageReport linked to candidate, suspends valid pass, and gives fields/provenance', async () => {
    const api = startApi()
    const obs = await createObservation(api)

    // Verify initial pass is valid
    const initialPassRes = await api.request('get', `/passes/${PASS_ID}`, { token: 'tok_manager' })
    expect(initialPassRes.status).toBe(200)
    const initialPass = EdgePass.parse(await initialPassRes.json())
    expect(initialPass.state).toBe('valid')

    const richInput = {
      segmentId: S1.segmentId,
      observationIds: [obs.id],
      inventoryItemId: S1.inventoryItemId,
      itemStatus: 'missing' as const,
      class: 'inventory_item' as const,
      rationale: 'Fence panel 4 is broken and leaning over path',
      simulated: true,
      report: {
        description: 'Fence panel 4 has snapped brackets and leans over path',
        observedAt: '2026-10-20T08:15:00.000Z',
        issueType: 'fence_damaged' as const,
        urgency: 'high' as const,
        viewpointId: S1.viewpointId,
        where: {
          lat: 3.12345,
          lon: 101.56789,
          accuracyM: 1.5,
          source: 'phone' as const,
          note: 'Near playground approach'
        },
        timeSource: 'capture' as const,
        action: 'repair' as const,
        actionNote: 'Welding or replacement brackets required',
        cause: 'vandalism' as const
      }
    }

    const reportRes = await api.request('post', '/damage-reports', {
      token: 'tok_crew',
      body: richInput
    })
    expect(reportRes.status).toBe(201)
    const candidate = Candidate.parse(await reportRes.json())
    expect(candidate.id).toMatch(/^cand_/)
    expect(candidate.tier).toBe(2)
    expect(candidate.status).toBe('candidate')

    // Pass is suspended
    const passAfterRes = await api.request('get', `/passes/${PASS_ID}`, { token: 'tok_manager' })
    expect(passAfterRes.status).toBe(200)
    const passAfter = EdgePass.parse(await passAfterRes.json())
    expect(passAfter.state).toBe('suspended')
    expect(passAfter.stateReason).toContain(`Damage report ${candidate.id}`)

    // Query GET /damage-reports by candidateId
    const listRes = await api.request('get', `/damage-reports?candidateId=${candidate.id}`, {
      token: 'tok_crew'
    })
    expect(listRes.status).toBe(200)
    const list = DamageReportList.parse(await listRes.json())
    expect(list.length).toBe(1)
    const report = list[0]

    expect(report.id).toMatch(/^drpt_/)
    expect(report.candidateId).toBe(candidate.id)
    expect(report.segmentId).toBe(S1.segmentId)
    expect(report.viewpointId).toBe(S1.viewpointId)
    expect(report.observationIds).toEqual([obs.id])
    expect(report.reportedBy).toBe('usr_crew')
    expect(report.description).toBe('Fence panel 4 has snapped brackets and leans over path')
    expect(report.observedAt).toBe('2026-10-20T08:15:00.000Z')
    expect(report.timeSource).toBe('capture')
    expect(report.issueType).toBe('fence_damaged')
    expect(report.issueTypeOther).toBeNull()
    expect(report.action).toBe('repair')
    expect(report.actionNote).toBe('Welding or replacement brackets required')
    expect(report.urgency).toBe('high')
    expect(report.cause).toBe('vandalism')
    expect(report.where).toEqual({
      lat: 3.12345,
      lon: 101.56789,
      accuracyM: 1.5,
      source: 'phone',
      note: 'Near playground approach'
    })
    expect(report.costEstimate).toBeNull()
    expect(report.prevention).toEqual({ steps: [], other: null })
    expect(report.simulated).toBe(true)
    expect(report.source).toBe('user')

    // Read by GET /damage-reports/{id}
    const getRes = await api.request('get', `/damage-reports/${report.id}`, { token: 'tok_manager' })
    expect(getRes.status).toBe(200)
    const single = DamageReport.parse(await getRes.json())
    expect(single).toEqual(report)

    // Filter by segmentId
    const segmentListRes = await api.request('get', `/damage-reports?segmentId=${S1.segmentId}`, {
      token: 'tok_manager'
    })
    expect(segmentListRes.status).toBe(200)
    const segmentList = DamageReportList.parse(await segmentListRes.json())
    expect(segmentList.some((r) => r.id === report.id)).toBe(true)

    // Filter by reportedBy
    const userListRes = await api.request('get', `/damage-reports?reportedBy=usr_crew`, {
      token: 'tok_manager'
    })
    expect(userListRes.status).toBe(200)
    const userList = DamageReportList.parse(await userListRes.json())
    expect(userList.some((r) => r.id === report.id)).toBe(true)

    // Manager can confirm candidate, causing finding and workorder
    const decideRes = await api.request('post', `/candidates/${candidate.id}/decision`, {
      token: 'tok_manager',
      body: { decision: 'confirm', severity: 'high' }
    })
    expect(decideRes.status).toBe(200)
    const decision = CandidateDecision.parse(await decideRes.json())
    expect(decision.candidate.status).toBe('confirmed')
    expect(decision.finding).not.toBeNull()
    expect(decision.finding?.candidateId).toBe(candidate.id)
    expect(decision.workOrder).not.toBeNull()
    expect(decision.workOrder?.findingId).toBe(decision.finding?.id)

    // Human report urgency must remain chosen enum after decision
    const reportAfterDecisionRes = await api.request('get', `/damage-reports/${report.id}`, {
      token: 'tok_manager'
    })
    expect(reportAfterDecisionRes.status).toBe(200)
    const reportAfterDecision = DamageReport.parse(await reportAfterDecisionRes.json())
    expect(reportAfterDecision.urgency).toBe('high')
    expect(reportAfterDecision.costEstimate).toBeNull()
  })

  test('human actor only: crew and manager allowed; agents and other roles refused 403', async () => {
    const api = startApi()
    const obs = await createObservation(api)

    const payload = {
      segmentId: S1.segmentId,
      observationIds: [obs.id],
      inventoryItemId: S1.inventoryItemId,
      itemStatus: 'missing' as const,
      class: 'inventory_item' as const,
      rationale: 'Checking role access',
      simulated: true,
      report: {
        description: 'Checking role access',
        observedAt: '2026-10-20T08:00:00.000Z',
        issueType: 'fence_missing' as const,
        urgency: 'medium' as const
      }
    }

    // Agent is refused
    const agentRes = await api.request('post', '/damage-reports', {
      token: 'tok_agent',
      body: payload
    })
    expect(agentRes.status).toBe(403)
    const agentBody = await agentRes.json()
    expect(agentBody).toMatchObject({ ok: false, rule: 'agents_draft_only' })

    // Agent read-only is refused
    const agentRoRes = await api.request('post', '/damage-reports', {
      token: 'tok_agent_read_only',
      body: payload
    })
    expect(agentRoRes.status).toBe(403)

    // Engineer role is refused
    const engineerRes = await api.request('post', '/damage-reports', {
      token: 'tok_engineer',
      body: payload
    })
    expect(engineerRes.status).toBe(403)
    const engineerBody = await engineerRes.json()
    expect(engineerBody).toMatchObject({ ok: false, rule: 'role_forbidden' })

    // Provider role is refused
    const providerRes = await api.request('post', '/damage-reports', {
      token: 'tok_provider',
      body: payload
    })
    expect(providerRes.status).toBe(403)

    // Manager is allowed
    const managerRes = await api.request('post', '/damage-reports', {
      token: 'tok_manager',
      body: payload
    })
    expect(managerRes.status).toBe(201)

    // Crew is allowed
    const crewRes = await api.request('post', '/damage-reports', {
      token: 'tok_crew',
      body: payload
    })
    expect(crewRes.status).toBe(201)
  })

  test('read access: any role and scoped agents can read; unscoped agent is refused 403', async () => {
    const customTokens = await devTokens(
      {
        SAFE_EDGE_DEV_TOKENS: JSON.stringify(
          Object.fromEntries(seed.users.map((user) => [`tok_${user.role}`, user.id]))
        )
      },
      seed.users
    )
    customTokens.set('tok_agent_unscoped', { type: 'agent', id: 'usr_agent', role: 'agent', scopes: [] })
    customTokens.set('tok_agent_edge_read', { type: 'agent', id: 'usr_agent', role: 'agent', scopes: ['edge.read'] })
    customTokens.set('tok_agent_inspection_read', {
      type: 'agent',
      id: 'usr_agent',
      role: 'agent',
      scopes: ['inspection.read']
    })

    const api = startApi({ tokens: customTokens })
    const obs = await createObservation(api)
    const reportRes = await api.request('post', '/damage-reports', {
      token: 'tok_crew',
      body: {
        segmentId: S1.segmentId,
        observationIds: [obs.id],
        inventoryItemId: S1.inventoryItemId,
        itemStatus: 'missing' as const,
        class: 'inventory_item' as const,
        rationale: 'Read access check',
        simulated: true,
        report: {
          description: 'Read access check',
          observedAt: '2026-10-20T08:00:00.000Z',
          issueType: 'fence_damaged' as const,
          urgency: 'low' as const
        }
      }
    })
    expect(reportRes.status).toBe(201)
    const cand = await reportRes.json()
    const list = await (
      await api.request('get', `/damage-reports?candidateId=${cand.id}`, { token: 'tok_crew' })
    ).json()
    const reportId = list[0].id

    // Engineer can read (roles: 'any')
    const engRes = await api.request('get', `/damage-reports/${reportId}`, { token: 'tok_engineer' })
    expect(engRes.status).toBe(200)

    // Agent with all scopes (tok_agent) can read
    const agentRes = await api.request('get', `/damage-reports/${reportId}`, { token: 'tok_agent' })
    expect(agentRes.status).toBe(200)

    // Agent with inspection.read can read
    const agentRoRes = await api.request('get', `/damage-reports/${reportId}`, {
      token: 'tok_agent_inspection_read'
    })
    expect(agentRoRes.status).toBe(200)

    // Agent with only edge.read is refused 403 (needs inspection.read)
    const agentEdgeRes = await api.request('get', `/damage-reports/${reportId}`, {
      token: 'tok_agent_edge_read'
    })
    expect(agentEdgeRes.status).toBe(403)
    const agentEdgeBody = await agentEdgeRes.json()
    expect(agentEdgeBody).toMatchObject({ ok: false, rule: 'scope_missing' })

    // Agent without any scope is refused 403
    const agentUnscopedRes = await api.request('get', `/damage-reports/${reportId}`, {
      token: 'tok_agent_unscoped'
    })
    expect(agentUnscopedRes.status).toBe(403)
    const agentUnscopedBody = await agentUnscopedRes.json()
    expect(agentUnscopedBody).toMatchObject({ ok: false, rule: 'scope_missing' })

    // Non-existent report returns 404
    const notFoundRes = await api.request('get', '/damage-reports/drpt_nonexistent', {
      token: 'tok_manager'
    })
    expect(notFoundRes.status).toBe(404)
  })

  test('old request with no report remains valid with default/null rich fields', async () => {
    const api = startApi()
    const legacyPayload = {
      segmentId: S1.segmentId,
      observationIds: [],
      inventoryItemId: S1.inventoryItemId,
      itemStatus: 'missing' as const,
      class: 'inventory_item' as const,
      rationale: 'Legacy report without rich report object',
      simulated: true
    }

    const reportRes = await api.request('post', '/damage-reports', {
      token: 'tok_crew',
      body: legacyPayload
    })
    expect(reportRes.status).toBe(201)
    const candidate = Candidate.parse(await reportRes.json())
    expect(candidate.tier).toBe(2)

    const listRes = await api.request('get', `/damage-reports?candidateId=${candidate.id}`, {
      token: 'tok_manager'
    })
    expect(listRes.status).toBe(200)
    const list = DamageReportList.parse(await listRes.json())
    expect(list.length).toBe(1)
    const report = list[0]

    expect(report.candidateId).toBe(candidate.id)
    expect(report.description).toBe('Legacy report without rich report object')
    expect(report.observedAt).toBeNull()
    expect(report.timeSource).toBeNull()
    expect(report.issueType).toBeNull()
    expect(report.issueTypeOther).toBeNull()
    expect(report.action).toBeNull()
    expect(report.actionNote).toBeNull()
    expect(report.urgency).toBeNull()
    expect(report.where).toBeNull()
    expect(report.cause).toBe('unknown')
    expect(report.prevention).toEqual({ steps: [], other: null })
    expect(report.costEstimate).toBeNull()
    expect(report.simulated).toBe(true)
    expect(report.source).toBe('user')
  })

  test('report validation: requires nonempty description, problemType, urgency, observedAt, and observation', async () => {
    const api = startApi()
    const obs = await createObservation(api)

    const baseValid = {
      segmentId: S1.segmentId,
      observationIds: [obs.id],
      inventoryItemId: S1.inventoryItemId,
      itemStatus: 'missing' as const,
      class: 'inventory_item' as const,
      rationale: 'Valid rationale',
      simulated: true,
      report: {
        description: 'Valid description',
        observedAt: '2026-10-20T08:00:00.000Z',
        issueType: 'fence_damaged' as const,
        urgency: 'high' as const
      }
    }

    // Empty description
    const emptyDesc = await api.request('post', '/damage-reports', {
      token: 'tok_crew',
      body: { ...baseValid, report: { ...baseValid.report, description: '' } }
    })
    expect(emptyDesc.status).toBe(400)

    // Whitespace description
    const wsDesc = await api.request('post', '/damage-reports', {
      token: 'tok_crew',
      body: { ...baseValid, report: { ...baseValid.report, description: '   ' } }
    })
    expect(wsDesc.status).toBe(400)

    // Missing issueType
    const { issueType: _discard1, ...noIssueType } = baseValid.report
    const missingIssue = await api.request('post', '/damage-reports', {
      token: 'tok_crew',
      body: { ...baseValid, report: noIssueType }
    })
    expect(missingIssue.status).toBe(400)

    // Invalid issueType enum
    const badIssue = await api.request('post', '/damage-reports', {
      token: 'tok_crew',
      body: { ...baseValid, report: { ...baseValid.report, issueType: 'unknown_problem' } }
    })
    expect(badIssue.status).toBe(400)

    // Missing urgency
    const { urgency: _discard2, ...noUrgency } = baseValid.report
    const missingUrgency = await api.request('post', '/damage-reports', {
      token: 'tok_crew',
      body: { ...baseValid, report: noUrgency }
    })
    expect(missingUrgency.status).toBe(400)

    // Invalid urgency enum
    const badUrgency = await api.request('post', '/damage-reports', {
      token: 'tok_crew',
      body: { ...baseValid, report: { ...baseValid.report, urgency: 'critical' } }
    })
    expect(badUrgency.status).toBe(400)

    // Missing observedAt
    const { observedAt: _discard3, ...noObservedAt } = baseValid.report
    const missingObservedAt = await api.request('post', '/damage-reports', {
      token: 'tok_crew',
      body: { ...baseValid, report: noObservedAt }
    })
    expect(missingObservedAt.status).toBe(400)

    // Invalid observedAt timestamp
    const badObservedAt = await api.request('post', '/damage-reports', {
      token: 'tok_crew',
      body: { ...baseValid, report: { ...baseValid.report, observedAt: 'not-a-timestamp' } }
    })
    expect(badObservedAt.status).toBe(400)

    // Report supplied with empty observations is rejected
    const noObs = await api.request('post', '/damage-reports', {
      token: 'tok_crew',
      body: { ...baseValid, observationIds: [] }
    })
    expect(noObs.status).toBe(400)
  })

  test('other type needs text: issueType "other" requires nonempty issueTypeOther', async () => {
    const api = startApi()
    const obs = await createObservation(api)

    const baseOther = {
      segmentId: S1.segmentId,
      observationIds: [obs.id],
      inventoryItemId: S1.inventoryItemId,
      itemStatus: 'missing' as const,
      class: 'inventory_item' as const,
      rationale: 'Other problem type',
      simulated: true,
      report: {
        description: 'Custom problem report',
        observedAt: '2026-10-20T08:00:00.000Z',
        issueType: 'other' as const,
        urgency: 'medium' as const,
        issueTypeOther: null
      }
    }

    // null issueTypeOther
    const nullOtherRes = await api.request('post', '/damage-reports', {
      token: 'tok_crew',
      body: baseOther
    })
    expect(nullOtherRes.status).toBe(400)

    // empty issueTypeOther
    const emptyOtherRes = await api.request('post', '/damage-reports', {
      token: 'tok_crew',
      body: { ...baseOther, report: { ...baseOther.report, issueTypeOther: '   ' } }
    })
    expect(emptyOtherRes.status).toBe(400)

    // valid text in issueTypeOther
    const validOtherRes = await api.request('post', '/damage-reports', {
      token: 'tok_crew',
      body: { ...baseOther, report: { ...baseOther.report, issueTypeOther: 'Fallen tree blocking fence line' } }
    })
    expect(validOtherRes.status).toBe(201)
    const candidate = Candidate.parse(await validOtherRes.json())

    const list = DamageReportList.parse(
      await (await api.request('get', `/damage-reports?candidateId=${candidate.id}`, { token: 'tok_crew' })).json()
    )
    expect(list[0].issueType).toBe('other')
    expect(list[0].issueTypeOther).toBe('Fallen tree blocking fence line')
  })

  test('urgency enum preservation across all allowed values', async () => {
    const api = startApi()
    const obs = await createObservation(api)

    for (const urgency of ['low', 'medium', 'high'] as const) {
      const res = await api.request('post', '/damage-reports', {
        token: 'tok_crew',
        body: {
          segmentId: S1.segmentId,
          observationIds: [obs.id],
          inventoryItemId: S1.inventoryItemId,
          itemStatus: 'missing' as const,
          class: 'inventory_item' as const,
          rationale: `Urgency test for ${urgency}`,
          simulated: true,
          report: {
            description: `Urgency test for ${urgency}`,
            observedAt: '2026-10-20T08:00:00.000Z',
            issueType: 'debris' as const,
            urgency
          }
        }
      })
      expect(res.status).toBe(201)
      const cand = Candidate.parse(await res.json())
      const list = DamageReportList.parse(
        await (await api.request('get', `/damage-reports?candidateId=${cand.id}`, { token: 'tok_crew' })).json()
      )
      expect(list[0].urgency).toBe(urgency)
    }
  })

  test('observation and viewpoint relation validation', async () => {
    const api = startApi()
    const obs = await createObservation(api)

    // Observation at nonexistent ID
    const badObsRes = await api.request('post', '/damage-reports', {
      token: 'tok_crew',
      body: {
        segmentId: S1.segmentId,
        observationIds: ['obs_nonexistent'],
        inventoryItemId: S1.inventoryItemId,
        itemStatus: 'missing' as const,
        class: 'inventory_item' as const,
        rationale: 'Bad obs',
        simulated: true,
        report: {
          description: 'Bad obs',
          observedAt: '2026-10-20T08:00:00.000Z',
          issueType: 'debris' as const,
          urgency: 'low' as const
        }
      }
    })
    expect(badObsRes.status).toBe(404)

    // Viewpoint nonexistent on segment
    const badVpRes = await api.request('post', '/damage-reports', {
      token: 'tok_crew',
      body: {
        segmentId: S1.segmentId,
        observationIds: [obs.id],
        inventoryItemId: S1.inventoryItemId,
        itemStatus: 'missing' as const,
        class: 'inventory_item' as const,
        rationale: 'Bad vp',
        simulated: true,
        report: {
          description: 'Bad vp',
          observedAt: '2026-10-20T08:00:00.000Z',
          issueType: 'debris' as const,
          urgency: 'low' as const,
          viewpointId: 'vp_nonexistent'
        }
      }
    })
    expect(badVpRes.status).toBe(404)
  })
})

describe('Manager-only setReportPrevention and restart durability', () => {
  test('manager-only setReportPrevention persists across actual API restart and nonmanager 403', async () => {
    const dataDir = await mkdtemp(join(tmpdir(), 'safe-edge-reports-'))
    afterAll(() => rm(dataDir, { recursive: true }))
    const env = { NODE_ENV: 'test', SAFE_EDGE_DATA_DIR: dataDir }

    // Start initial API process
    const first = await startApiProcess(env)

    // Upload photo and observation
    const capturedAt = '2026-10-20T08:00:00.000Z'
    const photoRes = await first.request('post', '/evidence', 'tok_crew', {
      mediaType: 'image/jpeg',
      dataBase64: PHOTO_BASE64,
      capturedAt,
      simulated: true
    })
    expect(photoRes.status).toBe(201)
    const photo = EvidenceRef.parse(await photoRes.json())

    const viewpoint = seed.segments.find((s) => s.id === S1.segmentId)!.viewpoints.find((v) => v.id === S1.viewpointId)!
    const obsRes = await first.request('post', '/observations', 'tok_crew', {
      patrolId: null,
      segmentId: S1.segmentId,
      viewpointId: S1.viewpointId,
      captureSource: 'phone',
      image: photo,
      pose: viewpoint.pose,
      capturedAt,
      quality: { sharpness: 0.9, alignmentResidualPx: 2, occlusion: 0 },
      privacyAction: 'none',
      simulated: true
    })
    expect(obsRes.status).toBe(201)
    const obs = Observation.parse(await obsRes.json())

    // Submit rich damage report
    const reportRes = await first.request('post', '/damage-reports', 'tok_crew', {
      segmentId: S1.segmentId,
      observationIds: [obs.id],
      inventoryItemId: S1.inventoryItemId,
      itemStatus: 'missing',
      class: 'inventory_item',
      rationale: 'Fence damaged by playground path',
      simulated: true,
      report: {
        description: 'Fence damaged by playground path',
        observedAt: '2026-10-20T08:00:00.000Z',
        issueType: 'fence_damaged',
        urgency: 'high',
        viewpointId: S1.viewpointId
      }
    })
    expect(reportRes.status).toBe(201)
    const candidate = Candidate.parse(await reportRes.json())

    const listRes = await first.request('get', `/damage-reports?candidateId=${candidate.id}`, 'tok_manager')
    expect(listRes.status).toBe(200)
    const list = DamageReportList.parse(await listRes.json())
    const reportId = list[0].id

    // Non-manager role (crew) gets 403 on setReportPrevention
    const crewPatchRes = await first.request('patch', `/damage-reports/${reportId}/prevention`, 'tok_crew', {
      steps: ['cctv'],
      other: null
    })
    expect(crewPatchRes.status).toBe(403)
    const crewPatchBody = await crewPatchRes.json()
    expect(crewPatchBody).toMatchObject({ ok: false, rule: 'role_forbidden' })

    // Agent gets 403 on setReportPrevention
    const agentPatchRes = await first.request('patch', `/damage-reports/${reportId}/prevention`, 'tok_agent', {
      steps: ['cctv'],
      other: null
    })
    expect(agentPatchRes.status).toBe(403)
    const agentPatchBody = await agentPatchRes.json()
    expect(agentPatchBody).toMatchObject({ ok: false, rule: 'agents_draft_only' })

    // Prevention validation: "other" step requires other text
    const invalidOtherPatch = await first.request('patch', `/damage-reports/${reportId}/prevention`, 'tok_manager', {
      steps: ['other'],
      other: null
    })
    expect(invalidOtherPatch.status).toBe(400)

    // Manager sets valid prevention steps
    const managerPatchRes = await first.request('patch', `/damage-reports/${reportId}/prevention`, 'tok_manager', {
      steps: ['patrols', 'cctv'],
      other: null
    })
    expect(managerPatchRes.status).toBe(200)
    const updated = DamageReport.parse(await managerPatchRes.json())
    expect(updated.prevention).toEqual({ steps: ['patrols', 'cctv'], other: null })

    // Kill the API process with SIGKILL (crash)
    await first.crash()

    // Start restarted API process on the same data directory
    const second = await startApiProcess(env)

    // Verify report and prevention persisted across actual restart
    const getAfterRestartRes = await second.request('get', `/damage-reports/${reportId}`, 'tok_manager')
    expect(getAfterRestartRes.status).toBe(200)
    const persistedReport = DamageReport.parse(await getAfterRestartRes.json())
    expect(persistedReport.id).toBe(reportId)
    expect(persistedReport.candidateId).toBe(candidate.id)
    expect(persistedReport.description).toBe('Fence damaged by playground path')
    expect(persistedReport.urgency).toBe('high')
    expect(persistedReport.prevention).toEqual({ steps: ['patrols', 'cctv'], other: null })
    expect(persistedReport.costEstimate).toBeNull()

    // Non-manager 403 still holds after restart
    const crewPatchAfterRestart = await second.request('patch', `/damage-reports/${reportId}/prevention`, 'tok_crew', {
      steps: ['guard'],
      other: null
    })
    expect(crewPatchAfterRestart.status).toBe(403)

    await second.crash()
  }, 30_000)
})
