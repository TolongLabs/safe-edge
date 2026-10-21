import type Anthropic from '@anthropic-ai/sdk'
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod'
import { ToolError } from '@anthropic-ai/sdk/lib/tools/ToolError'
import { transformJSONSchema } from '@anthropic-ai/sdk/lib/transform-json-schema'
import type { BetaMessage } from '@anthropic-ai/sdk/resources/beta/messages'
import {
  agentInstructions,
  agentTools,
  apiRefusal,
  monthlyReportPrompt,
  toolDescription,
  type AgentToolContext
} from './index.ts'
import {
  ID_PREFIXES,
  WorkOrder,
  type AgentAnswer,
  type AgentFallback,
  type AgentStopped,
  type Candidate,
  type Finding,
  type InboxDraft,
  type MonthlyReportDraft,
  Notice
} from '@safe-edge/contracts'

// The one Claude agent of the TRD "Agent layer and MCP server": the tool runner over the same tools the MCP server
// serves (index.ts), calling Safe Edge through a client that holds the agent's own token. The API (or the demo core in
// the browser), not this module, enforces scope and state, so a refused call comes back to the model as a tool error
// naming the rule. It runs in the API with the server's key and in the web demo with the person's own key.

export const AGENT_MODEL = 'claude-opus-5-5'
const MAX_TURNS = 10

const SYSTEM = [
  'You are the Safe Edge agent. Managers and the township general manager ask you about water-edge segments, their passes, findings and repair work, and ask you to draft paperwork.',
  agentInstructions,
  'Answer only from tool results in this conversation. Name every record ID you rely on inline, exactly as a tool returned it (for example pass_866518980_5); an answer that names no record ID is shown to people as uncited. If the tools return nothing relevant, say so and say what you checked.',
  'Write plain text for a small screen: short sentences, short lists at most, no tables or headings.'
].join('\n\n')

/** One successful tool call, kept for the citation check and for checking that a draft was made. */
interface ToolCall {
  name: string
  output: Record<string, unknown>
}

type Finished = { ok: true; text: string; calls: ToolCall[]; model: string; fallbacks: AgentFallback[] } | AgentStopped

export interface AgentOptions {
  claude: Anthropic
  /** Tool context: a client holding the agent's token, and the API clock. The served model comes from each run. */
  context: Omit<AgentToolContext, 'model'>
}

/** The agent's three workflows: the Ask panel, the Inbox card and the monthly report. */
export interface SafeEdgeAgent {
  ask(
    question: string,
    onText: (text: string) => Promise<void>,
    signal: AbortSignal
  ): Promise<{ ok: true; answer: AgentAnswer } | AgentStopped>
  draftInbox(candidate: Candidate, finding: Finding | null): Promise<{ ok: true; draft: InboxDraft } | AgentStopped>
  draftMonthlyReport(month: string): Promise<{ ok: true; report: MonthlyReportDraft } | AgentStopped>
}

export function createAgent({ claude, context }: AgentOptions): SafeEdgeAgent {
  /**
   * Runs the tool loop on one user turn, streaming text to `onText`, and checks how Claude stopped. Aborting `signal`
   * aborts the request open to Claude and ends the loop with the SDK's `APIUserAbortError`.
   */
  async function run(
    prompt: string,
    effort: 'medium' | 'high',
    onText: (text: string) => Promise<void> = async () => {},
    signal?: AbortSignal
  ): Promise<Finished> {
    const calls: ToolCall[] = []
    // The model the API reports serving the turn whose tool calls run next (after any fallback). The runner runs a
    // turn's tools only after this loop's body has read that turn's final message.
    let served: string | undefined
    const model = () => {
      if (served === undefined) throw new Error('A tool ran before Claude answered')
      return served
    }
    const runner = claude.beta.messages.toolRunner(
      {
        model: AGENT_MODEL,
        max_tokens: 64_000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort },
        tool_choice: { type: 'auto' },
        // The system prompt (with the tools before it) is the shared prefix; the automatic breakpoint caches the
        // growing tool loop.
        system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
        cache_control: { type: 'ephemeral' },
        tools: claudeTools({ ...context, model }, calls),
        messages: [{ role: 'user', content: prompt }],
        max_iterations: MAX_TURNS,
        stream: true
      },
      { signal }
    )
    const fallbacks: AgentFallback[] = []
    let last: BetaMessage | undefined
    for await (const stream of runner) {
      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') await onText(event.delta.text)
      }
      last = await stream.finalMessage()
      served = last.model
      for (const block of last.content) {
        if (block.type === 'fallback') fallbacks.push({ from: block.from.model, to: block.to.model })
      }
    }
    if (last === undefined) throw new Error('The tool runner finished without a message')
    // The runner stops by itself on refusal and max_tokens, before running that turn's tools. Anything but a
    // finished turn is reported, never passed off as an answer.
    if (last.stop_reason !== 'end_turn') {
      const result = stopped(last)
      console.error('safe-edge agent: stopped without an answer', result)
      return result
    }
    const text = last.content.flatMap((block) => (block.type === 'text' ? [block.text] : [])).join('')
    return { ok: true, text, calls, model: last.model, fallbacks }
  }

  return {
    /** The Ask panel: answers a person's question, streaming text as it is written, until `signal` aborts. */
    async ask(
      question: string,
      onText: (text: string) => Promise<void>,
      signal: AbortSignal
    ): Promise<{ ok: true; answer: AgentAnswer } | AgentStopped> {
      const result = await run(question, 'medium', onText, signal)
      if (!result.ok) return result
      return { ok: true, answer: { answer: result.text, ...provenance(result.text, result) } }
    },

    /**
     * The Inbox: a summary of the candidate, stored on it for its card, and once it is a finding, its work order draft
     * (the open draft confirming made, which the draft request returns). Only IDs of stored records go into the prompt;
     * the evidence text reaches Claude inside tool results.
     */
    async draftInbox(
      candidate: Candidate,
      finding: Finding | null
    ): Promise<{ ok: true; draft: InboxDraft } | AgentStopped> {
      const prompt = [
        `Prepare the Inbox card for candidate ${candidate.id} on segment ${candidate.segmentId}.`,
        '1. Read the candidate with get_inspection_evidence and the segment with get_edge_context.',
        finding === null
          ? `2. The candidate is ${candidate.status} and not a finding, so draft nothing.`
          : `2. Call draft_work_order once for finding ${finding.id}, with remedyId null (an engineer picks the remedy later) and notes that say what to repair and where, naming the record IDs. A person edits and submits it.`,
        `3. Reply with only the card summary, at most four sentences: what changed and where, the tier, your uncertainty, and the record IDs it rests on, including ${candidate.id} and ${candidate.segmentId}.`
      ].join('\n')
      const result = await run(prompt, 'medium')
      if (!result.ok) return result
      // Distinct work orders: a repeated draft request returns the finding's same open draft.
      const returned = result.calls
        .filter((call) => call.name === 'draft_work_order')
        .map((call) => WorkOrder.parse(call.output.workOrder))
      const drafts = [...new Map(returned.map((workOrder) => [workOrder.id, workOrder])).values()]
      const draftedFor = drafts.map((workOrder) => workOrder.findingId)
      const expected = finding === null ? [] : [finding.id]
      if (draftedFor.join() !== expected.join()) {
        return incomplete(
          result,
          `The agent drafted work orders for [${draftedFor.join(', ')}]; expected [${expected.join(', ')}]`
        )
      }
      const draft = {
        candidateId: candidate.id,
        findingId: finding?.id ?? null,
        summary: result.text,
        workOrder: drafts[0] ?? null,
        ...provenance(result.text, result)
      }
      // Stored with the agent's token, so the card reads it as the agent's, with the model the API reported. A decided
      // candidate keeps the summary its decision was made on (core refuses a new one).
      if (candidate.status === 'candidate') {
        await context.client.recordAgentSummary({
          params: { id: candidate.id },
          body: { text: draft.summary, citations: draft.citations, model: draft.model }
        })
      }
      return { ok: true, draft }
    },

    /** The board's monthly governance report, saved as a notice draft; `month` is a checked YYYY-MM. */
    async draftMonthlyReport(month: string): Promise<{ ok: true; report: MonthlyReportDraft } | AgentStopped> {
      const result = await run(monthlyReportPrompt(month), 'high')
      if (!result.ok) return result
      const reports = result.calls
        .filter((call) => call.name === 'draft_escalation')
        .map((call) => Notice.parse(call.output.notice))
        .filter((notice) => notice.kind === 'monthly_report')
      if (reports.length !== 1) {
        return incomplete(result, `The agent saved ${reports.length} monthly reports for ${month}; expected 1`)
      }
      const notice = reports[0]!
      return { ok: true, report: { month, notice, ...provenance(notice.body, result) } }
    }
  }
}

/** A finished turn that skipped what the workflow asked for: reported like any other stop, never passed off. */
function incomplete(result: { model: string }, message: string): AgentStopped {
  const stopped: AgentStopped = {
    ok: false,
    error: 'agent_stopped',
    message,
    stopReason: 'end_turn',
    category: null,
    model: result.model
  }
  console.error('safe-edge agent: stopped without the draft', stopped)
  return stopped
}

/**
 * The shared agent tools as strict tool-runner tools. A Safe Edge refusal becomes a tool error naming the rule, as in
 * the MCP server; anything else is logged and left to the runner, which reports it to the model as an error.
 */
function claudeTools(context: AgentToolContext, calls: ToolCall[]) {
  return agentTools.map((tool) => {
    const runnable = betaZodTool({
      name: tool.name,
      description: toolDescription(tool),
      inputSchema: tool.input,
      run: async (input) => {
        try {
          const output = await tool.run(context, input)
          calls.push({ name: tool.name, output })
          return JSON.stringify(output)
        } catch (error) {
          const refusal = apiRefusal(error)
          if (refusal !== null) throw new ToolError(refusal)
          console.error(`safe-edge agent: ${tool.name} failed`, error)
          throw error
        }
      }
    })
    // Strict tools take a subset of JSON Schema (no minimum or maximum on integers). The SDK's transform, the one its
    // structured outputs use, moves the rest into descriptions; the runner still parses every input with Zod.
    if (!('input_schema' in runnable)) throw new Error(`betaZodTool gave ${tool.name} no input schema`)
    const { $schema, ...schema } = runnable.input_schema
    return { ...runnable, input_schema: transformJSONSchema(schema) as typeof runnable.input_schema, strict: true }
  })
}

function stopped(message: BetaMessage): AgentStopped {
  const reason = message.stop_reason ?? 'none'
  const refusal = message.stop_reason === 'refusal' ? message.stop_details : null
  const text =
    refusal !== null
      ? `Claude declined (${refusal.category ?? 'no category'}): ${refusal.explanation ?? 'no explanation'}`
      : reason === 'tool_use'
        ? `The agent used all ${MAX_TURNS} turns without finishing`
        : `The agent stopped before finishing (stop_reason ${reason})`
  return {
    ok: false,
    error: 'agent_stopped',
    message: text,
    stopReason: reason,
    category: refusal?.category ?? null,
    model: message.model
  }
}

const RECORD_ID = new RegExp(`(?<![A-Za-z0-9_])(?:${Object.values(ID_PREFIXES).join('|')})_[A-Za-z0-9_]+`, 'g')

/** Every string in a tool output that is a whole record ID. Free text (rationales, notes) is not a source. */
function recordIds(value: unknown, into: Set<string>): Set<string> {
  if (typeof value === 'string') {
    if ([...value.matchAll(RECORD_ID)].some((match) => match[0] === value)) into.add(value)
  } else if (Array.isArray(value)) value.forEach((item) => recordIds(item, into))
  else if (typeof value === 'object' && value !== null) Object.values(value).forEach((item) => recordIds(item, into))
  return into
}

/** The record IDs the text names that tool results returned. Text that names none is uncited. */
function provenance(
  text: string,
  { calls, model, fallbacks }: { calls: ToolCall[]; model: string; fallbacks: AgentFallback[] }
) {
  const returned = recordIds(
    calls.map((call) => call.output),
    new Set()
  )
  const citations = [...new Set([...text.matchAll(RECORD_ID)].map((match) => match[0]))].filter((id) =>
    returned.has(id)
  )
  return { citations, uncited: citations.length === 0, model, fallbacks }
}
