// What every process a test spawns starts from, so no test run can reach a live service with someone's credentials.
import { PROCORE_ENV } from '../packages/providers/src/workorder-procore.ts'

/** Inherited variables a spawned test process never gets: credentials, NODE_ENV, and the app's own SAFE_EDGE_*. */
const DROPPED = /^(PROCORE|ANTHROPIC|SAFE_EDGE)_|KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|_CT0|^NODE_ENV$/

/**
 * Set blank: what the product reads to reach Procore and Claude. A process's own environment wins over a .env file bun
 * loads (`bun run dev` loads the root .env), and a blank variable counts as unset to readProcoreEnv and the Claude SDK.
 */
const BLANKED = [...Object.values(PROCORE_ENV), 'ANTHROPIC_API_KEY']

/** The environment for a process a test spawns: the test run's without credentials, then `env` on top. */
export function testEnv(env: Record<string, string> = {}): Record<string, string> {
  const inherited = Object.entries(process.env).filter(
    (entry): entry is [string, string] => entry[1] !== undefined && !DROPPED.test(entry[0])
  )
  return { ...Object.fromEntries(inherited), ...Object.fromEntries(BLANKED.map((name) => [name, ''])), ...env }
}
