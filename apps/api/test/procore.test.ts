// A finding goes to SDP's defect system once a person submits its work order: the API hands each submitted work order,
// with its photo, to the workorder-procore adapter, and records the Observation ID on the work order. Drafts, the
// agent's included, stay in Safe Edge (INBOX-4: people edit and submit; the agent cannot). Procore here is the contract double
// (packages/providers/test/procore-double.ts), which accepts only the documented request shapes.
import { afterAll, expect, test } from 'bun:test'
import {
  AuditEvent,
  Candidate,
  HandOffRetry,
  CandidateDecision,
  EvidenceRef,
  Observation,
  Opening,
  Remedy,
  RetestOutcome,
  Task,
  WorkOrder,
  type RecordRetestRequest,
  type WorkOrderProvider
} from '@safe-edge/contracts'
import { ProcoreWorkOrderProvider, SAFETY_HAZARD_OBSERVATION_TYPE } from '@safe-edge/providers'
import { startProcoreDouble } from '../../../packages/providers/test/procore-double.ts'
import { playS1toRepair, startCore } from '../../../packages/core/test/support.ts'
import type { ApiOptions } from '../src/app.ts'
import { forwardWorkOrders } from '../src/work-orders.ts'
import { S1, seed, startApi, type Api, type Token } from './support.ts'

// FF D8 FF E0 followed by "safe-edge", as in evidence.test.ts.
const PHOTO_BASE64 = '/9j/4HNhZmUtZWRnZQ=='
const PHOTO = Uint8Array.from(atob(PHOTO_BASE64), (c) => c.charCodeAt(0))
const SAFETY_HAZARD_TYPE_ID = 69259

const credentials = { clientId: 'safe-edge-sandbox', clientSecret: 'sandbox-secret', companyId: 4271, projectId: 1234 }
const procore = startProcoreDouble(credentials)
afterAll(() => procore.stop())

/**
 * The Procore adapter against the double, watched: `handedOff` settles when the API's hand-off of a work order has
 * finished (photos attached, null) or failed (the error), so the tests wait on the hand-off itself, not on a timer.
 */
function procoreAdapter(clientSecret = credentials.clientSecret) {
  const { promise: handedOff, resolve } = Promise.withResolvers<unknown>()
  const workOrders: ApiOptions['workOrders'] = (readEvidence) => {
    const adapter = new ProcoreWorkOrderProvider({
      loginBaseUrl: procore.url,
      apiBaseUrl: procore.url,
      ...credentials,
      clientSecret,
      observationType: SAFETY_HAZARD_OBSERVATION_TYPE,
      readEvidence
    })
    const watch = <T>(step: Promise<T>, last: boolean) =>
      step.then(
        (value) => {
          if (last) resolve(null)
          return value
        },
        (error: unknown) => {
          resolve(error)
          throw error
        }
      )
    return {
      createFinding: (finding) => watch(adapter.createFinding(finding), false),
      addEvidence: (ref, evidence) => watch(adapter.addEvidence(ref, evidence), true),
      updateStatus: (ref, status) => adapter.updateStatus(ref, status)
    }
  }
  return { workOrders, handedOff }
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

/**
 * S1 by phone up to a person's submit: the crew photographs the gap, the provider raises it, the manager confirms it,
 * the agent drafts a second work order, and the manager's draft goes through interim protection and an approved
 * remedy to submission.
 */
async function submitS1(api: Api) {
  const filedBefore = procore.observations.length
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
  expect(procore.observations).toHaveLength(filedBefore)

  await post(
    api,
    `/work-orders/${workOrder!.id}/submit`,
    'tok_manager',
    { installerUserId: 'usr_installer', dueAt: '2026-10-24T09:00:00.000Z' },
    WorkOrder
  )
  return { photo, finding: finding!, workOrder: workOrder!, remedy }
}

/** Calls `read` until it returns a value: the hand-off runs on the API's own time, after the request behind it. */
async function until<T>(read: () => Promise<T | undefined> | T | undefined): Promise<T> {
  for (;;) {
    const value = await read()
    if (value !== undefined) return value
    await Bun.sleep(5)
  }
}

const readWorkOrder = async (api: Api, id: string) =>
  WorkOrder.parse(await (await api.request('get', `/work-orders/${id}`, { token: 'tok_manager' })).json())

/** The Observation the work order links, once the hand-off has linked one. */
const observationOf = async (api: Api, workOrderId: string) => {
  const { externalRef } = await until(async () => {
    const current = await readWorkOrder(api, workOrderId)
    return current.externalRef === null ? undefined : current
  })
  return procore.observations.find((o) => String(o.id) === externalRef)!
}

/** The installer starts and completes the repair. */
async function repair(api: Api, workOrderId: string) {
  await post(api, `/work-orders/${workOrderId}/start`, 'tok_installer', undefined, WorkOrder)
  const done = { evidence: [], note: 'Panel 4 replaced' }
  await post(api, `/work-orders/${workOrderId}/complete`, 'tok_installer', done, WorkOrder)
}

/** A reviewer who did not install it re-tests the repair. */
function retest(api: Api, workOrderId: string, result: RecordRetestRequest['result']) {
  const check = result === 'accepted' ? 'pass' : 'fail'
  const body = {
    workOrderId,
    checklist: [{ kind: 'saved_view', subjectId: S1.viewpointId, result: check, reason: 'Panel 4', measuredMm: null }],
    evidence: [],
    result,
    reason: result === 'accepted' ? 'Gap closed' : 'Panel 4 is loose'
  } satisfies RecordRetestRequest
  return post(api, '/retests', 'tok_reviewer', body, RetestOutcome)
}

const retry = (api: Api, workOrderId: string, token: Token) =>
  api.request('post', `/work-orders/${workOrderId}/external-retry`, { token })

test('submitting a work order files a Procore Observation with its photo and links it; drafts stay in Safe Edge', async () => {
  const { workOrders, handedOff } = procoreAdapter()
  const api = startApi({ workOrders })
  const { photo, finding, workOrder } = await submitS1(api)

  expect(await handedOff).toBeNull()
  const filed = procore.observations[0]!
  expect(procore.observations).toHaveLength(1)
  expect(filed).toMatchObject({
    name: `Safe Edge ${finding.id}: inventory item on ${S1.segmentId}`,
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
    await (await api.request('get', `/work-orders/${workOrder.id}`, { token: 'tok_manager' })).json()
  )
  expect(linked.externalRef).toBe(String(filed.id))
  const audit = AuditEvent.array().parse(await (await api.request('get', '/audit', { token: 'tok_manager' })).json())
  expect(audit.at(-1)).toMatchObject({
    action: 'setWorkOrderExternalRef',
    subjectId: workOrder.id,
    decision: 'allowed',
    actor: { type: 'system', role: 'system' },
    after: { externalRef: String(filed.id) }
  })

  // The link is set once: a second one is refused, even for the system.
  const again = await api.request('post', `/work-orders/${workOrder.id}/external-ref`, {
    token: 'tok_system',
    body: { externalRef: '999' }
  })
  expect(again.status).toBe(403)
  expect(await again.json()).toMatchObject({ ok: false, rule: 'invalid_transition' })
})

test('a failed hand-off is recorded on the work order and the audit chain, readable through the API', async () => {
  // A wrong client secret: Procore refuses the token, so nothing is filed.
  const { workOrders, handedOff } = procoreAdapter('not-the-secret')
  const api = startApi({ workOrders })
  const filedBefore = procore.observations.length
  const { workOrder } = await submitS1(api)

  const error = await handedOff
  expect(error).toBeInstanceOf(Error)
  expect(procore.observations).toHaveLength(filedBefore)
  const read = await api.request('get', `/work-orders/${workOrder.id}`, { token: 'tok_manager' })
  const failed = WorkOrder.parse(await read.json())
  expect(failed).toMatchObject({
    status: 'submitted',
    externalRef: null,
    externalError: { step: 'createFinding', message: (error as Error).message, at: seed.asOf }
  })
  expect(failed.externalError!.message).toContain('401')
  const audit = AuditEvent.array().parse(await (await api.request('get', '/audit', { token: 'tok_manager' })).json())
  expect(audit.at(-1)).toMatchObject({
    action: 'recordWorkOrderExternalError',
    subjectId: workOrder.id,
    decision: 'allowed',
    actor: { type: 'system', id: 'api.work-orders', role: 'system' },
    before: { externalError: null },
    after: { externalError: failed.externalError }
  })
})

test('the Observation follows the repair: ready for review when it is completed, not accepted or closed by the re-test', async () => {
  const api = startApi({ workOrders: procoreAdapter().workOrders })
  const { finding, workOrder, remedy } = await submitS1(api)
  const first = await observationOf(api, workOrder.id)
  await until(() => (first.attachments.length === 1 ? true : undefined))
  expect(first.status).toBe('initiated')

  await repair(api, workOrder.id)
  await until(() => (first.status === 'ready_for_review' ? true : undefined))
  await retest(api, workOrder.id, 'rejected')
  await until(() => (first.status === 'not_accepted' ? true : undefined))

  // The reopened finding takes a new work order, which becomes its own Observation and is closed by a passed re-test.
  const reworkDraft = await post(
    api,
    '/work-orders',
    'tok_manager',
    { findingId: finding.id, remedyId: remedy.id, notes: 'Refit panel 4' },
    WorkOrder
  )
  const due = { installerUserId: 'usr_installer', dueAt: '2026-10-28T09:00:00.000Z' }
  await post(api, `/work-orders/${reworkDraft.id}/submit`, 'tok_manager', due, WorkOrder)
  const second = await observationOf(api, reworkDraft.id)
  expect(second.id).not.toBe(first.id)
  await repair(api, reworkDraft.id)
  await until(() => (second.status === 'ready_for_review' ? true : undefined))
  const { pass } = await retest(api, reworkDraft.id, 'accepted')
  expect(pass?.state).toBe('valid')
  await until(() => (second.status === 'closed' ? true : undefined))
  expect(first.status).toBe('not_accepted')
  for (const id of [workOrder.id, reworkDraft.id]) expect((await readWorkOrder(api, id)).externalError).toBeNull()
})

test('a failed hand-off is retried by a manager from the step that failed, audited, and never by the agent', async () => {
  const api = startApi({ workOrders: procoreAdapter().workOrders })
  // Procore is down when the work order is submitted: listing the observation types answers 503.
  procore.failNext('/rest/v1.0/observations/types')
  const filedBefore = procore.observations.length
  const { photo, workOrder } = await submitS1(api)
  const failed = await until(async () => (await readWorkOrder(api, workOrder.id)).externalError ?? undefined)
  expect(failed).toEqual({
    step: 'createFinding',
    message: expect.stringContaining('answered 503'),
    at: seed.asOf
  })
  expect(procore.observations).toHaveLength(filedBefore)

  // Only people who submit work orders retry them.
  for (const [token, rule] of [
    ['tok_agent', 'agents_draft_only'],
    ['tok_installer', 'role_forbidden']
  ] as const) {
    const refused = await retry(api, workOrder.id, token)
    expect({ token, status: refused.status, body: await refused.json() }).toMatchObject({
      token,
      status: 403,
      body: { ok: false, rule }
    })
  }

  const retried = await retry(api, workOrder.id, 'tok_manager')
  expect(retried.status).toBe(200)
  expect(HandOffRetry.parse(await retried.json())).toEqual({
    workOrder: expect.objectContaining({ id: workOrder.id, externalError: null }),
    retried: failed
  })
  const filed = await observationOf(api, workOrder.id)
  await until(() => (filed.attachments.length === 1 ? true : undefined))
  expect(procore.file(filed.attachments[0]!.id)).toEqual(PHOTO)
  expect(filed.attachments[0]!.name).toBe(`${photo.id}.jpg`)
  expect(procore.observations).toHaveLength(filedBefore + 1)

  const audit = AuditEvent.array().parse(await (await api.request('get', '/audit', { token: 'tok_manager' })).json())
  const subject = audit.filter((e) => e.subjectId === workOrder.id)
  expect(subject.map((e) => [e.action, e.actor.id, e.decision, e.rule])).toEqual(
    expect.arrayContaining([
      ['recordWorkOrderExternalError', 'api.work-orders', 'allowed', null],
      ['retryWorkOrderHandOff', 'usr_agent', 'denied', 'agents_draft_only'],
      ['retryWorkOrderHandOff', 'usr_installer', 'denied', 'role_forbidden'],
      ['retryWorkOrderHandOff', 'usr_manager', 'allowed', null],
      ['setWorkOrderExternalRef', 'api.work-orders', 'allowed', null]
    ])
  )
  const allowedRetry = subject.find((e) => e.action === 'retryWorkOrderHandOff' && e.decision === 'allowed')!
  expect(allowedRetry).toMatchObject({ before: { externalError: failed }, after: { externalError: null } })

  // With nothing failed, there is nothing to retry.
  const again = await retry(api, workOrder.id, 'tok_manager')
  expect(again.status).toBe(403)
  expect(await again.json()).toMatchObject({ ok: false, rule: 'invalid_transition' })
})

test('a retry after the photos or the status failed resumes there: the same Observation, no second record', async () => {
  const api = startApi({ workOrders: procoreAdapter().workOrders })
  procore.failNext(`/rest/v1.1/projects/${credentials.projectId}/uploads`)
  const filedBefore = procore.observations.length
  const { workOrder } = await submitS1(api)
  const failed = await until(async () => (await readWorkOrder(api, workOrder.id)).externalError ?? undefined)
  expect(failed.step).toBe('addEvidence')
  const filed = await observationOf(api, workOrder.id)
  expect(filed.attachments).toEqual([])

  expect((await retry(api, workOrder.id, 'tok_engineer')).status).toBe(200)
  await until(() => (filed.attachments.length === 1 ? true : undefined))
  expect(procore.observations).toHaveLength(filedBefore + 1)

  // Procore is down when the repair is completed, so the status change fails and waits for a person.
  procore.failNext(`/rest/v1.0/observations/items/${filed.id}`)
  await repair(api, workOrder.id)
  const statusFailed = await until(async () => (await readWorkOrder(api, workOrder.id)).externalError ?? undefined)
  expect(statusFailed.step).toBe('updateStatus')
  expect(filed.status).toBe('initiated')
  expect((await retry(api, workOrder.id, 'tok_manager')).status).toBe(200)
  await until(() => (filed.status === 'ready_for_review' ? true : undefined))
  expect(filed.attachments).toHaveLength(1)
  expect(procore.observations).toHaveLength(filedBefore + 1)
})

test('a retry on an API without a work-order system fails at once, on the record', async () => {
  const api = startApi()
  const { workOrder } = await submitS1(api)
  const failure = { step: 'createFinding', message: 'Procore answered 503' }
  const recorded = await api.request('post', `/work-orders/${workOrder.id}/external-error`, {
    token: 'tok_system',
    body: failure
  })
  expect(recorded.status).toBe(200)
  expect((await retry(api, workOrder.id, 'tok_manager')).status).toBe(200)
  expect((await readWorkOrder(api, workOrder.id)).externalError).toEqual({
    step: 'createFinding',
    message: 'This API instance has no work-order system configured',
    at: seed.asOf
  })
})

test('the hand-off records what the work-order system did, a refusal or an outage, but never a bug of its own', async () => {
  const h = startCore()
  const { workOrderId } = playS1toRepair(h, 'submitted')
  const externalError = () => h.call('getWorkOrder', 'usr_manager', { params: { id: workOrderId } }).data.externalError
  const forwarder = (provider: WorkOrderProvider) => forwardWorkOrders({ core: h.core, subscribe: () => {}, provider })

  // A bug is not Procore's: it is not recorded on the work order, and the hand-off fails with it.
  const buggy: WorkOrderProvider = {
    createFinding: async () => {
      throw new TypeError('finding.class.replaceAll is not a function')
    },
    addEvidence: async () => {},
    updateStatus: async () => {}
  }
  await expect(forwarder(buggy).retry(workOrderId, 'createFinding')).rejects.toThrow(TypeError)
  expect(externalError()).toBeNull()

  // Procore cannot be reached: that is recorded, for a person to retry.
  const closed = Bun.serve({ port: 0, fetch: () => new Response() })
  const nobody = closed.url.href
  closed.stop(true)
  const unreachable = new ProcoreWorkOrderProvider({
    loginBaseUrl: nobody,
    apiBaseUrl: nobody,
    ...credentials,
    observationType: SAFETY_HAZARD_OBSERVATION_TYPE,
    readEvidence: async () => PHOTO
  })
  await forwarder(unreachable).retry(workOrderId, 'createFinding')
  expect(externalError()).toMatchObject({
    step: 'createFinding',
    message: expect.stringContaining('Procore POST /oauth/token could not be reached')
  })
})
