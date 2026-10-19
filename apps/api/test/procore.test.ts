// An accepted finding goes to SDP's defect system: the API hands each drafted work order, with its photo, to the
// workorder-procore adapter, and records the Observation ID on the work order. Procore here is the contract double
// (packages/providers/test/procore-double.ts), which accepts only the documented request shapes.
import { afterAll, expect, test } from 'bun:test'
import { AuditEvent, Candidate, CandidateDecision, EvidenceRef, Observation, WorkOrder } from '@safe-edge/contracts'
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

/** Polls until `read` returns a value; the hand-off runs after the confirming request has answered. */
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

test('confirming a candidate files a Procore Observation with its photo and links it to the work order', async () => {
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
