import type { Notice } from '@safe-edge/contracts'
import { ok, type Handlers } from './handler.ts'

export const notices: Handlers<'draftNotice' | 'sendNotice'> = {
  draftNotice: (tx, { body }) => {
    const subject = body.subjectId === null ? null : tx.find(body.subjectId)
    if (subject === undefined) return tx.notFound(`No record ${body.subjectId}`)
    const notice: Notice = {
      id: tx.id('ntc'),
      ...body,
      status: 'draft',
      draftedBy: { type: tx.actor.type, id: tx.actor.id },
      // Policy, not input, picks the recipient: escalations and reports go to the township general manager.
      recipientUserId: tx.all('users').find((u) => u.role === 'gm')?.id ?? null,
      sentBy: null,
      sentAt: null,
      createdAt: tx.now,
      // A township-wide report is simulated when the township's segments are.
      simulated: subject === null ? tx.all('segments').some((s) => s.simulated) : subject.simulated,
      source: tx.source
    }
    tx.put('notices', notice)
    return ok(notice)
  },

  sendNotice: (tx, { params }) => {
    const notice = tx.get('notices', params.id)
    if (!notice) return tx.notFound(`No notice ${params.id}`)
    if (notice.status !== 'draft') return tx.deny('invalid_transition', `${notice.id} is already sent`, notice.id)
    if (notice.recipientUserId === null) {
      return tx.deny(
        'invalid_transition',
        `${notice.id} has no recipient: the township has no general manager`,
        notice.id
      )
    }
    const sent: Notice = { ...notice, status: 'sent', sentBy: tx.actor.id, sentAt: tx.now }
    tx.put('notices', sent)
    return ok(sent)
  }
}
