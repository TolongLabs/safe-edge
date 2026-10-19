import { ApiError, Denial, operations, type CoreOperationId, type OperationSpec } from '@safe-edge/contracts'
import {
  bindMethods,
  idsHandledBy,
  type ApiOperationId,
  type CallOptions,
  type Methods,
  type RawInput,
  type SafeEdgeClient
} from './client.ts'
import { SafeEdgeApiError, SafeEdgeDeniedError } from './errors.ts'

export interface HttpOptions {
  transport: 'http'
  /** The API's `/v1` base, e.g. `http://localhost:3000/v1`, or `/v1` on the same origin. */
  baseUrl: string
  /** Bearer token; the API maps it to an Actor. */
  token: string
  /** The fetch to call the API with; the global fetch when absent. The API's own agent passes its app's fetch. */
  fetch?: (url: string, init: RequestInit) => Promise<Response>
}

/** Every core operation, plus the HTTP-only ones that are not streamed (evidence, triage, webhooks). */
export type HttpClient = SafeEdgeClient & Methods<ApiOperationId>

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
    if (response.ok) return op.response.parse(await response.json())
    throw await failure(response, `${op.method.toUpperCase()} ${path}`)
  }
  const ids = [...idsHandledBy('core'), ...idsHandledBy('api')] as (CoreOperationId | ApiOperationId)[]
  return bindMethods(ids, call)
}

/** A 403 carries a Denial, any other error an ApiError (both from the contracts). Anything else fails loudly as is. */
async function failure(response: Response, request: string): Promise<Error> {
  const text = await response.text()
  if (!response.headers.get('content-type')?.includes('application/json')) {
    return new Error(`${request} returned ${response.status}: ${text}`)
  }
  const body: unknown = JSON.parse(text)
  if (response.status === 403) {
    const denial = Denial.parse(body)
    return new SafeEdgeDeniedError(denial.rule, denial.message)
  }
  const error = ApiError.parse(body)
  return new SafeEdgeApiError(response.status, error.error, error.message)
}
