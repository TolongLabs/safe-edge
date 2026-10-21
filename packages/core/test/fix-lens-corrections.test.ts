// Fix Lens corrections: a mis-marked opening, route or remedy is removed, and an engineer confirms the markings.
import { describe, expect, test } from 'bun:test'
import { playS1toRepair, S1, startCore, type Harness } from './support.ts'

/** A fence gap marked on S1's photo, as a manager does. */
const markGap = (h: Harness) =>
  h.call('createOpening', 'usr_manager', {
    body: {
      segmentId: S1.segmentId,
      type: 'fence_gap',
      photoMarks: [{ evidenceId: 'evd_s1_photo', x: 0.45, y: 0.6 }],
      measuredMm: 1200
    }
  }).data

/** A gate route through one opening, as a manager links it. */
const linkRoute = (h: Harness, openingId: string) =>
  h.call('createRoute', 'usr_manager', {
    body: {
      segmentId: S1.segmentId,
      fromFeature: { kind: 'gate', label: 'Gate' },
      openingIds: [openingId],
      status: 'open'
    }
  }).data

describe('correcting and confirming Fix Lens markings', () => {
  test('a mis-marked opening is deleted, and the route closure no longer lists it', () => {
    const h = startCore()
    const opening = markGap(h)
    const closureOpenings = () =>
      h
        .call('previewRouteClosure', 'usr_manager', { params: { id: S1.segmentId }, body: { remedyIds: [] } })
        .data.openings.map((o) => o.id)
    expect(closureOpenings()).toContain(opening.id)

    h.call('deleteOpening', 'usr_manager', { params: { id: opening.id } })

    expect(closureOpenings()).not.toContain(opening.id)
  })

  test('an opening a route uses cannot be deleted, and the refusal names the route', () => {
    const h = startCore()
    const opening = markGap(h)
    const route = linkRoute(h, opening.id)

    expect(h.attempt('deleteOpening', 'usr_manager', { params: { id: opening.id } })).toEqual({
      ok: false,
      rule: 'invalid_transition',
      message: expect.stringContaining(route.id)
    })
  })

  test('a route and a remedy that nothing uses are deleted', () => {
    const h = startCore()
    const opening = markGap(h)
    const route = linkRoute(h, opening.id)
    const remedy = h.call('createRemedy', 'usr_engineer', {
      body: {
        segmentId: S1.segmentId,
        type: 'panel_replacement',
        label: 'Replace panel 4',
        blocksOpeningIds: [opening.id],
        quantities: [{ item: 'Fence panel 2.4 m', amount: 1, unit: 'panel' }],
        acceptanceTest: 'No gap over 100 mm',
        quote: 'quote_needed'
      }
    }).data

    h.call('deleteRoute', 'usr_manager', { params: { id: route.id } })
    h.call('deleteRemedy', 'usr_engineer', { params: { id: remedy.id } })

    expect(h.attempt('deleteRoute', 'usr_manager', { params: { id: route.id } })).toMatchObject({
      ok: false,
      error: 'not_found'
    })
    expect(h.attempt('deleteRemedy', 'usr_engineer', { params: { id: remedy.id } })).toMatchObject({
      ok: false,
      error: 'not_found'
    })
  })

  test('an approved remedy cannot be deleted', () => {
    const h = startCore()
    const played = playS1toRepair(h)

    expect(h.attempt('deleteRemedy', 'usr_engineer', { params: { id: played.remedies.full.id } })).toEqual({
      ok: false,
      rule: 'invalid_transition',
      message: expect.stringContaining('approved')
    })
  })

  test('an engineer confirms an opening and a route, and a second confirmation is refused', () => {
    const h = startCore()
    const opening = markGap(h)
    const route = linkRoute(h, opening.id)

    expect(h.call('confirmOpening', 'usr_engineer', { params: { id: opening.id } }).data.engineerConfirmedBy).toBe(
      'usr_engineer'
    )
    expect(h.call('confirmRoute', 'usr_engineer', { params: { id: route.id } }).data.engineerConfirmedBy).toBe(
      'usr_engineer'
    )
    expect(h.attempt('confirmOpening', 'usr_engineer', { params: { id: opening.id } })).toMatchObject({
      ok: false,
      rule: 'invalid_transition'
    })
  })

  test('a manager cannot confirm an opening', () => {
    const h = startCore()
    const opening = markGap(h)

    expect(h.attempt('confirmOpening', 'usr_manager', { params: { id: opening.id } })).toMatchObject({
      ok: false,
      rule: 'role_forbidden'
    })
  })

  test('a confirmed opening cannot be deleted', () => {
    const h = startCore()
    const opening = markGap(h)
    h.call('confirmOpening', 'usr_engineer', { params: { id: opening.id } })

    expect(h.attempt('deleteOpening', 'usr_manager', { params: { id: opening.id } })).toMatchObject({
      ok: false,
      rule: 'invalid_transition'
    })
  })

  test('an opening blocked by an accepted re-test cannot be deleted', () => {
    const h = startCore()
    const played = playS1toRepair(h)
    h.call('recordRetest', 'usr_reviewer', { body: played.retest })
    const [gapId] = played.remedies.full.blocksOpeningIds

    expect(h.attempt('deleteOpening', 'usr_manager', { params: { id: gapId! } })).toEqual({
      ok: false,
      rule: 'invalid_transition',
      message: expect.stringContaining(gapId!)
    })
  })
})
