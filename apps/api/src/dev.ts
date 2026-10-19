// `bun run dev` serves the API from here: index.ts, with this machine's dev tokens (dev-tokens.ts) handed over through
// the environment. The API reads the token file, which it refuses in production, and its agent acts with the agent's.
import { ensureDevTokens } from './dev-tokens.ts'

// Development allows loopback webhooks (events.ts webhookOptions).
process.env.NODE_ENV ??= 'development'
const tokens = await ensureDevTokens(process.env)
process.env.SAFE_EDGE_DEV_TOKENS_FILE = tokens.file
process.env.SAFE_EDGE_AGENT_TOKEN = tokens.tokenOf('usr_agent')
console.log(`Dev tokens: ${tokens.file}. Print one with bun run dev:token <userId>.`)

export default (await import('./index.ts')).default
