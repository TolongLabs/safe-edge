import Anthropic from '@anthropic-ai/sdk'
import { counterIds, createCore, Seed } from '@safe-edge/core'
import { join } from 'node:path'
import { createApp, type ApiOptions } from './app.ts'
import { createElminaPlanner } from '@safe-edge/sdk'
import {
  PROCORE_DEVELOPER_SANDBOX,
  ProcoreWorkOrderProvider,
  readProcoreEnv,
  SAFETY_HAZARD_OBSERVATION_TYPE
} from '@safe-edge/providers'
import { devTokens } from './tokens.ts'

const repoRoot = join(import.meta.dir, '../../..')
const readJson = (path: string) => Bun.file(join(repoRoot, path)).json()

const seed = Seed.parse(await readJson('data/elmina/fixtures/seed.json'))
const clock = { now: () => new Date().toISOString() }
const ids = counterIds()
// The seed maps no third parties and no observation feeds them yet (DECISIONS #79), so plans see none.
const planner = await createElminaPlanner(readJson, { thirdParties: [] })
const core = createCore({ seed, clock, ids, planner })

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

// Bun serves the default export on PORT (3000 by default). Its idle timeout is 10 s, so the event stream's heartbeat
// comes every 5 s.
export default createApp({
  core,
  clock,
  ids,
  tokens: await devTokens(process.env, seed.users),
  heartbeatMs: 5_000,
  agent,
  workOrders
})
