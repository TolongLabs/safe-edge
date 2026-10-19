import { counterIds, createCore, Seed } from '@safe-edge/core'
import { join } from 'node:path'
import { createApp } from './app.ts'
import { createElminaPlanner } from '@safe-edge/sdk'
import { devTokens } from './tokens.ts'

const repoRoot = join(import.meta.dir, '../../..')
const readJson = (path: string) => Bun.file(join(repoRoot, path)).json()

const seed = Seed.parse(await readJson('data/elmina/fixtures/seed.json'))
const clock = { now: () => new Date().toISOString() }
const ids = counterIds()
// The seed maps no third parties and no observation feeds them yet (DECISIONS #79), so plans see none.
const planner = await createElminaPlanner(readJson, { thirdParties: [] })
const core = createCore({ seed, clock, ids, planner })

// Bun serves the default export on PORT (3000 by default). Its idle timeout is 10 s, so the event stream's heartbeat
// comes every 5 s.
export default createApp({ core, clock, ids, tokens: await devTokens(process.env, seed.users), heartbeatMs: 5_000 })
