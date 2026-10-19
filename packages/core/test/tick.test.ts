import { describe, expect, test } from 'bun:test'
import { EdgeEvent } from '@safe-edge/contracts'
import { verifyAuditChain } from '../src/index.ts'
import { S1, raiseOnS1, startCore } from './support.ts'

// Seeded passes around asOf (2026-10-20): S1's (pass_866518980_11) runs to 2027-04-15; pass_866518980_12 is valid to 2026-12-01;
// pass_866518980_5 is already expiring (to 2026-11-12); pass_866518980_6 has expired.
const SOON = 'pass_866518980_12'
const EXPIRING = 'pass_866518980_5'

/** `[type, passId, time]` of each event a tick returns, after checking it against the contract. */
const moves = (events: EdgeEvent[]) =>
  events.map((e) => {
    const { type, data, time } = EdgeEvent.parse(e)
    return [type, 'passId' in data ? data.passId : null, time]
  })

describe('PROOF-4: automation moves passes one way only', () => {
  test('tick moves a pass to expiring 30 days before validTo, then to expired at validTo', () => {
    const h = startCore()
    const state = (id: string) => h.call('getPass', 'usr_gm', { params: { id } }).data.state

    expect(h.core.tick('2026-11-01T01:59:59.000Z')).toEqual([])
    const expiring = h.core.tick('2026-11-01T02:00:00.000Z')
    expect(moves(expiring)).toEqual([['edge.pass.expiring.v1', SOON, '2026-11-01T02:00:00.000Z']])
    expect(state(SOON)).toBe('expiring')

    const expired = h.core.tick('2026-11-12T02:00:00.000Z')
    expect(moves(expired)).toEqual([['edge.pass.expired.v1', EXPIRING, '2026-11-12T02:00:00.000Z']])
    expect(state(EXPIRING)).toBe('expired')

    // A tick that jumps past validTo walks a valid pass through expiring to expired.
    const jump = h.core.tick('2027-04-15T02:00:00.000Z')
    const at = '2027-04-15T02:00:00.000Z'
    expect(moves(jump)).toEqual([
      ['edge.pass.expiring.v1', 'pass_866518980_11', at],
      ['edge.pass.expired.v1', 'pass_866518980_11', at],
      ['edge.pass.expired.v1', SOON, at]
    ])
    expect(h.call('listPasses', 'usr_gm', { query: { state: 'valid' } }).data).toEqual([])
  })

  test('every tick move is the system acting, never to valid, on the same audit chain', () => {
    const h = startCore()
    h.core.tick('2027-06-01T00:00:00.000Z')
    const ticked = h.audit().filter((e) => e.action === 'tick')
    expect(ticked.length).toBe(5)
    for (const e of ticked) {
      expect(e.actor).toEqual({ type: 'system', id: 'core.tick', role: 'system' })
      expect(['expiring', 'expired']).toContain((e.after as { state: string }).state)
    }
    expect(verifyAuditChain(h.audit()).ok).toBe(true)
  })

  test('a suspended pass stays suspended through expiry ticks: only a re-test brings it back', () => {
    const h = startCore()
    raiseOnS1(h, 'usr_drone_sim', {
      inventoryItemId: S1.inventoryItemId,
      itemStatus: 'missing',
      class: 'inventory_item',
      rationale: 'Fence panel 4 is missing'
    })
    h.core.tick('2027-06-01T00:00:00.000Z')
    expect(h.segment(S1.segmentId).pass!.state).toBe('suspended')
  })

  test('the board lists passes expiring within N days of now', () => {
    const h = startCore()
    const within = (days: number) =>
      h.call('listPasses', 'usr_agent', { query: { expiresWithinDays: days } }).data.map((p) => p.id)
    expect(within(30)).toEqual([EXPIRING])
    expect(within(60)).toEqual([EXPIRING, SOON])
  })
})
