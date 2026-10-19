import Anthropic from '@anthropic-ai/sdk'
import { Seed } from '@safe-edge/core'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { createApp, type ApiOptions } from './app.ts'
import { clockFrom } from './clock.ts'
import { createElminaPlanner } from '@safe-edge/sdk'
import {
  createDataGovMyClient,
  PROCORE_DEVELOPER_SANDBOX,
  ProcoreWorkOrderProvider,
  readProcoreEnv,
  SAFETY_HAZARD_OBSERVATION_TYPE
} from '@safe-edge/providers'
import { webhookOptions } from './events.ts'
import { devTokens } from './tokens.ts'

const repoRoot = join(import.meta.dir, '../../..')
const readJson = (path: string) => Bun.file(join(repoRoot, path)).json()

const seed = Seed.parse(await readJson('data/elmina/fixtures/seed.json'))
// The wall clock, or with SAFE_EDGE_CLOCK=scenario the clock a scenario player sets (refused in production).
const clock = clockFrom(process.env, seed.asOf)
// Observed third parties reach plans through core: the seed's (S1's path crowd) and each create-plan request's. Mapped
// structures such as buildings arrive with #59's Overpass extract; the research extract maps none.
const planner = await createElminaPlanner(readJson, { thirdParties: [] })

// The API keeps its state in SAFE_EDGE_DATA_DIR/api.sqlite and picks it up again on restart (journal.ts). The file
// holds webhook secrets and evidence, so the directory is the OS user's alone. bun run dev uses apps/api/.data.
const dataDir = process.env.SAFE_EDGE_DATA_DIR
if (!dataDir) throw new Error('Set SAFE_EDGE_DATA_DIR to the directory the API keeps its state in')
mkdirSync(dataDir, { recursive: true, mode: 0o700 })

// The agent acts with its own API token (an agent actor). Claude reads ANTHROPIC_API_KEY; without it, agent calls fail.
const agentToken = process.env.SAFE_EDGE_AGENT_TOKEN
if (!agentToken) throw new Error('Set SAFE_EDGE_AGENT_TOKEN to the API token the agent acts with (bun run dev sets it)')
const agent = { claude: new Anthropic(), token: agentToken }

// Accepted findings go to the Procore Developer Sandbox when the PROCORE_* variables are set (the sandbox wizard,
// scripts/procore-sandbox-wizard.sh, writes them to .env). With none set, work orders stay in Safe Edge.
const procore = readProcoreEnv(process.env)
const workOrders: ApiOptions['workOrders'] =
  procore === null
    ? undefined
    : (readEvidence) =>
        new ProcoreWorkOrderProvider({
          ...PROCORE_DEVELOPER_SANDBOX,
          ...procore,
          observationType: SAFETY_HAZARD_OBSERVATION_TYPE,
          readEvidence
        })

// With SAFE_EDGE_WEATHER=datagovmy the API polls data.gov.my's warnings (live, at most 4 requests a minute) and
// re-plans on those in force for Elmina. Unset, nothing is polled: tests and the offline demo use the saved snapshots.
const { SAFE_EDGE_WEATHER: weatherSource } = process.env
if (weatherSource !== undefined && weatherSource !== 'datagovmy') {
  throw new Error(`SAFE_EDGE_WEATHER is datagovmy or unset, not ${weatherSource}`)
}
const weather =
  weatherSource === 'datagovmy'
    ? createDataGovMyClient({ fetch, clock: { now: Date.now, sleep: (ms) => Bun.sleep(ms) } })
    : undefined

// Bun serves the default export on PORT (3000 by default). Its idle timeout is 10 s, so the event stream's heartbeat
// comes every 5 s.
export default createApp({
  seed,
  planner,
  clock,
  store: join(dataDir, 'api.sqlite'),
  tokens: await devTokens(process.env, seed.users),
  heartbeatMs: 5_000,
  agent,
  workOrders,
  webhooks: webhookOptions(process.env),
  // On the wall clock the automation (drone-sim, tick, missed patrols, weather) repeats on timers; a scenario clock runs
  // it when set.
  every: (ms, run) => void setInterval(() => void run(), ms),
  weather
})
