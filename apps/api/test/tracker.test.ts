// #230/#234: the repair tracker over the real API. An assigned installer records progress, shipment facts and due-date
// changes; completion records what was spent; the journey joins the real records and audit times the UI shows.
import { expect, test } from 'bun:test'
import {
  AuditEvent,
  Candidate,
  CandidateDecision,
  Opening,
  Remedy,
  RepairJourney,
  Task,
  WorkOrder
} from '@safe-edge/contracts'
import { S1, raiseTier2, startApi, type Api } from './support.ts'

const NEW_FIELDS = [
  'progress',
  'expectedDeliveryAt',
  'trackingNumber',
  'noTracking',
  'progressUpdatedAt',
  'dueAtChanges',
  'spent',
  'overspendReason'
] as const

async function body<T>(promise: Promise<Response>, schema: { parse(value: unknown): T }): Promise<T> {
  const response = await promise
  const text = await response.text()
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${text}`)
  return schema.parse(JSON.parse(text))
}

const answer = async (response: Promise<Response>) => {
  const resolved = await response
  return { status: resolved.status, body: await resolved.json() }
}

/** S1 from a drone report to a started work order, with the engineer, manager and installer each acting in turn. */
async function repairToStart(
  api: Api,
  {
    quote = 'quote_needed' as const,
    approvedAt = '2026-10-21T06:00:00.000Z',
    submittedAt = '2026-10-21T07:00:00.000Z',
    startedAt = '2026-10-22T02:00:00.000Z'
  }: {
    quote?: { amount: number; currency: string; date: string } | 'quote_needed'
    approvedAt?: string
    submittedAt?: string
    startedAt?: string | null
  } = {}
) {
  const candidate = await body(raiseTier2(api), Candidate)
  api.setNow('2026-10-21T01:15:00.000Z')
  const decision = await body(
    api.request('post', `/candidates/${candidate.id}/decision`, {
      token: 'tok_manager',
      body: { decision: 'confirm', severity: 'high' }
    }),
    CandidateDecision
  )
  const workOrderId = decision.workOrder!.id
  await body(api.request('post', `/tasks/${decision.tasks[0]!.id}/complete`, { token: 'tok_crew' }), Task)
  const opening = await body(
    api.request('post', '/openings', {
      token: 'tok_manager',
      body: {
        segmentId: S1.segmentId,
        type: 'fence_gap',
        photoMarks: [{ evidenceId: 'evd_s1_photo', x: 0.45, y: 0.6 }],
        measuredMm: 1200
      }
    }),
    Opening
  )
  api.setNow(approvedAt)
  const remedy = await body(
    api.request('post', '/remedies', {
      token: 'tok_engineer',
      body: {
        segmentId: S1.segmentId,
        type: 'panel_replacement',
        label: 'Replace panel 4',
        blocksOpeningIds: [opening.id],
        quantities: [{ item: 'Fence panel 2.4 m', amount: 1, unit: 'panel' }],
        acceptanceTest: 'No gap over 100 mm',
        quote
      }
    }),
    Remedy
  )
  await body(api.request('post', `/remedies/${remedy.id}/approve`, { token: 'tok_engineer' }), Remedy)
  await body(
    api.request('patch', `/work-orders/${workOrderId}`, { token: 'tok_manager', body: { remedyId: remedy.id } }),
    WorkOrder
  )
  api.setNow(submittedAt)
  const submitted = await body(
    api.request('post', `/work-orders/${workOrderId}/submit`, {
      token: 'tok_manager',
      body: { installerUserId: 'usr_installer', dueAt: '2026-10-24T09:00:00.000Z' }
    }),
    WorkOrder
  )
  let started: WorkOrder | null = null
  if (startedAt !== null) {
    api.setNow(startedAt)
    started = await body(
      api.request('post', `/work-orders/${workOrderId}/start`, { token: 'tok_installer' }),
      WorkOrder
    )
  }
  return { candidate, decision, remedy, submitted, started, workOrderId, approvedAt, submittedAt, startedAt }
}

test('the assigned installer records progress and shipment facts, and only a real shipment can wait for delivery', async () => {
  const api = startApi()
  const { workOrderId } = await repairToStart(api)

  // The foreman cannot act as the installer, whatever the state.
  expect(
    await answer(
      api.request('post', `/work-orders/${workOrderId}/progress`, {
        token: 'tok_manager',
        body: { progress: 'fixing' }
      })
    )
  ).toEqual({ status: 403, body: { ok: false, rule: 'role_forbidden', message: expect.any(String) } })

  // Waiting for delivery needs an expected date, and then a tracking number or an explicit no-tracking answer.
  const waiting = (body: unknown) =>
    answer(api.request('post', `/work-orders/${workOrderId}/progress`, { token: 'tok_installer', body }))
  expect(await waiting({ progress: 'waiting_for_delivery' })).toMatchObject({
    status: 403,
    body: { rule: 'invalid_transition' }
  })
  expect(
    await waiting({ progress: 'waiting_for_delivery', expectedDeliveryAt: '2026-10-26T00:00:00.000Z' })
  ).toMatchObject({ status: 403, body: { rule: 'invalid_transition' } })
  expect(
    await waiting({
      progress: 'waiting_for_delivery',
      expectedDeliveryAt: '2026-10-26T00:00:00.000Z',
      trackingNumber: 'TRK-1',
      noTracking: true
    })
  ).toMatchObject({ status: 403, body: { rule: 'invalid_transition' } })

  const tracked = await body(
    api.request('post', `/work-orders/${workOrderId}/progress`, {
      token: 'tok_installer',
      body: {
        progress: 'waiting_for_delivery',
        expectedDeliveryAt: '2026-10-26T00:00:00.000Z',
        trackingNumber: 'TRK-1',
        noTracking: false
      }
    }),
    WorkOrder
  )
  expect(tracked).toMatchObject({
    id: workOrderId,
    status: 'in_progress',
    progress: 'waiting_for_delivery',
    expectedDeliveryAt: '2026-10-26T00:00:00.000Z',
    trackingNumber: 'TRK-1',
    noTracking: false
  })
  expect(tracked.progressUpdatedAt).toEqual(expect.any(String))

  // An explicit no-tracking answer stands alone; the earlier number is cleared rather than kept beside it.
  const untracked = await body(
    api.request('post', `/work-orders/${workOrderId}/progress`, {
      token: 'tok_installer',
      body: { progress: 'waiting_for_delivery', noTracking: true }
    }),
    WorkOrder
  )
  expect(untracked).toMatchObject({
    progress: 'waiting_for_delivery',
    trackingNumber: null,
    noTracking: true,
    expectedDeliveryAt: '2026-10-26T00:00:00.000Z'
  })
})

test('the installer changes the due date with a reason, and the change is on the work order and the audit chain', async () => {
  const api = startApi()
  const { workOrderId } = await repairToStart(api)
  const changedAt = '2026-10-23T09:30:00.000Z'
  api.setNow(changedAt)
  const dueAt = '2026-10-28T09:00:00.000Z'

  expect(
    await answer(
      api.request('post', `/work-orders/${workOrderId}/due-date`, {
        token: 'tok_installer',
        body: { dueAt, reason: '   ' }
      })
    )
  ).toMatchObject({ status: 400, body: { error: 'invalid_input' } })

  const changed = await body(
    api.request('post', `/work-orders/${workOrderId}/due-date`, {
      token: 'tok_installer',
      body: { dueAt, reason: 'Supplier slipped a week' }
    }),
    WorkOrder
  )
  expect(changed.dueAt).toBe(dueAt)
  expect(changed.dueAtChanges).toEqual([
    {
      from: '2026-10-24T09:00:00.000Z',
      to: dueAt,
      reason: 'Supplier slipped a week',
      byUserId: 'usr_installer',
      at: changedAt
    }
  ])

  const audit = AuditEvent.array().parse(
    await (await api.request('get', `/audit?subject=${workOrderId}`, { token: 'tok_gm' })).json()
  )
  expect(audit.findLast((event) => event.action === 'changeWorkOrderDueDate')).toMatchObject({
    subjectId: workOrderId,
    actor: { type: 'user', id: 'usr_installer', role: 'installer' },
    decision: 'allowed',
    at: changedAt,
    before: { dueAt: '2026-10-24T09:00:00.000Z' },
    after: { dueAt, dueAtChanges: changed.dueAtChanges }
  })
})

test('completion records what was spent; more than 20% over the quote needs a reason, and a currency must match', async () => {
  const api = startApi()
  const { workOrderId } = await repairToStart(api, {
    quote: { amount: 100, currency: 'MYR', date: '2026-10-20' }
  })
  const complete = (body: unknown) =>
    answer(api.request('post', `/work-orders/${workOrderId}/complete`, { token: 'tok_installer', body }))
  const done = { evidence: [], note: 'Panel replaced' }

  expect(
    await complete({
      ...done,
      spent: { amount: 121, currency: 'MYR', date: '2026-10-23' }
    })
  ).toMatchObject({ status: 403, body: { rule: 'invalid_transition' } })
  expect(
    await complete({
      ...done,
      spent: { amount: 121, currency: 'USD', date: '2026-10-23' },
      overspendReason: 'Emergency supplier'
    })
  ).toMatchObject({ status: 403, body: { rule: 'invalid_transition' } })
  // Neither refusal left a completion behind.
  expect(
    await body(api.request('get', `/work-orders/${workOrderId}`, { token: 'tok_manager' }), WorkOrder)
  ).toMatchObject({ status: 'in_progress' })

  const completed = await body(
    api.request('post', `/work-orders/${workOrderId}/complete`, {
      token: 'tok_installer',
      body: {
        ...done,
        spent: { amount: 121, currency: 'MYR', date: '2026-10-23' },
        overspendReason: 'Emergency supplier'
      }
    }),
    WorkOrder
  )
  expect(completed).toMatchObject({
    status: 'completed',
    spent: { amount: 121, currency: 'MYR', date: '2026-10-23' },
    overspendReason: 'Emergency supplier'
  })
})

test('a completion without the new fields keeps the legacy work-order shape exactly', async () => {
  const api = startApi()
  const { submitted, started, workOrderId } = await repairToStart(api)
  for (const workOrder of [submitted, started!]) {
    for (const key of NEW_FIELDS) expect(key in workOrder).toBe(false)
  }

  const completed = await body(
    api.request('post', `/work-orders/${workOrderId}/complete`, {
      token: 'tok_installer',
      body: { evidence: [], note: '' }
    }),
    WorkOrder
  )
  expect(completed).toMatchObject({
    id: workOrderId,
    findingId: expect.any(String),
    remedyId: expect.any(String),
    draftedBy: { type: 'user', id: 'usr_manager' },
    status: 'completed',
    notes: 'Fence panel 4 is missing by the playground path',
    installerUserId: 'usr_installer',
    submittedBy: 'usr_manager',
    dueAt: '2026-10-24T09:00:00.000Z',
    completedAt: expect.any(String),
    completionEvidence: [],
    externalRef: null,
    externalError: null,
    simulated: true,
    source: 'user'
  })
  for (const key of NEW_FIELDS) expect(key in completed).toBe(false)
})

test('the repair journey joins the real candidate, finding, work order, remedy and audit times, or 404s', async () => {
  const api = startApi()
  const { candidate, decision, remedy, workOrderId, approvedAt, submittedAt, startedAt } = await repairToStart(api)

  const journey = await body(
    api.request('get', `/candidates/${candidate.id}/journey`, { token: 'tok_installer' }),
    RepairJourney
  )
  expect(journey).toMatchObject({
    candidate: { id: candidate.id, status: 'confirmed' },
    report: null,
    finding: { id: decision.finding!.id, candidateId: candidate.id },
    workOrder: { id: workOrderId, status: 'in_progress' },
    remedy: { id: remedy.id, engineerApprovedBy: 'usr_engineer' },
    retest: null,
    planApprovedAt: approvedAt,
    assignedAt: submittedAt,
    startedAt
  })

  // A reviewer, the role that checks the repair, reads the same journey.
  expect(
    await body(api.request('get', `/candidates/${candidate.id}/journey`, { token: 'tok_reviewer' }), RepairJourney)
  ).toMatchObject({ workOrder: { id: workOrderId }, planApprovedAt: approvedAt })

  const missing = await answer(api.request('get', '/candidates/cand_404/journey', { token: 'tok_manager' }))
  expect(missing).toEqual({
    status: 404,
    body: { ok: false, error: 'not_found', message: 'No candidate cand_404' }
  })
})
