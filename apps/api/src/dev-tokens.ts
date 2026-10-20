// This machine's dev tokens (#129): a random bearer token for each seeded user, generated on first use into the OS
// user's state directory, outside the repo, so a coding agent whose file tools stay inside the repo can't read a
// person's token. Later uses reuse them. `bun run dev` (dev.ts) serves the API with them, and
// `bun run dev:token <userId>` prints one, such as the agent's for the MCP server's SAFE_EDGE_AGENT_TOKEN.
import { Seed } from '@safe-edge/core'
import { randomBytes } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

/** The token file, `$XDG_STATE_HOME/safe-edge/dev-tokens.json` (`~/.local/state` by default), generated if missing. */
export async function ensureDevTokens(env: Record<string, string | undefined>) {
  const file = join(env.XDG_STATE_HOME || join(homedir(), '.local/state'), 'safe-edge/dev-tokens.json')
  if (!(await Bun.file(file).exists())) {
    const seed = Seed.parse(await Bun.file(join(import.meta.dir, '../../../data/elmina/fixtures/seed.json')).json())
    const table = Object.fromEntries(
      seed.users.map((user) => [`sedev_${randomBytes(32).toString('base64url')}`, user.id])
    )
    await mkdir(dirname(file), { recursive: true, mode: 0o700 })
    // `wx` fails if another start wrote the file first, rather than replacing tokens it already handed out.
    await writeFile(file, `${JSON.stringify(table, null, 2)}\n`, { mode: 0o600, flag: 'wx' })
  }
  const table: Record<string, string> = await Bun.file(file).json()
  return {
    file,
    tokenOf(userId: string) {
      const entry = Object.entries(table).find(([, id]) => id === userId)
      if (entry === undefined) throw new Error(`${file} has no token for ${userId}`)
      return entry[0]
    }
  }
}

if (import.meta.main) {
  const userId = process.argv[2]
  if (userId === undefined) throw new Error('Usage: bun run dev:token <userId>, for example usr_agent')
  console.log((await ensureDevTokens(process.env)).tokenOf(userId))
}
