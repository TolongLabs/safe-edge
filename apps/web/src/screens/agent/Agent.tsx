import { LockSimple, Robot, ShieldCheck, WarningCircle } from '@phosphor-icons/react'
import { agentInstructions, agentTools } from '@safe-edge/agent-tools'
import { operations, type AuditEvent, type OperationId, type User } from '@safe-edge/contracts'
import { SafeEdgeDeniedError } from '@safe-edge/sdk'
import { useEffect, useState } from 'react'
import { Screen } from '../../shell/Shell'
import { can, client, demo, onReset, useStore } from '../../store'
import { clock, peopleWho, useCoreRead, type Read } from '../shared/core'
import './agent.css'

const AGENT = 'usr_agent'

/** What the agent token can never call: every change whose row in the contracts has no agent scope. */
const NEVER = (Object.entries(operations) as [OperationId, (typeof operations)[OperationId]][]).filter(
  ([, op]) => op.agentScope === null && op.method !== 'get'
)

/** The agent's own lines on the audit chain (refused attempts included); null when the signed-in role may not read it. */
const readActivity = async (): Promise<AuditEvent[] | null> =>
  can('listAudit') ? (await client().listAudit({})).filter((a) => a.actor.type === 'agent') : null

type Check =
  | { kind: 'refused'; candidateId: string; rule: string; message: string }
  | { kind: 'allowed'; candidateId: string }
  | { kind: 'nothing' }

export function Agent() {
  const { snapshot: s } = useStore()
  if (!s) throw new Error('The Agent screen renders only after the demo data loaded')
  const activity = useCoreRead(readActivity)
  const [check, setCheck] = useState<Check | null>(null)
  const [busy, setBusy] = useState(false)
  const [fatal, setFatal] = useState<{ error: unknown } | null>(null)
  useEffect(() => onReset(() => setCheck(null)), [])
  if (fatal) throw fatal.error

  // S5: ask core, as the agent, to confirm the first open candidate. Core must refuse and name its rule.
  const runCheck = async () => {
    setBusy(true)
    setCheck(null)
    try {
      const agent = demo.as(AGENT)
      const open = (await agent.listCandidates({})).find((c) => c.status === 'candidate')
      if (!open) return setCheck({ kind: 'nothing' })
      try {
        await agent.decideCandidate({ params: { id: open.id }, body: { decision: 'confirm', severity: 'high' } })
        setCheck({ kind: 'allowed', candidateId: open.id })
      } catch (error) {
        if (!(error instanceof SafeEdgeDeniedError)) throw error
        setCheck({ kind: 'refused', candidateId: open.id, rule: error.rule, message: error.message })
      }
      // A refusal emits no event, so the activity list is read again here.
      activity.reload()
    } catch (error) {
      setFatal({ error })
    } finally {
      setBusy(false)
    }
  }

  const drafted = s.workOrders.filter((w) => w.draftedBy.type === 'agent')

  return (
    <Screen title="Agent" context="Reads, proposes and drafts. People decide.">
      <div className="work agent-work">
        <nav className="list island" aria-label="Agent tools">
          <div className="agent-list-head">
            <h2>Its eight tools</h2>
            <p>The same tools the MCP server serves, each checked against the agent token&apos;s scope.</p>
          </div>
          <ul className="agent-tools">
            {agentTools.map((t) => (
              <li key={t.name}>
                <div className="agent-tool-head">
                  <b>{t.title}</b>
                  <span className={`chip${t.readOnly ? '' : ' drafts'}`}>{t.readOnly ? 'Read only' : 'Drafts'}</span>
                </div>
                <code>{t.name}</code>
                <span className="agent-scope">Scope: {t.scope}</span>
              </li>
            ))}
          </ul>
        </nav>

        <main className="detail island agent-detail">
          <header className="agent-head">
            <h2>Can the agent decide anything?</h2>
            <p>
              No. Core refuses every confirm, approval, submission and send from the agent token, and writes the refusal
              to the audit trail. Try it.
            </p>
          </header>

          <section className="panel" aria-labelledby="ag-check">
            <h3 id="ag-check">Guardrail check</h3>
            <p className="agent-note">
              Asks the demo core, as the Safe Edge agent ({AGENT}), to confirm the first open candidate. No model runs:
              this is the same call a model would make through a tool. <span className="chip sample">Simulation</span>
            </p>
            <div className="agent-actions">
              <button className="btn primary" disabled={busy} onClick={() => void runCheck()}>
                {busy ? 'Asking core…' : 'Ask core as the agent'}
              </button>
            </div>
            <div aria-live="polite">
              {check?.kind === 'refused' && (
                <div className="state ok agent-result">
                  <ShieldCheck size={20} weight="bold" aria-hidden="true" />
                  <div>
                    <p>
                      {/* The ID only: a sample title is the AI's conclusion, which blind triage hides. */}
                      <b>Refused, as it must be.</b> The agent asked to confirm candidate {check.candidateId}.
                    </p>
                    <p>
                      Rule: <code>{check.rule}</code>
                    </p>
                    <p>Core said: &ldquo;{check.message}&rdquo;</p>
                  </div>
                </div>
              )}
              {check?.kind === 'nothing' && (
                <p className="state neutral">
                  No open candidate is left to try it on. Reset demo from the profile menu brings the sample cards back.
                </p>
              )}
            </div>
            {check?.kind === 'allowed' && (
              <p className="banner error" role="alert">
                <WarningCircle size={20} weight="bold" aria-hidden="true" />
                <span>
                  Core accepted a decision from the agent on {check.candidateId}. That breaks the rule that agents only
                  draft (S5): this is a bug. Reset demo and report it.
                </span>
              </p>
            )}
          </section>

          <section aria-labelledby="ag-activity">
            <h3 id="ag-activity">What the agent did this session</h3>
            <Activity read={activity} users={s.users} />
            {drafted.length > 0 && (
              <ul className="agent-log">
                {drafted.map((w) => (
                  <li key={w.id}>
                    <span>Drafted work order</span> <span className="plate">{w.id}</span>{' '}
                    <span className="chip">{w.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="ag-never">
            <h3 id="ag-never">What it can never do</h3>
            <p className="agent-note">
              Every change in the operations table that has no agent scope: {NEVER.length} of them. Core refuses each
              for the agent token with the rule agents_draft_only.
            </p>
            <div className="agent-table-wrap" tabIndex={0} role="region" aria-label="What the agent can never do">
              <table className="agent-table">
                <thead>
                  <tr>
                    <th scope="col">Operation</th>
                    <th scope="col">What it does</th>
                    <th scope="col">Who may</th>
                  </tr>
                </thead>
                <tbody>
                  {NEVER.map(([id, op]) => (
                    <tr key={id}>
                      <th scope="row">
                        <code>{id}</code>
                      </th>
                      <td>{op.summary}</td>
                      <td>{op.roles === 'any' ? 'Anyone signed in' : op.roles.join(', ') || 'No person'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section aria-labelledby="ag-instructions">
            <h3 id="ag-instructions">Its instructions</h3>
            <p className="agent-note">
              Given to the model as its system prompt or MCP server instructions, word for word.
            </p>
            <blockquote className="agent-quote">{agentInstructions}</blockquote>
          </section>
        </main>
      </div>
    </Screen>
  )
}

function Activity({ read, users }: { read: Read<AuditEvent[] | null>; users: User[] }) {
  if (read.error)
    return (
      <div className="banner error" role="alert">
        <WarningCircle size={20} weight="bold" aria-hidden="true" />
        <p>
          The audit trail could not be read: {read.error.message}. The check above still works.{' '}
          <button className="btn small" onClick={read.reload}>
            Try again
          </button>
        </p>
      </div>
    )
  if (read.data === null)
    return can('listAudit') ? (
      <div className="skeleton agent-skeleton" role="status">
        <span className="sr">Loading the audit trail</span>
        <i aria-hidden="true" />
      </div>
    ) : (
      <p className="banner info">
        <LockSimple size={20} weight="bold" aria-hidden="true" />
        <span>
          <b>The audit trail is for the park manager and the general manager.</b> {peopleWho('listAudit', users)} can
          read what the agent did.
        </span>
      </p>
    )
  if (read.data.length === 0)
    return (
      <div className="empty-state left">
        <span className="icon-tile">
          <Robot size={24} weight="bold" aria-hidden="true" />
        </span>
        <p>
          Nothing yet. The agent has not read, proposed or drafted anything in this session; its refused attempts show
          here too.
        </p>
      </div>
    )
  return (
    <ul className="agent-log">
      {read.data.map((a) => (
        <li key={a.id}>
          <span className="agent-time">{clock(a.at)}</span>
          <code>{a.action}</code>
          <span className="agent-subject">{a.subjectId}</span>
          <span className={`chip ${a.decision}`}>{a.decision === 'denied' ? `Refused · ${a.rule}` : 'Allowed'}</span>
        </li>
      ))}
    </ul>
  )
}
