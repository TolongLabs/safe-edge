// `bun run procore:e2e`: the live end-to-end check of the Procore hand-off, the way users reach it. It starts the dev
// API (`bun run dev` in apps/api, whose script loads the root .env), plays S1 over HTTP with the dev tokens up to the
// manager's submit, reads the work order's externalRef back, then fetches that Observation from the Procore Developer
// Sandbox and checks the photo on it is the one the crew uploaded, byte for byte. It needs PROCORE_CLIENT_ID,
// PROCORE_CLIENT_SECRET, PROCORE_COMPANY_ID and PROCORE_PROJECT_ID in .env (scripts/procore-sandbox-wizard.sh writes
// them). It never runs in CI.
import { createSafeEdgeClient, elminaSeed } from '@safe-edge/sdk'
import { join } from 'node:path'
import * as z from 'zod'
import { PROCORE_DEVELOPER_SANDBOX, readProcoreEnv } from '../src/index.ts'

if (process.env.CI) throw new Error('procore:e2e calls the real Procore sandbox, so it never runs in CI')
const credentials = readProcoreEnv(process.env)
if (credentials === null) {
  throw new Error(
    'Set PROCORE_CLIENT_ID, PROCORE_CLIENT_SECRET, PROCORE_COMPANY_ID and PROCORE_PROJECT_ID in .env ' +
      '(run scripts/procore-sandbox-wizard.sh)'
  )
}

const repoRoot = join(import.meta.dir, '../../..')
// The repo has no real site photo. The S6 drone frame is the only photo-like image of the S1 segment.
const PHOTO_PATH = 'data/elmina/scenarios/s6-vandalised-sign.png'
const photoBytes = new Uint8Array(await Bun.file(join(repoRoot, PHOTO_PATH)).arrayBuffer())
const sha256 = (bytes: Uint8Array) => new Bun.CryptoHasher('sha256').update(bytes).digest('hex')
const DEADLINE_MS = 60_000

function freePort(): number {
  const server = Bun.serve({ port: 0, fetch: () => new Response() })
  const { port } = server
  server.stop(true)
  if (port === undefined) throw new Error('Bun.serve did not report a port')
  return port
}

/** Calls `check` every second until it returns a value, for at most a minute. */
async function until<T>(what: string, check: () => Promise<T | undefined>): Promise<T> {
  const deadline = Date.now() + DEADLINE_MS
  while (Date.now() < deadline) {
    const value = await check()
    if (value !== undefined) return value
    await Bun.sleep(1_000)
  }
  throw new Error(`${what} did not happen within ${DEADLINE_MS / 1000} s`)
}

const port = freePort()
const dev = Bun.spawn(['bun', 'run', 'dev'], {
  cwd: join(repoRoot, 'apps/api'),
  env: { ...process.env, PORT: String(port) },
  stdout: 'ignore',
  stderr: 'inherit',
  detached: true
})
try {
  const baseUrl = `http://localhost:${port}/v1`
  await until('The dev API answering /v1/health', async () => {
    if (dev.exitCode !== null) throw new Error(`The dev API exited with code ${dev.exitCode}`)
    const response = await fetch(`${baseUrl}/health`).catch((error: Error) => {
      if (error.message.includes('Unable to connect')) return undefined
      throw error
    })
    return response?.ok ? response : undefined
  })

  // S1 by phone, as the people do it, each with their dev token.
  const as = (token: string) => createSafeEdgeClient({ transport: 'http', baseUrl, token })
  const crew = as('dev_crew')
  const provider = as('dev_drone_sim')
  const manager = as('dev_manager')
  const engineer = as('dev_engineer')
  const S1 = elminaSeed.story.s1
  const viewpoint = elminaSeed.segments
    .find((s) => s.id === S1.segmentId)!
    .viewpoints.find((v) => v.id === S1.viewpointId)!
  const capturedAt = new Date().toISOString()

  const photo = await crew.uploadEvidence({
    body: {
      mediaType: 'image/png',
      dataBase64: Buffer.from(photoBytes).toString('base64'),
      capturedAt,
      simulated: true
    }
  })
  const observation = await crew.recordObservation({
    body: {
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
    }
  })
  const candidate = await provider.raiseCandidate({
    body: {
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
    }
  })
  if (candidate.tier !== 2) throw new Error(`${candidate.id} is Tier ${candidate.tier}, not Tier 2`)
  const decision = await manager.decideCandidate({
    params: { id: candidate.id },
    body: { decision: 'confirm', severity: 'high' }
  })
  const { finding, workOrder } = decision
  if (finding === null || workOrder === null) throw new Error(`Confirming ${candidate.id} drafted no work order`)
  await crew.completeTask({ params: { id: decision.tasks[0]!.id } })
  const gap = await manager.createOpening({
    body: {
      segmentId: S1.segmentId,
      type: 'fence_gap',
      photoMarks: [{ evidenceId: photo.id, x: 0.45, y: 0.6 }],
      measuredMm: 1200
    }
  })
  const remedy = await engineer.createRemedy({
    body: {
      segmentId: S1.segmentId,
      type: 'panel_replacement',
      label: 'Replace panel 4',
      blocksOpeningIds: [gap.id],
      quantities: [{ item: 'Fence panel 2.4 m', amount: 1, unit: 'panel' }],
      acceptanceTest: 'No gap over 100 mm along the run',
      quote: 'quote_needed'
    }
  })
  await engineer.approveRemedy({ params: { id: remedy.id } })
  await manager.updateWorkOrder({ params: { id: workOrder.id }, body: { remedyId: remedy.id } })
  const dueAt = new Date(Date.now() + 5 * 24 * 3600_000).toISOString()
  await manager.submitWorkOrder({ params: { id: workOrder.id }, body: { installerUserId: 'usr_installer', dueAt } })
  console.log(`${new Date().toISOString()} submitted ${workOrder.id} (finding ${finding.id}, photo ${photo.id})`)

  // The API files the Observation, links it, then attaches the photo. A failure lands on the work order.
  const readWorkOrder = async () => {
    const current = await manager.getWorkOrder({ params: { id: workOrder.id } })
    if (current.externalError !== null) {
      throw new Error(`${workOrder.id} did not reach Procore: ${current.externalError.message}`)
    }
    return current
  }
  const externalRef = await until(`${workOrder.id} getting an externalRef`, async () => {
    return (await readWorkOrder()).externalRef ?? undefined
  })
  if (!/^\d+$/.test(externalRef)) throw new Error(`${workOrder.id} has externalRef "${externalRef}", not a Procore ID`)
  console.log(`${new Date().toISOString()} ${workOrder.id} externalRef is Procore Observation ${externalRef}`)

  // Read the Observation straight from the sandbox, with a token of its own, not through the adapter.
  const { loginBaseUrl, apiBaseUrl } = PROCORE_DEVELOPER_SANDBOX
  const tokenResponse = await fetch(new URL('/oauth/token', loginBaseUrl), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret
    })
  })
  if (!tokenResponse.ok) throw new Error(`Procore token request answered ${tokenResponse.status}`)
  const { access_token } = z.object({ access_token: z.string().min(1) }).parse(await tokenResponse.json())
  const procoreHeaders = {
    Authorization: `Bearer ${access_token}`,
    'Procore-Company-Id': String(credentials.companyId)
  }
  const observationUrl = new URL(
    `/rest/v1.0/observations/items/${externalRef}?project_id=${credentials.projectId}`,
    apiBaseUrl
  )
  const ProcoreObservation = z.object({
    id: z.number(),
    name: z.string(),
    created_at: z.string(),
    attachments: z.array(
      z.object({ id: z.number().optional(), name: z.string().optional(), url: z.string().optional() })
    )
  })
  const filename = `${photo.id}.png`
  const { filed, attachment } = await until(`Observation ${externalRef} getting ${filename}`, async () => {
    await readWorkOrder()
    const response = await fetch(observationUrl, { headers: procoreHeaders })
    if (!response.ok)
      throw new Error(`GET ${observationUrl.pathname} answered ${response.status}: ${await response.text()}`)
    const filed = ProcoreObservation.parse(await response.json())
    const attachment = filed.attachments.find((a) => a.name === filename)
    return attachment === undefined ? undefined : { filed, attachment }
  })
  if (!filed.name.includes(finding.id)) throw new Error(`Observation ${filed.id} is "${filed.name}", not ${finding.id}`)
  if (attachment.id === undefined || attachment.url === undefined) {
    throw new Error(`Observation ${filed.id} lists ${filename} without a file ID and URL`)
  }
  // The file URL is on the Procore API host, so it takes the token; it redirects to storage, which fetch follows.
  const download = await fetch(attachment.url, { headers: procoreHeaders })
  if (!download.ok) throw new Error(`Downloading ${filename} answered ${download.status}`)
  const downloaded = sha256(new Uint8Array(await download.arrayBuffer()))
  if (downloaded !== sha256(photoBytes) || downloaded !== photo.sha256) {
    throw new Error(`${filename} on Observation ${filed.id} has sha256 ${downloaded}, not the uploaded ${photo.sha256}`)
  }

  console.log(`Procore sandbox project ${credentials.projectId}, Observation ${filed.id} "${filed.name}"`)
  console.log(`  created_at ${filed.created_at}`)
  console.log(`  attachment ${attachment.id} ${filename}: sha256 ${downloaded}, the same bytes as ${PHOTO_PATH}`)
  console.log(`  ${observationUrl.href}`)
} finally {
  // Signal the whole process group, as Ctrl-C in a terminal does; killing only the parent orphans the API.
  process.kill(-dev.pid, 'SIGINT')
  await dev.exited
}
