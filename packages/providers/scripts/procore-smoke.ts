// `bun run procore:smoke`: the live check of the Procore hand-off. It files one Observation, with a photo attached
// through Procore's upload flow, in the Procore Developer Sandbox, using the same adapter the API uses, and prints the
// Observation's ID and URL. It needs the sandbox app's credentials in PROCORE_CLIENT_ID, PROCORE_CLIENT_SECRET,
// PROCORE_COMPANY_ID and PROCORE_PROJECT_ID (scripts/procore-sandbox-wizard.sh writes them to .env). It never runs in CI.
import { EvidenceRef, Finding } from '@safe-edge/contracts'
import { join } from 'node:path'
import { PROCORE_DEVELOPER_SANDBOX, ProcoreWorkOrderProvider, readProcoreEnv } from '../src/index.ts'

if (process.env.CI) throw new Error('procore:smoke calls the real Procore sandbox, so it never runs in CI')
const credentials = readProcoreEnv(process.env)
if (credentials === null) {
  throw new Error(
    'Set PROCORE_CLIENT_ID, PROCORE_CLIENT_SECRET, PROCORE_COMPANY_ID and PROCORE_PROJECT_ID in .env ' +
      '(run scripts/procore-sandbox-wizard.sh)'
  )
}

// The repo's Safe Edge workflow diagram stands in for a site photo: the check is the hand-off, not the picture.
const photoPath = 'docs/images/shortlist/safe-edge-workflow.png'
const bytes = new Uint8Array(await Bun.file(join(import.meta.dir, '../../..', photoPath)).arrayBuffer())
const now = new Date().toISOString()
const photo = EvidenceRef.parse({
  id: 'evd_procore_smoke',
  mediaType: 'image/png',
  uri: photoPath,
  sha256: new Bun.CryptoHasher('sha256').update(bytes).digest('hex'),
  capturedAt: null,
  simulated: true,
  source: 'fixture'
})
const finding = Finding.parse({
  id: 'fnd_procore_smoke',
  candidateId: 'cand_procore_smoke',
  segmentId: 'seg_866518980_11',
  class: 'inventory_item',
  severity: 'high',
  confirmedBy: 'usr_manager',
  custodianUserId: 'usr_manager',
  status: 'open',
  createdAt: now,
  simulated: true,
  source: 'fixture'
})

const procore = new ProcoreWorkOrderProvider({
  ...PROCORE_DEVELOPER_SANDBOX,
  ...credentials,
  observationType: 'Safety Hazard',
  readEvidence: async () => bytes
})
const ref = await procore.createFinding(finding)
await procore.addEvidence(ref, [photo])

console.log(`Created Procore Observation ${ref.id} with ${photoPath} attached`)
console.log(ref.url)
console.log(
  `Open ${PROCORE_DEVELOPER_SANDBOX.apiBaseUrl}, project ${credentials.projectId}, Observations to see it. ` +
    'Procore does not notify assignees of observations the API creates; send them from the Observations tool.'
)
