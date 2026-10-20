import { beforeAll, expect, test } from 'bun:test'
import { DiagnosticSeverity, Parser } from '@asyncapi/parser'
import { createConfig, lintFromString } from '@redocly/openapi-core'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parse } from 'yaml'
import { testEnv } from '../../../test/spawn.ts'

// Every row of the TRD "REST API" table. `agentScope` comes from the TRD agent tool table and PLAN.md
// (null: agents are refused; undefined: the TRD says "any", so not asserted here).
const trdEndpoints: { method: string; path: string; roles: string[] | 'any'; agentScope?: string | null }[] = [
  { method: 'get', path: '/assets', roles: 'any' },
  { method: 'get', path: '/segments/{id}', roles: 'any' },
  { method: 'post', path: '/patrol-plans', roles: ['manager', 'system'], agentScope: 'patrol.propose' },
  { method: 'post', path: '/patrol-plans/{id}/approve', roles: ['pilot'], agentScope: null },
  { method: 'post', path: '/patrols', roles: ['pilot'], agentScope: null },
  { method: 'post', path: '/observations', roles: ['provider', 'crew'], agentScope: null },
  { method: 'post', path: '/inventory-checks', roles: ['provider', 'crew', 'system'], agentScope: null },
  { method: 'get', path: '/inventory-checks', roles: 'any' },
  { method: 'get', path: '/candidates', roles: ['manager'], agentScope: 'inspection.read' },
  { method: 'post', path: '/candidates/{id}/decision', roles: ['manager'], agentScope: null },
  { method: 'post', path: '/work-orders', roles: ['manager'], agentScope: 'workorder.draft' },
  { method: 'post', path: '/work-orders/{id}/submit', roles: ['manager', 'engineer'], agentScope: null },
  { method: 'post', path: '/work-orders/{id}/complete', roles: ['installer'], agentScope: null },
  { method: 'post', path: '/retests', roles: ['reviewer'], agentScope: null },
  { method: 'get', path: '/passes', roles: 'any' },
  { method: 'get', path: '/false-flags', roles: 'any' },
  { method: 'get', path: '/audit', roles: ['manager', 'gm'], agentScope: null },
  { method: 'post', path: '/triage/images', roles: ['manager'], agentScope: null },
  { method: 'post', path: '/agent/ask', roles: ['manager', 'gm'], agentScope: null },
  { method: 'get', path: '/events', roles: 'any' },
  { method: 'post', path: '/webhooks', roles: ['integrator'], agentScope: null }
]

// TRD "Agent layer": the only scopes an agent token may carry.
const agentScopes = [
  'edge.read',
  'inspection.read',
  'finding.propose',
  'workorder.draft',
  'notice.draft',
  'patrol.propose'
]

// The TRD "Events" list.
const trdEvents = [
  'edge.patrol.planned.v1',
  'edge.patrol.started.v1',
  'edge.patrol.completed.v1',
  'edge.candidate.raised.v1',
  'edge.candidate.decided.v1',
  'edge.pass.suspended.v1',
  'edge.work_order.drafted.v1',
  'edge.work_order.submitted.v1',
  'edge.repair.completed.v1',
  'edge.retest.recorded.v1',
  'edge.pass.issued.v1',
  'edge.pass.expiring.v1',
  'edge.pass.expired.v1'
]

type OpenApiOperation = {
  operationId: string
  'x-safe-edge-roles': string[] | 'any'
  'x-safe-edge-agent-scope'?: string
}
type OpenApiDocument = { openapi: string; paths: Record<string, Record<string, OpenApiOperation>> }

const committedDir = join(import.meta.dir, '../generated')
let outDir: string

beforeAll(async () => {
  outDir = await mkdtemp(join(tmpdir(), 'safe-edge-contracts-'))
  const run = Bun.spawnSync([process.execPath, join(import.meta.dir, '../scripts/generate.ts'), outDir], {
    env: testEnv()
  })
  if (run.exitCode !== 0) throw new Error(`generate.ts failed:\n${run.stderr.toString()}`)
})

const generated = (file: string) => readFile(join(outDir, file), 'utf8')

test('openapi.yaml is valid OpenAPI 3.1', async () => {
  const source = await generated('openapi.yaml')
  expect((parse(source) as OpenApiDocument).openapi).toBe('3.1.0')
  const problems = await lintFromString({
    source,
    absoluteRef: join(outDir, 'openapi.yaml'),
    // The repo has not chosen a licence yet, so the document declares none.
    config: await createConfig({ extends: ['recommended'], rules: { 'info-license': 'off' } })
  })
  expect(problems.map((p) => `${p.severity} ${p.ruleId}: ${p.message} at ${p.location[0]?.pointer}`)).toEqual([])
})

test('openapi.yaml covers every TRD endpoint with the TRD roles', async () => {
  const doc = parse(await generated('openapi.yaml')) as OpenApiDocument
  for (const { method, path, roles, agentScope } of trdEndpoints) {
    const operation = doc.paths[path]?.[method]
    expect(operation, `${method.toUpperCase()} ${path}`).toBeDefined()
    expect(operation!['x-safe-edge-roles'], `${method.toUpperCase()} ${path}`).toEqual(roles)
    if (agentScope !== undefined) {
      expect(operation!['x-safe-edge-agent-scope'], `${method.toUpperCase()} ${path}`).toBe(agentScope ?? undefined)
    }
  }
})

test('no operation lets an agent approve, submit, complete, decide, accept or send', async () => {
  const doc = parse(await generated('openapi.yaml')) as OpenApiDocument
  for (const [path, methods] of Object.entries(doc.paths)) {
    for (const [method, operation] of Object.entries(methods)) {
      const scope = operation['x-safe-edge-agent-scope']
      if (scope === undefined) continue
      expect(agentScopes, `${method.toUpperCase()} ${path}`).toContain(scope)
      expect(path, `${method.toUpperCase()} ${path} grants agents ${scope}`).not.toMatch(
        /\/(approve|submit|complete|decision|send)$|^\/retests$/
      )
    }
  }
})

test('asyncapi.yaml is valid AsyncAPI 3.0 and covers every TRD event', async () => {
  const { document, diagnostics } = await new Parser().parse(await generated('asyncapi.yaml'))
  const problems = diagnostics.filter((d) => d.severity <= DiagnosticSeverity.Warning)
  expect(problems.map((d) => `${d.code}: ${d.message} at ${d.path.join('.')}`)).toEqual([])
  expect(document?.version()).toBe('3.0.0')
  const names = document!
    .allMessages()
    .all()
    .map((message) => message.name())
  expect(names.toSorted()).toEqual(trdEvents.toSorted())
})

test.each(['openapi.yaml', 'asyncapi.yaml', 'openapi.ts'])(
  'committed generated/%s matches a regeneration',
  async (file) => {
    const committed = await readFile(join(committedDir, file), 'utf8')
    expect(await generated(file), `generated/${file} is stale: run bun run generate:contracts`).toBe(committed)
  }
)
