import { counterIds, createCore, Seed } from '@safe-edge/core'
import { join } from 'node:path'
import { createApp } from './app.ts'
import { elminaPlanner } from './planner.ts'
import { devTokens } from './tokens.ts'

const repoRoot = join(import.meta.dir, '../../..')
const readJson = (path: string) => Bun.file(join(repoRoot, path)).json()

const seed = Seed.parse(await readJson('data/elmina/fixtures/seed.json'))
const clock = { now: () => new Date().toISOString() }
const ids = counterIds()
const core = createCore({ seed, clock, ids, planner: await elminaPlanner(readJson) })

// Bun serves the default export on PORT (3000 by default). Its idle timeout is 10 s, so the event stream's heartbeat
// comes every 5 s.
export default createApp({ core, clock, ids, tokens: await devTokens(process.env, seed.users), heartbeatMs: 5_000 })
