import { Key, Robot, WarningCircle } from '@phosphor-icons/react'
import type { SafeEdgeAgent } from '@safe-edge/agent-tools/claude'
import type { AgentStopped } from '@safe-edge/contracts'
import { useEffect, useRef, useState } from 'react'
import { anthropicFailure, demoAgent, isCancelled } from '../../agent'
import { useSettings } from '../../settings'
import './agent-run.css'

// Every screen that runs the agent in the page (Inbox summary, monthly report, Ask) uses this, so they share one way
// to need a key, run, stop, and fail.

/** What one run ended with when it gave nothing to show: Claude stopped, or Anthropic failed. Shown, never thrown. */
export type AgentProblem = { kind: 'stopped' | 'failed'; text: string }

export function useAgentRun() {
  const { anthropicKey } = useSettings()
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<AgentProblem | null>(null)
  const [fatal, setFatal] = useState<{ error: unknown } | null>(null)
  const abort = useRef<AbortController | null>(null)
  // A screen that closes mid-run (another card, Reset demo, another page) stops it: no more calls billed to the key.
  useEffect(() => () => abort.current?.abort(), [])
  if (fatal) throw fatal.error

  /**
   * Runs one workflow with the person's key. Resolves to its result, or to null when it stopped, failed or was
   * stopped by the person (then `problem` says why, except for a stop the person asked for). Any other error is a
   * bug and goes to the screen's error boundary.
   */
  async function run<T extends { ok: true }>(
    work: (agent: SafeEdgeAgent, signal: AbortSignal) => Promise<T | AgentStopped>
  ): Promise<T | null> {
    if (anthropicKey === null) throw new Error('The agent ran without a key: its button must be disabled')
    const controller = new AbortController()
    abort.current = controller
    setProblem(null)
    setBusy(true)
    try {
      const result = await work(await demoAgent(anthropicKey), controller.signal)
      if (result.ok) return result
      setProblem({ kind: 'stopped', text: `The agent stopped without a result: ${result.message}. Nothing was saved.` })
      return null
    } catch (error) {
      if (isCancelled(error)) return null
      const text = anthropicFailure(error)
      if (text === null) setFatal({ error })
      else setProblem({ kind: 'failed', text })
      return null
    } finally {
      abort.current = null
      setBusy(false)
    }
  }

  return {
    /** The person saved a key in Settings, so the agent can run. */
    ready: anthropicKey !== null,
    busy,
    problem,
    run,
    /** Stops the run in progress: aborts the request open to Claude. A draft the agent already saved stays. */
    stop: () => abort.current?.abort()
  }
}

/** The line under a disabled agent button: why it is disabled and where to fix it. */
export function NeedsKey({ id }: { id: string }) {
  return (
    <p id={id} className="agent-line">
      <Key size={16} weight="bold" aria-hidden="true" />
      <span>
        The agent runs in this page with your own Anthropic key. <a href="#/settings">Add it in Settings</a>.
      </span>
    </p>
  )
}

/** Why the last run gave nothing: an amber line when Claude stopped, a red one when Anthropic failed. */
export function AgentProblemLine({ problem }: { problem: AgentProblem }) {
  return (
    <p className={`state ${problem.kind === 'stopped' ? 'warn' : 'bad'} agent-problem`} role="alert">
      <WarningCircle size={20} weight="bold" aria-hidden="true" />
      <span>{problem.text}</span>
    </p>
  )
}

/** The label every agent-written text carries: it is an AI suggestion, not a decision, with the model and sources. */
export function AgentByline({ model, citations }: { model: string; citations: string[] }) {
  return (
    <p className="agent-byline">
      <Robot size={16} weight="bold" aria-hidden="true" />
      <span>
        <b>AI suggestion, unvalidated</b> · written by the agent with <span translate="no">{model}</span>
        {' · '}
        {citations.length > 0 ? (
          <>
            sources <span translate="no">{citations.join(', ')}</span>
          </>
        ) : (
          <b className="uncited">uncited: it names no record it read</b>
        )}
      </span>
    </p>
  )
}
