import {
  AgentAnswer,
  AgentDelta,
  AgentStopped,
  EdgeEvent,
  operations,
  type AskAgentRequest,
  type CoreOperationId,
  type OperationSpec
} from '@safe-edge/contracts'
import * as z from 'zod'
import {
  bindMethods,
  idsHandledBy,
  type ApiOperationId,
  type CallOptions,
  type Methods,
  type RawInput,
  type SafeEdgeClient
} from './client.ts'
import { errorFor, SafeEdgeHttpError } from './errors.ts'
import { readServerSentEvents, type ServerSentEvent } from './sse.ts'

export interface HttpOptions {
  transport: 'http'
  /** The API's `/v1` base, e.g. `http://localhost:3000/v1`, or `/v1` on the same origin. */
  baseUrl: string
  /** Bearer token; the API maps it to an Actor. */
  token: string
  /** The fetch to call the API with; the global fetch when absent. The API's own agent passes its app's fetch. */
  fetch?: (url: string, init: RequestInit) => Promise<Response>
}

/** A server-sent event of `askAgent`: text as the agent writes it, then its answer, or why it stopped without one. */
export type AgentStreamEvent =
  | { event: 'delta'; data: AgentDelta }
  | { event: 'answer'; data: AgentAnswer }
  | { event: 'stopped'; data: AgentStopped }

export interface StreamOptions {
  /** Aborting it hangs up, as leaving the `for await` loop early does. */
  signal?: AbortSignal
}

/** The streamed operations. Each resolves once the API accepted the request (an error throws then), then yields. */
export interface HttpStreams {
  /**
   * `POST /agent/ask`: `delta` text, then one `answer` (citing record IDs) or one `stopped` (`AgentStopped`). Hanging
   * up cancels the agent's Claude run. An `error` event (the run failed) throws.
   */
  askAgent(input: { body: AskAgentRequest }, options?: StreamOptions): Promise<AsyncIterable<AgentStreamEvent>>
  /** `GET /events`: resolves once this client is subscribed, so act after awaiting it; yields every CloudEvent. */
  streamEvents(options?: StreamOptions): Promise<AsyncIterable<EdgeEvent>>
}

/** Every core operation, the HTTP-only ones that are not streamed (evidence, triage, webhooks), and the streams. */
export type HttpClient = SafeEdgeClient & Methods<ApiOperationId> & HttpStreams

const AgentError = z.object({ message: z.string() })

export function createHttpClient({ baseUrl, token, fetch = globalThis.fetch }: HttpOptions): HttpClient {
  const call = async (operationId: CoreOperationId | ApiOperationId, input: RawInput, options: CallOptions) => {
    const op: OperationSpec = operations[operationId]
    const path = op.path.replace(/\{(\w+)\}/g, (_, name: string) => encodeURIComponent(String(input.params?.[name])))
    const query = new URLSearchParams()
    for (const [key, value] of Object.entries(input.query ?? {})) if (value !== undefined) query.set(key, String(value))
    const headers: Record<string, string> = { authorization: `Bearer ${token}` }
    if (op.method !== 'get') headers['idempotency-key'] = options.idempotencyKey ?? crypto.randomUUID()
    if (op.body) headers['content-type'] = 'application/json'

    const response = await fetch(`${baseUrl}${path}${query.size > 0 ? `?${query}` : ''}`, {
      method: op.method.toUpperCase(),
      headers,
      body: op.body ? JSON.stringify(input.body) : undefined
    })
    const request = `${op.method.toUpperCase()} ${path}`
    if (!response.ok) throw await failure(response, request)
    if (!isJson(response))
      throw new SafeEdgeHttpError(
        response.status,
        `${request} answered ${response.status} with ${response.headers.get('content-type') ?? 'no content type'}, not JSON`
      )
    return op.response.parse(await response.json())
  }
  const ids = [...idsHandledBy('core'), ...idsHandledBy('api')] as (CoreOperationId | ApiOperationId)[]

  const open = async <T>(
    operationId: 'askAgent' | 'streamEvents',
    body: unknown,
    signal: AbortSignal | undefined,
    parse: (event: ServerSentEvent) => T
  ): Promise<AsyncIterable<T>> => {
    const op: OperationSpec = operations[operationId]
    const request = `${op.method.toUpperCase()} ${op.path}`
    // Its own signal too, so a caller that leaves the loop early hangs up.
    const hangUp = new AbortController()
    const headers: Record<string, string> = { authorization: `Bearer ${token}`, accept: 'text/event-stream' }
    if (op.body) headers['content-type'] = 'application/json'
    const response = await fetch(`${baseUrl}${op.path}`, {
      method: op.method.toUpperCase(),
      headers,
      body: op.body ? JSON.stringify(body) : undefined,
      signal: signal ? AbortSignal.any([signal, hangUp.signal]) : hangUp.signal
    })
    if (!response.ok) throw await failure(response, request)
    const stream = response.body
    if (!response.headers.get('content-type')?.startsWith('text/event-stream') || stream === null) {
      throw new Error(`${request} answered ${response.status} without an event stream`)
    }
    return (async function* () {
      try {
        for await (const event of readServerSentEvents(stream)) yield parse(event)
      } finally {
        hangUp.abort()
      }
    })()
  }

  return {
    ...bindMethods(ids, call),
    askAgent: ({ body }, { signal } = {}) =>
      open('askAgent', body, signal, ({ event, data }): AgentStreamEvent => {
        const json: unknown = JSON.parse(data)
        if (event === 'delta') return { event, data: AgentDelta.parse(json) }
        if (event === 'answer') return { event, data: AgentAnswer.parse(json) }
        if (event === 'stopped') return { event, data: AgentStopped.parse(json) }
        if (event === 'error') throw new Error(`POST /agent/ask failed: ${AgentError.parse(json).message}`)
        throw new Error(`POST /agent/ask sent an unknown event ${event}`)
      }),
    streamEvents: ({ signal } = {}) =>
      open('streamEvents', undefined, signal, ({ data }) => EdgeEvent.parse(JSON.parse(data)))
  }
}

const isJson = (response: Response) => response.headers.get('content-type')?.includes('application/json') ?? false

/** A 403 carries a Denial, any other error an ApiError (both from the contracts). Anything else fails loudly as is. */
async function failure(response: Response, request: string): Promise<Error> {
  const text = await response.text()
  if (!isJson(response))
    return new SafeEdgeHttpError(response.status, `${request} returned ${response.status}: ${text}`)
  return errorFor(response.status, JSON.parse(text))
}
