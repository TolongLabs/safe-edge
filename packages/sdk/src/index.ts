import { createHttpClient, type HttpClient, type HttpOptions } from './http.ts'
import { createMemoryClient, type MemoryClient, type MemoryOptions } from './memory.ts'

export type { ApiOperationId, CallInput, CallOptions, MemoryOperationId, Methods, SafeEdgeClient } from './client.ts'
export { createElminaPlanner } from '@safe-edge/planner'
export { SafeEdgeApiError, SafeEdgeDeniedError } from './errors.ts'
export type { AgentStreamEvent, HttpClient, HttpOptions, HttpStreams, StreamOptions } from './http.ts'
export { elminaSeed, type MemoryClient, type MemoryOptions } from './memory.ts'
export {
  createScenarioPlayer,
  FLIGHT_STEP_MS,
  GROUND_PLAYBACK_RATE,
  GROUND_STEP_MS,
  type Played,
  type ScenarioPlayer,
  type ScenarioPlayerOptions
} from './player.ts'
export { Scenario, ScenarioEvent } from './scenario.ts'
export { elminaScenarios } from './scenarios.ts'

/**
 * A typed Safe Edge client with one method per operationId in the contracts' operations table.
 * `transport: 'memory'` runs core in the page on the labelled seed; `transport: 'http'` calls the v1 API.
 */
export function createSafeEdgeClient(options: MemoryOptions): MemoryClient
export function createSafeEdgeClient(options: HttpOptions): HttpClient
export function createSafeEdgeClient(options: MemoryOptions | HttpOptions): MemoryClient | HttpClient {
  return options.transport === 'memory' ? createMemoryClient(options) : createHttpClient(options)
}
