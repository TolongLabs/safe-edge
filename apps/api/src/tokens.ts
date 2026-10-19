import { UserId, type Actor, type User } from '@safe-edge/contracts'
import { actorFor } from '@safe-edge/core'
import * as z from 'zod'

/** Tokens the in-browser demo issues start with this. The API rejects them (TRD "Security and privacy"). */
export const DEMO_TOKEN_PREFIX = 'demo_'

/** Opaque bearer token → the seeded user it acts as. */
const TokenTable = z.record(
  z
    .string()
    .min(1)
    .refine((token) => !token.startsWith(DEMO_TOKEN_PREFIX), `API tokens cannot start with ${DEMO_TOKEN_PREFIX}`),
  UserId
)

/**
 * Local dev tokens, from exactly one of `SAFE_EDGE_DEV_TOKENS` (a JSON object of token → seeded user ID) or
 * `SAFE_EDGE_DEV_TOKENS_FILE` (a path to that JSON). The file is refused when `NODE_ENV` is `production`.
 */
export async function devTokens(env: Record<string, string | undefined>, users: User[]): Promise<Map<string, Actor>> {
  const { SAFE_EDGE_DEV_TOKENS: inline, SAFE_EDGE_DEV_TOKENS_FILE: file } = env
  if ((inline === undefined) === (file === undefined)) {
    throw new Error('Set exactly one of SAFE_EDGE_DEV_TOKENS or SAFE_EDGE_DEV_TOKENS_FILE')
  }
  if (file !== undefined && env.NODE_ENV === 'production') {
    throw new Error('The API refuses the dev token file in production; set SAFE_EDGE_DEV_TOKENS')
  }
  const table = TokenTable.parse(inline === undefined ? await Bun.file(file!).json() : JSON.parse(inline))
  return new Map(
    Object.entries(table).map(([token, userId]) => {
      const user = users.find((u) => u.id === userId)
      if (user === undefined) throw new Error(`A dev token maps to ${userId}, who is not a seeded user`)
      return [token, actorFor(user)]
    })
  )
}
