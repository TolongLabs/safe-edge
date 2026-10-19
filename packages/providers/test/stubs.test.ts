// The DJI Cloud API and MAVLink adapters are typed stubs: they implement the DroneProvider port, and every method
// refuses with a named error instead of pretending to fly.
import { describe, expect, test } from 'bun:test'
import type { DroneProvider, HumanApproval, PatrolPlan } from '@safe-edge/contracts'
import { DjiCloudDroneProvider, MavlinkDroneProvider, ProviderNotImplementedError } from '../src/index.ts'

const approval: HumanApproval = { planId: 'plan_1', approvedBy: 'usr_pilot', approvedAt: '2026-10-21T22:00:00.000Z' }
const calls: Record<keyof DroneProvider, (p: DroneProvider) => unknown> = {
  listDevices: (p) => p.listDevices(),
  getStatus: (p) => p.getStatus('dock-3-aircraft'),
  schedulePatrol: (p) => p.schedulePatrol({ id: 'plan_1' } as PatrolPlan),
  dispatchPatrol: (p) => p.dispatchPatrol('run_1', approval),
  cancelPatrol: (p) => p.cancelPatrol('run_1'),
  onEvent: (p) => p.onEvent(() => {})
}

describe.each([
  ['dji_cloud', new DjiCloudDroneProvider()],
  ['mavlink', new MavlinkDroneProvider()]
] as const)('%s is a typed stub', (provider, adapter) => {
  test.each(Object.entries(calls))('%s throws ProviderNotImplementedError', (method, call) => {
    let thrown: unknown
    try {
      call(adapter)
    } catch (error) {
      thrown = error
    }
    expect(thrown).toBeInstanceOf(ProviderNotImplementedError)
    expect(thrown).toMatchObject({ name: 'ProviderNotImplementedError', provider, method })
  })
})
