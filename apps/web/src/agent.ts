import type * as AnthropicSdk from '@anthropic-ai/sdk'
import type * as Claude from '@safe-edge/agent-tools/claude'
import type { SafeEdgeAgent } from '@safe-edge/agent-tools/claude'
import { demo } from './store'

// The Safe Edge agent in the page, with the person's own Anthropic key (Settings). It is the agent the API runs
// (packages/agent-tools/src/claude.ts), acting through the demo core as usr_agent, so core refuses it everything but
// reading, proposing and drafting, exactly as the API does. The Anthropic SDK loads only when the agent first runs.

type Sdk = typeof AnthropicSdk & typeof Claude

let loading: Promise<Sdk> | null = null
let loaded: Sdk | null = null
const sdk = () =>
  (loading ??= Promise.all([import('@anthropic-ai/sdk'), import('@safe-edge/agent-tools/claude')]).then(
    ([anthropic, claude]) => (loaded = { ...anthropic, ...claude }),
    (error: unknown) => {
      loading = null
      throw error
    }
  ))

/** A fresh agent for one run: it acts on the demo core as it is now, after any Reset demo. */
export async function demoAgent(apiKey: string): Promise<SafeEdgeAgent> {
  const s = await sdk()
  return s.createAgent({
    claude: new s.Anthropic({ apiKey, dangerouslyAllowBrowser: true }),
    context: { client: demo.as('usr_agent'), now: () => new Date().toISOString() }
  })
}

/** Settings' check before saving: asks Anthropic for the agent's model with the key. Returns the model's name. */
export async function checkAnthropicKey(apiKey: string): Promise<string> {
  const s = await sdk()
  const claude = new s.Anthropic({ apiKey, dangerouslyAllowBrowser: true })
  return (await claude.models.retrieve(s.AGENT_MODEL)).display_name
}

/** The person cancelled the run (Stop): not a failure to report. */
export const isCancelled = (error: unknown) => loaded !== null && error instanceof loaded.APIUserAbortError

/** An Anthropic failure in words that say how to get past it; null for anything else, which is a bug to throw. */
export function anthropicFailure(error: unknown): string | null {
  if (loaded === null) return null
  const s = loaded
  if (error instanceof s.APIConnectionError)
    return 'Could not reach api.anthropic.com. Check the connection, then try again.'
  if (error instanceof s.AuthenticationError)
    return 'Anthropic refused this key (401). Check it, or make a new one in the Anthropic Console, then save it in Settings again.'
  if (error instanceof s.PermissionDeniedError || error instanceof s.NotFoundError)
    return `This key cannot use ${s.AGENT_MODEL} (${error.status}). Use a key from an account that has it.`
  if (error instanceof s.RateLimitError)
    return 'Anthropic is limiting requests for this key (429). Wait a minute, then try again.'
  if (error instanceof s.APIError)
    return `Anthropic could not answer (${error.status ?? 'no status'}): ${error.message}. Try again.`
  return null
}
