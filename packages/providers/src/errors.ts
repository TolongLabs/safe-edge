import type { DroneProviderKind } from '@safe-edge/contracts'

/** `dispatchPatrol` was called without an approval that matches the pilot approval recorded on the plan. */
export class ApprovalRequiredError extends Error {
  override name = 'ApprovalRequiredError'
}

/** `dispatchPatrol` was called too late for the flight to land before the plan's window closes. */
export class OutsideWindowError extends Error {
  override name = 'OutsideWindowError'
}

/** A typed stub's method: the adapter documents its vendor mapping but does not talk to the vendor yet. */
export class ProviderNotImplementedError extends Error {
  override name = 'ProviderNotImplementedError'

  readonly provider: DroneProviderKind
  readonly method: string

  constructor(provider: DroneProviderKind, method: string) {
    super(`${provider}.${method} is not implemented: the ${provider} adapter is a typed stub`)
    this.provider = provider
    this.method = method
  }
}
