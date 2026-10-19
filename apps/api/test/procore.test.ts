// A finding goes to SDP's defect system once a person submits its work order: the API hands each submitted work order,
// with its photo, to the workorder-procore adapter, and records the Observation ID on the work order. Drafts, the
// agent's included, stay in Safe Edge (INBOX-4: people edit and submit; the agent cannot). Procore here is the contract double
// (packages/providers/test/procore-double.ts), which accepts only the documented request shapes.
import { afterAll, expect, test } from 'bun:test'
import {
  AuditEvent,
  Candidate,
  CandidateDecision,
  EvidenceRef,
  Observation,
  Opening,
  Remedy,
  Task,
  WorkOrder
} from '@safe-edge/contracts'
import { ProcoreWorkOrderProvider } from '@safe-edge/providers'
import { startProcoreDouble } from '../../../packages/providers/test/procore-double.ts'
import { S1, seed, startApi, type Api } from './support.ts'

// FF D8 FF E0 followed by "safe-edge", as in evidence.test.ts.
const PHOTO_BASE64 = '/9j/4HNhZmUtZWRnZQ=='
const PHOTO = Uint8Array.from(atob(PHOTO_BASE64), (c) => c.charCodeAt(0))
const SAFETY_HAZARD_TYPE_ID = 69259

const credentials = { clientId: 'safe-edge-sandbox', clientSecret: 'sandbox-secret', companyId: 4271, projectId: 1234 }
const procore = startProcoreDouble(credentials)
afterAll(() => procore.stop())

/** Polls until `read` returns a value; the hand-off runs after the submitting request has answered. */
async function eventually<T>(read: () => T | undefined | Promise<T | undefined>): Promise<T> {
  const deadline = Date.now() + 3_000
  for (;;) {
    const value = await read()
    if (value !== undefined) return value
    if (Date.now() > deadline) throw new Error('Timed out waiting for the Procore hand-off')
    await Bun.sleep(10)
  }
}

async function post<T>(
  api: Api,
  path: string,
  token: `tok_${string}`,
  body: unknown,
  schema: { parse(v: unknown): T }
) {
  const response = await api.request('post', path, { token, body })
  expect(response.status).toBeLessThan(300)
  return schema.parse(await response.json())
}

async function tasksOf(api: Api, findingId: string) {
  const response = await api.request('get', '/tasks?status=open', { token: 'tok_manager' })
  return Task.array()
    .parse(await response.json())
    .filter((task) => task.findingId === findingId)
}

test('submitting a work order files a Procore Observation with its photo and links it; drafts stay in Safe Edge', async () => {
  const api = startApi({
    workOrders: (readEvidence) =>
      new ProcoreWorkOrderProvider({
        loginBaseUrl: procore.url,
        apiBaseUrl: procore.url,
        ...credentials,
        observationType: 'Safety Hazard',
        readEvidence
      })
  })

  // S1 by phone: the crew photographs the gap, the provider raises it, the manager confirms it.
  const photo = await post(
    api,
    '/evidence',
    'tok_crew',
    { mediaType: 'image/jpeg', dataBase64: PHOTO_BASE64, capturedAt: '2026-10-20T08:00:00.000Z', simulated: true },
    EvidenceRef
  )
  const viewpoint = seed.segments.find((s) => s.id === S1.segmentId)!.viewpoints.find((v) => v.id === S1.viewpointId)!
  const observation = await post(
    api,
    '/observations',
    'tok_crew',
    {
      patrolId: null,
      segmentId: S1.segmentId,
      viewpointId: S1.viewpointId,
      captureSource: 'phone',
      image: photo,
      pose: viewpoint.pose,
      capturedAt: '2026-10-20T08:00:00.000Z',
      quality: { sharpness: 0.9, alignmentResidualPx: 2, occlusion: 0 },
      privacyAction: 'none',
      simulated: true
    },
    Observation
  )
  const candidate = await post(
    api,
    '/candidates',
    'tok_provider',
    {
      segmentId: S1.segmentId,
      observationIds: [observation.id],
      inventoryItemId: S1.inventoryItemId,
      itemStatus: 'missing',
      class: 'inventory_item',
      score: 0.9,
      uncertainty: 'low',
      gridCell: 'B3',
      rationale: 'Fence panel 4 is missing by the playground path',
      model: null,
      simulated: true
    },
    Candidate
  )
  const { finding, workOrder } = await post(
    api,
    `/candidates/${candidate.id}/decision`,
    'tok_manager',
    { decision: 'confirm', severity: 'high' },
    CandidateDecision
  )

  // The agent drafts a second work order for the same finding. Neither draft goes anywhere.
  const agentDraft = await post(
    api,
    '/work-orders',
    'tok_agent',
    { findingId: finding!.id, remedyId: null, notes: 'Replace fence panel 4' },
    WorkOrder
  )

  // A person takes the manager's draft through the gates and submits it: interim protection, an approved remedy.
  await post(api, `/tasks/${(await tasksOf(api, finding!.id))[0]!.id}/complete`, 'tok_crew', undefined, Task)
  const gap = await post(
    api,
    '/openings',
    'tok_manager',
    {
      segmentId: S1.segmentId,
      type: 'fence_gap',
      photoMarks: [{ evidenceId: photo.id, x: 0.45, y: 0.6 }],
      measuredMm: 1200
    },
    Opening
  )
  const remedy = await post(
    api,
    '/remedies',
    'tok_engineer',
    {
      segmentId: S1.segmentId,
      type: 'panel_replacement',
      label: 'Replace panel 4',
      blocksOpeningIds: [gap.id],
      quantities: [{ item: 'Fence panel 2.4 m', amount: 1, unit: 'panel' }],
      acceptanceTest: 'No gap over 100 mm along the run',
      quote: 'quote_needed'
    },
    Remedy
  )
  await post(api, `/remedies/${remedy.id}/approve`, 'tok_engineer', undefined, Remedy)
  const edited = await api.request('patch', `/work-orders/${workOrder!.id}`, {
    token: 'tok_manager',
    body: { remedyId: remedy.id }
  })
  expect(edited.status).toBe(200)
  // Every draft so far was published before these requests ran, and none reached Procore.
  expect(procore.observations).toEqual([])

  await post(
    api,
    `/work-orders/${workOrder!.id}/submit`,
    'tok_manager',
    { installerUserId: 'usr_installer', dueAt: '2026-10-24T09:00:00.000Z' },
    WorkOrder
  )
  const filed = await eventually(() =>
    procore.observations[0]?.attachments.length === 1 ? procore.observations[0] : undefined
  )
  expect(procore.observations).toHaveLength(1)
  expect(filed).toMatchObject({
    name: `Safe Edge ${finding!.id}: inventory item on ${S1.segmentId}`,
    priority: 'High',
    status: 'initiated',
    type: { id: SAFETY_HAZARD_TYPE_ID, name: 'Safety Hazard' },
    date_notified: null,
    attachments: [{ name: `${photo.id}.jpg` }]
  })
  expect(filed.description).toContain('SIMULATED')
  expect(procore.file(filed.attachments[0]!.id)).toEqual(PHOTO)

  // The work order now names the Observation, recorded by the system and audited.
  const linked = WorkOrder.parse(
    await (await api.request('get', `/work-orders/${workOrder!.id}`, { token: 'tok_manager' })).json()
  )
  expect(linked.externalRef).toBe(String(filed.id))
  const draft = await api.request('get', `/work-orders/${agentDraft.id}`, { token: 'tok_manager' })
  expect(WorkOrder.parse(await draft.json())).toMatchObject({ status: 'draft', externalRef: null })
  const audit = AuditEvent.array().parse(await (await api.request('get', '/audit', { token: 'tok_manager' })).json())
  expect(audit.at(-1)).toMatchObject({
    action: 'setWorkOrderExternalRef',
    subjectId: workOrder!.id,
    decision: 'allowed',
    actor: { type: 'system', role: 'system' },
    after: { externalRef: String(filed.id) }
  })

  // The link is set once: a second one is refused, even for the system.
  const again = await api.request('post', `/work-orders/${workOrder!.id}/external-ref`, {
    token: 'tok_system',
    body: { externalRef: '999' }
  })
  expect(again.status).toBe(403)
  expect(await again.json()).toMatchObject({ ok: false, rule: 'invalid_transition' })
})
