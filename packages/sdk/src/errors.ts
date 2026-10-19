import type { ApiError, PolicyRule } from '@safe-edge/contracts'

/** A refused action (HTTP 403): `rule` names the policy rule that blocked it. Core has audited the refusal. */
export class SafeEdgeDeniedError extends Error {
  override readonly name = 'SafeEdgeDeniedError'
  readonly status = 403
  constructor(
    readonly rule: PolicyRule,
    message: string
  ) {
    super(message)
  }
}

/** Any other contract error (400 invalid input, 401, 404 not found, 422, 501). */
export class SafeEdgeApiError extends Error {
  override readonly name = 'SafeEdgeApiError'
  constructor(
    readonly status: number,
    readonly error: ApiError['error'],
    message: string
  ) {
    super(message)
  }
}
