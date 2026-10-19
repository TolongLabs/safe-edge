// The workorder-procore adapter through its WorkOrderProvider port, against the Procore contract double. The hand-off
// of an accepted finding with its photo is proven end to end in apps/api/test/procore.test.ts.
import { afterAll, expect, test } from 'bun:test'
import { Finding } from '@safe-edge/contracts'
import { ProcoreWorkOrderProvider, SAFETY_HAZARD_OBSERVATION_TYPE, type ProcoreConfig } from '../src/index.ts'
import { startProcoreDouble } from './procore-double.ts'

const credentials = { clientId: 'safe-edge-sandbox', clientSecret: 'sandbox-secret', companyId: 4271, projectId: 1234 }
const procore = startProcoreDouble(credentials)
afterAll(() => procore.stop())

const adapter = (config: Partial<ProcoreConfig> = {}) =>
  new ProcoreWorkOrderProvider({
    loginBaseUrl: procore.url,
    apiBaseUrl: procore.url,
    ...credentials,
    observationType: SAFETY_HAZARD_OBSERVATION_TYPE,
    readEvidence: () => Promise.reject(new Error('These tests attach no evidence')),
    ...config
  })

const finding = Finding.parse({
  id: 'fnd_7',
  candidateId: 'cand_3',
  segmentId: 'seg_866518980_11',
  class: 'bank_change',
  severity: 'low',
  confirmedBy: 'usr_manager',
  custodianUserId: 'usr_manager',
  status: 'open',
  createdAt: '2026-10-20T08:05:00.000Z',
  simulated: false,
  source: 'user'
})

test('moving the work state moves the Procore observation, on one access token', async () => {
  const provider = adapter()
  const ref = await provider.createFinding(finding)
  const filed = procore.observations.find((o) => String(o.id) === ref.id)!
  expect(filed).toMatchObject({
    name: 'Safe Edge fnd_7: bank change on seg_866518980_11',
    priority: 'Low',
    status: 'initiated'
  })
  expect(filed.description).not.toContain('SIMULATED')
  expect(ref.url).toBe(`${procore.url}/rest/v1.0/observations/items/${ref.id}?project_id=1234`)

  const seen: string[] = []
  for (const status of ['ready_for_review', 'rejected', 'closed'] as const) {
    await provider.updateStatus(ref, status)
    seen.push(filed.status)
  }
  expect(seen).toEqual(['ready_for_review', 'not_accepted', 'closed'])
  // The token lasts 5400 s, so the adapter asks once.
  expect(procore.tokenRequests()).toBe(1)
})

test('a project without the configured observation type is refused, naming the types it has', async () => {
  await expect(adapter({ observationType: 'Drowning Risk' }).createFinding(finding)).rejects.toThrow(
    'Procore project 1234 has no active observation type "Drowning Risk" (Commissioning, Deficiency, Safety Hazard, Warranty)'
  )
})
