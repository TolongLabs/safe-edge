// Claude for the agent tests, at the HTTP boundary of the Anthropic SDK. SAFE_EDGE_CLAUDE picks the mode:
// - `replay` (default, offline, no key): answers each request from a recording of real API responses, and fails when
//   the request differs from the recorded one, so a changed prompt, tool or tool result forces a re-record.
// - `record` (`bun run agent:record`): calls the real API with ANTHROPIC_API_KEY and writes the recording.
// - `live` (`bun run agent:live`): calls the real API and writes nothing.
import Anthropic from '@anthropic-ai/sdk'
import { VERSION } from '@anthropic-ai/sdk/version'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { AGENT_MODEL } from '../src/agent.ts'

const MODES = ['replay', 'record', 'live'] as const
type Mode = (typeof MODES)[number]
const mode = (process.env.SAFE_EDGE_CLAUDE ?? 'replay') as Mode
if (!MODES.includes(mode)) throw new Error(`SAFE_EDGE_CLAUDE must be one of ${MODES.join(', ')}, not ${mode}`)
export const claudeMode = mode

interface SentRequest {
  method: string
  /** Path and query, e.g. /v1/messages?beta=true */
  url: string
  beta: string | null
  body: Record<string, unknown>
}

interface Exchange {
  request: SentRequest
  response: { status: number; contentType: string | null; requestId: string | null; body: string }
}

interface Recording {
  label: { model: string; recordedOn: string; sdk: string; note: string }
  exchanges: Exchange[]
}

/**
 * A Claude client for one test scenario, plus every request body it sent (in all modes). With `holdAfterFirstText`,
 * each answer streams up to its first text delta and then stays open, as a slow model's would, until the request's
 * abort signal fires (`aborted` resolves with that request's index).
 */
export function claude(scenario: string, { holdAfterFirstText = false } = {}) {
  const file = join(import.meta.dir, 'fixtures/claude', `${scenario}.json`)
  const recording: Recording | undefined = mode === 'replay' ? JSON.parse(readFileSync(file, 'utf8')) : undefined
  if (recording && recording.label.model !== AGENT_MODEL) {
    throw new Error(`${file} was recorded with ${recording.label.model}, not ${AGENT_MODEL}; re-record it`)
  }
  const exchanges: Exchange[] = []
  const sent: SentRequest['body'][] = []
  const aborted = Promise.withResolvers<number>()

  /** The answer as the Anthropic SDK reads it: whole, or held open after its first text delta. */
  const respond = (index: number, body: string, init: ResponseInit, signal: AbortSignal | null | undefined) => {
    if (!holdAfterFirstText) return new Response(body, init)
    if (!signal) throw new Error('Expected the Anthropic SDK to send an abort signal')
    const firstText = body.indexOf('"text_delta"')
    if (firstText === -1) throw new Error(`${scenario}: response ${index + 1} streams no text to hold after`)
    const head = new TextEncoder().encode(body.slice(0, body.indexOf('\n\n', firstText) + 2))
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(head)
        const abort = () => {
          aborted.resolve(index)
          controller.error(signal.reason)
        }
        signal.addEventListener('abort', abort, { once: true })
      }
    })
    return new Response(stream, init)
  }

  const fetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    if (typeof init?.body !== 'string') throw new Error('Expected the Anthropic SDK to send a JSON string body')
    const url = new URL(input instanceof Request ? input.url : input)
    const request: SentRequest = {
      method: init.method ?? 'GET',
      url: url.pathname + url.search,
      beta: new Headers(init.headers).get('anthropic-beta'),
      body: JSON.parse(init.body)
    }
    sent.push(request.body)

    if (recording) {
      const index = exchanges.length
      const next = recording.exchanges[index]
      if (next === undefined) {
        throw new Error(`${scenario}: the recording has ${index} requests and this run sent more; ${RERECORD}`)
      }
      const difference = firstDifference(next.request, request, '$')
      if (difference) throw new Error(`${scenario}: request ${index + 1} differs from the recording at ${difference}`)
      exchanges.push(next)
      const headers = new Headers()
      if (next.response.contentType) headers.set('content-type', next.response.contentType)
      if (next.response.requestId) headers.set('request-id', next.response.requestId)
      return respond(index, next.response.body, { status: next.response.status, headers }, init.signal)
    }

    const response = await globalThis.fetch(input, init)
    if (mode === 'live' && !holdAfterFirstText) return response
    const body = await response.text()
    const contentType = response.headers.get('content-type')
    const requestId = response.headers.get('request-id')
    const index = exchanges.length
    exchanges.push({ request, response: { status: response.status, contentType, requestId, body } })
    const headers = new Headers()
    if (contentType) headers.set('content-type', contentType)
    if (requestId) headers.set('request-id', requestId)
    return respond(index, body, { status: response.status, headers }, init.signal)
  }

  return {
    client: new Anthropic({ ...(recording ? { apiKey: 'replay-needs-no-key', maxRetries: 0 } : {}), fetch }),
    sent,
    aborted: aborted.promise,
    /** Replay: every recorded request was made. Record: writes the recording. */
    async done() {
      if (recording && exchanges.length !== recording.exchanges.length) {
        throw new Error(
          `${scenario}: the recording has ${recording.exchanges.length} requests and this run sent ${exchanges.length}; ${RERECORD}`
        )
      }
      if (mode !== 'record') return
      const label = {
        model: AGENT_MODEL,
        recordedOn: new Date().toISOString().slice(0, 10),
        sdk: `@anthropic-ai/sdk ${VERSION}`,
        note: 'Real Claude API requests and responses, recorded by bun run agent:record and replayed by bun test.'
      }
      await Bun.write(file, `${JSON.stringify({ label, exchanges } satisfies Recording, null, 2)}\n`)
    }
  }
}

const RERECORD = 'the prompt, tools or tool results changed, so re-record with bun run agent:record'

/** The JSON path where two values first differ, with both values, or null when they are equal. */
function firstDifference(recorded: unknown, actual: unknown, path: string): string | null {
  if (typeof recorded === 'object' && recorded !== null && typeof actual === 'object' && actual !== null) {
    const keys = new Set([...Object.keys(recorded), ...Object.keys(actual)])
    for (const key of keys) {
      const found = firstDifference(
        (recorded as Record<string, unknown>)[key],
        (actual as Record<string, unknown>)[key],
        `${path}.${key}`
      )
      if (found) return found
    }
    return null
  }
  if (recorded === actual) return null
  const show = (value: unknown) => JSON.stringify(value)?.slice(0, 300)
  return `${path}: recorded ${show(recorded)}, sent ${show(actual)}; ${RERECORD}`
}

/** Where a text appears in the requests sent to Claude: instructions (system, user text) or tool results. */
export function placesOf(sent: SentRequest['body'][], text: string) {
  const places = new Set<'system' | 'user text' | 'tool result' | 'assistant'>()
  for (const body of sent) {
    if (JSON.stringify(body.system ?? '').includes(text)) places.add('system')
    for (const message of body.messages as { role: string; content: unknown }[]) {
      const blocks =
        typeof message.content === 'string'
          ? [{ type: 'text', text: message.content }]
          : (message.content as { type: string }[])
      for (const block of blocks) {
        if (!JSON.stringify(block).includes(text)) continue
        if (message.role === 'assistant') places.add('assistant')
        else places.add(block.type === 'tool_result' ? 'tool result' : 'user text')
      }
    }
  }
  return [...places].sort()
}
