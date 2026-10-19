import type { Opening, Remedy, Route, Segment } from '@safe-edge/contracts'
import { routeStatus } from '../policy.ts'
import type { Tx } from '../store.ts'
import { ok, type Handlers } from './handler.ts'

type FixLensOperation = 'createOpening' | 'createRoute' | 'createRemedy' | 'approveRemedy' | 'previewRouteClosure'

/** The segment's openings by ID, or the first ID that is not one of them. */
function openingsOn(tx: Tx, segment: Segment, ids: string[]): Opening[] | string {
  const openings: Opening[] = []
  for (const id of ids) {
    const opening = tx.get('openings', id)
    if (opening?.segmentId !== segment.id) return id
    openings.push(opening)
  }
  return openings
}

export const blockedOpenings = (tx: Tx, segmentId: string) =>
  new Set(
    tx
      .all('openings')
      .filter((o) => o.segmentId === segmentId && o.status === 'blocked')
      .map((o) => o.id)
  )

export const fixLens: Handlers<FixLensOperation> = {
  createOpening: (tx, { body }) => {
    const segment = tx.get('segments', body.segmentId)
    if (!segment) return tx.notFound(`No segment ${body.segmentId}`)
    const opening: Opening = {
      id: tx.id('opn'),
      ...body,
      status: 'open',
      simulated: segment.simulated,
      source: tx.source
    }
    tx.put('openings', opening)
    return ok(opening)
  },

  createRoute: (tx, { body }) => {
    const segment = tx.get('segments', body.segmentId)
    if (!segment) return tx.notFound(`No segment ${body.segmentId}`)
    const openings = openingsOn(tx, segment, body.openingIds)
    if (typeof openings === 'string') return tx.notFound(`No opening ${openings} on ${segment.id}`)
    const route: Route = {
      id: tx.id('rte'),
      ...body,
      status: routeStatus(body, blockedOpenings(tx, segment.id)),
      simulated: segment.simulated,
      source: tx.source
    }
    tx.put('routes', route)
    return ok(route)
  },

  createRemedy: (tx, { body }) => {
    const segment = tx.get('segments', body.segmentId)
    if (!segment) return tx.notFound(`No segment ${body.segmentId}`)
    const openings = openingsOn(tx, segment, body.blocksOpeningIds)
    if (typeof openings === 'string') return tx.notFound(`No opening ${openings} on ${segment.id}`)
    const remedy: Remedy = {
      id: tx.id('rem'),
      ...body,
      engineerApprovedBy: null,
      simulated: segment.simulated,
      source: tx.source
    }
    tx.put('remedies', remedy)
    return ok(remedy)
  },

  approveRemedy: (tx, { params }) => {
    const remedy = tx.get('remedies', params.id)
    if (!remedy) return tx.notFound(`No remedy ${params.id}`)
    if (remedy.engineerApprovedBy !== null) {
      return tx.deny(
        'invalid_transition',
        `${remedy.id} is already approved by ${remedy.engineerApprovedBy}`,
        remedy.id
      )
    }
    const approved: Remedy = { ...remedy, engineerApprovedBy: tx.actor.id }
    tx.put('remedies', approved)
    return ok(approved)
  },

  previewRouteClosure: (tx, { params, body }) => {
    const segment = tx.get('segments', params.id)
    if (!segment) return tx.notFound(`No segment ${params.id}`)
    const remedies: Remedy[] = []
    for (const id of body.remedyIds) {
      const remedy = tx.get('remedies', id)
      if (remedy?.segmentId !== segment.id) return tx.notFound(`No remedy ${id} on ${segment.id}`)
      remedies.push(remedy)
    }
    const blocked = blockedOpenings(tx, segment.id)
    for (const remedy of remedies) for (const id of remedy.blocksOpeningIds) blocked.add(id)
    return ok({
      segmentId: segment.id,
      remedyIds: body.remedyIds,
      openings: tx.all('openings').filter((o) => o.segmentId === segment.id),
      remedies,
      routes: tx
        .all('routes')
        .filter((r) => r.segmentId === segment.id)
        .map((r) => ({ ...r, projectedStatus: routeStatus(r, blocked) }))
    })
  }
}
