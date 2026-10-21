import { Play, WarningCircle } from '@phosphor-icons/react'
import { EVENT_DATA, EVENT_SUMMARIES, EVENT_TYPES, operations, type OperationId } from '@safe-edge/contracts'
import { SafeEdgeDeniedError } from '@safe-edge/sdk'
import { useEffect, useState } from 'react'
import mcpConfig from '../../../../mcp/mcp.json?raw'
import { Screen } from '../../shell/Shell'
import { onReset, useSignedIn } from '../../store'
import { CodeBlock } from '../shared/CodeBlock'
import { refusalText } from '../shared/core'
import './developers.css'

const OPERATIONS = Object.entries(operations) as [OperationId, (typeof operations)[OperationId]][]

// The quickstart follows packages/sdk/README.md; the option names are HttpOptions and MemoryOptions.
const INSTALL = `// package.json of an app in this workspace
"dependencies": {
  "@safe-edge/sdk": "workspace:*"
}

bun install`
const MEMORY = `import { createSafeEdgeClient } from '@safe-edge/sdk'

// Core runs in the page on the labelled Elmina seed: no server.
const demo = createSafeEdgeClient({ transport: 'memory', userId: 'usr_manager' })
const installer = demo.as('usr_installer') // same demo, another seeded user

const segments = await demo.listSegments()`
const HTTP = `import { createSafeEdgeClient } from '@safe-edge/sdk'

// The v1 API; the token decides who the calls act as.
const api = createSafeEdgeClient({ transport: 'http', baseUrl: 'http://localhost:3000/v1', token })

const open = await api.listFindings({ query: { status: 'open' } })`
// From apps/mcp/README.md, "Connect Claude Code".
const CLAUDE = `SAFE_EDGE_AGENT_TOKEN=$(bun run --silent dev:token usr_agent) claude --mcp-config apps/mcp/mcp.json \\
  --allowedTools "mcp__safe-edge__*"`

/** Reads that need no input, so Try it can run them with one press. */
const TRY = [
  'getMe',
  'listUsers',
  'listDocks',
  'listDroneProfiles',
  'listPatrolPlans',
  'listPasses',
  'listCandidates',
  'listAudit'
] as const satisfies readonly OperationId[]
type TryId = (typeof TRY)[number]

type Result = { id: TryId; as: string; json: string; count: number | null } | { id: TryId; as: string; refused: string }

const matches = (id: OperationId, words: string) => {
  const op = operations[id]
  const text = [
    id,
    op.method,
    op.path,
    op.summary,
    op.roles === 'any' ? 'any' : op.roles.join(' '),
    op.agentScope ?? ''
  ]
    .join(' ')
    .toLowerCase()
  return words
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => text.includes(w))
}

export function Developers() {
  const { user: me, client: signedIn } = useSignedIn()
  const [filter, setFilter] = useState('')
  const [tryId, setTryId] = useState<TryId>('getMe')
  const [result, setResult] = useState<Result | null>(null)
  const [busy, setBusy] = useState(false)
  const [fatal, setFatal] = useState<{ error: unknown } | null>(null)
  useEffect(() => onReset(() => setResult(null)), [])
  if (fatal) throw fatal.error

  const run = async () => {
    setBusy(true)
    const as = me.name
    try {
      // Every TRY read takes no input; the call goes to the demo core as the signed-in person.
      const data: unknown = await (signedIn[tryId] as () => Promise<unknown>).call(signedIn)
      setResult({
        id: tryId,
        as,
        json: JSON.stringify(data, null, 2),
        count: Array.isArray(data) ? data.length : null
      })
    } catch (error) {
      if (error instanceof SafeEdgeDeniedError) setResult({ id: tryId, as, refused: refusalText(error) })
      else setFatal({ error })
    } finally {
      setBusy(false)
    }
  }

  const shown = OPERATIONS.filter(([id]) => matches(id, filter))

  return (
    <Screen title="Developers" context="The SDK, the operations table, events and the MCP server">
      <main className="detail island dev">
        <header className="dev-head">
          <h2>Build on Safe Edge</h2>
          <p>
            One typed client with a method per operation in the contracts. The memory transport runs core in the page,
            as this demo does; the http transport calls the v1 API. Same rules, same refusals.
          </p>
        </header>

        <section aria-labelledby="dev-try" className="dev-try">
          <h3 id="dev-try">Try it</h3>
          <p className="dev-note">
            Runs one read against this page&apos;s demo core as {me.name}. What your role may not read comes back as
            core&apos;s refusal. <span className="chip sample">Sample data</span>
          </p>
          <div className="dev-try-row">
            <label>
              <span>Operation</span>
              <select value={tryId} onChange={(e) => setTryId(e.target.value as TryId)}>
                {TRY.map((id) => (
                  <option key={id} value={id}>
                    {id} · {operations[id].method.toUpperCase()} {operations[id].path}
                  </option>
                ))}
              </select>
            </label>
            <button className="btn primary" disabled={busy} onClick={() => void run()}>
              <Play size={18} weight="bold" aria-hidden="true" />
              {busy ? 'Running…' : 'Run'}
            </button>
          </div>
          <div aria-live="polite">
            {result &&
              ('refused' in result ? (
                <p className="state warn" role="alert">
                  <WarningCircle size={20} weight="bold" aria-hidden="true" />
                  <span>
                    {result.id} as {result.as}: {result.refused}
                  </span>
                </p>
              ) : (
                <CodeBlock
                  label={`${result.id} as ${result.as}${result.count === null ? '' : ` · ${result.count} ${result.count === 1 ? 'record' : 'records'}`}`}
                  code={result.json}
                />
              ))}
          </div>
        </section>

        <section aria-labelledby="dev-quick" className="dev-quick">
          <h3 id="dev-quick">Quickstart</h3>
          <div className="dev-grid">
            <CodeBlock label="Install from the workspace" code={INSTALL} />
            <CodeBlock label="Demo mode: the memory transport" code={MEMORY} />
            <CodeBlock label="The http transport" code={HTTP} />
          </div>
        </section>

        <section aria-labelledby="dev-ops">
          <h3 id="dev-ops">Operations</h3>
          <p className="dev-note">
            Generated from the contracts&apos; operations table, the single source for the HTTP routes, the SDK, core
            and the OpenAPI document. Paths sit under /v1. An agent token may call a row only when it names an agent
            scope.
          </p>
          <label className="dev-filter">
            <span>Filter operations</span>
            <input
              type="search"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="e.g. patrol, post, pilot, edge.read"
            />
          </label>
          <p className="dev-note" aria-live="polite">
            {shown.length} of {OPERATIONS.length} operations
          </p>
          {shown.length === 0 ? (
            <p className="state neutral">No operation matches &ldquo;{filter}&rdquo;.</p>
          ) : (
            <div className="dev-table-wrap" tabIndex={0} role="region" aria-label="Operations">
              <table className="dev-table">
                <thead>
                  <tr>
                    <th scope="col">Operation</th>
                    <th scope="col">Method and path</th>
                    <th scope="col">Summary</th>
                    <th scope="col">Who may</th>
                    <th scope="col">Agent scope</th>
                    <th scope="col">Runs in</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map(([id, op]) => (
                    <tr key={id}>
                      <th scope="row">
                        <code>{id}</code>
                      </th>
                      <td className="dev-path">
                        <span className={`dev-method ${op.method}`}>{op.method.toUpperCase()}</span>{' '}
                        <code>{op.path}</code>
                      </td>
                      <td>{op.summary}</td>
                      <td>{op.roles === 'any' ? 'any role' : op.roles.join(', ') || 'agent only'}</td>
                      <td>{op.agentScope ?? 'none: people only'}</td>
                      <td>{op.handledBy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section aria-labelledby="dev-events">
          <h3 id="dev-events">Events</h3>
          <p className="dev-note">
            CloudEvents core emits after a change: over HTTP from GET /v1/events (streamEvents) or a registered webhook,
            in demo mode from demo.subscribe. Payloads carry IDs and the simulated flag, never images.
          </p>
          <ul className="dev-events">
            {EVENT_TYPES.map((t) => (
              <li key={t}>
                <code>{t}</code>
                <p>{EVENT_SUMMARIES[t]}</p>
                <p className="dev-fields">Data: {Object.keys(EVENT_DATA[t].shape).join(', ')}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="dev-mcp">
          <h3 id="dev-mcp">MCP server</h3>
          <p className="dev-note">
            apps/mcp serves the eight agent tools over stdio to an assistant such as Claude Code. It calls the v1 API
            with the agent&apos;s token, so the API enforces every scope and state rule. See the{' '}
            <a href="#/agent">Agent</a> page for what the tools may and may not do.
          </p>
          <div className="dev-grid">
            <CodeBlock label="apps/mcp/mcp.json" code={mcpConfig.trim()} />
            <CodeBlock label="Connect Claude Code (from the repo root, with the API running)" code={CLAUDE} />
          </div>
        </section>
      </main>
    </Screen>
  )
}
