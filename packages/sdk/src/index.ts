import { createHttpClient, type HttpClient, type HttpOptions } from './http.ts'
import { createMemoryClient, type MemoryClient, type MemoryOptions } from './memory.ts'

export type { ApiOperationId, CallInput, CallOptions, MemoryOperationId, Methods, SafeEdgeClient } from './client.ts'
export { createElminaPlanner } from './elmina-planner.ts'
export { SafeEdgeApiError, SafeEdgeDeniedError } from './errors.ts'
export type { HttpClient, HttpOptions } from './http.ts'
export { elminaSeed, type MemoryClient, type MemoryOptions } from './memory.ts'

/**
 * A typed Safe Edge client with one method per operationId in the contracts' operations table.
 * `transport: 'memory'` runs core in the page on the labelled seed; `transport: 'http'` calls the v1 API.
 */
export function createSafeEdgeClient(options: MemoryOptions): MemoryClient
export function createSafeEdgeClient(options: HttpOptions): HttpClient
export function createSafeEdgeClient(options: MemoryOptions | HttpOptions): MemoryClient | HttpClient {
  return options.transport === 'memory' ? createMemoryClient(options) : createHttpClient(options)
}
