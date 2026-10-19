// `bun run dev` serves the API from here: index.ts, with this machine's dev tokens (dev-tokens.ts) handed over through
// the environment. The API reads the token file, which it refuses in production, and its agent acts with the agent's.
import { elminaSeed } from '@safe-edge/sdk'
import { join } from 'node:path'
import { ensureDevTokens } from './dev-tokens.ts'

// Development allows loopback webhooks (events.ts webhookOptions).
process.env.NODE_ENV ??= 'development'
// The scenario clock (clock.ts), so the demo opens in the seed's state on any day (#147). The seed describes 20
// October, each segment patrolled weekly and last on 16 October: on the wall clock, from 23 October the API's scheduled
// pass finds every patrol missed and suspends every valid or expiring pass, S1's included.
process.env.SAFE_EDGE_CLOCK ??= 'scenario'
// The API's state, kept across restarts; delete the directory to start again from the seed.
process.env.SAFE_EDGE_DATA_DIR ??= join(import.meta.dir, '../.data')
const tokens = await ensureDevTokens(process.env)
process.env.SAFE_EDGE_DEV_TOKENS_FILE = tokens.file
process.env.SAFE_EDGE_AGENT_TOKEN = tokens.tokenOf('usr_agent')
console.log(`Dev tokens: ${tokens.file}. Print one with bun run dev:token <userId>.`)
console.log(`API state: ${process.env.SAFE_EDGE_DATA_DIR}. Delete it to start again from the seed.`)
console.log(
  process.env.SAFE_EDGE_CLOCK === 'scenario'
    ? `Clock: scenario: it starts at the seed's ${elminaSeed.asOf} (or where the last run left it) and moves only when ` +
        'the system user sets it (POST /v1/scenario/clock). SAFE_EDGE_CLOCK=wall runs on the wall clock.'
    : `Clock: ${process.env.SAFE_EDGE_CLOCK}.`
)

export default (await import('./index.ts')).default
